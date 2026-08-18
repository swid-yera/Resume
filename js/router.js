// Адресная строка как часть системы: открытое окно видно в URL, а ссылка вида
// antawkay.com/#terminal открывает нужное приложение сразу.
//
// Разбор и сборка hash - чистые функции, их гоняет node --test. Всё, что трогает
// window и history, живёт в setupRouter.
import { WINDOW_TITLES } from "./constants.js";

// Внутренний тип окна не всегда годится для URL: `text` - это About.txt, а
// `console` - терминал. Остальные типы совпадают со своим слагом.
const ALIASES = { text: "about", console: "terminal" };

// Пульт живёт вне адреса: в доке его нет, открывает и закрывает его сама система,
// и ссылки на него не бывает.
const NO_ROUTE = new Set(["player"]);

const TYPE_BY_SLUG = new Map(
  Object.keys(WINDOW_TITLES)
    .filter((type) => !NO_ROUTE.has(type))
    .map((type) => [ALIASES[type] ?? type, type]),
);

export function slugForType(type) {
  return ALIASES[type] ?? type;
}

export function typeForSlug(slug) {
  return TYPE_BY_SLUG.get(String(slug ?? "").toLowerCase()) ?? null;
}

export function typeFromHash(hash) {
  return typeForSlug(String(hash ?? "").replace(/^#/, ""));
}

export function hashForType(type) {
  if (!type || NO_ROUTE.has(type) || !WINDOW_TITLES[type]) return "";
  return `#${slugForType(type)}`;
}

// --- Подключение ---

export function setupRouter({ openWindow, onActiveWindowChange, win = window }) {
  const { location, history } = win;
  let applying = false;

  // replaceState, а не присваивание location.hash: иначе каждый клик по окну
  // добавлял бы запись в историю и «назад» пришлось бы жать десять раз.
  const writeHash = (type) => {
    if (applying) return;
    // Окно без маршрута (пульт) всплывает поверх приложения и не должно стирать
    // его адрес: пустой hash здесь значит «оставь как есть», а не «очисти».
    if (type && !hashForType(type)) return;
    const hash = hashForType(type);
    // Фрагмент, который поставили не мы, не трогаем - он мог прийти извне.
    if (!hash && !typeFromHash(location.hash)) return;
    if (hash === location.hash) return;
    history.replaceState(null, "", hash || location.pathname + location.search);
  };

  const openFromHash = () => {
    const type = typeFromHash(location.hash);
    if (!type) return;
    applying = true;
    openWindow(type);
    applying = false;
  };

  win.addEventListener("hashchange", openFromHash);
  // Порядок важен: подписка сразу зовёт колбэк с пустым активным окном, и та
  // затёрла бы hash, который мы ещё не успели прочитать.
  openFromHash();
  onActiveWindowChange(writeHash);
}
