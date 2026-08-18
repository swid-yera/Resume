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

// Шаг сетки выводим из уже размещённых иконок, а не из констант: координаты
// заданы в CSS и на планшете другие, дублировать их в JS нельзя.
export function gridStep(positions, fallback) {
  const step = (values, back) => {
    const uniq = [...new Set(values)].sort((a, b) => a - b);
    return uniq.length > 1 ? uniq[1] - uniq[0] : back;
  };
  return {
    originX: Math.min(...positions.map((p) => p.left)),
    originY: Math.min(...positions.map((p) => p.top)),
    stepX: step(positions.map((p) => p.left), fallback.stepX),
    stepY: step(positions.map((p) => p.top), fallback.stepY),
  };
}

// Первое свободное место: колонками сверху вниз, как в Проводнике Windows.
export function freeSlots(occupied, grid, rows, count) {
  const taken = new Set(occupied.map((p) => `${p.left}:${p.top}`));
  const out = [];
  for (let col = 0; out.length < count; col++) {
    for (let row = 0; row < rows && out.length < count; row++) {
      const slot = {
        left: grid.originX + col * grid.stepX,
        top: grid.originY + row * grid.stepY,
      };
      if (!taken.has(`${slot.left}:${slot.top}`)) out.push(slot);
    }
    if (col > 50) break;
  }
  return out;
}
