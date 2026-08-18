import { getFs } from "../fs.js";
import { execute, COMMAND_NAMES } from "./console-commands.js";
import {
  completionsFor,
  applyCompletion,
  predictFrom,
  nextWord,
} from "./console-complete.js";
import {
  openSession,
  closeSession,
  tabLabel,
  screenText,
} from "./console-session.js";
import { escapeHtml } from "../utils.js";

// Вкладки живут на уровне модуля: закрытое и снова открытое окно возвращает те
// же сессии с их экранами, историей и каталогами.
let sessions = [];
let activeId = null;

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

// Новая вкладка открывается там же, где стоит текущая: чаще всего её и заводят,
// чтобы поработать в том же месте другой командой.
function spawn(fs) {
  const opened = openSession(sessions, sessions.length ? active().cwd : fs.pwd());
  sessions = opened.sessions;
  activeId = opened.activeId;
  active().screen.push(textBlk(BANNER.map((t) => [seg(t, "muted")])));
}

const active = () => sessions.find((s) => s.id === activeId) ?? sessions[0];

export function renderConsole(windowContent) {
  const fs = getFs();
  if (!sessions.length) spawn(fs);

  windowContent.innerHTML = `
            <div class="console" tabindex="0">
                <div class="console-tabs">
                    <div class="console-tabs__list" role="tablist" aria-label="Terminal sessions"></div>
                    <div class="console-tabs__actions">
                        <button class="console-tabs__action" type="button" data-act="new"
                                aria-label="New session" title="New session">+</button>
                        <button class="console-tabs__action console-tabs__action--copy" type="button"
                                data-act="copy" aria-label="Copy session output">Copy</button>
                    </div>
                </div>
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
                    <ul class="console-menu" hidden></ul>
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

  const root = windowContent.querySelector(".console");
  const tabsEl = windowContent.querySelector(".console-tabs__list");
  const actionsEl = windowContent.querySelector(".console-tabs__actions");
  const body = windowContent.querySelector(".console-body");
  const out = windowContent.querySelector(".console-out");
  const ps1El = windowContent.querySelector(".console-ps1");
  const input = windowContent.querySelector(".console-input");
  const form = windowContent.querySelector(".console-line");
  const measure = windowContent.querySelector(".console-measure");
  const cursor = windowContent.querySelector(".console-cursor");
  const ink = windowContent.querySelector(".console-ink");
  const menu = windowContent.querySelector(".console-menu");
  const statusPos = windowContent.querySelector(".console-status-pos");

  let histIndex = active().history.length;
  // Активный перебор по Tab: пока он жив, Tab крутит варианты, а предсказание
  // молчит. Любая другая клавиша его сбрасывает.
  let cycling = null;
  // Хвост предсказания, показанный серым. Обработчики клавиш читают его до
  // перерисовки, поэтому он живёт здесь, а не вычисляется на месте.
  let ghost = "";

  // Двигаем блочный курсор под текущую позицию каретки, измеряя ширину
  // текста слева от неё скрытым span'ом с тем же шрифтом.
  const syncCursor = () => {
    const caret = input.selectionStart ?? input.value.length;
    measure.textContent = input.value.slice(0, caret);
    cursor.style.left = `${measure.offsetWidth}px`;
    // Живой Ln/Col в статус-баре: строка - номер блока ввода, колонка - позиция
    // каретки.
    statusPos.textContent = `Ln ${active().screen.length + 1}, Col ${caret + 1}`;
    // Мигание перезапускаем при каждом движении, чтобы курсор был виден.
    cursor.style.animation = "none";
    void cursor.offsetWidth;
    cursor.style.animation = "";
  };

  const atEnd = () =>
    input.selectionStart === input.value.length && input.selectionEnd === input.value.length;

  // Перерисовываем цветной слой ввода поверх прозрачного input, а следом -
  // серый хвост предсказания. Предсказание показывается только у конца строки:
  // в середине оно вводило бы в заблуждение, дописывается-то всегда справа.
  const syncInk = () => {
    ghost = !cycling && atEnd() ? predictFrom(active().history, input.value) : "";
    const typed = richHtml(highlightSegs(input.value));
    ink.innerHTML = ghost
      ? typed + `<span class="t-ghost">${escapeHtml(ghost)}</span>`
      : typed;
  };

  const closeMenu = () => {
    menu.hidden = true;
    menu.textContent = "";
  };

  const drawMenu = () => {
    if (!cycling) return closeMenu();
    menu.innerHTML = cycling.items
      .map(
        (it, i) =>
          `<li class="console-menu__item${i === cycling.index ? " is-current" : ""}">${escapeHtml(it)}</li>`,
      )
      .join("");
    menu.hidden = false;
    // Список вырастает под строкой ввода, то есть ниже видимой области экрана,
    // если вывод уже длинный. Догоняем прокруткой, иначе он открывается вслепую.
    body.scrollTop = body.scrollHeight;
  };

  const stopCycling = () => {
    cycling = null;
    closeMenu();
  };

  // Tab подставляет первый вариант, повторный Tab - следующий по кругу.
  // Предсказание при этом игнорируется, как и в PSReadLine.
  const cycle = (step, withMenu) => {
    if (!cycling) {
      useCwd();
      const { start, end, items } = completionsFor(fs, input.value, input.selectionStart);
      if (!items.length) return;
      cycling = { start, end, items, index: step > 0 ? 0 : items.length - 1 };
    } else {
      cycling.index = (cycling.index + step + cycling.items.length) % cycling.items.length;
    }
    const item = cycling.items[cycling.index];
    // Заменяем то, что подставили в прошлый раз, а не исходный токен: границы
    // едут вместе с длиной вставленного варианта.
    const { line, caret } = applyCompletion(input.value, cycling, item);
    cycling.end = caret;
    input.value = line;
    input.setSelectionRange(caret, caret);
    if (withMenu || !menu.hidden) drawMenu();
    syncInk();
    syncCursor();
  };

  const setValue = (value) => {
    input.value = value;
    input.setSelectionRange(value.length, value.length);
    syncInk();
    syncCursor();
  };

  // VFS одна на систему, а каталог у каждой вкладки свой, поэтому перед любой
  // работой с путями подставляем каталог активной сессии.
  const useCwd = () => {
    fs.cwd = active().cwd;
  };

  const drawTabs = () => {
    tabsEl.innerHTML = sessions
      .map((s) => {
        const on = s.id === activeId;
        return `<div class="console-tab${on ? " is-active" : ""}" role="tab"
                     aria-selected="${on}" data-id="${s.id}" tabindex="${on ? 0 : -1}">
                  <span class="console-tab__label">${escapeHtml(tabLabel(s))}</span>
                  <button class="console-tab__close" type="button" data-close="${s.id}"
                          aria-label="Close ${escapeHtml(tabLabel(s))}">&times;</button>
                </div>`;
      })
      .join("");
    // Одна вкладка закрывается вместе с окном, крестик на ней только путает.
    tabsEl.classList.toggle("is-single", sessions.length === 1);
  };

  const renderOut = () => {
    useCwd();
    out.innerHTML = active().screen.map(blockHtml).join("");
    ps1El.innerHTML = richHtml(promptSegs(fs));
    drawTabs();
    body.scrollTop = body.scrollHeight;
  };

  const submit = (value) => {
    useCwd();
    const s = active();
    // Эхо команды: приглашение + команда той же подсветкой, что была во вводе.
    s.screen.push(textBlk([[...promptSegs(fs), seg(" ", null), ...highlightSegs(value)]], "console-echo"));
    if (value.trim()) {
      s.history.push(value);
      histIndex = s.history.length;
    }

    const res = execute(fs, value, { history: s.history.slice(0, -1) });
    // clear стирает экран вместе с эхом самой команды - как Clear-Host.
    if (res.clear) s.screen.length = 0;
    (res.blocks ?? []).forEach((b) => s.screen.push(b));
    // cd мог увести вкладку в другой каталог - забираем его обратно в сессию.
    s.cwd = fs.pwd();
    renderOut();
  };

  const run = () => {
    const value = input.value;
    stopCycling();
    input.value = "";
    submit(value);
    syncInk();
    syncCursor();
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    run();
  });

  const switchTo = (id) => {
    if (id === activeId) return input.focus();
    activeId = id;
    stopCycling();
    setValue("");
    histIndex = active().history.length;
    renderOut();
    input.focus();
  };

  const closeTab = (id) => {
    const next = closeSession(sessions, id);
    sessions = next.sessions;
    activeId = next.activeId;
    // Закрыли последнюю вкладку - закрывать больше нечего, уходит и окно.
    if (!sessions.length) {
      windowContent.closest(".window")?.querySelector(".window-control.close")?.click();
      return;
    }
    stopCycling();
    setValue("");
    histIndex = active().history.length;
    renderOut();
    input.focus();
  };

  tabsEl.addEventListener("click", (e) => {
    const close = e.target.closest(".console-tab__close");
    if (close) return closeTab(Number(close.dataset.close));
    const tab = e.target.closest(".console-tab");
    if (tab) switchTo(Number(tab.dataset.id));
  });

  actionsEl.addEventListener("click", (e) => {
    const button = e.target.closest(".console-tabs__action");
    if (!button) return;
    if (button.dataset.act === "new") {
      spawn(fs);
      stopCycling();
      setValue("");
      histIndex = 0;
      renderOut();
      return input.focus();
    }
    // Копирование отзывается той же сменой подписи, что и кнопка в ридере .md.
    const label = button.textContent;
    navigator.clipboard?.writeText(screenText(active().screen)).then(
      () => {
        button.textContent = "Copied";
        setTimeout(() => (button.textContent = label), 1200);
      },
      () => {
        button.textContent = "Failed";
        setTimeout(() => (button.textContent = label), 1200);
      },
    );
  });

  // Вариант из списка можно и просто ткнуть мышью.
  menu.addEventListener("pointerdown", (e) => {
    const item = e.target.closest(".console-menu__item");
    if (!item || !cycling) return;
    e.preventDefault();
    cycling.index = [...menu.children].indexOf(item) - 1;
    cycle(1, false);
    stopCycling();
    input.focus();
  });

  // Любое движение каретки или текста двигает и блочный курсор, и цветной слой.
  ["input", "keyup", "click", "focus", "select"].forEach((ev) =>
    input.addEventListener(ev, () => {
      syncInk();
      syncCursor();
    }),
  );

  input.addEventListener("keydown", (e) => {
    // Tab и Ctrl+Space продолжают перебор, всё остальное его обрывает. Решаем
    // это здесь, а не в input/select: программная подстановка их не поднимает,
    // и перебор рвался бы от собственных же изменений.
    const keepsCycling =
      e.key === "Tab" || (e.ctrlKey && (e.code === "Space" || e.key === " "));
    if (!keepsCycling) stopCycling();

    if (e.key === "Tab") {
      e.preventDefault();
      cycle(e.shiftKey ? -1 : 1, false);
      return;
    }

    if (e.ctrlKey && (e.code === "Space" || e.key === " ")) {
      e.preventDefault();
      cycle(1, true);
      return;
    }

    // Стрелка вправо у конца строки принимает подсказку целиком, Ctrl+F - одно
    // слово. В середине строки обе клавиши работают как обычно.
    if (e.key === "ArrowRight" && ghost && atEnd()) {
      e.preventDefault();
      setValue(input.value + ghost);
      return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === "f" && ghost) {
      e.preventDefault();
      setValue(input.value + nextWord(ghost));
      return;
    }

    // Escape здесь намеренно не перехвачен: во всей системе он закрывает окно
    // (main.js), и терминал не должен быть исключением.
    if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      active().screen.length = 0;
      renderOut();
      return;
    }

    // Ctrl+T заводит вкладку, Ctrl+W закрывает - как в Windows Terminal.
    if (e.ctrlKey && e.key.toLowerCase() === "t") {
      e.preventDefault();
      spawn(fs);
      setValue("");
      histIndex = 0;
      renderOut();
      return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === "w") {
      e.preventDefault();
      closeTab(activeId);
      return;
    }

    const history = active().history;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (histIndex > 0) input.value = history[--histIndex] ?? "";
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIndex < history.length - 1) {
        input.value = history[++histIndex] ?? "";
      } else {
        histIndex = history.length;
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
