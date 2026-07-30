// Держим этот модуль свободным от state.js: там импортируются .webp, которые
// понимает только Vite, и тесты на node --test перестают запускаться.
import { escapeHtml } from "../utils.js";

// --- Data ---

const STATUS_LABELS = {
  live: "Live",
  wip: "WIP",
  archived: "Archived",
};

export function statusMeta(status) {
  const label = STATUS_LABELS[status];
  if (!label) return null;
  return { label, isLive: status === "live" };
}

export function normalizeProject(raw, path) {
  return {
    name: raw.name ?? "",
    src: raw.image ? "projects/" + raw.image : "",
    url: raw.url ?? null,
    repo: raw.repo ?? null,
    description: raw.description ?? "",
    stack: Array.isArray(raw.stack) ? raw.stack : [],
    year: raw.year ?? null,
    status: raw.status ?? null,
    // Путь к .md в файловой системе: по нему открывается ридер.
    path: path ?? raw.path ?? null,
  };
}

// --- Tile markup ---

export function projectTileHtml(project, index) {
  const status = statusMeta(project.status);

  const preview = project.src
    ? `<img class="project-tile__preview" src="${escapeHtml(project.src)}" alt="" loading="lazy">`
    : '<div class="project-tile__preview project-tile__preview--empty"></div>';

  const desc = project.description
    ? `<p class="project-tile__desc">${escapeHtml(project.description)}</p>`
    : "";

  const chips = project.stack
    .map(
      (item) =>
        `<span class="project-tile__chip">${escapeHtml(item)}</span>`,
    )
    .join("");

  const statusEl = status
    ? `<span class="project-tile__status${status.isLive ? " is-live" : ""}">${escapeHtml(status.label)}</span>`
    : "";

  const year = project.year
    ? `<span class="project-tile__year">${escapeHtml(String(project.year))}</span>`
    : "";

  const buttons = [
    project.path
      ? `<button type="button" class="project-tile__btn" data-action="read">Read</button>`
      : "",
    project.repo
      ? `<button type="button" class="project-tile__btn" data-action="repo">Code</button>`
      : "",
    project.url
      ? `<button type="button" class="project-tile__btn project-tile__btn--primary" data-action="site">Open Site</button>`
      : "",
  ].join("");

  const file = project.path
    ? `<span class="project-tile__file">${escapeHtml(project.path.split("\\").pop())}</span>`
    : "";

  return `
    <article class="project-tile" data-index="${index}" tabindex="0" role="button"
             aria-label="${escapeHtml(project.name)}">
      ${preview}
      <div class="project-tile__body">
        <h3 class="project-tile__name">${escapeHtml(project.name)}</h3>
        ${desc}
        <div class="project-tile__chips">${chips}</div>
      </div>
      <div class="project-tile__meta">
        ${statusEl}
        ${year}
        ${file}
      </div>
      <div class="project-tile__actions">${buttons}</div>
    </article>
  `;
}

// --- Render ---

function openExternal(url) {
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

export function renderProjects(windowContent, items, { openDoc } = {}) {
  if (!items.length) {
    windowContent.innerHTML =
      '<div class="projects"><p class="projects__empty">This folder is empty.</p></div>';
    return;
  }

  windowContent.innerHTML = `
    <div class="projects">
      ${items.map((p, i) => projectTileHtml(p, i)).join("")}
    </div>
  `;

  const list = windowContent.querySelector(".projects");

  // Проект теперь документ: сам тайл открывает .md, а сайт и репозиторий
  // разведены по кнопкам.
  const activate = (project, action) => {
    if (action === "repo") return openExternal(project.repo);
    if (action === "site") return openExternal(project.url);
    if (project.path) return openDoc?.(project.path);
    openExternal(project.url);
  };

  list.addEventListener("click", (e) => {
    const tile = e.target.closest(".project-tile");
    if (!tile) return;
    const project = items[Number(tile.dataset.index)];
    if (!project) return;
    activate(project, e.target.closest("[data-action]")?.dataset.action);
  });

  list.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tile = e.target.closest(".project-tile");
    if (!tile) return;
    e.preventDefault();
    const project = items[Number(tile.dataset.index)];
    if (project) activate(project, e.target.closest("[data-action]")?.dataset.action);
  });
}
