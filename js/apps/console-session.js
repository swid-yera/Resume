// Вкладки терминала: несколько независимых сессий в одном окне.
// Чистая логика над массивом сессий, без DOM - как и остальные модели приложений.
//
// Сессия держит свой экран, свою историю команд и свой рабочий каталог. Каталог
// живёт здесь, а не в VFS: VFS одна на всю систему, и её cwd приходится
// подставлять на время выполнения команды из активной вкладки.

import { baseName, THIS_PC } from "../fs.js";
import { blocksToRich } from "./console-commands.js";

// Счётчик не сбрасывается при закрытии: переоткрытая вкладка не должна получать
// id только что закрытой, иначе к ней прилипнет старая разметка.
let nextId = 1;

export function createSession(id, cwd) {
  return { id, cwd, screen: [], history: [] };
}

export function openSession(sessions, cwd) {
  const id = Math.max(nextId, ...sessions.map((s) => s.id + 1));
  nextId = id + 1;
  return { sessions: [...sessions, createSession(id, cwd)], activeId: id };
}

// Закрытие уводит на соседа справа, а если закрыли последнюю - на соседа слева.
// Пустой результат означает, что закрывать больше нечего и окно надо закрыть.
export function closeSession(sessions, id) {
  const i = sessions.findIndex((s) => s.id === id);
  if (i < 0) return { sessions, activeId: sessions[0]?.id ?? null };
  const rest = sessions.filter((s) => s.id !== id);
  if (!rest.length) return { sessions: rest, activeId: null };
  return { sessions: rest, activeId: (rest[i] ?? rest[rest.length - 1]).id };
}

// Подпись вкладки - имя текущей папки: только оно и отличает одну сессию от
// другой. Вне дисков (This PC) отличать нечего, там пишем имя шелла.
export function tabLabel(session) {
  const name = baseName(session.cwd);
  return !name || name === THIS_PC ? "pwsh" : name;
}

// Экран в плоский текст - для копирования сессии в буфер.
export function screenText(screen) {
  return blocksToRich(screen)
    .map((row) => row.map((s) => s.t).join(""))
    .join("\n");
}
