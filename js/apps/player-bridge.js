// Единственная связь между источниками звука и окном плеера: Браузер и дежурная
// музыка отдают сюда свои фреймы, окно подписывается на состояние и шлёт команды.
// Обе стороны знают только этот модуль, поэтому окна ни от чего не зависят.
//
// Управляет плеером официальный IFrame API: он умеет взять готовый фрейм (лишь
// бы в его адресе был enablejsapi=1) и дальше отвечает обычными методами.

import { emptyState, isPlaying, readPlayer, sameState } from "./player-state.js";

const API_SRC = "https://www.youtube.com/iframe_api";

// Своё время плеер сам не рассказывает - его спрашивают. Четыре раза в секунду
// хватает, чтобы полоса шла ровно.
const POLL_MS = 250;

// Ролик, открытый вручную, важнее фоновой музыки: пульт достаётся Браузеру, а
// музыка при этом умолкает, чтобы два источника не звучали разом.
const OWNERS_BY_PRIORITY = ["browser", "music"];

const sources = new Map();
let active = null;
let state = emptyState();
let poll = 0;
let apiLoading = null;
const subscribers = new Set();

export function pickActive(owners) {
  return OWNERS_BY_PRIORITY.find((owner) => owners.includes(owner)) ?? null;
}

// Скрипт API зовёт один общий колбэк на всю страницу, поэтому грузим его раз.
function loadApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (apiLoading) return apiLoading;
  apiLoading = new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = resolve;
    const script = document.createElement("script");
    script.src = API_SRC;
    document.head.appendChild(script);
  });
  return apiLoading;
}

function setState(next) {
  if (sameState(next, state)) return;
  state = next;
  for (const notify of subscribers) notify(state);
}

function call(source, func, args = []) {
  try {
    source?.player?.[func]?.(...args);
  } catch {
    // Плеер ещё не готов - следующий опрос всё покажет.
  }
}

// Пока плеер не готов, его методы ещё не подключены и бросаются: до первого
// удачного опроса состояние просто остаётся пустым.
function read() {
  const source = sources.get(active);
  if (!source) return setState(emptyState());
  try {
    setState(readPlayer(source.player));
  } catch {
    setState(emptyState());
  }
}

function reselect() {
  const next = pickActive([...sources.keys()]);
  if (next === active) return;
  call(sources.get(active), "pauseVideo");
  active = next;
  read();
}

function startPolling() {
  if (poll) return;
  poll = setInterval(() => {
    // Фрейм умирает вместе со своим окном, и события об этом нет: закрытое окно
    // просто перестаёт отвечать, зато его узел покидает документ.
    for (const [owner, source] of sources) {
      if (!source.frame.isConnected) detachPlayer(owner);
    }
    if (!sources.size) {
      clearInterval(poll);
      poll = 0;
    }
    read();
  }, POLL_MS);
}

export async function attachPlayer(frame, { owner = "browser", onError } = {}) {
  if (!frame) return;
  detachPlayer(owner);
  // Источник числится за владельцем сразу, ещё без плеера: пока грузится скрипт
  // API, пульт должен показывать загрузку, а не «ничего не воспроизводится».
  const source = { frame, player: null };
  sources.set(owner, source);
  reselect();
  startPolling();

  await loadApi();
  // Пока грузился скрипт, вьюху могли перерисовать - тогда фрейма уже нет.
  if (!frame.isConnected || sources.get(owner) !== source) return;
  source.player = new window.YT.Player(frame, {
    events: {
      onReady: read,
      onStateChange: read,
      // Единственный способ узнать об отказе: чужой фрейм молчит, а плеер
      // рисует внутри себя серую заглушку без объяснений.
      onError: (e) => onError?.(e.data),
    },
  });
}

export function detachPlayer(owner = "browser") {
  const source = sources.get(owner);
  if (!source) return;
  sources.delete(owner);
  try {
    source.player?.destroy?.();
  } catch {
    // Фрейма уже нет - разрушать нечего.
  }
  if (active === owner) active = null;
  reselect();
  read();
}

export function playerState() {
  return state;
}

export function activeOwner() {
  return active;
}

// Подписчик получает состояние сразу, чтобы не рисовать пустое окно до первого
// опроса. Возвращаем функцию отписки.
export function subscribePlayer(notify) {
  subscribers.add(notify);
  notify(state);
  return () => subscribers.delete(notify);
}

export function sendPlayer(func, args) {
  call(sources.get(active), func, args);
  read();
}
