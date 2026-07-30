import { getFs } from "../fs.js";
import { execute, COMMAND_NAMES } from "./console-commands.js";
import { escapeHtml } from "../utils.js";

// Экран - список блоков вывода (см. console-commands.js). Держим на уровне модуля,
// чтобы терминал помнил историю в пределах сессии.
const screen = [];
const commandHistory = [];

const BANNER = ["PowerShell 7.6.3", "Type 'help' for commands."];

// Известные команды в нижнем регистре - для подсветки ввода (жёлтая команда
// против красной неизвестной, как в PSReadLine).
const KNOWN = new Set(COMMAND_NAMES.map((n) => n.toLowerCase()));

// --- Цвет ---

const seg = (t, c = null) => ({ t, c });

// Один сегмент -> span с классом цвета. Пустой текст даёт пустой span, чтобы
// сохранить длину строки (например, пустые строки вывода).
const segHtml = (s) => `<span class="t-${s.c ?? "def"}">${escapeHtml(s.t)}</span>`;
const richHtml = (segs) => segs.map(segHtml).join("");

// Текстовый блок для экрана: строки обычного текста (+ необязательный класс).
const textBlk = (rows, cls) => ({ table: false, cls, rows });

// Приглашение pwsh целиком приглушённым тоном: префикс `PS `, путь и `>` красим
// одним ключом "ps", без яркого акцента.
function promptSegs(fs) {
  return [seg("PS ", "ps"), seg(fs.pwd(), "ps"), seg(">", "ps")];
}

// Разбивка строки на чередующиеся куски пробелов и не-пробелов с сохранением
// порядка - так подсветка не съедает пробелы.
function tokenize(value) {
  return value.match(/\s+|\S+/g) ?? [];
}

// Подсветка ввода в духе PSReadLine: первое слово - команда (жёлтая, если
// известна, иначе красная), параметры `-x`/`/x` серым, строки в кавычках цианом,
// `>` серым, числа белым.
function highlightSegs(value) {
  let sawWord = false;
  return tokenize(value).map((p) => {
    if (/^\s+$/.test(p)) return seg(p, null);
    let c = null;
    if (!sawWord) {
      c = KNOWN.has(p.toLowerCase()) ? "cmd" : "cmd-bad";
      sawWord = true;
    } else if (p === ">") {
      c = "op";
    } else if (p[0] === "-" || p[0] === "/") {
      c = "param";
    } else if (p[0] === '"' || p[0] === "'") {
      c = "string";
    } else if (/^\d+$/.test(p)) {
      c = "num";
    }
    return seg(p, c);
  });
}

// HTML одной текстовой строки: пустую (все сегменты пустые) заменяем на nbsp,
// чтобы у неё была высота.
function rowHtml(segs) {
  return `<div class="console-text">${segs.every((s) => s.t === "") ? "&nbsp;" : richHtml(segs)}</div>`;
}

// HTML блока: таблица -> CSS-грид (колонки задаёт template, не пробелы), иначе
// стопка текстовых строк.
function blockHtml(b) {
  if (b.table) {
    const cells = b.rows
      .map((row) =>
        row
          .map((c) => `<div class="console-cell${c.cls ? " cell-" + c.cls : ""}">${richHtml(c.segs)}</div>`)
          .join(""),
      )
      .join("");
    return `<div class="console-grid" style="grid-template-columns:${b.template}">${cells}</div>`;
  }
  return `<div class="console-block${b.cls ? " " + b.cls : ""}">${b.rows.map(rowHtml).join("")}</div>`;
}

