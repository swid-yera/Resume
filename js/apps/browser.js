import { getFs, THIS_PC, extensionOf } from "../fs.js";
import {
  embedHint,
  externalUrl,
  hostOf,
  parseOmnibox,
  refusesEmbedding,
} from "./browser-omnibox.js";
import {
  canGoBack,
  canGoForward,
  createHistory,
  current,
  frameNavigated,
  go,
  push,
} from "./browser-history.js";
import { openWindow } from "../open-window.js";
import { escapeHtml } from "../utils.js";
import { breadcrumbs, icon, iconFor, isImage } from "./explorer-model.js";

const HOME_ADDR = "about:home";

// Per-session navigation history (survives close/reopen of the window).
let session = createHistory(HOME_ADDR);

// Стартовая страница: витрина того, ради чего сюда вообще заходят. Ярлык
// (data-open) открывает приложение, адрес (data-addr) остаётся внутри браузера.
const HOME_TILES = [
  { label: "Projects", icon: "i-folder", addr: "file:///C:/Users/antawkay/Documents/Projects" },
  { label: "Resume", icon: "i-file-text", open: "text" },
  { label: "GitHub", icon: "i-shortcut", open: "github" },
  { label: "Terminal", icon: "i-terminal", open: "console" },
  { label: "This PC", icon: "i-pc", addr: "file:///" },
];

const READABLE = new Set(["md", "markdown", "txt", "json", "ini", "css", "js", "html"]);

// Адрес для VFS-пути: file:///C:/Users/antawkay
function fileAddr(path) {
  return "file:///" + String(path).replace(/\\/g, "/");
}

// Walk the whole tree collecting nodes whose name matches the query.
function searchTree(fs, query, path = THIS_PC, acc = []) {
  let entries;
  try {
    entries = fs.list(path);
  } catch {
    return acc;
  }
  const q = query.toLowerCase();
  for (const entry of entries) {
    if (entry.name.toLowerCase().includes(q)) acc.push(entry);
    if (entry.type === "dir" && acc.length < 60) searchTree(fs, query, entry.path, acc);
  }
  return acc;
}

function breadcrumb(fs, path) {
  const labels = Object.fromEntries(fs.drives().map((d) => [d.name, d.label || d.name]));
  const crumbs = breadcrumbs(path, labels).map(
    (c) => `<a class="bc" data-addr="${escapeHtml(fileAddr(c.path))}">${escapeHtml(c.label)}</a>`,
  );
  return `<div class="browser-breadcrumb">${crumbs.join('<span class="bc-sep">›</span>')}</div>`;
}

