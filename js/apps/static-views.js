import { escapeHtml } from "../utils.js";

export function renderPlaceholder(windowContent, name) {
  windowContent.innerHTML = `
            <div class="text-content">
                <h2>${escapeHtml(name)}</h2>
                <p>Coming soon.</p>
            </div>
        `;
}

export function renderCalls(windowContent) {
  windowContent.innerHTML =
    '<div class="call-log"><p>No recent calls</p></div>';
}

export function renderNotes(windowContent) {
  windowContent.innerHTML =
    '<textarea class="notes-area" placeholder="Your notes..." aria-label="Notes textarea"></textarea>';
}
