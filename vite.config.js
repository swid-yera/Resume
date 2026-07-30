import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { buildSeoPages } from "./scripts/build-seo.js";

const root = fileURLToPath(new URL(".", import.meta.url));

// Страницы проектов и карта сайта пишутся после бандла: public/ к этому моменту
// уже скопирован в dist, так что ничего не затирается копированием.
function seoPages() {
  return {
    name: "seo-pages",
    apply: "build",
    async closeBundle() {
      const count = await buildSeoPages({ root, outDir: "dist" });
      this.info(`seo-pages: ${count} проектов, sitemap.xml`);
    },
  };
}

// Кастомный домен раздаётся с корня (antawkay.com), поэтому base '/'.
// index.html в корне — точка входа; public/ копируется в dist/ as-is.
export default defineConfig({
  base: "/",
  plugins: [seoPages()],
});
