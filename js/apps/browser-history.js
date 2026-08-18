// Цепочка адресов браузера. DOM сюда не заходит, поэтому переходы проверяются тестами.

export function createHistory(addr) {
  return { stack: [addr], index: 0 };
}

export function current(history) {
  return history.stack[history.index];
}

export function canGoBack(history) {
  return history.index > 0;
}

export function canGoForward(history) {
  return history.index < history.stack.length - 1;
}

// Новый адрес обрубает всё, что было впереди - как в любом браузере.
export function push(history, addr) {
  if (addr === current(history)) return history;
  const stack = history.stack.slice(0, history.index + 1);
  stack.push(addr);
  return { stack, index: stack.length - 1 };
}

export function replace(history, addr) {
  if (addr === current(history)) return history;
  const stack = history.stack.slice();
  stack[history.index] = addr;
  return { stack, index: history.index };
}

export function go(history, step) {
  const index = Math.min(Math.max(history.index + step, 0), history.stack.length - 1);
  return index === history.index ? history : { stack: history.stack, index };
}

// Фрейм отчитался о загрузке. Первая загрузка - ответ на наш же переход, и смена
// адреса в ней значит переадресацию: своего шага она не заслуживает. Последующие
// значат, что страница ушла сама, и шаг нужен, иначе «назад» перепрыгнет через неё.
export function frameNavigated(history, href, loads) {
  if (!href || href === "about:blank") return history;
  return loads > 1 ? push(history, href) : replace(history, href);
}
