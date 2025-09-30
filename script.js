// script.js
document.addEventListener('DOMContentLoaded', () => {
    const files = document.querySelectorAll('.file');
    const windowElement = document.getElementById('window');
    const windowContent = document.getElementById('window-content');
    const closeButton = document.getElementById('close-window');
    const datetimeElement = document.getElementById('datetime');
    const lockTimeElement = document.getElementById('lock-time');
    const lockDateElement = document.getElementById('lock-date');
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent);
    const PADDING = 20;

    const DATE_FORMATTERS = {
        lockTime: new Intl.DateTimeFormat('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }),
        lockDate: new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        }),
        menu: new Intl.DateTimeFormat('ru-RU', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })
    };

    let dateTimerId = null;

    // Lock Screen
    const lockScreen = document.getElementById('lock-screen');

    // Unlock functionality
    function unlockScreen() {
        if (!lockScreen || lockScreen.classList.contains('hide')) return;
        lockScreen.classList.add('hide');
        lockScreen.addEventListener('transitionend', () => {
            lockScreen.classList.add('hidden');
        }, { once: true });
    }

    // Event listeners for unlock
    if (lockScreen) {
        const handleUnlock = (e) => {
            e.preventDefault();
            e.stopPropagation();
            unlockScreen();
        };

        ['click', 'touchend'].forEach((eventName) => {
            lockScreen.addEventListener(eventName, handleUnlock, { passive: false });
        });

        const handleUnlockKey = (e) => {
            if (e.code !== 'Space' && e.key !== ' ') return;
            if (lockScreen.classList.contains('hide')) return;
            e.preventDefault();
            unlockScreen();
        };

        document.addEventListener('keydown', handleUnlockKey, { passive: false });
    }

    const folderContents = {
        photos: [
            { src: 'photos/photo1.png', name: 'Photo 1' },
            { src: 'photos/photo2.png', name: 'Photo 2' },
            { src: 'photos/photo3.png', name: 'Photo 3' }
        ],
        projects: [
            { src: 'projects/project1.png', name: 'Project 1', url: 'https://example.com/project1' },
            { src: 'projects/project2.png', name: 'Project 2', url: 'https://example.com/project2' }
        ],
        trash: [
            { src: 'trash/item1.png', name: 'Deleted 1' },
            { src: 'trash/item2.png', name: 'Deleted 2' }
        ]
    };

    let currentIndex = { photos: 0, projects: 0, trash: 0 };

    const GITHUB_PROFILES = [
        { username: "swid-yera", prefix: "gh-main" },
        { username: "Antawq", prefix: "gh-alt" }
    ];

    const githubDataCache = {};
    const GITHUB_CACHE_PREFIX = 'github-profile-cache:';
    const GITHUB_CACHE_TTL = 1000 * 60 * 30; // 30 минут
    const GITHUB_RATE_LIMIT_MESSAGE = 'Превышен лимит GitHub API. Попробуйте снова через несколько минут или откройте профиль напрямую.';
    const GITHUB_REQUEST_HEADERS = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
    };

    const isLocalStorageAvailable = (() => {
        try {
            const testKey = '__gh_cache_test__';
            localStorage.setItem(testKey, '1');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.warn('LocalStorage недоступен, кэш GitHub отключен.', error);
            return false;
        }
    })();

    const buildGitHubCacheKey = (username) => `${GITHUB_CACHE_PREFIX}${username}`;

    function readGitHubCache(username) {
        if (!isLocalStorageAvailable) return null;
        try {
            const raw = localStorage.getItem(buildGitHubCacheKey(username));
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            const { timestamp, data } = parsed;
            if (!timestamp || !data) return null;
            if (Date.now() - timestamp > GITHUB_CACHE_TTL) {
                localStorage.removeItem(buildGitHubCacheKey(username));
                return null;
            }
            return data;
        } catch (error) {
            console.warn('Не удалось прочитать кэш GitHub.', error);
            return null;
        }
    }

    function writeGitHubCache(username, data) {
        if (!isLocalStorageAvailable) return;
        try {
            localStorage.setItem(buildGitHubCacheKey(username), JSON.stringify({
                timestamp: Date.now(),
                data
            }));
        } catch (error) {
            console.warn('Не удалось записать кэш GitHub.', error);
        }
    }

    const telegramState = {
        chats: [
            { id: 1, name: 'Alice', avatar: 'photos/photo1.jpg', messages: [{ type: 'received', text: 'Hi there!' }] },
            { id: 2, name: 'Bob', avatar: 'photos/photo2.jpg', messages: [{ type: 'received', text: 'Hello!' }] }
        ],
        activeChatId: 1
    };

    // -----------------------
    // 1. Дата и время
    // -----------------------
    function updateDateTime() {
        const now = new Date();

        if (lockTimeElement && lockDateElement) {
            lockTimeElement.textContent = DATE_FORMATTERS.lockTime.format(now);
            lockDateElement.textContent = DATE_FORMATTERS.lockDate.format(now);
        }

        if (datetimeElement) {
            datetimeElement.textContent = DATE_FORMATTERS.menu.format(now).replace(',', '');
        }
    }

    function startDateTimeTicker() {
        updateDateTime();
        if (dateTimerId !== null) return;
        dateTimerId = window.setInterval(updateDateTime, 1000);
    }

    startDateTimeTicker();

    window.addEventListener('beforeunload', () => {
        if (dateTimerId !== null) {
            clearInterval(dateTimerId);
            dateTimerId = null;
        }
    });

    // Check button functionality
    const checkButton = document.getElementById('check-button');
    const checkPanel = document.getElementById('check-panel');

    if (checkButton && checkPanel) {
        const toggleCheckPanel = (forceState) => {
            const shouldOpen = typeof forceState === 'boolean'
                ? forceState
                : !checkPanel.classList.contains('is-open');
            checkPanel.classList.toggle('is-open', shouldOpen);
        };

        checkButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCheckPanel();
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.corner-area') && !e.target.closest('.check-panel')) {
                toggleCheckPanel(false);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                toggleCheckPanel(false);
            }
        });
    }

    // -----------------------
    // 2. Перетаскивание файлов
    // -----------------------
    function setupFileDragging(file) {
        let isDragging = false, offsetX = 0, offsetY = 0;
        let hasMoved = false, startTarget = null, isProcessing = false;

        const attemptOpenWindow = () => {
            const { type } = file.dataset;
            if (isProcessing || !type) return;
            isProcessing = true;
            openWindow(type);
            window.setTimeout(() => {
                isProcessing = false;
            }, 100);
        };

        const startDrag = (e) => {
            if (isMobile && !e.target.closest('.file-icon')) return;

            e.preventDefault();
            startTarget = file;
            isDragging = true;
            hasMoved = false;

            const rect = file.getBoundingClientRect();
            const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            offsetX = clientX - rect.left;
            offsetY = clientY - rect.top;

            file.classList.add('dragging');
        };

        const moveDrag = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            hasMoved = true;

            const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

            let newX = clientX - offsetX;
            let newY = clientY - offsetY;

            newX = Math.max(PADDING, Math.min(newX, window.innerWidth - file.offsetWidth - PADDING));
            newY = Math.max(PADDING + (isMobile ? 40 : 50), Math.min(newY, window.innerHeight - file.offsetHeight - PADDING - (isMobile ? 100 : 80)));

            file.style.left = `${newX}px`;
            file.style.top = `${newY}px`;
        };

        const endDrag = (e) => {
            if (isDragging) {
                isDragging = false;
                file.classList.remove('dragging');
            }

            if (!hasMoved && startTarget && startTarget === file) {
                attemptOpenWindow();
            }

            startTarget = null;
        };

        if (isMobile) {
            file.addEventListener('touchstart', startDrag, { passive: false });
            file.addEventListener('touchmove', moveDrag, { passive: false });
            file.addEventListener('touchend', endDrag, { passive: true });
            file.addEventListener('touchcancel', endDrag, { passive: true });
        } else {
            file.addEventListener('mousedown', (e) => {
                startDrag(e);
                const moveHandler = (ev) => moveDrag(ev);
                const upHandler = (ev) => {
                    endDrag(ev);
                    document.removeEventListener('mousemove', moveHandler);
                    document.removeEventListener('mouseup', upHandler);
                };
                document.addEventListener('mousemove', moveHandler);
                document.addEventListener('mouseup', upHandler);
            });
            file.addEventListener('click', () => {
                if (!hasMoved && !isDragging) {
                    attemptOpenWindow();
                }
            });
        }
    }

    files.forEach(setupFileDragging);

    // -----------------------
    // 5. Док-бар
    // -----------------------
    const dockItems = document.querySelectorAll('.dock-item');
    dockItems.forEach(item => {
        const eventType = isMobile ? 'touchend' : 'click';
        const handler = (e) => {
            e.stopPropagation();
            openWindow(item.dataset.type);
        };

        item.addEventListener(eventType, handler, { passive: eventType === 'touchend' });

        if (!isMobile && item.dataset.type === 'calls') {
            item.addEventListener('mouseenter', () => {
                item.setAttribute('title', 'Звонки - История вызовов');
            });
        }
    });

    // -----------------------
    // 3. Перетаскивание окна
    // -----------------------
    (function setupWindowDragging() {
        let isDraggingWindow = false;
        let startX = 0;
        let startY = 0;
        let initialX = 0;
        let initialY = 0;
        const windowHeader = windowElement.querySelector('.window-header');

        const startDragWindow = (e) => {
            if (!windowElement.classList.contains('is-visible')) return;
            e.preventDefault();

            const touchEvent = e.type.includes('touch');
            startX = touchEvent ? e.touches[0].clientX : e.clientX;
            startY = touchEvent ? e.touches[0].clientY : e.clientY;

            const rect = windowElement.getBoundingClientRect();
            windowElement.classList.add('is-dragging');
            windowElement.style.left = `${rect.left}px`;
            windowElement.style.top = `${rect.top}px`;

            initialX = rect.left;
            initialY = rect.top;
            isDraggingWindow = true;
        };

        const moveDragWindow = (e) => {
            if (!isDraggingWindow) return;
            e.preventDefault();

            const touchEvent = e.type.includes('touch');
            const clientX = touchEvent ? e.touches[0].clientX : e.clientX;
            const clientY = touchEvent ? e.touches[0].clientY : e.clientY;
            const deltaX = clientX - startX;
            const deltaY = clientY - startY;

            const maxX = window.innerWidth - windowElement.offsetWidth;
            const maxY = window.innerHeight - windowElement.offsetHeight;

            const newX = Math.max(0, Math.min(initialX + deltaX, Math.max(0, maxX)));
            const newY = Math.max(0, Math.min(initialY + deltaY, Math.max(0, maxY)));

            windowElement.style.left = `${newX}px`;
            windowElement.style.top = `${newY}px`;
        };

        const endDragWindow = () => {
            isDraggingWindow = false;
        };

        windowHeader.addEventListener('mousedown', startDragWindow);
        windowHeader.addEventListener('touchstart', startDragWindow, { passive: false });
        document.addEventListener('mousemove', moveDragWindow);
        document.addEventListener('touchmove', moveDragWindow, { passive: false });
        document.addEventListener('mouseup', endDragWindow);
        document.addEventListener('touchend', endDragWindow);
    })();

    // -----------------------
    // 4. Закрытие окна
    // -----------------------
    let closingAnimationHandler = null;

    const resetWindowPosition = () => {
        windowElement.classList.remove('is-dragging');
        windowElement.style.left = '';
        windowElement.style.top = '';
    };

    function closeWindow() {
        if (!windowElement.classList.contains('is-visible') || windowElement.classList.contains('is-closing')) {
            return;
        }

        if (closingAnimationHandler) {
            windowElement.removeEventListener('animationend', closingAnimationHandler);
            closingAnimationHandler = null;
        }

        windowElement.classList.add('is-closing');

        closingAnimationHandler = (event) => {
            if (event.animationName !== 'window-minimize') return;

            windowElement.classList.remove('is-visible', 'is-closing');
            windowContent.innerHTML = '';
            resetWindowPosition();

            windowElement.removeEventListener('animationend', closingAnimationHandler);
            closingAnimationHandler = null;
        };

        windowElement.addEventListener('animationend', closingAnimationHandler);
    }

    closeButton.addEventListener(isMobile ? 'touchend' : 'click', (e) => {
        e.stopPropagation(); e.preventDefault();
        closeWindow();
    }, { passive: false });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && windowElement.classList.contains('is-visible')) {
            closeWindow();
        }
    });

    // -----------------------
    // 6. Открытие окна
    // -----------------------
    const createFolderRenderer = (type) => (index) => renderFolderContent(type, index);

    const WINDOW_RENDER_STRATEGIES = {
        photos: createFolderRenderer('photos'),
        projects: createFolderRenderer('projects'),
        trash: createFolderRenderer('trash'),
        text: () => renderTextFile(),
        calls: () => renderCalls(),
        notes: () => renderNotes(),
        github: () => loadGitHubProfile(),
        telegram: () => renderTelegram()
    };

    function openWindow(type, fileIndex = null) {
        if (!type) return;

        const wasHidden = !windowElement.classList.contains('is-visible');

        if (closingAnimationHandler) {
            windowElement.removeEventListener('animationend', closingAnimationHandler);
            closingAnimationHandler = null;
        }

        windowElement.classList.remove('is-closing');

        if (wasHidden) {
            resetWindowPosition();
        }

        windowElement.classList.add('is-visible');
        windowContent.innerHTML = '';

        const render = WINDOW_RENDER_STRATEGIES[type];

        if (render) {
            render(fileIndex);
        } else {
            console.warn(`No renderer configured for window type: ${type}`);
        }
    }

    // -----------------------
    // 7. Вспомогательные функции рендеринга
    // -----------------------
    function renderFolder(type) {
        const items = folderContents[type];
        windowContent.innerHTML = `
            <div class="folder-content">
                ${items.map((item, index) => `
                    <div class="folder-item" data-index="${index}" data-type="${type}">
                        <img src="${item.src}" alt="${item.name}">
                        <span>${item.name}</span>
                    </div>
                `).join('')}
            </div>
        `;
        const folderItems = windowContent.querySelectorAll('.folder-item');
        const selectEvent = isMobile ? 'touchend' : 'click';

        folderItems.forEach((item) => {
            const handleSelection = (e) => {
                e.stopPropagation();
                e.preventDefault();

                const index = Number.parseInt(item.dataset.index, 10);
                if (Number.isNaN(index)) return;

                if (type === 'projects') {
                    const project = folderContents[type][index];
                    if (project && project.url) {
                        window.open(project.url, '_blank', 'noopener');
                    }
                } else {
                    openWindow(type, index);
                }
            };

            item.addEventListener(selectEvent, handleSelection, { passive: false });
        });
    }

    function renderFolderContent(type, fileIndex) {
        const items = folderContents[type] || [];

        if (!items.length) {
            windowContent.innerHTML = `
                <div class="folder-content">
                    <p>Папка пока пуста.</p>
                </div>
            `;
            return;
        }

        if (Number.isInteger(fileIndex) && items[fileIndex]) {
            renderGallery(type, fileIndex);
        } else {
            renderFolder(type);
        }
    }

    function renderTextFile() {
        windowContent.innerHTML = `
            <div class="text-content">
                <h2>About</h2>
                <p>This is a desktop interface template.</p>
            </div>
        `;
    }

    function renderCalls() {
        windowContent.innerHTML = `<div class="call-log"><p>No recent calls</p></div>`;
    }

    function renderNotes() {
        windowContent.innerHTML = `<textarea class="notes-area" placeholder="Your notes..."></textarea>`;
    }

    function renderGallery(type, startIndex = 0) {
        const items = folderContents[type];
        currentIndex[type] = startIndex;

        windowContent.innerHTML = `
            <div class="gallery">
                <div class="arrow left">&#10094;</div>
                <div class="gallery-container">
                    ${items.map(item => `
                        <div class="gallery-item${type === 'projects' ? ' gallery-item--link' : ''}">
                            <img src="${item.src}" alt="${item.name}">
                        </div>
                    `).join('')}
                </div>
                <div class="arrow right">&#10095;</div>
            </div>
        `;

        const container = windowContent.querySelector('.gallery-container');
        const leftArrow = windowContent.querySelector('.arrow.left');
        const rightArrow = windowContent.querySelector('.arrow.right');

        const updateGallery = () => container.style.transform = `translateX(-${currentIndex[type] * 100}%)`;

        leftArrow.addEventListener('click', () => { currentIndex[type] = (currentIndex[type] - 1 + items.length) % items.length; updateGallery(); });
        rightArrow.addEventListener('click', () => { currentIndex[type] = (currentIndex[type] + 1) % items.length; updateGallery(); });

        updateGallery();

        if (type === 'projects') {
            windowContent.querySelectorAll('.gallery-item--link img').forEach((img, index) => {
                img.addEventListener('click', () => window.open(items[index].url, '_blank'));
            });
        }
    }

    // -----------------------
    // 8. GitHub профили
    // -----------------------
    function loadGitHubProfile() {
        windowContent.innerHTML = `
            <div class="github-profile">
                <div class="gh-profiles">
                    ${GITHUB_PROFILES.map(renderGitHubProfileSection).join("")}
                </div>
            </div>
        `;

        GITHUB_PROFILES.forEach(profile => hydrateGitHubProfile(profile));
    }

    function renderGitHubProfileSection({ prefix, username }) {
        return `
            <section class="gh-profile" data-user="${username}">
                <div class="gh-body">
                    <div class="gh-left-column">
                        <img id="${prefix}-avatar" class="gh-avatar" src="" alt="Avatar" />
                        <h2 id="${prefix}-name">Loading...</h2>
                        <p id="${prefix}-followers">Loading...</p>
                    </div>

                    <div class="gh-right-column">
                        <div class="gh-readme" id="${prefix}-readme">Loading README...</div>
                        <div class="gh-repos">
                            <h3>Popular repositories</h3>
                            <ul id="${prefix}-repos"></ul>
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    function hydrateGitHubProfile({ username, prefix }) {
        const avatar = document.getElementById(`${prefix}-avatar`);
        const name = document.getElementById(`${prefix}-name`);
        const followers = document.getElementById(`${prefix}-followers`);
        const reposList = document.getElementById(`${prefix}-repos`);
        const readmeContainer = document.getElementById(`${prefix}-readme`);

        fetchGitHubData(username)
            .then(({ user, repos, readme }) => {
                if (avatar && user) {
                    avatar.src = user.avatar_url;
                    avatar.alt = `Avatar ${user.login}`;
                }

                if (name) {
                    name.textContent = user ? (user.name || user.login) : "Failed to load";
                }

                if (followers) {
                    followers.textContent = user ? `${user.followers} followers · ${user.following} following` : "";
                }

                if (reposList) {
                    if (repos && repos.length) {
                        reposList.innerHTML = repos.map(repo => `
                            <li>
                                <a href="${repo.html_url}" target="_blank" rel="noopener">${repo.name}</a> ⭐ ${repo.stargazers_count}
                            </li>
                        `).join("");
                    } else {
                        reposList.textContent = "No public repositories.";
                    }
                }

                if (readmeContainer) {
                    if (readme) {
                        readmeContainer.innerHTML = marked.parse(readme);
                    } else {
                        readmeContainer.textContent = "No README found.";
                    }
                }
            })
            .catch((error) => {
                const isRateLimit = Boolean(error?.isRateLimit);

                if (name) {
                    name.textContent = isRateLimit ? 'Лимит GitHub API' : 'Failed to load';
                }

                if (followers) {
                    followers.textContent = '';
                }

                if (reposList) {
                    if (isRateLimit) {
                        reposList.innerHTML = `
                            <li>
                                <span>${GITHUB_RATE_LIMIT_MESSAGE}</span><br>
                                <a href="https://github.com/${username}" target="_blank" rel="noopener">Открыть профиль ${username}</a>
                            </li>
                        `;
                    } else {
                        reposList.textContent = 'Failed to load repos.';
                    }
                }

                if (readmeContainer) {
                    if (isRateLimit) {
                        readmeContainer.textContent = GITHUB_RATE_LIMIT_MESSAGE;
                    } else {
                        readmeContainer.textContent = 'No README found.';
                    }
                }
            });
    }

    function fetchGitHubData(username) {
        if (!githubDataCache[username]) {
            const cached = readGitHubCache(username);

            if (cached) {
                githubDataCache[username] = Promise.resolve(cached);

                refreshGitHubData(username)
                    .then((freshData) => {
                        githubDataCache[username] = Promise.resolve(freshData);
                    })
                    .catch((error) => {
                        if (error?.isRateLimit) {
                            console.info(`GitHub rate limit while refreshing ${username}: ${error.message}`);
                        } else {
                            console.warn(`Не удалось обновить данные GitHub для ${username}`, error);
                        }
                    });
            } else {
                githubDataCache[username] = refreshGitHubData(username);
            }
        }

        return githubDataCache[username];
    }

    function refreshGitHubData(username) {
        return Promise.all([
            fetchGitHubUser(username),
            fetchGitHubRepos(username).catch((error) => {
                if (error?.isRateLimit) throw error;
                return [];
            }),
            fetchUserReadme(username).catch((error) => {
                if (error?.isRateLimit) throw error;
                return null;
            })
        ])
            .then(([user, repos, readme]) => {
                const payload = { user, repos, readme };
                writeGitHubCache(username, payload);
                return payload;
            })
            .catch((error) => {
                delete githubDataCache[username];
                throw error;
            });
    }

    async function fetchGitHubResource(url, { responseType = 'json' } = {}) {
        const response = await fetch(url, { headers: GITHUB_REQUEST_HEADERS });

        if (response.status === 403) {
            let message = 'GitHub API rate limit exceeded';
            try {
                const body = await response.json();
                if (body?.message) {
                    message = body.message;
                }
            } catch (error) {
                console.warn('Не удалось разобрать тело ответа GitHub при 403.', error);
            }

            const rateLimitError = new Error(message);
            rateLimitError.isRateLimit = true;
            rateLimitError.status = 403;
            throw rateLimitError;
        }

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            const error = new Error(text || response.statusText);
            error.status = response.status;
            throw error;
        }

        if (responseType === 'text') {
            return response.text();
        }

        if (responseType === 'json') {
            return response.json();
        }

        return response;
    }

    function fetchGitHubUser(username) {
        return fetchGitHubResource(`https://api.github.com/users/${username}`);
    }

    function fetchGitHubRepos(username) {
        return fetchGitHubResource(`https://api.github.com/users/${username}/repos?sort=updated&per_page=5`)
            .then(repos => {
                if (!Array.isArray(repos)) throw new Error("Invalid repos response");
                return repos;
            });
    }

    function fetchUserReadme(username) {
        const readmePaths = [
            `https://raw.githubusercontent.com/${username}/${username}/main/README.md`,
            `https://raw.githubusercontent.com/${username}/${username}/master/README.md`,
            `https://raw.githubusercontent.com/${username}/profile/main/README.md`
        ];

        const tryFetch = async (index = 0) => {
            if (index >= readmePaths.length) {
                throw new Error("README not found");
            }

            try {
                const response = await fetch(readmePaths[index]);
                if (response.status === 403) {
                    const rateLimitError = new Error('GitHub raw rate limit');
                    rateLimitError.isRateLimit = true;
                    rateLimitError.status = 403;
                    throw rateLimitError;
                }

                if (!response.ok) {
                    throw new Error("Not found");
                }

                return await response.text();
            } catch (error) {
                if (error?.isRateLimit) throw error;
                return tryFetch(index + 1);
            }
        };

        return tryFetch();
    }
    // -----------------------
    // 9. Telegram
    // -----------------------
    function renderTelegram() {
        windowContent.innerHTML = `
            <div class="telegram-window">
                <div class="telegram-header">Telegram</div>
                <div class="telegram-body">
                    <div class="telegram-chat-list" id="telegram-chat-list"></div>
                    <div class="telegram-messages" id="telegram-messages"></div>
                </div>
                <div class="telegram-input">
                    <input type="text" id="telegram-input" placeholder="Type a message...">
                    <button id="telegram-send">&#9658;</button>
                </div>
            </div>
        `;

        const chatList = document.getElementById('telegram-chat-list');
        const messagesContainer = document.getElementById('telegram-messages');
        const input = document.getElementById('telegram-input');
        const sendBtn = document.getElementById('telegram-send');

        if (!telegramState.chats.length) {
            telegramState.chats.push({
                id: Date.now(),
                name: 'New chat',
                avatar: 'photos/photo1.jpg',
                messages: []
            });
        }

        if (!telegramState.activeChatId) {
            telegramState.activeChatId = telegramState.chats[0].id;
        }

        const findChat = (id) => telegramState.chats.find((chat) => chat.id === id);

        const renderChatList = () => {
            chatList.innerHTML = telegramState.chats.map(chat => `
                <div class="telegram-chat-item${chat.id === telegramState.activeChatId ? ' is-active' : ''}" data-id="${chat.id}">
                    <img src="${chat.avatar}" alt="${chat.name}">
                    <span>${chat.name}</span>
                </div>
            `).join('');
        };

        const renderMessages = () => {
            const chat = findChat(telegramState.activeChatId);
            if (!chat) return;

            messagesContainer.innerHTML = chat.messages.map(msg => `
                <div class="telegram-message ${msg.type}">${msg.text}</div>
            `).join('');

            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        };

        chatList.addEventListener('click', (e) => {
            const item = e.target.closest('.telegram-chat-item');
            if (!item) return;

            const nextId = Number.parseInt(item.dataset.id, 10);
            if (Number.isNaN(nextId)) return;

            telegramState.activeChatId = nextId;
            renderChatList();
            renderMessages();
        });

        sendBtn.addEventListener('click', () => {
            const text = input.value.trim();
            if (!text) return;

            const chat = findChat(telegramState.activeChatId);
            if (!chat) return;

            chat.messages.push({ type: 'sent', text });
            input.value = '';
            renderMessages();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendBtn.click();
            }
        });

        renderChatList();
        renderMessages();
    }

    // System notifications removed
    // Hash checking removed	
});
