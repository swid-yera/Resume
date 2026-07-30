// Читает content/projects/*.md и раскладывает по dist статические страницы:
// /projects/, /projects/<slug>/ и карту сайта. Запускается из vite.config.js
// после сборки бандла.
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

import { parseFrontmatter } from "../js/apps/markdown-doc.js";
import {
  projectSlug,
  projectPageHtml,
  projectsIndexHtml,
  aboutPageHtml,
  sitemapXml,
} from "./seo-pages.js";

marked.setOptions({ gfm: true, breaks: false });

const SITE = "https://antawkay.com";

function isoDate(value) {
  const d = value ? new Date(value) : new Date();
  return (Number.isNaN(d.valueOf()) ? new Date() : d).toISOString().slice(0, 10);
}

export async function readProjects(contentDir) {
  const files = (await readdir(contentDir)).filter((f) => f.endsWith(".md"));

  const projects = await Promise.all(
    files.map(async (file) => {
      const raw = await readFile(path.join(contentDir, file), "utf8");
      const { data, body } = parseFrontmatter(raw);
      return {
        slug: projectSlug(file),
        data,
        bodyHtml: marked.parse(body),
        lastmod: isoDate(data.date),
      };
    }),
  );

  // Свежие проекты сверху - тот же порядок, что и в папке Projects.
  return projects.sort((a, b) => b.lastmod.localeCompare(a.lastmod));
}

async function writePage(outDir, relPath, html) {
  const file = path.join(outDir, relPath, "index.html");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html, "utf8");
}

export async function readDoc(file) {
  const raw = await readFile(file, "utf8");
  const { data, body } = parseFrontmatter(raw);
  return { data, bodyHtml: marked.parse(body), lastmod: isoDate(data.date) };
}

export async function buildSeoPages({ root, outDir, site = SITE }) {
  const projects = await readProjects(path.join(root, "content", "projects"));
  const about = await readDoc(path.join(root, "content", "about.md"));

  for (const project of projects) {
    await writePage(
      outDir,
      path.join("projects", project.slug),
      projectPageHtml(project, site),
    );
  }
  await writePage(outDir, "projects", projectsIndexHtml(projects, site));
  await writePage(outDir, "about", aboutPageHtml(about, site));

  const newest = projects[0]?.lastmod ?? isoDate();
  await writeFile(
    path.join(outDir, "sitemap.xml"),
    sitemapXml([
      { loc: `${site}/`, lastmod: newest, changefreq: "weekly", priority: "1.0" },
      {
        loc: `${site}/about/`,
        lastmod: about.lastmod,
        changefreq: "monthly",
        priority: "0.9",
      },
      {
        loc: `${site}/projects/`,
        lastmod: newest,
        changefreq: "weekly",
        priority: "0.8",
      },
      ...projects.map((p) => ({
        loc: `${site}/projects/${p.slug}/`,
        lastmod: p.lastmod,
        changefreq: "monthly",
        priority: "0.7",
      })),
    ]),
    "utf8",
  );

  return projects.length;
}
