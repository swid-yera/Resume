export function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Проверяем лениво, а не при импорте: модуль тянут и те файлы, что гоняются
// в node --test, где трогать localStorage на старте незачем.
let storageChecked = null;

export function isLocalStorageAvailable() {
  if (storageChecked !== null) return storageChecked;
  try {
    const k = "__gh_cache_test__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    storageChecked = true;
  } catch (e) {
    console.warn("LocalStorage недоступен.", e);
    storageChecked = false;
  }
  return storageChecked;
}
