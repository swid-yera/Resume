// Окно резюме. Раскладку и визуальные решения подобрал Stitch (дизайн-системы
// Obsidian Desktop и Daylight Desktop, экраны «Resume window»): рейка 300px с
// личным блоком и стеком слева, колонка чтения 700px справа, статус-бар 24px.
//
// Данные - фронтматтер content/about.md, того же файла, из которого собирается
// страница /about/. Проекты не дублируются: карточки строятся из
// content/projects/*.md, и клик по карточке открывает тот же .md в ридере.
import { marked } from "marked";
import DOMPurify from "dompurify";

import { escapeHtml } from "../utils.js";
import { parseFrontmatter, wordCount } from "./markdown-doc.js";
import { skillGroups, skillNote } from "./about-doc.js";
import { monogram, contacts, timeline, plural, splitSections } from "./resume-doc.js";
import { projectDocs } from "./projects-data.js";
import { normalizeProject } from "./projects.js";
import aboutRaw from "../../content/about.md?raw";

const about = parseFrontmatter(aboutRaw);

const clean = (markdown) =>
  DOMPurify.sanitize(marked.parse(markdown), { USE_PROFILES: { html: true } });

// --- Рейка ---

function monoHtml(data) {
  return `<div class="resume-mono" aria-hidden="true">${escapeHtml(monogram(data.person || data.name))}</div>`;
}

function contactsHtml(data) {
  const rows = contacts(data);
  if (!rows.length) return "";

  const items = rows
    .map((row) => {
      const inner =
        `<span class="resume-contact__label">${escapeHtml(row.label)}</span>` +
        (row.detail
          ? `<span class="resume-contact__detail">${escapeHtml(row.detail)}</span>`
          : "");
      // Без ссылки контакт остаётся строкой, а не мёртвой кнопкой.
      return row.href
        ? `<li><a class="resume-contact" href="${escapeHtml(row.href)}" target="_blank" rel="noopener noreferrer">${inner}</a></li>`
        : `<li><span class="resume-contact">${inner}</span></li>`;
    })
    .join("");

  return `
    <section class="resume-group">
      <h2 class="resume-group__label">Контакты</h2>
      <ul class="resume-contacts">${items}</ul>
    </section>`;
}

function skillsHtml(data) {
  const groups = skillGroups(data);
  if (!groups.length) return "";

  const note = skillNote(data);
  const hint = note
    ? `<span class="hint">
         <button type="button" class="hint__btn" aria-label="Что ещё входит в стек" aria-describedby="resume-stack-note">i</button>
         <span class="hint__bubble" id="resume-stack-note" role="tooltip">${escapeHtml(note)}</span>
       </span>`
    : "";

  const blocks = groups
    .map(
      ({ label, items }) => `
        <div class="resume-skills">
          <p class="resume-skills__label">${escapeHtml(label)}</p>
          <ul class="resume-pills">${items
            .map((item) => `<li class="resume-pill">${escapeHtml(String(item))}</li>`)
            .join("")}</ul>
        </div>`,
    )
    .join("");

  return `
    <section class="resume-group">
      <h2 class="resume-group__label">Стек${hint}</h2>
      ${blocks}
    </section>`;
}

function railHtml(data) {
  return `
    <aside class="resume-rail">
      <div class="resume-id">
        ${monoHtml(data)}
        <p class="resume-name">${escapeHtml(data.person || data.name || "")}</p>
        ${data.role ? `<p class="resume-role">${escapeHtml(data.role)}</p>` : ""}
      </div>
      ${contactsHtml(data)}
      ${skillsHtml(data)}
    </aside>`;
}

// --- Основная колонка ---

function sectionHtml(title, inner, extraClass = "") {
  return `
    <section class="resume-section${extraClass ? " " + extraClass : ""}">
      <h2 class="resume-h"><span>${escapeHtml(title)}</span></h2>
      ${inner}
    </section>`;
}

