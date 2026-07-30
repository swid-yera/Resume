// Исполнитель команд терминала: чистая логика над переданной VFS, без DOM.
// execute(fs, line) -> { blocks, rich, lines }
//
// Вывод - это список блоков. Блок бывает двух видов:
//   textBlock  - строки обычного текста (каждая строка = массив сегментов);
//   tableBlock - таблица-грид (колонки задаёт CSS grid-template, не пробелы).
// Раньше колонки help/ls/dir рисовались добивкой пробелами (padEnd), но пробел
// в сабсете шрифта оказался уже букв - столбцы разъезжались. Грид выравнивает
// колонки независимо от метрик шрифта. Поля rich/lines (плоский текст) остаются
// для тестов и любых не-DOM читателей; их выводит result() из блоков.

import { THIS_PC } from "../fs.js";
import { formatDate } from "./explorer-model.js";

const COMMAND_HELP = [
  ["help", "show this help"],
  ["ls [path]", "list a directory (Get-ChildItem)"],
  ["dir [path]", "list a directory the Windows way"],
  ["cd [path]", "change directory, or print it"],
  ["pwd", "print working directory"],
  ["cat <file>", "print file contents"],
  ["mkdir <path>", "create a directory"],
  ["date", "print the current date"],
];

// Цветной сегмент строки: текст t и цветовой ключ c (сами цвета знает рендерер).
const seg = (t, c = null) => ({ t, c });

// Одна строка обычного текста как массив сегментов.
const tline = (t, c = null) => [seg(t, c)];

// Ячейка таблицы: сегменты + необязательный класс раскладки (напр. "r" - вправо).
const cell = (segs, cls) => ({ segs, cls });

const textBlock = (rows) => ({ table: false, rows });
const tableBlock = (template, rows) => ({ table: true, template, rows });

// Цвет имени по типу узла: папка синяя, ярлык зелёный, файл обычный.
const TYPE_COLOR = { dir: "dir", app: "app", file: null };

// Атрибуты Mode как в PowerShell: d - каталог, a - archive.
const MODE = { dir: "d----", app: "-a---", file: "-a---" };

const bytes = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

// Собирает результат: rich - по строке на каждую строку/ряд блоков (ячейки ряда
// склеиваются пробелом), lines - тот же rich плоским текстом.
function result(blocks, extra = {}) {
  const rich = [];
  for (const b of blocks) {
    if (b.table) {
      for (const row of b.rows) {
        const segs = [];
        row.forEach((c, i) => {
          if (i) segs.push(seg(" ", null));
          segs.push(...c.segs);
        });
        rich.push(segs);
      }
    } else {
      for (const segs of b.rows) rich.push(segs);
    }
  }
  return { blocks, rich, lines: rich.map((r) => r.map((s) => s.t).join("")), ...extra };
}

const err = (s) => result([textBlock([tline(s, "err")])]);

// ls / Get-ChildItem: заголовок Directory, зелёная шапка колонок и грид строк;
// имена папок - на синей плашке, ярлыки - зелёные.
function gciBlocks(fs, path) {
  let where;
  let entries;
  try {
    where = fs.stat(path);
    entries = fs.list(path);
  } catch (e) {
    return [textBlock([tline(e.message, "err")])];
  }
  if (!where || !entries.length) return [];

  const header = [
    cell([seg("Mode", "th")]),
    cell([seg("LastWriteTime", "th")]),
    cell([seg("Length", "thi")], "r"),
    cell([seg("Name", "thi")]),
  ];
  const rule = [
    cell([seg("----", "th")]),
    cell([seg("-------------", "th")]),
    cell([seg("------", "thi")], "r"),
    cell([seg("----", "thi")]),
  ];
  const rows = entries.map((e) => [
    cell([seg(MODE[e.type], null)]),
    cell([seg(formatDate(e.modified), null)]),
    cell([seg(e.type === "file" && e.size != null ? String(e.size) : "", null)], "r"),
    cell([seg(e.name, TYPE_COLOR[e.type])]),
  ]);

  return [
    textBlock([tline("Directory: " + where.path)]),
    tableBlock("auto auto auto minmax(0, 1fr)", [header, rule, ...rows]),
  ];
}

