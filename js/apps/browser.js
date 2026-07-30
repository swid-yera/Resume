import { getFs, THIS_PC, extensionOf } from "../fs.js";
import { parseOmnibox } from "./browser-omnibox.js";
import { openWindow } from "../open-window.js";
import { escapeHtml } from "../utils.js";
import { breadcrumbs, iconFor } from "./explorer-model.js";

const HOME_ADDR = "file:///C:/Users/antawkay";

// Per-session navigation history (survives close/reopen of the window).
const session = { stack: [HOME_ADDR], index: 0 };

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
                    <button class="browser-nav" data-nav="back" aria-label="Back">◀</button>
                    <button class="browser-nav" data-nav="forward" aria-label="Forward">▶</button>
                    <button class="browser-nav" data-nav="reload" aria-label="Reload">⟳</button>
                    <form class="browser-omnibox-form">
                        <input class="browser-omnibox" type="text" autocomplete="off"
                               spellcheck="false" aria-label="Address bar">
                    </form>
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
    navButtons.querySelector('[data-nav="back"]').disabled = session.index <= 0;
    navButtons.querySelector('[data-nav="forward"]').disabled =
      session.index >= session.stack.length - 1;
  };

  const render = (addr) => {
    omnibox.value = addr;
    const intent = parseOmnibox(addr || HOME_ADDR);
    switch (intent.kind) {
      case "file":
        return renderFiles(view, fs, intent.path);
      case "youtube":
        return renderFrame(view, intent.embedUrl);
      case "web":
        return renderFrame(view, intent.url);
      case "search":
        return renderSearch(view, fs, intent.query);
      default:
        return renderFiles(view, fs, THIS_PC);
    }
  };

  const navigate = (addr) => {
    if (addr === session.stack[session.index]) return render(addr);
    session.stack = session.stack.slice(0, session.index + 1);
    session.stack.push(addr);
    session.index = session.stack.length - 1;
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
    if (nav === "reload") return render(session.stack[session.index]);
    if (nav === "back" && session.index > 0) session.index--;
    if (nav === "forward" && session.index < session.stack.length - 1) session.index++;
    updateNav();
    render(session.stack[session.index]);
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
  else render(session.stack[session.index]);
}

// --- views ---

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
                <pre class="browser-file-body">${escapeHtml(fs.read(path)) || "(empty file)"}</pre>
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

function renderFrame(view, url) {
  view.innerHTML = `
            <iframe class="browser-frame" src="${escapeHtml(url)}"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    referrerpolicy="no-referrer" allowfullscreen></iframe>`;
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
