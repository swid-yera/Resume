// Pure parsing for the browser address bar. No DOM here so it stays testable.

const YT_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]+)/i;

export function youtubeId(input) {
  const m = String(input).match(YT_RE);
  return m ? m[1] : null;
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

  if (/^file:\/\//i.test(raw)) {
    return { kind: "file", path: toWindowsPath(raw.slice("file://".length)) };
  }

  if (BARE_PATH_RE.test(raw) || raw.toLowerCase() === THIS_PC.toLowerCase()) {
    return { kind: "file", path: toWindowsPath(raw) };
  }

  const id = youtubeId(raw);
  if (id) {
    return {
      kind: "youtube",
      videoId: id,
      embedUrl: "https://www.youtube-nocookie.com/embed/" + id,
    };
  }

  if (/^https?:\/\//i.test(raw)) {
    return { kind: "web", url: raw };
  }

  if (BARE_HOST_RE.test(raw)) {
    return { kind: "web", url: "https://" + raw };
  }

  return { kind: "search", query: raw };
}