export function renderConsole(windowContent) {
  if (!screen.length) screen.push(textBlk(BANNER.map((t) => [seg(t, "muted")])));

  windowContent.innerHTML = `
            <div class="console" tabindex="0">
                <div class="console-body">
                    <div class="console-out" aria-live="polite"></div>
                    <form class="console-line">
                        <span class="console-ps1"></span>
                        <span class="console-field">
                            <span class="console-ink" aria-hidden="true"></span>
                            <input class="console-input" type="text" autocomplete="off"
                                   autocapitalize="off" spellcheck="false" aria-label="Terminal input">
                            <span class="console-measure" aria-hidden="true"></span>
                            <span class="console-cursor" aria-hidden="true"></span>
                        </span>
                    </form>
                </div>
                <div class="console-status" aria-hidden="true">
                    <div class="console-status-left">
                        <span class="console-status-dot"></span>
                        <span>PowerShell 7.6.3</span>
                    </div>
                    <div class="console-status-right">
                        <span>UTF-8</span>
                        <span class="console-status-pos">Ln 1, Col 1</span>
                        <span>LF</span>
                    </div>
                </div>
            </div>
        `;

  // Заголовок окна показывает имя шелла (pwsh); само приложение остаётся
  // «Terminal» в меню-баре, доке и иконке.
  const titleEl = windowContent.closest(".window")?.querySelector(".window-title");
  if (titleEl) titleEl.textContent = "pwsh";

  const fs = getFs();
  const root = windowContent.querySelector(".console");
  const body = windowContent.querySelector(".console-body");
  const out = windowContent.querySelector(".console-out");
  const ps1El = windowContent.querySelector(".console-ps1");
  const input = windowContent.querySelector(".console-input");
  const form = windowContent.querySelector(".console-line");
  const measure = windowContent.querySelector(".console-measure");
  const cursor = windowContent.querySelector(".console-cursor");
  const ink = windowContent.querySelector(".console-ink");
  const statusPos = windowContent.querySelector(".console-status-pos");

  let histIndex = commandHistory.length;

  // Двигаем блочный курсор под текущую позицию каретки, измеряя ширину
  // текста слева от неё скрытым span'ом с тем же шрифтом.
  const syncCursor = () => {
    const caret = input.selectionStart ?? input.value.length;
    measure.textContent = input.value.slice(0, caret);
    cursor.style.left = `${measure.offsetWidth}px`;
    // Живой Ln/Col в статус-баре: строка - номер блока ввода, колонка - позиция
    // каретки.
    statusPos.textContent = `Ln ${screen.length + 1}, Col ${caret + 1}`;
    // Мигание перезапускаем при каждом движении, чтобы курсор был виден.
    cursor.style.animation = "none";
    void cursor.offsetWidth;
    cursor.style.animation = "";
  };

  // Перерисовываем цветной слой ввода поверх прозрачного input.
  const syncInk = () => {
    ink.innerHTML = richHtml(highlightSegs(input.value));
  };

  const renderOut = () => {
    out.innerHTML = screen.map(blockHtml).join("");
    ps1El.innerHTML = richHtml(promptSegs(fs));
    body.scrollTop = body.scrollHeight;
  };

  const submit = (value) => {
    // Эхо команды: приглашение + команда той же подсветкой, что была во вводе.
    screen.push(textBlk([[...promptSegs(fs), seg(" ", null), ...highlightSegs(value)]], "console-echo"));
    if (value.trim()) {
      commandHistory.push(value);
      histIndex = commandHistory.length;
    }

    const res = execute(fs, value);
    (res.blocks ?? []).forEach((b) => screen.push(b));
    renderOut();
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = input.value;
    input.value = "";
    submit(value);
    syncInk();
    syncCursor();
  });

  // Любое движение каретки или текста двигает и блочный курсор, и цветной слой.
  ["input", "keyup", "click", "focus", "select"].forEach((ev) =>
    input.addEventListener(ev, () => {
      syncInk();
      syncCursor();
    }),
  );

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (histIndex > 0) input.value = commandHistory[--histIndex] ?? "";
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIndex < commandHistory.length - 1) {
        input.value = commandHistory[++histIndex] ?? "";
      } else {
        histIndex = commandHistory.length;
        input.value = "";
      }
    }
  });

  // Clicking anywhere in the terminal focuses the input.
  root.addEventListener("pointerdown", (e) => {
    if (e.target !== input) {
      // Defer so text selection still works on the output.
      setTimeout(() => input.focus(), 0);
    }
  });

  renderOut();
  input.focus();
  syncInk();
  syncCursor();
}
