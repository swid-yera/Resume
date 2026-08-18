// Статические страницы проектов: то, что краулер и превью-скрапер получают без
// запуска JS. Рабочий стол читает те же content/projects/*.md в рантайме, здесь
// они превращаются в обычные HTML-страницы на этапе сборки.
//
// Модуль чистый: ничего не читает и не пишет, только строит строки. Всё IO -
// в build-seo.js.
import { escapeHtml } from "../js/utils.js";
import { slugify } from "../js/apps/markdown-doc.js";
import { skillGroups, skillNote } from "../js/apps/about-doc.js";

const SITE_NAME = "Antawkay";

// --- Пути ---

export function projectSlug(file) {
  const name = String(file ?? "")
    .split(/[\\/]/)
    .pop()
    .replace(/\.md$/i, "");
  return slugify(name);
}

// Ссылки приходят из фронтматтера, то есть из обычного текстового файла. В
// разметку пускаем только схемы, которые нельзя превратить в исполняемый код;
// всё остальное считаем отсутствующей ссылкой.
export function safeUrl(value) {
  const url = String(value ?? "").trim();
  return /^(https?:\/\/|mailto:|\/|#)/i.test(url) ? url : "";
}

// Markdown пишется для рабочего стола, где картинки лежат рядом: `projects/x.webp`.
// На странице /projects/<slug>/ тот же путь ушёл бы на уровень глубже, поэтому
// относительные ссылки поднимаются к корню сайта.
export function rootRelative(html) {
  return String(html ?? "").replace(
    /(\s(?:src|href)=")(?!https?:|\/\/|\/|#|mailto:|tel:|data:)([^"]*)"/g,
    '$1/$2"',
  );
}

// --- Общая обвязка страницы ---

const PAGE_CSS = `
:root{--abyss:#03040a;--bg:#0f0f12;--surface:#14151c;--frost:#e4f0f6;
--frost-soft:rgba(228,240,246,.72);--frost-mute:rgba(228,240,246,.44);
--line:rgba(228,240,246,.10);--fill:rgba(228,240,246,.06);--accent:#0038ff;
--accent-soft:#7aa2ff;--green:#03dac6}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--frost);
font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
-webkit-font-smoothing:antialiased}
.wrap{max-width:46rem;margin:0 auto;padding:2rem 1.25rem 4rem}
.top{display:flex;gap:1rem;align-items:center;font-size:.875rem;
padding-bottom:1.5rem;border-bottom:1px solid var(--line);margin-bottom:2rem}
.top a{color:var(--frost-mute);text-decoration:none}
.top a:hover{color:var(--accent-soft)}
h1{font-size:2.25rem;line-height:1.15;margin:0 0 .5rem;letter-spacing:-.02em}
h2{font-size:1.375rem;margin:2.5rem 0 .75rem;letter-spacing:-.01em}
h3{font-size:1.0625rem;margin:1.75rem 0 .5rem}
p{margin:0 0 1rem}
a{color:var(--accent-soft)}
a:hover{color:var(--frost)}
img{max-width:100%;height:auto;border-radius:10px;border:1px solid var(--line);display:block}
ul,ol{padding-left:1.25rem}
li{margin:.25rem 0}
code{background:var(--fill);padding:.15em .4em;border-radius:4px;font-size:.9em}
pre{background:var(--surface);border:1px solid var(--line);border-radius:10px;
padding:1rem;overflow-x:auto}
pre code{background:none;padding:0}
blockquote{margin:1.5rem 0;padding:.25rem 0 .25rem 1rem;
border-left:2px solid var(--accent);color:var(--frost-soft)}
table{width:100%;border-collapse:collapse;margin:1.25rem 0;display:block;overflow-x:auto}
th,td{text-align:left;padding:.5rem .75rem;border-bottom:1px solid var(--line)}
th{color:var(--frost-mute);font-weight:600;font-size:.8125rem;
text-transform:uppercase;letter-spacing:.06em}
.lede{color:var(--frost-soft);font-size:1.0625rem;margin-bottom:1.5rem}
.meta{display:flex;flex-wrap:wrap;gap:.4rem;margin:0 0 1.5rem;padding:0;list-style:none}
.meta li{background:var(--fill);border:1px solid var(--line);border-radius:999px;
padding:.2rem .7rem;font-size:.8125rem;color:var(--frost-soft);margin:0}
.meta .live{color:var(--green);border-color:rgba(3,218,198,.35)}
.hint{position:relative;display:inline-flex;vertical-align:middle;margin-left:.5rem}
.hint__btn{width:18px;height:18px;padding:0;display:inline-flex;align-items:center;
justify-content:center;border:1px solid var(--line);border-radius:50%;background:var(--fill);
color:var(--frost-mute);font:italic 600 11px/1 Georgia,serif;cursor:help}
.hint__btn:hover,.hint__btn:focus{color:var(--frost);border-color:var(--accent-soft);outline:none}
.hint__bubble{position:absolute;top:calc(100% + .5rem);left:0;z-index:5;width:max-content;
max-width:min(24rem,80vw);padding:.6rem .75rem;border:1px solid var(--line);border-radius:10px;
background:var(--surface);color:var(--frost-soft);font-size:.8125rem;line-height:1.5;
font-weight:400;letter-spacing:0;opacity:0;visibility:hidden;transform:translateY(-4px);
transition:opacity .12s ease,transform .12s ease,visibility .12s}
.hint__btn:hover + .hint__bubble,.hint__btn:focus + .hint__bubble{
opacity:1;visibility:visible;transform:none}
.skills{margin:1.25rem 0}
.skills h3{margin:0 0 .5rem;font-size:.8125rem;color:var(--frost-mute);
text-transform:uppercase;letter-spacing:.06em}
.actions{display:flex;flex-wrap:wrap;gap:.75rem;margin:2rem 0}
.actions a{display:inline-block;padding:.6rem 1.1rem;border-radius:10px;
border:1px solid var(--line);text-decoration:none;font-size:.9375rem;color:var(--frost)}
.actions a.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.actions a:hover{border-color:var(--accent-soft)}
.cards{list-style:none;padding:0;margin:0;display:grid;gap:1rem}
.cards a{display:block;padding:1.25rem;border:1px solid var(--line);border-radius:14px;
text-decoration:none;color:inherit;background:var(--fill)}
.cards a:hover{border-color:var(--accent-soft)}
.cards h2{margin:0 0 .35rem;font-size:1.125rem}
.cards p{margin:0;color:var(--frost-soft);font-size:.9375rem}
.foot{margin-top:3rem;padding-top:1.5rem;border-top:1px solid var(--line);
color:var(--frost-mute);font-size:.875rem}
`.trim();

