import { folderContents, openWindows } from "./state.js";
import { createWindow, raiseWindow, restoreWindow } from "./window-manager.js";
import { renderFolderContent } from "./apps/folder.js";
import { normalizeProject, renderProjects } from "./apps/projects.js";
import { projectDocs } from "./apps/projects-data.js";
import { loadGitHubProfile } from "./apps/github.js";
import { renderTelegram } from "./apps/telegram.js";
import {
  renderPlaceholder,
  renderCalls,
  renderNotes,
} from "./apps/static-views.js";
import { bindResume } from "./apps/resume.js";
import { renderConsole } from "./apps/console.js";
import { renderBrowser } from "./apps/browser.js";
import { renderPlayer } from "./apps/player.js";
import { renderExplorer } from "./apps/explorer.js";
import { renderMarkdown } from "./apps/markdown.js";
import { renderSettings } from "./settings.js";
import { extensionOf } from "./fs.js";

// --- Projects ---

// Проекты лежат в бандле .md-файлами, поэтому грузить нечего: фронтматтер даёт
// плитку, а сам файл открывается в ридере.
function projectItems() {
  folderContents.projects = projectDocs().map((doc) =>
    normalizeProject(doc.data, doc.path),
  );
  return folderContents.projects;
}

// --- Render strategies ---

const WINDOW_RENDER_STRATEGIES = {
  photos: (contentEl, arg) => renderFolderContent(contentEl, "photos", arg),
  projects: (contentEl) =>
    renderProjects(contentEl, projectItems(), {
      openDoc: (path) => openWindow("markdown", path),
    }),
  trash: (contentEl, arg) => renderFolderContent(contentEl, "trash", arg),
  explorer: (contentEl, arg) => renderExplorer(contentEl, arg),
  markdown: (contentEl, arg) => renderMarkdown(contentEl, arg),
  text: (contentEl) =>
    bindResume(contentEl, {
      openDoc: (path) => openWindow("markdown", path),
    }),
  calls: (contentEl) => renderCalls(contentEl),
  notes: (contentEl) => renderNotes(contentEl),
  github: (contentEl) => loadGitHubProfile(contentEl),
  telegram: (contentEl) => renderTelegram(contentEl),
  instagram: (contentEl) => renderPlaceholder(contentEl, "Instagram"),
  console: (contentEl) => renderConsole(contentEl),
  browser: (contentEl, arg) => renderBrowser(contentEl, arg),
  player: (contentEl) => renderPlayer(contentEl),
  settings: (contentEl) => renderSettings(contentEl),
};

// --- Open ---

// Второй аргумент зависит от приложения: индекс фотографии, путь к папке или
// файлу, адрес для браузера. Если его нет, уже открытое окно не перерисовывается
// и сохраняет своё состояние.
export function openWindow(type, arg) {
  if (!type) return;
  const render = WINDOW_RENDER_STRATEGIES[type];
  try {
    let win = openWindows.get(type);
    if (win) {
      win.el.classList.remove("is-closing");
      // Клик по доку или иконке разворачивает свёрнутое окно обратно.
      restoreWindow(win);
      raiseWindow(win);
      if (arg !== undefined && render) render(win.contentEl, arg);
      return;
    }
    win = createWindow(type);
    if (render) {
      render(win.contentEl, arg);
    } else {
      console.warn("No renderer for window type:", type);
      renderPlaceholder(win.contentEl, type);
    }
  } catch (error) {
    console.error("Error opening window:", type, error);
    const win = openWindows.get(type);
    if (win) {
      win.contentEl.innerHTML =
        '<div class="error-content"><p>Failed to open content.</p></div>';
    }
  }
}

const READABLE = new Set(["md", "markdown", "txt", "json", "ini", "css", "js", "html"]);

// Чем открыть запись ФС. Один список на систему: по нему ходят и Проводник, и
// иконки на рабочем столе. Незнакомое уходит в Браузер - он умеет и картинку,
// и «предпросмотр недоступен».
export function openEntry(entry) {
  if (entry.type === "dir") return openWindow("explorer", entry.path);
  if (entry.type === "app") return openWindow(entry.target);
  if (READABLE.has(extensionOf(entry.name))) return openWindow("markdown", entry.path);
  openWindow("browser", "file:///" + entry.path.replace(/\\/g, "/"));
}
