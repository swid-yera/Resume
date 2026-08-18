import { test } from "node:test";
import assert from "node:assert/strict";

import {
  projectSlug,
  rootRelative,
  projectPageHtml,
  projectsIndexHtml,
  aboutPageHtml,
  sitemapXml,
} from "./seo-pages.js";

const SITE = "https://antawkay.com";

// --- projectSlug ---

test("slug is the file name without extension", () => {
  assert.equal(projectSlug("anitop.md"), "anitop");
  assert.equal(projectSlug("portfolio-os.md"), "portfolio-os");
});

test("slug survives a path and odd characters", () => {
  assert.equal(projectSlug("content/projects/My Project.md"), "my-project");
});

// --- rootRelative ---

test("a relative asset path becomes root-relative", () => {
  const html = '<img src="projects/anitop.webp" alt="">';
  assert.equal(rootRelative(html), '<img src="/projects/anitop.webp" alt="">');
});

test("absolute urls and root-relative paths are left alone", () => {
  const html =
    '<a href="https://anitop.antawkay.com">site</a><img src="/projects/a.webp">';
  assert.equal(rootRelative(html), html);
});

test("anchors inside the document are left alone", () => {
  const html = '<a href="#stack">Стек</a>';
  assert.equal(rootRelative(html), html);
});

// --- projectPageHtml ---

const anitop = {
  slug: "anitop",
  data: {
    name: "AniTop",
    description: "Каталог аниме: поиск по Jikan и Yummy API",
    image: "anitop.webp",
    url: "https://anitop.antawkay.com",
    repo: "https://github.com/Antawq/AniTop",
    stack: ["Vue 3", "Vite"],
    year: 2026,
    date: "2026-06-14T18:35:00Z",
  },
  bodyHtml: "<h1>AniTop</h1><p>Каталог аниме.</p>",
};

test("the page carries its own canonical", () => {
  const html = projectPageHtml(anitop, SITE);
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/antawkay\.com\/projects\/anitop\/">/,
  );
});

test("title and description come from the frontmatter", () => {
  const html = projectPageHtml(anitop, SITE);
  assert.match(html, /<title>AniTop - Antawkay<\/title>/);
  assert.match(
    html,
    /<meta name="description" content="Каталог аниме: поиск по Jikan и Yummy API">/,
  );
});

test("og:image is absolute, otherwise scrapers cannot fetch it", () => {
  const html = projectPageHtml(anitop, SITE);
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/antawkay\.com\/projects\/anitop\.webp">/,
  );
});

test("the page falls back to the site preview when a project has no image", () => {
  const html = projectPageHtml(
    { ...anitop, data: { ...anitop.data, image: undefined } },
    SITE,
  );
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/antawkay\.com\/og-image\.png">/,
  );
});

test("the rendered markdown body ends up in the page", () => {
  const html = projectPageHtml(anitop, SITE);
  assert.match(html, /<h1>AniTop<\/h1>/);
  assert.match(html, /Каталог аниме\./);
});

test("live site and repository are linked", () => {
  const html = projectPageHtml(anitop, SITE);
  assert.match(html, /href="https:\/\/anitop\.antawkay\.com"/);
  assert.match(html, /href="https:\/\/github\.com\/Antawq\/AniTop"/);
});

test("structured data names the project and its repository", () => {
  const html = projectPageHtml(anitop, SITE);
  const ld = JSON.parse(
    html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    )[1],
  );
  const project = ld["@graph"].find((n) => n["@type"] === "SoftwareSourceCode");
  assert.equal(project.name, "AniTop");
  assert.equal(project.codeRepository, "https://github.com/Antawq/AniTop");
});

