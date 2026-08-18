// Порог мобильной раскладки, общий у CSS и JS. За ним система работает как
// мобильная: окна раскрываются на весь стол, а перетаскивание и растягивание
// выключены - на тач-экране их не за что взять, и они только мешают скроллу.
//
// Условий два: узкий экран это телефон стоймя, низкий - он же лёжа. По одной
// ширине повёрнутый телефон (844x390) считался бы десктопом.
export const MOBILE_QUERY = "(max-width: 768px), (max-height: 480px)";

let mq = null;

// Ленивый matchMedia: модуль импортируют и тесты на node --test, где window нет.
function query() {
  return (mq ??= window.matchMedia(MOBILE_QUERY));
}

export function isMobile() {
  return query().matches;
}

export function onMobileChange(cb) {
  query().addEventListener("change", (e) => cb(e.matches));
}
