// Собирает public/github-data.json: профили GitHub и их README, где картинки
// вшиты в base64. Рабочий стол читает этот файл, а не GitHub API, поэтому
// раз в неделю его обновляет .github/workflows/update-github-data.yml.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { GITHUB_PROFILES } from "../js/constants.js";

// Список профилей один на приложение: собираем ровно то, что рабочий стол потом
// ищет в этом файле по имени.
const PROFILES = GITHUB_PROFILES.map((p) => p.username);
const OUT = "public/github-data.json";
const AGENT = "github-actions-data-updater";

// Джоба идёт по расписанию и без присмотра: без таймаута зависший ответ держит
// раннер до общего лимита GitHub Actions.
const TIMEOUT_MS = 15_000;

// Картинки уезжают в JSON целиком, поэтому крупные (обычно это гифки в README)
// оставляем ссылкой.
const MAX_IMAGE_BYTES = 512 * 1024;

const IMAGE_RE = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;

function request(url, headers) {
  return fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

export async function fetchJson(url, token) {
  const res = await request(url, {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": AGENT,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// Ветка по умолчанию у профильных репозиториев бывает и main, и master.
export async function pickReadme(username, load) {
  for (const branch of ["main", "master"]) {
    const text = await load(branch);
    if (text) return text;
  }
  return null;
}

export async function fetchText(url) {
  try {
    const res = await request(url, { "User-Agent": AGENT });
    return res.ok ? res.text() : null;
  } catch {
    return null;
  }
}

export async function fetchDataUri(url) {
  try {
    const res = await request(url, { "User-Agent": AGENT });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) return null;
    const type = (res.headers.get("content-type") || "image/svg+xml").split(";")[0];
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function inlineImages(markdown, toDataUri) {
  if (!markdown) return markdown;

  let out = markdown;
  for (const [full, alt, url] of markdown.matchAll(IMAGE_RE)) {
    try {
      const uri = await toDataUri(url);
      if (uri) out = out.replace(full, `![${alt}](${uri})`);
    } catch {
      // недоступная картинка не повод терять весь README
    }
  }
  return out;
}

// Штамп времени меняется только вместе с данными: иначе каждая еженедельная
// сборка давала бы коммит и передеплой на пустом месте.
export function withUpdatedAt(profiles, previous) {
  const { updated_at: was, ...before } = previous ?? {};
  const same = was && JSON.stringify(before) === JSON.stringify(profiles);
  return { updated_at: same ? was : new Date().toISOString(), ...profiles };
}

async function readPrevious(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

export async function buildGithubData({ token, out = OUT }) {
  const profiles = {};

  for (const username of PROFILES) {
    console.log(`Fetching ${username}...`);
    const [user, readme] = await Promise.all([
      fetchJson(`https://api.github.com/users/${username}`, token),
      pickReadme(username, (branch) =>
        fetchText(
          `https://raw.githubusercontent.com/${username}/${username}/${branch}/README.md`,
        ),
      ),
    ]);
    profiles[username] = { user, readme: await inlineImages(readme, fetchDataUri) };
  }

  const data = withUpdatedAt(profiles, await readPrevious(out));
  await writeFile(out, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return data;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const token = process.env.GH_TOKEN;
  if (!token) {
    console.error("GH_TOKEN не задан.");
    process.exit(1);
  }
  buildGithubData({ token })
    .then((data) => console.log(`github-data.json: updated_at ${data.updated_at}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
