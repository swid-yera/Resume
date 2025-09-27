// script.js
document.addEventListener('DOMContentLoaded', () => {
    const desktop = document.getElementById('desktop');
    const files = document.querySelectorAll('.file');
    const windowElement = document.getElementById('window');
    const windowContent = document.getElementById('window-content');
    const closeButton = document.getElementById('close-window');
    const datetimeElement = document.getElementById('datetime');
    const lockTimeElement = document.getElementById('lock-time');
    const lockDateElement = document.getElementById('lock-date');
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent);
    const PADDING = 20;

    // Lock Screen
    const lockScreen = document.getElementById('lock-screen');

    // Unlock functionality
    function unlockScreen() {
        lockScreen.classList.add('hide');
        setTimeout(() => {
            lockScreen.style.display = 'none';
        }, 200);
    }

    // Event listeners for unlock
    // Click anywhere on lock screen to unlock
    lockScreen.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Lock screen click detected');
        unlockScreen();
    });

    lockScreen.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Lock screen touch detected');
        unlockScreen();
    });

    const folderContents = {
        photos: [
            { src: 'photos/photo1.jpg', name: 'Photo 1' },
            { src: 'photos/photo2.jpg', name: 'Photo 2' },
            { src: 'photos/photo3.jpg', name: 'Photo 3' }
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

    // -----------------------
    // 1. Дата и время
    // -----------------------
    function updateDateTime() {
        const now = new Date();

        // Время и дата в lock screen
        if (lockTimeElement && lockDateElement) {
            const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
            lockTimeElement.textContent = now.toLocaleTimeString('ru-RU', timeOptions);

            const dateOptions = { weekday: 'short', day: 'numeric', month: 'short' };
            lockDateElement.textContent = now.toLocaleDateString('en-US', dateOptions);
        }

        // Дата и время в меню
        const options = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
        datetimeElement.textContent = now.toLocaleString('ru-RU', options).replace(',', '');

        setTimeout(updateDateTime, 1000);
    }
    updateDateTime();

    // Check button functionality
    const checkButton = document.getElementById('check-button');
    const checkPanel = document.getElementById('check-panel');

    if (checkButton) {
        checkButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (checkPanel.style.display === 'block') {
                checkPanel.style.display = 'none';
            } else {
                checkPanel.style.display = 'block';
            }
        });

        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.corner-area') && !e.target.closest('.check-panel')) {
                checkPanel.style.display = 'none';
            }
        });
    }

    // Инициализация начальных позиций иконок
    files.forEach(file => {
        if (isMobile) {
            if (file.dataset.type === 'projects') {
                file.style.position = 'absolute';
                file.style.left = '20px';
                file.style.top = '40px';
            } else if (file.dataset.type === 'photos') {
                file.style.position = 'absolute';
                file.style.left = '20px';
                file.style.top = '160px';
            } else if (file.dataset.type === 'text') {
                file.style.position = 'absolute';
                file.style.left = '20px';
                file.style.top = '280px';
            }
        }
    });

    // -----------------------
    // 2. Перетаскивание файлов
    // -----------------------
    function setupFileDragging(file) {
        let isDragging = false, startX, startY, offsetX, offsetY;
        let hasMoved = false, startTarget = null, isProcessing = false;

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
            file.style.position = 'absolute';
            file.style.zIndex = '30';
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
                file.style.zIndex = '20';
            }

            if (!hasMoved && startTarget && startTarget === file && !isProcessing) {
                isProcessing = true;
                openWindow(file.dataset.type);
                setTimeout(() => { isProcessing = false; }, 100);
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
            file.addEventListener('click', (e) => {
                if (!hasMoved && !isDragging && !isProcessing) {
                    isProcessing = true;
                    openWindow(file.dataset.type);
                    setTimeout(() => { isProcessing = false; }, 100);
                }
            });
        }
    }

    const startYDesktop = 50; // отступ сверху для первого элемента
    const gap = 150;          // вертикальный отступ между элементами

    files.forEach((file, index) => {
        file.style.position = 'absolute';
        file.style.left = '20px';                     // фиксированная позиция слева
        file.style.top = `${startYDesktop + index * gap}px`;

        // Все файлы можно перетаскивать
        setupFileDragging(file);
    });

    // -----------------------
    // Dock items
    // -----------------------
    const dockItems = document.querySelectorAll('.dock-item');
    dockItems.forEach(item => {
        const handler = (e) => {
            e.stopPropagation();
            openWindow(item.dataset.type);
        };
        item.addEventListener(isMobile ? 'touchend' : 'click', handler, { passive: true });

        // Add comments for calls
        if (item.dataset.type === 'calls') {
            item.addEventListener('mouseenter', () => {
                if (!isMobile) {
                    item.setAttribute('title', 'Звонки - История вызовов');
                }
            });
        }
    });

    // -----------------------
    // 3. Перетаскивание окна
    // -----------------------
    (function setupWindowDragging() {
        let isDraggingWindow = false, startX, startY, initialX, initialY;
        const windowHeader = windowElement.querySelector('.window-header');

        const startDragWindow = (e) => {
            e.preventDefault();
            isDraggingWindow = true;
            startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            const rect = windowElement.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
        };

        const moveDragWindow = (e) => {
            if (!isDraggingWindow) return;
            e.preventDefault();
            const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            const deltaX = clientX - startX;
            const deltaY = clientY - startY;
            const newX = initialX + deltaX;
            const newY = initialY + deltaY;
            windowElement.style.left = `${Math.max(0, Math.min(newX, window.innerWidth - windowElement.offsetWidth))}px`;
            windowElement.style.top = `${Math.max(0, Math.min(newY, window.innerHeight - windowElement.offsetHeight))}px`;
        };

        const endDragWindow = () => { isDraggingWindow = false; };

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
    function closeWindow() {
        windowElement.style.animation = 'window-minimize 0.3s ease forwards';
        setTimeout(() => {
            windowElement.style.display = 'none';
            windowElement.style.animation = '';
            windowContent.innerHTML = '';
            windowElement.style.left = isMobile ? 'calc(50% - 45vw)' : 'calc(50% - 400px)';
            windowElement.style.top = '50px';
        }, 300);
    }

    closeButton.addEventListener(isMobile ? 'touchend' : 'click', (e) => {
        e.stopPropagation(); e.preventDefault();
        closeWindow();
    }, { passive: false });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && windowElement.style.display === 'block') closeWindow();
    });

    // -----------------------
    // 5. Док-бар
    // -----------------------
    dockItems.forEach(item => {
        item.addEventListener(isMobile ? 'touchend' : 'click', (e) => {
            e.stopPropagation();
            // Всегда открываем окно для всех dock items
            openWindow(item.dataset.type);
        }, { passive: true });
    });


    // -----------------------
    // 6. Открытие окна
    // -----------------------
    function openWindow(type, fileIndex = null) {
        windowElement.style.display = 'block';
        windowElement.style.left = isMobile ? 'calc(50% - 45vw)' : 'calc(50% - 400px)';
        windowElement.style.top = '50px';
        windowContent.innerHTML = '';

        if (['photos', 'projects', 'trash'].includes(type)) {
            if (fileIndex !== null) renderGallery(type, fileIndex);
            else renderFolder(type);
        } else if (type === 'text') renderTextFile();
        else if (type === 'calls') renderCalls();
        else if (type === 'notes') renderNotes();
        else if (type === 'github') loadGitHubProfile();
        else if (type === 'telegram') renderTelegram();
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
        folderItems.forEach(item => {
            if (!isMobile) {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(item.dataset.index);
                    if (type === 'projects') window.open(folderContents[type][index].url, '_blank');
                    else openWindow(type, index);
                }, { passive: false });
            }
        });
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
                        <div class="gallery-item">
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
            windowContent.querySelectorAll('.gallery-item img').forEach((img, index) => {
                img.style.cursor = 'pointer';
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
            .catch(() => {
                if (name) name.textContent = "Failed to load";
                if (followers) followers.textContent = "";
                if (reposList) reposList.textContent = "Failed to load repos.";
                if (readmeContainer) readmeContainer.textContent = "No README found.";
            });
    }

    function fetchGitHubData(username) {
        if (!githubDataCache[username]) {
            githubDataCache[username] = Promise.all([
                fetchGitHubUser(username),
                fetchGitHubRepos(username).catch(() => []),
                fetchUserReadme(username).catch(() => null)
            ])
                .then(([user, repos, readme]) => ({ user, repos, readme }))
                .catch(error => {
                    delete githubDataCache[username];
                    throw error;
                });
        }

        return githubDataCache[username];
    }

    function fetchGitHubUser(username) {
        return fetch(`https://api.github.com/users/${username}`)
            .then(res => {
                if (!res.ok) throw new Error(res.statusText);
                return res.json();
            });
    }

    function fetchGitHubRepos(username) {
        return fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=5`)
            .then(res => {
                if (!res.ok) throw new Error(res.statusText);
                return res.json();
            })
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

        const tryFetch = (index = 0) => {
            if (index >= readmePaths.length) {
                return Promise.reject(new Error("README not found"));
            }

            return fetch(readmePaths[index])
                .then(res => {
                    if (!res.ok) throw new Error("Not found");
                    return res.text();
                })
                .catch(() => tryFetch(index + 1));
        };

        return tryFetch();
    }

    GITHUB_PROFILES.forEach(({ username }) => {
        fetchGitHubData(username).catch(() => { /* данная ошибка отобразится при открытии окна */ });
    });

    // -----------------------
    // 9. Анимации
    // -----------------------
    const style = document.createElement('style');
    style.innerHTML = `@keyframes window-minimize { to { transform: scale(0.3); opacity: 0; } }`;
    document.head.appendChild(style);

    // -----------------------
    // 10. Telegram
    // -----------------------
    function renderTelegram() {
        windowContent.innerHTML = `
            <div class="telegram-window">
                <div class="telegram-header">Telegram</div>
                <div style="display:flex; flex:1; overflow:hidden;">
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

        const chats = [
            { id: 1, name: 'Alice', avatar: 'photos/photo1.jpg', messages: [{ type: 'received', text: 'Hi there!' }] },
            { id: 2, name: 'Bob', avatar: 'photos/photo2.jpg', messages: [{ type: 'received', text: 'Hello!' }] },
        ];

        let activeChatId = chats[0].id;

        function renderChatList() {
            chatList.innerHTML = chats.map(chat => `
                <div class="telegram-chat-item" data-id="${chat.id}">
                    <img src="${chat.avatar}" alt="${chat.name}">
                    <span>${chat.name}</span>
                </div>
            `).join('');
        }

        function renderMessages() {
            const chat = chats.find(c => c.id === activeChatId);
            messagesContainer.innerHTML = chat.messages.map(msg => `
                <div class="telegram-message ${msg.type}">${msg.text}</div>
            `).join('');
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        chatList.addEventListener('click', e => {
            const item = e.target.closest('.telegram-chat-item');
            if (!item) return;
            activeChatId = parseInt(item.dataset.id);
            renderMessages();
        });

        sendBtn.addEventListener('click', () => {
            const text = input.value.trim();
            if (!text) return;
            const chat = chats.find(c => c.id === activeChatId);
            chat.messages.push({ type: 'sent', text });
            input.value = '';
            renderMessages();
        });

        input.addEventListener('keydown', e => { if (e.key === 'Enter') sendBtn.click(); });

        renderChatList();
        renderMessages();
    }

    // System notifications removed
    // Hash checking removed	
});
