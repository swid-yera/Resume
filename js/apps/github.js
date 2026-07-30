import { marked } from "marked";
import DOMPurify from "dompurify";
import { GITHUB_PROFILES } from "../constants.js";

let githubDataPromise = null;

// --- Data ---

function fetchGitHubData(username) {
  githubDataPromise ??= fetch("github-data.json").then((r) => {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  });
  return githubDataPromise.then((data) => {
    const profile = data[username];
    if (!profile?.user) throw new Error("Profile not found: " + username);
    return profile;
  });
}

// --- Render ---

function renderGitHubProfileSection({ prefix, username }) {
  return `
            <section class="gh-profile" data-user="${username}">
                <div class="gh-body">
                    <div class="gh-left-column">
                        <img id="${prefix}-avatar" class="gh-avatar" src="" alt="Avatar ${username}">
                        <h2 id="${prefix}-name">Loading...</h2>
                        <p id="${prefix}-followers">Loading...</p>
                    </div>
                    <div class="gh-right-column">
                        <div class="gh-readme" id="${prefix}-readme">Loading README...</div>
                    </div>
                </div>
            </section>
        `;
}

// --- Hydrate ---

function hydrateGitHubProfile({ username, prefix }) {
  const avatar    = document.getElementById(prefix + "-avatar");
  const nameEl    = document.getElementById(prefix + "-name");
  const followers = document.getElementById(prefix + "-followers");
  const readmeEl  = document.getElementById(prefix + "-readme");

  fetchGitHubData(username)
    .then(({ user, readme }) => {
      if (avatar && user) {
        avatar.src = user.avatar_url;
        avatar.alt = "Avatar " + user.login;
      }
      if (nameEl)
        nameEl.textContent = user ? user.name || user.login : "Failed to load";
      if (followers && user)
        followers.textContent = `${user.followers} followers · ${user.following} following`;

      if (readmeEl) {
        if (readme) {
          readmeEl.innerHTML = DOMPurify.sanitize(marked.parse(readme));
        } else {
          readmeEl.textContent = "No README found.";
        }
      }
    })
    .catch((error) => {
      if (nameEl)    nameEl.textContent    = "Failed to load";
      if (followers) followers.textContent = "";
      if (readmeEl)  readmeEl.textContent  = "No README found.";
      console.error("GitHub profile error:", error);
    });
}

export function loadGitHubProfile(windowContent) {
  windowContent.innerHTML = `
            <div class="github-profile">
                <div class="gh-profiles">
                    ${GITHUB_PROFILES.map(renderGitHubProfileSection).join("")}
                </div>
            </div>
        `;
  GITHUB_PROFILES.forEach(hydrateGitHubProfile);
}
