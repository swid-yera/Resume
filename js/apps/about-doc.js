// Навыки для About: во фронтматтере они лежат тремя списками, и родственные
// вещи пишутся одним пунктом (`Java & Spring`), чтобы один навык не дробился на
// четыре плашки.
//
// Модуль общий: из него читают и окно About на рабочем столе, и генератор
// страницы /about/ на этапе сборки.
const SKILL_GROUPS = [
  { key: "backend", label: "Бэкенд" },
  { key: "frontend", label: "Фронтенд" },
  { key: "tools", label: "Инструменты" },
];

export function skillGroups(data) {
  return SKILL_GROUPS.map(({ key, label }) => ({
    label,
    items: Array.isArray(data?.[key]) ? data[key] : [],
  })).filter((group) => group.items.length > 0);
}

// Плашками показывается только то, чем пользуюсь чаще всего. Остальное лежит в
// `more` и вылезает подсказкой, чтобы короткий список не превращался в свалку.
export function fullSkillList(data) {
  const shown = skillGroups(data).flatMap((group) => group.items);
  const rest = Array.isArray(data?.more) ? data.more : [];
  return [...new Set([...shown, ...rest])];
}

export function skillNote(data) {
  const full = fullSkillList(data);
  if (!full.length) return "";
  return `В плашках только то, чем пользуюсь чаще всего. Полностью: ${full.join(", ")}.`;
}