test("quotes in a description cannot break out of the meta tag", () => {
  const html = projectPageHtml(
    { ...anitop, data: { ...anitop.data, description: 'a "quoted" <tag>' } },
    SITE,
  );
  assert.match(
    html,
    /<meta name="description" content="a &quot;quoted&quot; &lt;tag&gt;">/,
  );
  assert.doesNotMatch(html, /content="a "quoted"/);
});

test("a closing script tag in the frontmatter cannot break out of the json-ld block", () => {
  const html = projectPageHtml(
    {
      ...anitop,
      data: { ...anitop.data, description: "</script><script>alert(1)</script>" },
    },
    SITE,
  );
  const blocks = html.match(/<script[^>]*>/g);
  assert.deepEqual(blocks, ['<script type="application/ld+json">']);
});

test("a quote in the image path cannot break out of the meta tag", () => {
  const html = projectPageHtml(
    { ...anitop, data: { ...anitop.data, image: 'a.webp" onload="alert(1)' } },
    SITE,
  );
  assert.doesNotMatch(html, /onload="alert\(1\)"/);
});

test("a link with an executable scheme is dropped, not rendered", () => {
  const html = projectPageHtml(
    {
      ...anitop,
      data: {
        ...anitop.data,
        url: "javascript:alert(1)",
        repo: "JavaScript:alert(2)",
      },
    },
    SITE,
  );
  assert.doesNotMatch(html, /href="javascript:/i);
  const ld = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
  );
  const project = ld["@graph"].find((n) => n["@type"] === "SoftwareSourceCode");
  assert.equal(project.sameAs, undefined);
  assert.equal(project.codeRepository, undefined);
});

test("the page links back to the desktop", () => {
  const html = projectPageHtml(anitop, SITE);
  assert.match(html, /href="\/"/);
});

// --- projectsIndexHtml ---

test("the index lists every project and links to its page", () => {
  const html = projectsIndexHtml([anitop, { ...anitop, slug: "portfolio-os", data: { ...anitop.data, name: "Portfolio OS" } }], SITE);
  assert.match(html, /href="\/projects\/anitop\/"/);
  assert.match(html, /href="\/projects\/portfolio-os\/"/);
  assert.match(html, /Portfolio OS/);
});

test("the index declares itself as the projects list", () => {
  const html = projectsIndexHtml([anitop], SITE);
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/antawkay\.com\/projects\/">/,
  );
  const ld = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
  );
  const list = ld["@graph"].find((n) => n["@type"] === "ItemList");
  assert.equal(list.itemListElement.length, 1);
  assert.equal(list.itemListElement[0].url, "https://antawkay.com/projects/anitop/");
});

// --- aboutPageHtml ---

const aboutDoc = {
  data: {
    name: "Обо мне",
    description: "Фуллстак с уклоном в бэкенд.",
    backend: ["Java & Spring", "MongoDB & SQL"],
    frontend: ["JavaScript & TypeScript", "Vue 3"],
    tools: ["Vite", "Cloudflare"],
  },
  bodyHtml: "<h1>Обо мне</h1><p>Фуллстак.</p>",
};

test("the about page carries its own canonical and title", () => {
  const html = aboutPageHtml(aboutDoc, SITE);
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/antawkay\.com\/about\/">/,
  );
  assert.match(html, /<title>Обо мне - Antawkay<\/title>/);
});

test("every skill group is rendered with its chips", () => {
  const html = aboutPageHtml(aboutDoc, SITE);
  assert.match(html, /Бэкенд/);
  assert.match(html, /Java &amp; Spring/);
  assert.match(html, /JavaScript &amp; TypeScript/);
  assert.match(html, /Cloudflare/);
});

test("an ampersand in a chip is escaped, not left raw", () => {
  const html = aboutPageHtml(aboutDoc, SITE);
  assert.doesNotMatch(html, /<li[^>]*>Java & Spring/);
});

test("structured data describes a person and what they know", () => {
  const html = aboutPageHtml(aboutDoc, SITE);
  const ld = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
  );
  const person = ld["@graph"].find((n) => n["@type"] === "Person");
  assert.ok(person.knowsAbout.includes("Java & Spring"));
  assert.ok(ld["@graph"].some((n) => n["@type"] === "AboutPage"));
});

test("the about body ends up in the page", () => {
  const html = aboutPageHtml(aboutDoc, SITE);
  assert.match(html, /<h1>Обо мне<\/h1>/);
});

// --- sitemapXml ---

test("the sitemap holds every url that was passed in", () => {
  const xml = sitemapXml(
    [
      { loc: "https://antawkay.com/", lastmod: "2026-07-24", priority: "1.0" },
      { loc: "https://antawkay.com/projects/anitop/", lastmod: "2026-06-14" },
    ],
  );
  assert.match(xml, /<loc>https:\/\/antawkay\.com\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/antawkay\.com\/projects\/anitop\/<\/loc>/);
  assert.match(xml, /<lastmod>2026-06-14<\/lastmod>/);
  assert.equal(xml.match(/<url>/g).length, 2);
});

test("the sitemap is a well-formed urlset", () => {
  const xml = sitemapXml([{ loc: "https://antawkay.com/" }]);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(
    xml,
    /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/,
  );
  assert.match(xml, /<\/urlset>\s*$/);
});

test("an entry without lastmod omits the tag instead of emitting an empty one", () => {
  const xml = sitemapXml([{ loc: "https://antawkay.com/" }]);
  assert.doesNotMatch(xml, /<lastmod>/);
});