// Внутри <script> браузер ищет строку "</script>" до всякого разбора JSON, так
// что описание из фронтматтера иначе закрыло бы блок и открыло свой.
function jsonLdBlock(jsonLd) {
  return JSON.stringify(jsonLd, null, 4).replace(/</g, "\\u003c");
}

function head({ lang, title, description, canonical, image, jsonLd }) {
  const url = escapeHtml(canonical);
  const preview = escapeHtml(image);

  return `<!DOCTYPE html>
<html lang="${lang}">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${url}">
    <meta name="theme-color" content="#0038ff">

    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${SITE_NAME}">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${preview}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${preview}">

    <link rel="icon" type="image/x-icon" href="/favicon/favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png">
    <style>${PAGE_CSS}</style>
    <script type="application/ld+json">
${jsonLdBlock(jsonLd)}
    </script>
</head>`;
}

function breadcrumbs(site, trail) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${site}${item.path}`,
    })),
  };
}

// --- Страница проекта ---

export function projectPageHtml({ slug, data, bodyHtml }, site) {
  const canonical = `${site}/projects/${slug}/`;
  const name = data.name || slug;
  const description = data.description || `${name} - проект в портфолио ${SITE_NAME}.`;
  const image = data.image
    ? `${site}/projects/${data.image}`
    : `${site}/og-image.png`;
  const stack = Array.isArray(data.stack) ? data.stack : [];
  const live = safeUrl(data.url);
  const repo = safeUrl(data.repo);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareSourceCode",
        "@id": `${canonical}#project`,
        name,
        description,
        url: canonical,
        ...(live ? { sameAs: [live] } : {}),
        ...(repo ? { codeRepository: repo } : {}),
        ...(stack.length ? { programmingLanguage: stack } : {}),
        ...(data.date ? { dateCreated: data.date } : {}),
        ...(data.image ? { image } : {}),
        author: { "@id": `${site}/#antawq` },
        isPartOf: { "@id": `${site}/#website` },
      },
      breadcrumbs(site, [
        { name: SITE_NAME, path: "/" },
        { name: "Projects", path: "/projects/" },
        { name, path: `/projects/${slug}/` },
      ]),
    ],
  };

  const meta = [
    data.status === "live" ? '<li class="live">Live</li>' : "",
    data.status && data.status !== "live"
      ? `<li>${escapeHtml(String(data.status))}</li>`
      : "",
    data.year ? `<li>${escapeHtml(String(data.year))}</li>` : "",
    ...stack.map((item) => `<li>${escapeHtml(String(item))}</li>`),
  ]
    .filter(Boolean)
    .join("");

  const actions = [
    live
      ? `<a class="primary" href="${escapeHtml(live)}" rel="noopener">Открыть сайт</a>`
      : "",
    repo ? `<a href="${escapeHtml(repo)}" rel="noopener">Исходники</a>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `${head({
    lang: "ru",
    title: `${name} - ${SITE_NAME}`,
    description,
    canonical,
    image,
    jsonLd,
  })}

<body>
    <div class="wrap">
        <nav class="top">
            <a href="/">${SITE_NAME}</a>
            <a href="/projects/">Projects</a>
        </nav>
        <ul class="meta">${meta}</ul>
        <article>
${rootRelative(bodyHtml)}
        </article>
        <div class="actions">${actions}</div>
        <footer class="foot">
            <a href="/">Открыть рабочий стол ${SITE_NAME}</a>
        </footer>
    </div>
</body>

</html>
`;
}

// --- Список проектов ---

export function projectsIndexHtml(projects, site) {
  const canonical = `${site}/projects/`;
  const title = `Projects - ${SITE_NAME}`;
  const description =
    "Проекты Antawkay: что сделано, на чём собрано и где посмотреть вживую.";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": canonical,
        name: title,
        description,
        isPartOf: { "@id": `${site}/#website` },
      },
      {
        "@type": "ItemList",
        itemListElement: projects.map(({ slug, data }, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: data.name || slug,
          url: `${site}/projects/${slug}/`,
        })),
      },
      breadcrumbs(site, [
        { name: SITE_NAME, path: "/" },
        { name: "Projects", path: "/projects/" },
      ]),
    ],
  };

  const cards = projects
    .map(
      ({ slug, data }) => `
            <li>
                <a href="/projects/${slug}/">
                    <h2>${escapeHtml(data.name || slug)}</h2>
                    <p>${escapeHtml(data.description || "")}</p>
                </a>
            </li>`,
    )
    .join("");

  return `${head({
    lang: "ru",
    title,
    description,
    canonical,
    image: `${site}/og-image.png`,
    jsonLd,
  })}

<body>
    <div class="wrap">
        <nav class="top">
            <a href="/">${SITE_NAME}</a>
        </nav>
        <h1>Projects</h1>
        <p class="lede">${escapeHtml(description)}</p>
        <ul class="cards">${cards}
        </ul>
        <footer class="foot">
            <a href="/">Открыть рабочий стол ${SITE_NAME}</a>
        </footer>
    </div>
</body>

</html>
`;
}

