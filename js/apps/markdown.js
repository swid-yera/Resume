// Ридер .md. Рендерит marked, чистит DOMPurify - обе библиотеки опенсорсные и
// лежат в бандле, поэтому вкладка работает и без сети.
import { marked } from "marked";
import DOMPurify from "dompurify";

import { getFs } from "../fs.js";
import { escapeHtml } from "../utils.js";
import { setWindowTitle } from "../window-manager.js";
import {
  parseFrontmatter,
  wordCount,
  readingTime,
  buildOutline,
  uniqueSlug,
  titleFor,
} from "./markdown-doc.js";

marked.setOptions({ gfm: true, breaks: false });

const FONT_MIN = 12;
const FONT_MAX = 21;

// Переживает переоткрытие окна: читатель один раз подобрал размер под себя.
const prefs = { fontSize: 15, outline: true, view: "rendered" };

let lastPath = null;
let spy = null;

export function currentDocPath() {
  return lastPath;
}

export function renderMarkdown(windowContent, path) {
  spy?.disconnect();
  spy = null;

  const target = path || lastPath;
  if (!target) return renderMissing(windowContent, "No document selected.");
  lastPath = target;

  const fs = getFs();
  let raw;
  try {
    raw = fs.read(target);
  } catch (e) {
    return renderMissing(windowContent, e.message);
  }

  const { data, body } = parseFrontmatter(raw);
  const words = wordCount(body);
  setWindowTitle("markdown", titleFor(target, data));

  windowContent.innerHTML = `
    <div class="md${prefs.outline ? "" : " md--no-outline"}">
      <div class="md-toolbar">
        <span class="md-path" title="${escapeHtml(target)}">${escapeHtml(target)}</span>
        <div class="md-tools">
          <div class="md-seg" role="group" aria-label="View mode">
            <button type="button" data-view="rendered"
                    class="${prefs.view === "rendered" ? "is-active" : ""}">Rendered</button>
            <button type="button" data-view="source"
                    class="${prefs.view === "source" ? "is-active" : ""}">Source</button>
          </div>
          <div class="md-seg" role="group" aria-label="Font size">
            <button type="button" data-font="-" aria-label="Smaller text">A−</button>
            <button type="button" data-font="+" aria-label="Larger text">A+</button>
          </div>
          <button type="button" class="md-tool" data-toggle="outline"
                  aria-pressed="${prefs.outline}">Outline</button>
        </div>
      </div>

      <div class="md-body">
        <div class="md-scroll">
          <article class="md-doc" style="font-size:${prefs.fontSize}px"></article>
          <pre class="md-source">${escapeHtml(raw)}</pre>
        </div>
        <nav class="md-outline" aria-label="Document outline">
          <div class="md-outline__label">Outline</div>
          <ul class="md-outline__list"></ul>
        </nav>
      </div>

      <div class="md-status">
        <span>Markdown · ${words} words · ${readingTime(words)} min read</span>
        <span class="md-status__right">UTF-8</span>
      </div>
    </div>
  `;

  const root = windowContent.querySelector(".md");
  const doc = windowContent.querySelector(".md-doc");
  const scroll = windowContent.querySelector(".md-scroll");
  const outlineList = windowContent.querySelector(".md-outline__list");

  doc.innerHTML =
    pillsHtml(data) +
    DOMPurify.sanitize(marked.parse(body), { USE_PROFILES: { html: true } }) +
    linksHtml(data);

  placeMeta(doc);
  decorateLinks(doc);
  decorateCode(doc);
  const headings = tagHeadings(doc);
  renderOutline(outlineList, headings);
  spy = watchScroll(scroll, headings, outlineList);

  applyView(root, prefs.view);

  // --- Тулбар ---

  root.querySelector(".md-toolbar").addEventListener("click", (e) => {
    const view = e.target.closest("[data-view]")?.dataset.view;
    if (view) {
      prefs.view = view;
      root.querySelectorAll("[data-view]").forEach((b) =>
        b.classList.toggle("is-active", b.dataset.view === view),
      );
      applyView(root, view);
      return;
    }

    const step = e.target.closest("[data-font]")?.dataset.font;
    if (step) {
      const next = prefs.fontSize + (step === "+" ? 1 : -1);
      prefs.fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, next));
      doc.style.fontSize = prefs.fontSize + "px";
      return;
    }

    const toggle = e.target.closest("[data-toggle='outline']");
    if (toggle) {
      prefs.outline = !prefs.outline;
      root.classList.toggle("md--no-outline", !prefs.outline);
      toggle.setAttribute("aria-pressed", String(prefs.outline));
    }
  });

  // --- Оглавление ---

  outlineList.addEventListener("click", (e) => {
    const link = e.target.closest("[data-id]");
    if (!link) return;
    e.preventDefault();
    doc.querySelector(`#${CSS.escape(link.dataset.id)}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

// --- Разметка ---

function renderMissing(windowContent, message) {
  windowContent.innerHTML = `
    <div class="md">
      <div class="md-body">
        <div class="md-scroll">
          <article class="md-doc md-doc--empty">${escapeHtml(message)}</article>
        </div>
      </div>
    </div>`;
}

// Статус, год и стек из фронтматтера - те же данные, что на плитке проекта.
function pillsHtml(data) {
  const pills = [];
  if (data.status) {
    pills.push(
      `<span class="md-pill${data.status === "live" ? " is-live" : ""}">${escapeHtml(data.status)}</span>`,
    );
  }
  if (data.year) pills.push(`<span class="md-pill">${escapeHtml(String(data.year))}</span>`);
  for (const item of Array.isArray(data.stack) ? data.stack : []) {
    pills.push(`<span class="md-pill">${escapeHtml(item)}</span>`);
  }
  if (!pills.length) return "";
  return `<div class="md-meta"><div class="md-pills">${pills.join("")}</div></div>`;
}

// Ссылки идут в конец документа, а не в шапку: сначала читают, потом уходят.
function linksHtml(data) {
  const links = [
    data.url &&
      `<a class="md-link md-link--primary" href="${escapeHtml(data.url)}" target="_blank" rel="noopener noreferrer">Open site</a>`,
    data.repo &&
      `<a class="md-link" href="${escapeHtml(data.repo)}" target="_blank" rel="noopener noreferrer">Source</a>`,
  ].filter(Boolean);
  if (!links.length) return "";
  return `<div class="md-links">${links.join("")}</div>`;
}

// Плашки встают под заголовок документа, а не над ним: сверху должно быть
// имя, а не метаданные.
function placeMeta(doc) {
  const meta = doc.querySelector(".md-meta");
  const h1 = doc.querySelector("h1");
  if (meta && h1 && h1.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_PRECEDING) {
    h1.after(meta);
  }
}

function applyView(root, view) {
  root.classList.toggle("md--source", view === "source");
}

// Ссылки наружу открываются новой вкладкой; якоря внутри документа - нет.
function decorateLinks(doc) {
  for (const a of doc.querySelectorAll("a[href]")) {
    if (a.getAttribute("href").startsWith("#")) continue;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }
}

function decorateCode(doc) {
  for (const pre of doc.querySelectorAll("pre")) {
    if (pre.querySelector(".md-copy")) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "md-copy";
    button.textContent = "Copy";
    button.addEventListener("click", () => {
      const text = pre.querySelector("code")?.textContent ?? pre.textContent;
      navigator.clipboard?.writeText(text).then(
        () => {
          button.textContent = "Copied";
          setTimeout(() => (button.textContent = "Copy"), 1200);
        },
        () => {
          button.textContent = "Failed";
          setTimeout(() => (button.textContent = "Copy"), 1200);
        },
      );
    });
    pre.appendChild(button);
  }
}

// id проставляются по готовому DOM, а не через рендерер marked: так ридер не
// завязан на её внутренности и переживёт мажорное обновление.
function tagHeadings(doc) {
  const used = new Set();
  const nodes = [...doc.querySelectorAll("h1, h2, h3")];
  const headings = buildOutline(
    nodes.map((el) => ({
      level: Number(el.tagName[1]),
      text: el.textContent.trim(),
      id: el.id || uniqueSlug(el.textContent.trim(), used),
    })),
  );
  nodes.forEach((el, i) => {
    el.id = headings[i].id;
    headings[i].el = el;
  });
  return headings;
}

function renderOutline(list, headings) {
  if (!headings.length) {
    list.innerHTML = '<li class="md-outline__empty">No headings</li>';
    return;
  }
  list.innerHTML = headings
    .map(
      (h) =>
        `<li><a href="#${escapeHtml(h.id)}" data-id="${escapeHtml(h.id)}"
                class="md-outline__item" style="--depth:${h.depth}">${escapeHtml(h.text)}</a></li>`,
    )
    .join("");
}

function watchScroll(scroll, headings, list) {
  if (!headings.length || typeof IntersectionObserver === "undefined") return null;

  const mark = (id) => {
    for (const item of list.querySelectorAll(".md-outline__item")) {
      item.classList.toggle("is-active", item.dataset.id === id);
    }
  };
  mark(headings[0].id);

  const seen = new Set();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) seen.add(entry.target.id);
        else seen.delete(entry.target.id);
      }
      // Активным считается самый верхний из видимых заголовков.
      const first = headings.find((h) => seen.has(h.id));
      if (first) mark(first.id);
    },
    { root: scroll, rootMargin: "0px 0px -70% 0px", threshold: 0 },
  );

  for (const h of headings) observer.observe(h.el);
  return observer;
}
