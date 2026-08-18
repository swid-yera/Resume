// Приём файлов, перетащенных с настоящей машины. Куда бросил, туда и лёг:
// над окном Проводника - в открытую в нём папку, мимо - на рабочий стол.
import { getFs, DESKTOP, baseName } from "./fs.js";
import { classify, fileNode, refusal, uniqueName } from "./drop-model.js";
import { currentPath, refreshExplorer } from "./apps/explorer.js";
import { renderDesktopFiles } from "./desktop.js";
import { escapeHtml } from "./utils.js";

const TOAST_MS = 4000;

// dragenter/dragleave приходят и от вложенных узлов, поэтому считаем глубину,
// иначе подсветка мигает на каждой границе.
let depth = 0;

// Куда ляжет файл и что подсветить: окно Проводника принимает в открытую в нём
// папку, всё остальное - рабочий стол.
function dropTarget(el) {
  const win = el?.closest?.(".window");
  if (win?.dataset.type === "explorer") return { folder: currentPath(), zone: win };
  return { folder: DESKTOP, zone: null };
}

// --- Подсветка и сообщения ---

function overlay() {
  let el = document.getElementById("drop-overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "drop-overlay";
    el.className = "drop-overlay";
    el.hidden = true;
    el.innerHTML = '<div class="drop-overlay__label"></div>';
    document.body.append(el);
  }
  return el;
}

function showOverlay({ folder, zone }) {
  const el = overlay();
  el.querySelector(".drop-overlay__label").textContent =
    `Copy to ${folder === DESKTOP ? "Desktop" : baseName(folder)}`;
  // Рамка обводит именно ту область, которая примет файл.
  const r = zone?.getBoundingClientRect();
  el.style.inset = r
    ? `${r.top}px ${window.innerWidth - r.right}px ${window.innerHeight - r.bottom}px ${r.left}px`
    : "";
  el.hidden = false;
}

function hideOverlay() {
  depth = 0;
  overlay().hidden = true;
}

function toast(lines, kind = "info") {
  if (!lines.length) return;
  const el = document.createElement("div");
  el.className = `drop-toast drop-toast--${kind}`;
  el.setAttribute("role", "status");
  el.innerHTML = lines.map((l) => `<div>${escapeHtml(l)}</div>`).join("");
  document.body.append(el);
  setTimeout(() => el.remove(), TOAST_MS);
}

// --- Чтение ---

const readDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

async function storeFile(fs, folder, file) {
  const taken = fs.list(folder).map((e) => e.name);
  const name = uniqueName(taken, file.name);
  const isText = classify(file.name) === "text";

  const node = fileNode({
    name,
    size: file.size,
    mime: file.type,
    modified: new Date(file.lastModified || Date.now()).toISOString(),
    text: isText ? await file.text() : undefined,
    dataUrl: isText ? undefined : await readDataUrl(file),
  });

  const saved = fs.put(folder + "\\" + name, node);
  return { name, saved };
}

// --- Подключение ---

export function setupFileDrop() {
  // Без preventDefault браузер просто откроет файл вместо страницы.
  const carriesFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");

  document.addEventListener("dragenter", (e) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    depth++;
    showOverlay(dropTarget(e.target));
  });

  document.addEventListener("dragover", (e) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    showOverlay(dropTarget(e.target));
  });

  document.addEventListener("dragleave", (e) => {
    if (!carriesFiles(e)) return;
    if (--depth <= 0) hideOverlay();
  });

  document.addEventListener("drop", async (e) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    hideOverlay();

    const { folder } = dropTarget(e.target);
    const files = [...(e.dataTransfer?.files || [])];
    if (!files.length) return;

    const fs = getFs();
    const added = [];
    const rejected = [];

    for (const file of files) {
      const why = refusal(file.name, file.size);
      if (why) {
        rejected.push(why);
        continue;
      }
      try {
        const { name, saved } = await storeFile(fs, folder, file);
        added.push(saved ? name : `${name} — открыт, но не сохранён: нет места`);
      } catch {
        rejected.push(`${file.name} — не удалось прочитать`);
      }
    }

    if (added.length) {
      refreshExplorer();
      if (folder === DESKTOP) renderDesktopFiles();
      toast(added);
    }
    if (rejected.length) toast(rejected, "error");
  });
}
