import {
  formatTime,
  hasQueue,
  hasVideo,
  isLoading,
  isPlaying,
  thumbnailUrl,
} from "./player-state.js";
import { activeOwner, sendPlayer, subscribePlayer } from "./player-bridge.js";
import { icon } from "./explorer-model.js";
import { openWindow } from "../open-window.js";
import { CONSTANTS } from "../constants.js";
import loadingSticker from "../../icons/loading-sticker.webp";

const BLANK_TIME = "--:--";

// Окно всплывает само поверх Браузера, поэтому каскад ему не подходит: садим
// его в правый нижний угол, чтобы не закрывать видео.
function placeBottomRight(root) {
  const win = root.closest(".window");
  if (!win) return;
  const margin = CONSTANTS.PADDING;
  win.style.left = Math.max(margin, window.innerWidth - win.offsetWidth - margin) + "px";
  win.style.top =
    Math.max(
      margin,
      window.innerHeight - win.offsetHeight - CONSTANTS.DESKTOP_PADDING_BOTTOM,
    ) + "px";
}

export function renderPlayer(windowContent) {
  windowContent.innerHTML = `
            <div class="player">
                <div class="player-now">
                    <div class="player-art">
                        <img class="player-cover" alt="" hidden>
                        <img class="player-sticker" src="${loadingSticker}" alt=""
                             width="64" height="64" aria-hidden="true">
                    </div>
                    <div class="player-meta">
                        <button class="player-title" data-act="open">Nothing is playing</button>
                        <div class="player-author"></div>
                        <div class="player-seek">
                            <span class="player-at">0:00</span>
                            <input class="player-scrub" type="range" min="0" max="0" value="0"
                                   step="1" aria-label="Seek">
                            <span class="player-left">-0:00</span>
                        </div>
                    </div>
                </div>
                <div class="player-bar">
                    <div class="player-controls">
                        <button class="player-button" data-act="previous"
                                aria-label="Previous">${icon("i-skip-back")}</button>
                        <button class="player-button is-primary" data-act="toggle"
                                aria-label="Play">${icon("i-play")}</button>
                        <button class="player-button" data-act="next"
                                aria-label="Next">${icon("i-skip-forward")}</button>
                    </div>
                    <div class="player-sound">
                        <button class="player-mute" data-act="mute"
                                aria-label="Mute">${icon("i-volume-low")}</button>
                        <input class="player-volume" type="range" min="0" max="100" value="100"
                               step="1" aria-label="Volume">
                    </div>
                </div>
            </div>`;

  const root = windowContent.querySelector(".player");
  const cover = root.querySelector(".player-cover");
  const title = root.querySelector(".player-title");
  const author = root.querySelector(".player-author");
  const scrub = root.querySelector(".player-scrub");
  const at = root.querySelector(".player-at");
  const left = root.querySelector(".player-left");
  const toggle = root.querySelector('[data-act="toggle"]');
  const previous = root.querySelector('[data-act="previous"]');
  const next = root.querySelector('[data-act="next"]');
  const mute = root.querySelector('[data-act="mute"]');
  const volume = root.querySelector(".player-volume");

  // Пока ползунок тянут, плеер продолжает докладывать своё время: перебивать
  // им руку нельзя, иначе бегунок вырывается из-под пальца.
  let scrubbing = false;
  let shown = null;

  // Пока ролика нет, полоса остаётся на месте заглушкой: длительности она не
  // знает, поэтому вместо цифр прочерки.
  const showTimes = (position, duration) => {
    at.textContent = formatTime(position);
    left.textContent = "-" + formatTime(Math.max(0, duration - position));
  };

  const blankTimes = () => {
    at.textContent = BLANK_TIME;
    left.textContent = BLANK_TIME;
  };

  const paint = (state) => {
    shown = state;
    const live = hasVideo(state);
    const playing = isPlaying(state);
    const loading = isLoading(state, Boolean(activeOwner()));
    root.classList.toggle("is-loading", loading);
    root.classList.toggle("is-idle", !live && !loading);
    cover.hidden = !live;
    if (live) {
      const art = thumbnailUrl(state.videoId);
      // Общий обработчик ошибок прячет картинку насовсем, поэтому следующей
      // обложке возвращаем видимость руками.
      if (cover.getAttribute("src") !== art) {
        cover.style.removeProperty("display");
        cover.src = art;
      }
      cover.alt = state.title;
    }
    title.textContent = live ? state.title : loading ? "Loading…" : "Nothing is playing";
    // Дежурный плейлист показывать негде: своего окна у него пока нет.
    title.disabled = !live || activeOwner() !== "browser";
    title.title = title.disabled ? "" : "Show this video in the browser";
    author.textContent = state.author;

    toggle.innerHTML = icon(playing ? "i-pause" : "i-play");
    toggle.setAttribute("aria-label", playing ? "Pause" : "Play");
    mute.innerHTML = icon(state.muted || !state.volume ? "i-volume-x" : "i-volume-low");
    mute.setAttribute("aria-label", state.muted ? "Unmute" : "Mute");

    previous.disabled = !hasQueue(state);
    next.disabled = !hasQueue(state);
    if (document.activeElement !== volume) volume.value = state.muted ? 0 : state.volume;
    if (scrubbing) return;
    scrub.max = Math.floor(state.duration) || 0;
    scrub.value = Math.floor(state.currentTime);
    scrub.disabled = !live;
    if (live) showTimes(state.currentTime, state.duration);
    else blankTimes();
  };

  // Отписаться по закрытию окна не от чего: события нет, зато удалённый из
  // документа корень виден сразу.
  const unsubscribe = subscribePlayer((state) => {
    if (!root.isConnected) return unsubscribe();
    paint(state);
  });

  scrub.addEventListener("pointerdown", () => {
    scrubbing = true;
  });
  scrub.addEventListener("input", () => {
    showTimes(Number(scrub.value), shown.duration);
  });
  scrub.addEventListener("change", () => {
    scrubbing = false;
    sendPlayer("seekTo", [Number(scrub.value), true]);
  });

  volume.addEventListener("input", () => {
    const level = Number(volume.value);
    sendPlayer("setVolume", [level]);
    sendPlayer(level ? "unMute" : "mute");
  });

  root.addEventListener("click", (e) => {
    const button = e.target.closest("[data-act]");
    if (!button) return;
    // Ролик и так играет во фрейме Браузера: окно достаточно поднять, а с
    // адресом оно перерисовало бы фрейм и начало ролик заново.
    if (button.dataset.act === "open") return openWindow("browser");
    if (button.dataset.act === "toggle") {
      sendPlayer(isPlaying(shown) ? "pauseVideo" : "playVideo");
    }
    if (button.dataset.act === "mute") sendPlayer(shown.muted ? "unMute" : "mute");
    if (button.dataset.act === "previous") sendPlayer("previousVideo");
    if (button.dataset.act === "next") sendPlayer("nextVideo");
  });

  placeBottomRight(root);
}
