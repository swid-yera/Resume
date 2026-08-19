// Высота экранной клавиатуры в CSS-переменной.
//
// Страница зафиксирована (body position: fixed), прокрутить её из-под
// клавиатуры некуда, а dvh на iOS её не учитывает - поле ввода терминала
// или чата оказывается закрытым. Реальную высоту видимой области отдаёт только
// visualViewport, поэтому окно ужимаем сами.
//
// В Chrome с interactive-widget=resizes-content слой раскладки ужимается сам,
// и разность выходит нулевой - подстройки не будет, что и правильно.
export function trackKeyboard(doc = document, win = window) {
  const vv = win.visualViewport;
  if (!vv) return;

  const update = () => {
    const inset = Math.max(0, win.innerHeight - vv.height - vv.offsetTop);
    doc.documentElement.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
  };

  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  update();
}