// --- Страница «Обо мне» ---

export function aboutPageHtml({ data, bodyHtml }, site) {
  const canonical = `${site}/about/`;
  const title = `${data.name || "Обо мне"} - ${SITE_NAME}`;
  const description = data.description || `${SITE_NAME}: обо мне и о стеке.`;
  const groups = skillGroups(data);
  const note = skillNote(data);
  const github = safeUrl(data.github);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": canonical,
        name: title,
        description,
        isPartOf: { "@id": `${site}/#website` },
        mainEntity: { "@id": `${site}/#antawq` },
      },
      {
        "@type": "Person",
        "@id": `${site}/#antawq`,
        name: "Antawq",
        url: site + "/",
        description,
        knowsAbout: groups.flatMap((g) => g.items),
        sameAs: ["https://github.com/Antawq"],
      },
      breadcrumbs(site, [
        { name: SITE_NAME, path: "/" },
        { name: data.name || "Обо мне", path: "/about/" },
      ]),
    ],
  };

  const skills = groups
    .map(
      ({ label, items }) => `
            <div class="skills">
                <h3>${escapeHtml(label)}</h3>
                <ul class="meta">${items
                  .map((item) => `<li>${escapeHtml(String(item))}</li>`)
                  .join("")}</ul>
            </div>`,
    )
    .join("");

  return `${head({
    lang: "ru",
    title,
    description,
    canonical,
    image: `${site}/og-image.png`,
    jsonLd,
  })}

<body>
    <div class="wrap">
        <nav class="top">
            <a href="/">${SITE_NAME}</a>
            <a href="/projects/">Projects</a>
        </nav>
        <article>
${rootRelative(bodyHtml)}
        </article>
        <section>
            <h2>Стек${
              note
                ? `<span class="hint">
                <button type="button" class="hint__btn" aria-label="Что ещё входит в стек" aria-describedby="stack-note">i</button>
                <span class="hint__bubble" id="stack-note" role="tooltip">${escapeHtml(note)}</span>
            </span>`
                : ""
            }</h2>${skills}
        </section>
        <div class="actions">${
          github
            ? `<a class="primary" href="${escapeHtml(github)}" rel="noopener">GitHub</a>`
            : ""
        }</div>
        <footer class="foot">
            <a href="/">Открыть рабочий стол ${SITE_NAME}</a>
        </footer>
    </div>
</body>

</html>
`;
}

// --- Карта сайта ---

export function sitemapXml(entries) {
  const urls = entries
    .map(({ loc, lastmod, changefreq, priority }) =>
      [
        "  <url>",
        `    <loc>${escapeHtml(loc)}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : "",
        changefreq ? `    <changefreq>${changefreq}</changefreq>` : "",
        priority ? `    <priority>${priority}</priority>` : "",
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
