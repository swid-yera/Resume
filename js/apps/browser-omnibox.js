// Pure parsing for the browser address bar. No DOM here so it stays testable.

// Ролик лежит под четырьмя разными путями: обычный watch, короткая ссылка,
// готовый embed, Shorts и трансляция. Идентификатор во всех один и тот же.
const YT_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]+)/i;

const YT_LIST_RE = /[?&]list=([A-Za-z0-9_-]+)/i;
// Момент старта пишут и как t=90, и как t=1m30s - берём только целые секунды,
// на остальных формах плеер всё равно начнёт с начала.
const YT_TIME_RE = /[?&](?:t|start)=(\d+)s?(?:&|$)/i;

export function youtubeId(input) {
  const m = String(input).match(YT_RE);
  return m ? m[1] : null;
}

export function youtubePlaylistId(input) {
  const m = String(input).match(YT_LIST_RE);
  return m ? m[1] : null;
}

// Плеер для ролика, для плейлиста или для ролика внутри плейлиста. Без
// enablejsapi плеер не отвечает на postMessage, и мини-плеер им не управляет.
function youtubeIntent(raw, videoId, playlistId) {
  const start = raw.match(YT_TIME_RE)?.[1];
  const params = new URLSearchParams({ enablejsapi: "1" });
  if (playlistId) params.set("list", playlistId);
  if (videoId && start) params.set("start", start);
  const query = params.toString();
  const path = videoId ? videoId : "videoseries";
  return {
    kind: "youtube",
    videoId: videoId ?? null,
    playlistId: playlistId ?? null,
    embedUrl:
      "https://www.youtube-nocookie.com/embed/" + path + (query ? "?" + query : ""),
  };
}

// A bare host like "example.com" — a dotted token, no spaces, no scheme.
const BARE_HOST_RE = /^[^\s./\\]+(\.[^\s./\\]+)+(\/\S*)?$/;

// "C:\Users", "c:/users" — a drive-qualified path typed without a scheme.
const BARE_PATH_RE = /^[A-Za-z]:([\\/]|$)/;

const THIS_PC = "This PC";

// file:///C:/Users/... → C:\Users\...
function toWindowsPath(input) {
  const path = String(input).replace(/\//g, "\\").replace(/^\\(?=[A-Za-z]:)/, "");
  return path === "\\" || path === "" ? THIS_PC : path;
}

export function parseOmnibox(input) {
  const raw = String(input).trim();
  if (!raw) return { kind: "empty" };

  // Внутренних страниц у нас одна, так что любой about: ведёт на старт -
  // это ближе к ожиданию, чем поиск по ФС со словом «about:blank».
  if (/^about:/i.test(raw)) return { kind: "home" };

  if (/^file:\/\//i.test(raw)) {
    return { kind: "file", path: toWindowsPath(raw.slice("file://".length)) };
  }

  if (BARE_PATH_RE.test(raw) || raw.toLowerCase() === THIS_PC.toLowerCase()) {
    return { kind: "file", path: toWindowsPath(raw) };
  }

  const id = youtubeId(raw);
  // Плейлист без ролика встраивается только со страницы playlist: на выдаче
  // поиска и на канале параметра list нет, и подставлять там нечего.
  const list = /youtube\.com\/playlist/i.test(raw) ? youtubePlaylistId(raw) : null;
  if (id || list) return youtubeIntent(raw, id, id ? youtubePlaylistId(raw) : list);

  if (/^https?:\/\//i.test(raw)) {
    return { kind: "web", url: raw };
  }

  if (BARE_HOST_RE.test(raw)) {
    return { kind: "web", url: "https://" + raw };
  }

  return { kind: "search", query: raw };
}

export function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return String(url);
  }
}

// Запрет на встраивание живёт в заголовке ответа, а из JS его не достать:
// заблокированный фрейм грузит страницу ошибки самого браузера и одинаково
// молчит и при успехе, и при отказе. Поэтому список ведём руками - лучше
// показать честную заглушку на десятке ходовых сайтов, чем гадать на всех.
const REFUSE_EMBEDDING = [
  "github.com",
  "google.com",
  "youtube.com",
  "x.com",
  "twitter.com",
  "instagram.com",
  "facebook.com",
  "linkedin.com",
  "reddit.com",
  "stackoverflow.com",
  "t.me",
  "chatgpt.com",
  "claude.ai",
];

export function refusesEmbedding(url) {
  const host = hostOf(url);
  return REFUSE_EMBEDDING.some((h) => host === h || host.endsWith("." + h));
}

// Отказ встраивания не всегда тупик: у ютуба закрыта страница, но открыт плеер,
// а профиль с гитхаба этот рабочий стол рисует сам. Где выход есть - называем его.
export function embedHint(url) {
  const host = hostOf(url);
  if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") {
    return "Videos do play here: paste a link to a video, a Shorts or a playlist.";
  }
  if (host === "github.com" || host.endsWith(".github.com")) {
    return "The GitHub app on this desktop shows the same profile, avatar and README.";
  }
  return null;
}

// Отказ плеера виден только по коду IFrame API: 100 - ролика больше нет, 101 и
// 150 - его не пускают за пределы ютуба. Непубличный плейлист приходит тем же
// 150-м, поэтому про него говорим отдельно - иначе совет «откройте на ютубе»
// звучит как отписка.
const PLAYER_ERRORS = {
  2: "The link does not name anything the player can open.",
  5: "The player could not start this one.",
  100: "The video is gone: removed, or made private by its owner.",
  101: "The owner does not allow this video to play outside YouTube.",
  150: "The owner does not allow this video to play outside YouTube.",
};

const PLAYLIST_REFUSED =
  "An embedded player takes public playlists only: an unlisted one plays on YouTube itself, "
  + "though its videos still open here one by one.";

export function playerErrorText(code, hasPlaylist = false) {
  if (hasPlaylist && (code === 100 || code === 101 || code === 150)) return PLAYLIST_REFUSED;
  return PLAYER_ERRORS[code] ?? "YouTube refused to play this one.";
}

// Адрес для настоящей вкладки браузера. У файлов и поиска по нашей ФС
// внешнего адреса нет: снаружи такой страницы не существует.
export function externalUrl(intent) {
  if (!intent) return null;
  if (intent.kind === "web") return intent.url;
  if (intent.kind === "youtube") {
    if (!intent.videoId) return "https://www.youtube.com/playlist?list=" + intent.playlistId;
    const list = intent.playlistId ? "&list=" + intent.playlistId : "";
    return "https://www.youtube.com/watch?v=" + intent.videoId + list;
  }
  return null;
}