// Настоящий dir: шапка с томом и путём, грид записей (<DIR> или размер), итог.
function dirBlocks(fs, path) {
  let where;
  let entries;
  try {
    where = fs.stat(path);
    entries = fs.list(path);
  } catch (e) {
    return [textBlock([tline(e.message, "err")])];
  }
  if (!where) return [textBlock([tline("The system cannot find the path specified: " + path, "err")])];

  const drive = where.path === THIS_PC ? null : where.path.slice(0, 2);
  const head = textBlock([
    tline(drive ? ` Volume in drive ${drive[0]} is Local Disk` : " Volume: This PC"),
    tline(` Directory of ${where.path}`),
  ]);

  let files = 0;
  let dirs = 0;
  let total = 0;
  const rows = entries.map((e) => {
    const size = e.type === "file" ? bytes(e.size) : "<DIR>";
    if (e.type === "file") {
      files++;
      total += e.size;
    } else {
      dirs++;
    }
    return [
      cell([seg(formatDate(e.modified), null)]),
      cell([seg(size, null)], "r"),
      cell([seg(e.name, TYPE_COLOR[e.type])]),
    ];
  });

  const foot = textBlock([
    tline(`${String(files).padStart(4)} File(s) ${bytes(total)} bytes`),
    tline(`${String(dirs).padStart(4)} Dir(s)`),
  ]);

  const blocks = [head];
  if (!entries.length) blocks.push(textBlock([tline(" File Not Found")]));
  else blocks.push(tableBlock("auto auto minmax(0, 1fr)", rows));
  blocks.push(foot);
  return blocks;
}

const COMMANDS = {
  help: () =>
    result([
      tableBlock(
        "max-content minmax(0, 1fr)",
        COMMAND_HELP.map(([c, d]) => [cell([seg(c, "cmd")]), cell([seg(d, "muted")])]),
      ),
    ]),

  pwd: (fs) => result([textBlock([tline(fs.pwd())])]),

  ls: (fs, args) => result(gciBlocks(fs, args.find((a) => !a.startsWith("-")) ?? ".")),

  dir: (fs, args) => result(dirBlocks(fs, args.find((a) => !a.startsWith("/")) ?? ".")),

  // Без аргумента Windows печатает текущий каталог, а не уходит в корень.
  cd: (fs, args) => {
    if (!args[0]) return result([textBlock([tline(fs.pwd())])]);
    try {
      fs.chdir(args[0]);
      return result([]);
    } catch (e) {
      return err("cd: " + e.message);
    }
  },

  cat: (fs, args) => {
    if (!args[0]) return err("cat: missing operand");
    try {
      return result([textBlock(String(fs.read(args[0])).split("\n").map((l) => tline(l)))]);
    } catch (e) {
      return err("cat: " + e.message);
    }
  },

  mkdir: (fs, args) => {
    if (!args[0]) return err("mkdir: missing operand");
    try {
      fs.mkdir(args[0]);
      return result([]);
    } catch (e) {
      return err("mkdir: " + e.message);
    }
  },

  date: () => result([textBlock([tline(new Date().toString())])]),
};

export function execute(fs, raw) {
  const trimmed = String(raw).trim();
  if (!trimmed) return { blocks: [], rich: [], lines: [] };
  const parts = trimmed.split(/\s+/);
  const name = parts[0].toLowerCase();
  const handler = COMMANDS[name];
  if (!handler) {
    return err(`'${parts[0]}' is not recognized as an internal or external command.`);
  }
  return handler(fs, parts.slice(1), trimmed);
}

export const COMMAND_NAMES = Object.keys(COMMANDS);
