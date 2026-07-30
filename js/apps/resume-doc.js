// Резюме без DOM: монограмма, контакты, таймлайн, разбор тела документа.
// Всё, что можно проверить на node --test, живёт здесь; окно только рисует.
//
// Данные приходят из фронтматтера content/about.md - того же файла, из которого
// собирается страница /about/.

// --- Монограмма ---

// Фотографии нет, поэтому в шапке инициалы. Одно слово даёт две буквы: круг с
// единственной буквой читается как заглушка, а не как аватар.
export function monogram(name) {
  const words = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// --- Контакты ---

const GITHUB_RE = /^https?:\/\/(?:www\.)?github\.com\/([^/?#]+)/i;
const TELEGRAM_RE = /^https?:\/\/(?:www\.)?t\.me\/([^/?#]+)/i;

function githubRow(value) {
  const handle = value.match(GITHUB_RE)?.[1] ?? value.replace(/^@/, "");
  const href = GITHUB_RE.test(value) ? value : `https://github.com/${handle}`;
  return { id: "github", label: "GitHub", detail: handle, href };
}

function telegramRow(value) {
  const handle = value.match(TELEGRAM_RE)?.[1] ?? value.replace(/^@/, "");
  return {
    id: "telegram",
    label: "Telegram",
    detail: "@" + handle,
    href: `https://t.me/${handle}`,
  };
}

// В Discord ссылка на профиль строится только по числовому id, ника в ней нет.
// Сам id в подписи не показываем: восемнадцать цифр ничего не говорят, а без
// подписи строка выглядит обрубком рядом с «GitHub Antawq» - отсюда «профиль».
function discordRow(value) {
  if (/^\d+$/.test(value)) {
    return {
      id: "discord",
      label: "Discord",
      detail: "профиль",
      href: `https://discord.com/users/${value}`,
    };
  }
  return { id: "discord", label: "Discord", detail: value, href: null };
}

const CONTACT_BUILDERS = [
  ["github", githubRow],
  ["telegram", telegramRow],
  ["discord", discordRow],
];

// Порядок фиксирован кодом, а не порядком ключей в файле: шапка резюме не
// должна перестраиваться от того, как автор переставил строки.
export function contacts(data) {
  const rows = [];
  for (const [key, build] of CONTACT_BUILDERS) {
    const value = String(data?.[key] ?? "").trim();
    if (value) rows.push(build(value));
  }
  return rows;
}

// --- Таймлайн ---

const FIELDS = ["period", "role", "org", "summary"];

export function timeline(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((raw) => {
      const row = {};
      for (const field of FIELDS) row[field] = String(raw?.[field] ?? "").trim();
      return row;
    })
    .filter((row) => FIELDS.some((field) => row[field]));
}

// --- Числительные ---

// «194 слов» в статус-баре режет глаз, а правило по последней цифре короче,
// чем Intl.PluralRules ради одной строки.
export function plural(count, [one, few, many]) {
  const rest = Math.abs(count) % 100;
  if (rest > 10 && rest < 20) return many;
  const last = rest % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

// --- Разбор тела ---

// Тело about.md - обычный markdown. Всё до первого `##` идёт в шапку резюме
// вводным абзацем, каждый `##` становится своей секцией. Заголовок первого
// уровня выбрасывается: имя уже написано в шапке окна.
export function splitSections(body) {
  const text = String(body ?? "").replace(/^\s*#\s+.*(?:\r?\n|$)/, "");
  const parts = text.split(/^##[ \t]+(.+?)[ \t]*$/m);

  const intro = (parts[0] ?? "").trim();
  const sections = [];
  for (let i = 1; i < parts.length; i += 2) {
    sections.push({ title: parts[i].trim(), body: (parts[i + 1] ?? "").trim() });
  }
  return { intro, sections };
}