export function renderBrowser(windowContent, address) {
  windowContent.innerHTML = `
            <div class="browser">
                <div class="browser-toolbar">
                    <button class="browser-nav" data-nav="back" aria-label="Back">${icon("i-arrow-left")}</button>
                    <button class="browser-nav" data-nav="forward" aria-label="Forward">${icon("i-arrow-right")}</button>
                    <button class="browser-nav" data-nav="reload" aria-label="Reload">${icon("i-rotate-cw")}</button>
                    <button class="browser-nav" data-nav="home" aria-label="Home">${icon("i-home")}</button>
                    <form class="browser-omnibox-form">
                        <input class="browser-omnibox" type="text" autocomplete="off"
                               spellcheck="false" aria-label="Address bar">
                    </form>
                    <a class="browser-nav browser-external" target="_blank" rel="noopener noreferrer"
                       aria-label="Open in a new tab" hidden>${icon("i-external")}</a>
                </div>
                <div class="browser-view"></div>
            </div>
        `;

  const fs = getFs();
  const omnibox = windowContent.querySelector(".browser-omnibox");
  const form = windowContent.querySelector(".browser-omnibox-form");
  const view = windowContent.querySelector(".browser-view");
  const navButtons = windowContent.querySelector(".browser-toolbar");

  const updateNav = () => {
    navButtons.querySelector('[data-nav="back"]').disabled = !canGoBack(session);
    navButtons.querySelector('[data-nav="forward"]').disabled = !canGoForward(session);
  };

  const openExternal = windowContent.querySelector(".browser-external");

  // Показываем адрес и кнопку «открыть снаружи» для того, что сейчас во вьюхе.
  const showAddress = (addr) => {
    omnibox.value = addr;
    const external = externalUrl(parseOmnibox(addr || HOME_ADDR));
    openExternal.hidden = !external;
    if (external) openExternal.href = external;
  };

  // Сайт внутри фрейма может увести себя на другой адрес. Свой источник читается,
  // и переход встаёт в цепочку сам - без перерисовки, страница уже на экране.
  // Чужой закрыт, и честнее пометить адрес устаревшим, чем выдавать его за действующий.
  const onFrameNavigate = (href, loads) => {
    if (!href || href === "about:blank") {
      if (loads > 1) {
        omnibox.classList.add("is-stale");
        omnibox.title =
          "The page navigated itself. Another site's address cannot be read from here.";
      }
      return;
    }
    session = frameNavigated(session, href, loads);
    omnibox.classList.remove("is-stale");
    omnibox.removeAttribute("title");
    showAddress(current(session));
    updateNav();
  };

  const render = (addr) => {
    omnibox.classList.remove("is-stale");
    omnibox.removeAttribute("title");
    showAddress(addr);
    const intent = parseOmnibox(addr || HOME_ADDR);
    const external = externalUrl(intent);
    switch (intent.kind) {
      case "file":
        return renderFiles(view, fs, intent.path);
      case "youtube":
        // Плеер листает ролики сам, и его внутренние переходы - не наша цепочка.
        return renderFrame(view, intent.embedUrl, external);
      case "web":
        return refusesEmbedding(intent.url)
          ? renderBlocked(view, intent.url, external)
          : renderFrame(view, intent.url, external, true, onFrameNavigate);
      case "search":
        return renderSearch(view, fs, intent.query);
      default:
        return renderHome(view);
    }
  };

  const navigate = (addr) => {
    session = push(session, addr);
    updateNav();
    render(addr);
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    navigate(omnibox.value.trim());
  });

  navButtons.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav]")?.dataset.nav;
    if (!nav) return;
    if (nav === "reload") return render(current(session));
    if (nav === "home") return navigate(HOME_ADDR);
    if (nav === "back") session = go(session, -1);
    if (nav === "forward") session = go(session, 1);
    updateNav();
    render(current(session));
  });

  view.addEventListener("click", (e) => {
    const target = e.target.closest("[data-addr],[data-open],[data-read]");
    if (!target) return;
    if (target.dataset.read) {
      openWindow("markdown", target.dataset.read);
    } else if (target.dataset.open) {
      openWindow(target.dataset.open);
    } else if (target.dataset.addr !== undefined) {
      navigate(target.dataset.addr);
    }
  });

  updateNav();
  if (address) navigate(address);
  else render(current(session));
}

// --- views ---

// Картинку показываем, текст печатаем, остальное отдаём ссылкой: содержимое
// у брошенного бинарника лежит data-URL'ом, показать его всё равно нечем.
function fileBody(fs, path, stat) {
  if (isImage(stat.name)) {
    return `<img class="browser-file-image" src="${escapeHtml(stat.src)}" alt="${escapeHtml(stat.name)}">`;
  }
  if (stat.src) {
    return `
            <div class="browser-file-blank">
                <p>No preview available for this file type.</p>
                <a class="browser-file-download" href="${escapeHtml(stat.src)}"
                   download="${escapeHtml(stat.name)}">Download ${escapeHtml(stat.name)}</a>
            </div>`;
  }
  return `<pre class="browser-file-body">${escapeHtml(fs.read(path)) || "(empty file)"}</pre>`;
}

function renderFiles(view, fs, path) {
  const stat = fs.stat(path);

  if (!stat) {
    view.innerHTML = `${breadcrumb(fs, path)}<div class="browser-empty">The system cannot find the path specified: ${escapeHtml(path)}</div>`;
    return;
  }

  if (stat.type === "app") {
    openWindow(stat.target);
    view.innerHTML = `${breadcrumb(fs, path)}<div class="browser-empty">Opening “${escapeHtml(stat.target)}”…</div>`;
    return;
  }

  if (stat.type === "file") {
    const readable = READABLE.has(extensionOf(stat.name));
    view.innerHTML = `
            ${breadcrumb(fs, path)}
            <div class="browser-file">
                <div class="browser-file-name">
                    ${escapeHtml(stat.name)}
                    ${readable ? `<button class="browser-file-open" data-read="${escapeHtml(stat.path)}">Open in reader</button>` : ""}
                </div>
                ${fileBody(fs, path, stat)}
            </div>`;
    return;
  }

  const entries = fs.list(path);
  view.innerHTML = `
            ${breadcrumb(fs, path)}
            <div class="browser-files">
                ${
                  entries.length
                    ? entries
                        .map((e) => {
                          const attr =
                            e.type === "app"
                              ? `data-open="${escapeHtml(e.target)}"`
                              : `data-addr="${escapeHtml(fileAddr(e.path))}"`;
                          return `
                            <button class="browser-fileitem" ${attr}>
                                <span class="browser-fileicon">${iconFor(e)}</span>
                                <span class="browser-filelabel">${escapeHtml(e.label || e.name)}</span>
                            </button>`;
                        })
                        .join("")
                    : '<div class="browser-empty">This folder is empty.</div>'
                }
            </div>`;
}

