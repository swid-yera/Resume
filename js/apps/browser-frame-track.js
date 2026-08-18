// Переходы внутри чужого сайта во фрейме адресом не видны: чужой источник его не
// отдаёт. Зато каждый такой переход - и обычная загрузка, и клиентский роутинг
// SPA - добавляет запись в общую историю вкладки. По её длине считаем, на сколько
// страниц вглубь ушёл фрейм, и этими же записями ходим назад-вперёд.
//
// Слепое место одно: шаг назад длину не уменьшает, поэтому переход из середины
// цепочки (он затирает запись впереди) от неподвижности не отличить.

export function createTrack(historyLength) {
  return { base: historyLength, depth: 0, deepest: 0 };
}

export function observe(track, historyLength) {
  const total = historyLength - track.base;
  if (total <= track.deepest) return track;
  return { base: track.base, depth: total, deepest: total };
}

export function step(track, delta) {
  const depth = Math.min(Math.max(track.depth + delta, 0), track.deepest);
  return depth === track.depth ? track : { ...track, depth };
}

export function isInside(track) {
  return track.depth > 0;
}

export function canStepBack(track) {
  return track.depth > 0;
}

export function canStepForward(track) {
  return track.depth < track.deepest;
}