function cardHtml(project, index) {
  const shot = project.src
    ? `<img class="resume-card__shot" src="${escapeHtml(project.src)}" alt="" loading="lazy">`
    : '<div class="resume-card__shot resume-card__shot--empty"></div>';

  const live =
    project.status === "live"
      ? '<span class="resume-badge is-live">Live</span>'
      : project.status
        ? `<span class="resume-badge">${escapeHtml(project.status)}</span>`
        : "";

  const meta = [project.year, project.path?.split("\\").pop()]
    .filter(Boolean)
    .map((part) => escapeHtml(String(part)))
    .join(" · ");

  const pills = project.stack
    .map((item) => `<li class="resume-pill">${escapeHtml(item)}</li>`)
    .join("");

  // «Открыть сайт» появляется только если сайт есть: у портфолио его нет, вы в
  // нём и находитесь.
  const links = [
    project.path
      ? `<button type="button" class="resume-link" data-doc="${index}">Читать</button>`
      : "",
    project.repo
      ? `<a class="resume-link" href="${escapeHtml(project.repo)}" target="_blank" rel="noopener noreferrer">Исходники</a>`
      : "",
    project.url
      ? `<a class="resume-link resume-link--primary" href="${escapeHtml(project.url)}" target="_blank" rel="noopener noreferrer">Открыть сайт</a>`
      : "",
  ].join("");

  return `
    <article class="resume-card">
      ${shot}
      <div class="resume-card__body">
        <div class="resume-card__head">
          <h3 class="resume-card__name">${escapeHtml(project.name)}</h3>
          ${live}
        </div>
        ${meta ? `<p class="resume-card__meta">${meta}</p>` : ""}
        ${project.description ? `<p class="resume-card__desc">${escapeHtml(project.description)}</p>` : ""}
        <ul class="resume-pills">${pills}</ul>
        <div class="resume-card__links">${links}</div>
      </div>
    </article>`;
}

function projectsHtml(projects) {
  if (!projects.length) return "";
  return sectionHtml(
    "Проекты",
    `<div class="resume-cards">${projects.map(cardHtml).join("")}</div>`,
  );
}

function timelineHtml(title, rows) {
  // Пустая секция хуже её отсутствия: пока данных нет, её просто нет.
  if (!rows.length) return "";

  const items = rows
    .map(
      (row) => `
        <li class="resume-tl__item">
          ${row.period ? `<p class="resume-tl__period">${escapeHtml(row.period)}</p>` : ""}
          <div class="resume-tl__body">
            ${row.org ? `<p class="resume-tl__org">${escapeHtml(row.org)}</p>` : ""}
            ${row.role ? `<p class="resume-tl__role">${escapeHtml(row.role)}</p>` : ""}
            ${row.summary ? `<p class="resume-tl__summary">${escapeHtml(row.summary)}</p>` : ""}
          </div>
        </li>`,
    )
    .join("");

  return sectionHtml(title, `<ul class="resume-tl">${items}</ul>`);
}

// --- Окно ---

export function renderResume(windowContent) {
  const { data, body } = about;
  const { intro, sections } = splitSections(body);

  const projects = projectDocs().map((doc) => normalizeProject(doc.data, doc.path));

  const prose = intro
    ? sectionHtml("Кратко", `<div class="resume-prose">${clean(intro)}</div>`)
    : "";

  const rest = sections
    .map(({ title, body: text }) =>
      sectionHtml(title, `<div class="resume-prose">${clean(text)}</div>`, "resume-section--panel"),
    )
    .join("");

  const words = wordCount(body);

  windowContent.innerHTML = `
    <div class="resume">
      <div class="resume-body">
        ${railHtml(data)}
        <div class="resume-main">
          ${prose}
          ${projectsHtml(projects)}
          ${timelineHtml("Опыт", timeline(data.experience))}
          ${timelineHtml("Образование", timeline(data.education))}
          ${rest}
        </div>
      </div>
      <div class="resume-status">
        <span>Резюме${data.person ? " · " + escapeHtml(data.person) : ""}</span>
        <span class="resume-status__right">${words} ${plural(words, ["слово", "слова", "слов"])} · UTF-8</span>
      </div>
    </div>
  `;

  return { projects };
}

// Открытие .md проекта в ридере отдано наружу: сам модуль не знает про окна.
export function bindResume(windowContent, { openDoc } = {}) {
  const { projects } = renderResume(windowContent);

  windowContent.addEventListener("click", (e) => {
    const index = e.target.closest("[data-doc]")?.dataset.doc;
    if (index === undefined) return;
    const project = projects[Number(index)];
    if (project?.path) openDoc?.(project.path);
  });
}