function renderHome(view) {
  view.innerHTML = `
            <div class="browser-home">
                <div class="browser-home-head">
                    <h2 class="browser-home-title">antawkay</h2>
                    <p class="browser-home-sub">Start here, or type an address above.</p>
                </div>
                <div class="browser-files">
                    ${HOME_TILES.map(
                      (tile) => `
                        <button class="browser-fileitem" ${
                          tile.open
                            ? `data-open="${escapeHtml(tile.open)}"`
                            : `data-addr="${escapeHtml(tile.addr)}"`
                        }>
                            <span class="browser-fileicon">${icon(tile.icon)}</span>
                            <span class="browser-filelabel">${escapeHtml(tile.label)}</span>
                        </button>`,
                    ).join("")}
                </div>
                <p class="browser-home-hint">
                    The address bar takes <code>file:///C:/…</code> paths and real links;
                    anything else is searched for across the file system.
                </p>
            </div>`;
}

function renderBlocked(view, url, external) {
  const hint = embedHint(url);
  view.innerHTML = `
            <div class="browser-blocked">
                <div class="browser-blocked-title">${escapeHtml(hostOf(url))} refuses to be embedded</div>
                <p class="browser-blocked-text">
                    The site sends a header that forbids showing it inside another page,
                    so this window has nothing to render.
                </p>
                ${hint ? `<p class="browser-blocked-hint">${escapeHtml(hint)}</p>` : ""}
                ${
                  external
                    ? `<a class="browser-blocked-open" href="${escapeHtml(external)}"
                          target="_blank" rel="noopener noreferrer">Open in a new tab</a>`
                    : ""
                }
            </div>`;
}

// Полоска нужна только на обычных сайтах: встроенный плеер грузится всегда, и
// предупреждать там не о чем. onNavigate зовётся на каждую загрузку фрейма:
// первая - это сама страница, последующие означают, что сайт увёл себя сам.
function renderFrame(view, url, external, warn = false, onNavigate = () => {}) {
  view.innerHTML = `
            ${
              warn
                ? `<div class="browser-notice">
                        Sites may forbid embedding. If the page stays blank,
                        <a href="${escapeHtml(external)}" target="_blank" rel="noopener noreferrer">open it in a new tab</a>.
                   </div>`
                : ""
            }
            <div class="browser-frame-wrap">
                <div class="browser-loading" role="status">Loading ${escapeHtml(hostOf(url))}…</div>
                <iframe class="browser-frame" src="${escapeHtml(url)}"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
                        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        referrerpolicy="no-referrer" allowfullscreen></iframe>
            </div>`;

  const frame = view.querySelector(".browser-frame");
  let loads = 0;
  frame.addEventListener("load", () => {
    view.querySelector(".browser-loading")?.remove();
    loads += 1;
    // Адрес фрейма читается только у своего источника. Для чужого это не
    // недоделка, а граница безопасности браузера: там остаётся лишь факт перехода.
    let href = null;
    try {
      href = frame.contentWindow?.location?.href ?? null;
    } catch {
      href = null;
    }
    onNavigate(href, loads);
  });
}

function renderSearch(view, fs, query) {
  const results = searchTree(fs, query);
  view.innerHTML = `
            <div class="browser-search">
                <div class="browser-search-head">Results for “${escapeHtml(query)}”</div>
                ${
                  results.length
                    ? results
                        .map(
                          (r) => `
                            <button class="browser-result" ${
                              r.type === "app"
                                ? `data-open="${escapeHtml(r.target)}"`
                                : `data-addr="${escapeHtml(fileAddr(r.path))}"`
                            }>
                                <span class="browser-fileicon">${iconFor(r)}</span>
                                <span class="browser-filelabel">${escapeHtml(r.name)}</span>
                                <span class="browser-result-path">${escapeHtml(r.path)}</span>
                            </button>`,
                        )
                        .join("")
                    : '<div class="browser-empty">Nothing found.</div>'
                }
            </div>`;
}
