// Адресная строка как часть системы: открытое окно видно в URL, а ссылка вида
// antawkay.com/#terminal открывает нужное приложение сразу.
//
// Открытые окна - ещё и одна запись в истории браузера: «назад» закрывает
// верхнее окно, а не уводит с сайта. Запись ровно одна на всю стопку -
// переключение приложений её заменяет, а закрытие последнего окна снимает,
// поэтому «назад» со стола всегда уводит туда, откуда пришли.
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

export function setupRouter({
  openWindow,
  closeTopWindow,
  onActiveWindowChange,
  win = window,
}) {
  const { location, history } = win;
  // Пока разбираем адрес, открытое окно его не переписывает: иначе заход по
  // ссылке #terminal заводил бы вторую запись на то же приложение.
  let applying = false;
  // Верхняя запись истории - наша: её и снимает «назад». Запись, на которую
  // пришли извне, чужая, и трогать её нельзя.
  let ourEntry = false;
  // Адрес, который уже отработали: на один переход по истории браузер шлёт и
  // popstate, и hashchange, а закрыть окно нужно один раз.
  let syncedHash = location.hash;
  // Назад нажали мы сами, снимая свою запись: закрывать по такому переходу нечего.
  let steppingBack = false;

  const writeHash = (type) => {
    if (applying) return;
    const hash = hashForType(type);
    // Окно без маршрута (пульт) всплывает поверх приложения и не должно стирать
    // его адрес: пустой hash здесь значит «оставь как есть», а не «очисти».
    if (type && !hash) return;
    // Адрес уже показывает это приложение: запись под ним - та самая, на которой
    // стоим, и заводить вторую не за чем.
    if (hash === location.hash) return;

    if (hash) {
      // Первое окно поверх стола - шаг вперёд по истории, дальше окна сменяют
      // друг друга внутри этого же шага.
      if (ourEntry) history.replaceState(null, "", hash);
      else {
        history.pushState(null, "", hash);
        ourEntry = true;
      }
    } else if (ourEntry) {
      // Окон не осталось: снимаем свою запись, иначе «назад» со стола возвращал
      // бы на этот же стол. Адрес поменяется уже переходом.
      ourEntry = false;
      steppingBack = true;
      history.back();
      return;
    } else if (typeFromHash(location.hash)) {
      // Фрагмент чужой записи оставляем как есть, свой - убираем.
      history.replaceState(null, "", location.pathname + location.search);
    }
    syncedHash = location.hash;
  };

  const openFromHash = () => {
    const type = typeFromHash(location.hash);
    if (!type) return;
    applying = true;
    openWindow(type);
    applying = false;
  };

  // Один обработчик на оба события перехода: правду говорит адрес, а не то,
  // каким событием о нём сообщили.
  const syncFromHistory = () => {
    if (steppingBack) {
      steppingBack = false;
      syncedHash = location.hash;
      return;
    }
    if (location.hash === syncedHash) return;
    syncedHash = location.hash;
    // Ушли со своей записи: она осталась впереди, и снимать её теперь не нам.
    const leftOurEntry = ourEntry;
    ourEntry = false;
    // Шаг назад отменяет наш шаг вперёд, то есть закрывает верхнее окно.
    if (leftOurEntry) closeTopWindow?.();
    // Дальше слушаемся адреса: запись, на которую пришли, называет своё окно.
    openFromHash();
  };

  win.addEventListener("popstate", syncFromHistory);
  win.addEventListener("hashchange", syncFromHistory);
  // Порядок важен: подписка сразу зовёт колбэк, и тот затёр бы hash, который мы
  // ещё не успели прочитать.
  openFromHash();
  onActiveWindowChange(writeHash);
}
