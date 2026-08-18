// Дежурная музыка рабочего стола: плейлист заряжается при старте системы и ждёт
// нажатия - звук без клика браузеры всё равно не пускают.
//
// Фрейм живёт прямо в рабочем столе, а не в окне: музыка не должна замолкать
// оттого, что окно закрыли. Показывает её мини-плеер, забирая состояние у моста.

import { MUSIC_PLAYLIST } from "./constants.js";
import { attachPlayer } from "./apps/player-bridge.js";

const PLAYLIST_EMBED = "https://www.youtube-nocookie.com/embed/videoseries";

export function setupMusic() {
  if (!MUSIC_PLAYLIST || document.querySelector(".music-source")) return;

  const frame = document.createElement("iframe");
  frame.className = "music-source";
  frame.title = "Music";
  frame.src = `${PLAYLIST_EMBED}?enablejsapi=1&list=${MUSIC_PLAYLIST}`;
  frame.allow = "autoplay; encrypted-media";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  document.body.appendChild(frame);

  attachPlayer(frame, { owner: "music" });
}
