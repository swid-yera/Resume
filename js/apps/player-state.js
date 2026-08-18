// Состояние проигрывания в том виде, в каком его показывает окно плеера: снимок
// снимается с YT.Player, но сам модуль о нём ничего не знает - ему достаточно
// объекта с методами. Ни DOM, ни ютуба здесь нет, поэтому всё проверяется
// на node --test.

// Коды состояния из IFrame API: -1 не начат, 0 конец, 1 играет, 2 пауза,
// 3 буферизация, 5 в очереди.
const PLAYING_STATES = new Set([1, 3]);

export function emptyState() {
  return {
    videoId: null,
    title: "",
    author: "",
    currentTime: 0,
    duration: 0,
    volume: 100,
    muted: false,
    playerState: -1,
    playlistLength: 0,
  };
}

export function isPlaying(state) {
  return PLAYING_STATES.has(state.playerState);
}

export function hasVideo(state) {
  return Boolean(state.videoId);
}

// Единственный размер, который есть у любого ролика: 320×180 и без чёрных полей,
// в отличие от hqdefault. maxres существует не везде, и проверять его нечем.
export function thumbnailUrl(videoId) {
  return videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null;
}

// Ждём только тогда, когда показывать нечего: имени ролика ещё нет, а источник
// звука уже есть. Буферизация сюда не входит - ютуб уходит в неё на пол-секунды
// после каждого снятия с паузы, и карточка мигала бы стикером на ровном месте.
export function isLoading(state, hasSource) {
  return hasSource && !hasVideo(state);
}

// Адрес настоящей страницы ролика: по нему плеер отдаёт ролик Браузеру.
export function watchUrl(state) {
  return state.videoId ? `https://www.youtube.com/watch?v=${state.videoId}` : null;
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const s = String(total % 60).padStart(2, "0");
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

const number = (value, fallback) => (Number.isFinite(value) ? value : fallback);

// До готовности плеера половина методов ещё не подключена, поэтому каждое
// отсутствующее значение заменяем тем, что стоит в пустом снимке.
export function readPlayer(player) {
  const blank = emptyState();
  if (!player) return blank;
  const data = player.getVideoData?.() ?? {};
  return {
    videoId: data.video_id || blank.videoId,
    title: data.title || blank.title,
    author: data.author || blank.author,
    currentTime: number(player.getCurrentTime?.(), blank.currentTime),
    duration: number(player.getDuration?.(), blank.duration),
    volume: number(player.getVolume?.(), blank.volume),
    muted: player.isMuted?.() ?? blank.muted,
    playerState: number(player.getPlayerState?.(), blank.playerState),
    playlistLength: player.getPlaylist?.()?.length ?? blank.playlistLength,
  };
}

// Листать есть что только внутри плейлиста: у одиночного ролика соседей нет.
export function hasQueue(state) {
  return state.playlistLength > 1;
}

export function sameState(a, b) {
  return Object.keys(emptyState()).every((key) => a[key] === b[key]);
}
