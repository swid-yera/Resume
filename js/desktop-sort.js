// Порядок иконок на рабочем столе.
//
// Иконки позиционированы абсолютно и прибиты к местам CSS-правилами по
// data-type (см. styles.css, @media min-width: 769px), поэтому перестановка
// узлов в DOM их не двигает - сортировка обязана раздать координаты.
// Здесь только чистая логика, сам DOM трогает main.js.

export function iconOrder(items, mode) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  const byKind = (a, b) => Number(b.isFolder) - Number(a.isFolder) || byName(a, b);
  return [...items].sort(mode === "kind" ? byKind : byName);
}

export function assignSlots(sorted, slots) {
  // Места раздаём слева направо, сверху вниз - как читается рабочий стол.
  const free = [...slots].sort((a, b) => a.top - b.top || a.left - b.left);
  return sorted.map((item, i) => ({ ...item, ...free[i] }));
}
