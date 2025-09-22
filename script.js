// script.js
document.addEventListener('DOMContentLoaded', () => {
    const desktop = document.getElementById('desktop');
    const files = document.querySelectorAll('.file');
    const windowElement = document.getElementById('window');
    const windowContent = document.getElementById('window-content');
    const closeButton = document.getElementById('close-window');
    const datetimeElement = document.getElementById('datetime');
    const dockItems = document.querySelectorAll('.dock-item');
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent);
    const PADDING = 20;

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

    // -----------------------
    // 1. Дата и время
    // -----------------------
    (function updateDateTime() {
        const now = new Date();
        const options = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
        datetimeElement.textContent = now.toLocaleString('ru-RU', options).replace(',', '');
        setTimeout(updateDateTime, 1000);
    })();

    // -----------------------
    // 2. Перетаскивание файлов
    // -----------------------
    function setupFileDragging(file) {
        let isDragging = false, startX, startY, offsetX, offsetY;
        let hasMoved = false, startTarget = null, isProcessing = false;

        const startDrag = (e) => {
            if (isMobile && !e.target.closest('.file-icon')) return;
            const targetFile = e.target.closest('.file');
            if (!targetFile || isProcessing) return;
            e.preventDefault();
            startTarget = targetFile;
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
            if (!hasMoved && startTarget && startTarget === e.target.closest('.file') && !isProcessing) {
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

    files.forEach(file => {
        setupFileDragging(file);
        if (isMobile) {
            switch (file.dataset.type) {
                case 'projects': file.style.left = '20px'; file.style.top = '40px'; break;
                case 'photos': file.style.left = '20px'; file.style.top = '160px'; break;
                case 'text': file.style.left = '20px'; file.style.top = '280px'; break;
            }
            file.style.position = 'absolute';
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
            if (!['telegram','instagram'].includes(item.dataset.type)) openWindow(item.dataset.type);
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

        if (['photos','projects','trash'].includes(type)) {
            if (fileIndex !== null) renderGallery(type, fileIndex);
            else renderFolder(type);
        } else if (type === 'text') renderTextFile();
        else if (type === 'calls') renderCalls();
        else if (type === 'notes') renderNotes();
        else if (type === 'github') loadGitHubProfile();
    }

    // -----------------------
    // 7. Вспомогательные функции рендеринга
    // -----------------------
    function renderFolder(type) {
        const items = folderContents[type];
        windowContent.innerHTML = `
            <div class="folder-content">
                ${items.map((item,index) => `
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

        const updateGallery = () => container.style.transform = `translateX(-${currentIndex[type]*100}%)`;

        leftArrow.addEventListener('click', () => { currentIndex[type] = (currentIndex[type]-1+items.length)%items.length; updateGallery(); });
        rightArrow.addEventListener('click', () => { currentIndex[type] = (currentIndex[type]+1)%items.length; updateGallery(); });

        updateGallery();

        if (type === 'projects') {
            windowContent.querySelectorAll('.gallery-item img').forEach((img,index) => {
                img.style.cursor = 'pointer';
                img.addEventListener('click', () => window.open(items[index].url,'_blank'));
            });
        }
    }

    // -----------------------
    // 8. GitHub профиль
    // -----------------------
    function loadGitHubProfile() {
        windowContent.innerHTML = `
            <div id="github-profile" style="padding:15px; font-family:sans-serif; color:#fff;">
                <h2>GitHub Profile</h2>
                <div id="github-info">Loading...</div>
                <h3 style="margin-top:15px;">Popular repositories</h3>
                <ul id="github-repos" style="list-style:none; padding:0; margin-top:10px;"></ul>
                <h3 style="margin-top:15px;">README</h3>
                <div id="github-readme" style="margin-top:10px; background:#0d1117; padding:10px; border-radius:6px;"></div>
            </div>
        `;

        fetch("https://api.github.com/users/swid-yera").then(res=>res.json()).then(user=>{
            document.getElementById("github-info").innerHTML = `
                <img src="${user.avatar_url}" width="80" style="border-radius:50%; margin-bottom:10px;" />
                <p><b>${user.name||user.login}</b></p>
                <p>${user.bio||"No bio available"}</p>
                <p>${user.followers} followers · ${user.following} following</p>
                <a href="${user.html_url}" target="_blank" style="color:#58a6ff;">View on GitHub</a>
            `;
        }).catch(()=>document.getElementById("github-info").textContent="Failed to load profile.");

        fetch("https://api.github.com/users/swid-yera/repos?sort=updated&per_page=5").then(res=>res.json()).then(repos=>{
            document.getElementById("github-repos").innerHTML = repos.map(repo=>`
                <li style="margin-bottom:10px;">
                    <a href="${repo.html_url}" target="_blank" style="color:#58a6ff; text-decoration:none;">${repo.name}</a> ⭐ ${repo.stargazers_count}
                </li>
            `).join("");
        }).catch(()=>document.getElementById("github-repos").textContent="Failed to load repos.");

        fetch("https://raw.githubusercontent.com/swid-yera/swid-yera/main/README.md").then(res=>res.text()).then(readme=>{
            document.getElementById("github-readme").innerHTML = marked.parse(readme);
        }).catch(()=>document.getElementById("github-readme").textContent="No README found.");
    }

    // -----------------------
    // 9. Анимации
    // -----------------------
    const style = document.createElement('style');
    style.innerHTML = `@keyframes window-minimize { to { transform: scale(0.3); opacity: 0; } }`;
    document.head.appendChild(style);
});
