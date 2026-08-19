import { CONSTANTS } from "./constants.js";
import { isMobile, onMobileChange } from "./mobile.js";

const datetimeEl = document.getElementById("datetime");

// На телефоне в полосе меню, кроме часов, стоят имя приложения и кнопка
// закрытия: дата с днём недели вытесняла бы их за край экрана.
const DATE_FORMATTERS = {
  menu: new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }),
  compact: new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }),
};

let dateTimerId = null;

export function updateDateTime() {
  try {
    if (datetimeEl)
      datetimeEl.textContent = (isMobile()
        ? DATE_FORMATTERS.compact
        : DATE_FORMATTERS.menu)
        .format(new Date())
        .replace(",", "");
  } catch (e) {
    console.error("Error updating datetime:", e);
  }
}

export function setupDateTime() {
  updateDateTime();
  onMobileChange(updateDateTime);
  if (dateTimerId === null) {
    dateTimerId = window.setInterval(updateDateTime, CONSTANTS.UPDATE_INTERVAL);
  }
}

export function teardownDateTime() {
  if (dateTimerId !== null) {
    clearInterval(dateTimerId);
    dateTimerId = null;
  }
}
