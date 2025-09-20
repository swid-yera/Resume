// script.js 
document.addEventListener('DOMContentLoaded', () => {
    const desktop = document.getElementById('desktop');
    const files = document.querySelectorAll('.file');
    const windowElement = document.getElementById('window');
    const windowContent = document.getElementById('window-content');
    const closeButton = document.getElementById('close-window');
    const datetimeElement = document.getElementById('datetime');
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent);
    const PADDING = 20;

    const folderContents = {
        photos: [],
        projects: [],
        trash: []
    };

    function updateDateTime() {
        const now = new Date();
        const options = {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        datetimeElement.textContent = now.toLocaleString('ru-RU', options).replace(',', '');
        setTimeout(updateDateTime, 1000);
    }
    updateDateTime();

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

    files.forEach(file => {
        let isDragging = false, startX, startY, offsetX, offsetY;
        let hasMoved = false;
        let startTarget = null;
        let isProcessing = false;

        const startDrag = (e) => {
            if (isMobile && !e.target.closest('.file-icon')) return;
            const targetFile = e.target.closest('.file');
            if (!targetFile || isProcessing) return;
            e.preventDefault();
            startTarget = targetFile;
            isDragging = true;
            hasMoved = false;
            const rect = file.getBoundingClientRect();
            startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            offsetX = startX - rect.left;
            offsetY = startY - rect.top;
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
    });

    const dockItems = document.querySelectorAll('.dock-item');
    dockItems.forEach(item => {
        const handler = (e) => {
            e.stopPropagation();
            if (item.dataset.type === 'telegram' || item.dataset.type === 'github' || item.dataset.type === 'instagram') {
                // Links removed
            } else {
                openWindow(item.dataset.type);
            }
        };
        item.addEventListener(isMobile ? 'touchend' : 'click', handler, { passive: true });
    });

    let isDraggingWindow = false, startX, startY, initialX, initialY;
    const windowHeader = windowElement.querySelector('.window-header');

    const startDragWindow = (e) => {
        e.preventDefault();
        isDraggingWindow = true;
        startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        const rect = windowElement.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
    };

    const moveDragWindow = (e) => {
        if (!isDraggingWindow) return;
        e.preventDefault();
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        const deltaX = clientX - startX;
        const deltaY = clientY - startY;
        const newX = initialX + deltaX;
        const newY = initialY + deltaY;
        windowElement.style.left = `${Math.max(0, Math.min(newX, window.innerWidth - windowElement.offsetWidth))}px`;
        windowElement.style.top = `${Math.max(0, Math.min(newY, window.innerHeight - windowElement.offsetHeight))}px`;
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
        e.stopPropagation();
        e.preventDefault();
        closeWindow();
    }, { passive: false });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && windowElement.style.display === 'block') {
            closeWindow();
        }
    });

    function openWindow(type, fileIndex = null) {
        windowElement.style.display = 'block';
        windowElement.style.left = isMobile ? 'calc(50% - 45vw)' : 'calc(50% - 400px)';
        windowElement.style.top = '50px';
        windowContent.innerHTML = '';
        setTimeout(() => {
            if (fileIndex !== null && (type === 'photos' || type === 'projects' || type === 'trash')) {
                const items = folderContents[type];
                windowContent.innerHTML = `
                    <div class="gallery" id="gallery-${type}">
                        <div class="arrow left" data-direction="-1" data-type="${type}"><</div>
                        <div class="gallery-container" id="gallery-container-${type}">
                            ${items.map((item, index) => `
                                <div class="gallery-item">
                                    ${item.type === 'image' ? `<img src="${item.src}" alt="${item.name}">` : item.type === 'link' ? `<img src="${item.src}" alt="${item.name}" data-url="${item.url}" class="gallery-link">` : `
                                        <video autoplay loop muted>
                                            <source src="${item.src}" type="video/webm">
                                        </video>
                                    `}
                                </div>
                            `).join('')}
                        </div>
                        <div class="arrow right" data-direction="1" data-type="${type}">></div>
                    </div>
                `;
                setupGallery(type, fileIndex);
            } else {
                switch (type) {
                    case 'photos':
                    case 'projects':
                    case 'trash':
                        windowContent.innerHTML = `
                            <div class="folder-content">
                                ${folderContents[type].map((item, index) => `
                                    <div class="folder-item" data-index="${index}" data-type="${type}">
                                        <img src="${item.src}" alt="${item.name}">
                                        <span>${item.name}</span>
                                    </div>
                                `).join('')}
                            </div>
                        `;
                        const folderItems = windowContent.querySelectorAll('.folder-item');
                        folderItems.forEach(item => {
                            let touchStartTime = 0;
                            let touchStartX = 0;
                            let touchStartY = 0;
                            let isSwipingFolder = false;

                            item.addEventListener('touchstart', (e) => {
                                touchStartTime = Date.now();
                                touchStartX = e.touches[0].clientX;
                                touchStartY = e.touches[0].clientY;
                                isSwipingFolder = false;
                            }, { passive: true });

                            item.addEventListener('touchmove', (e) => {
                                const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
                                const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
                                if (deltaX > 10 || deltaY > 10) {
                                    isSwipingFolder = true;
                                }
                            }, { passive: true });

                            item.addEventListener('touchend', (e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const touchDuration = Date.now() - touchStartTime;
                                if (!isSwipingFolder && touchDuration < 300) {
                                    const index = parseInt(item.dataset.index);
                                    if (type === 'projects') {
                                        window.open(folderContents[type][index].url, '_blank');
                                    } else {
                                        openWindow(type, index);
                                    }
                                }
                            }, { passive: false });

                            if (!isMobile) {
                                item.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    const index = parseInt(item.dataset.index);
                                    if (type === 'projects') {
                                        window.open(folderContents[type][index].url, '_blank');
                                    } else {
                                        openWindow(type, index);
                                    }
                                }, { passive: false });
                            }
                        });
                        break;
                    case 'text':
                        windowContent.innerHTML = `
                            <div class="text-content">
                                <h2>About</h2>
                                <p>This is a desktop interface template.</p>
                            </div>
                        `;
                        break;
                    case 'calls':
                        windowContent.innerHTML = `
                            <div class="call-log">
                                <p>No recent calls</p>
                            </div>
                        `;
                        break;
					case 'notes':
						windowContent.innerHTML = `
							<textarea class="notes-area" placeholder="Your notes..."></textarea>
						`;
						const notesArea = windowContent.querySelector('.notes-area');
						let initialNotes = '';
						let isWindowOpen = true;

						// Notes functionality removed
						break;
                }
            }
        }, 0);
    }

    let currentIndex = { photos: 0, projects: 0, trash: 0 };
    function setupGallery(type, startIndex = 0) {
        const gallery = document.getElementById(`gallery-${type}`);
        if (!gallery) return;
        const container = document.getElementById(`gallery-container-${type}`);
        const arrows = gallery.querySelectorAll('.arrow');
        let startX, isSwiping = false;

        currentIndex[type] = startIndex;
        container.style.transform = `translateX(-${currentIndex[type] * 100}%)`;

        const arrowHandler = (e) => {
            e.stopPropagation();
            e.preventDefault();
            navigateGallery(parseInt(e.currentTarget.dataset.direction), type);
        };

        arrows.forEach(arrow => {
            arrow.removeEventListener(isMobile ? 'touchend' : 'click', arrowHandler);
            arrow.addEventListener(isMobile ? 'touchend' : 'click', arrowHandler, { passive: false });
        });

        const touchStartHandler = (e) => {
            startX = e.touches[0].clientX;
            isSwiping = true;
        };

        const touchMoveHandler = (e) => {
            if (isSwiping) e.preventDefault();
        };

        const touchEndHandler = (e) => {
            if (isSwiping) {
                const deltaX = e.changedTouches[0].clientX - startX;
                if (deltaX > 20) navigateGallery(-1, type);
                else if (deltaX < -20) navigateGallery(1, type);
            }
            isSwiping = false;
        };

        gallery.removeEventListener('touchstart', touchStartHandler);
        gallery.removeEventListener('touchmove', touchMoveHandler);
        gallery.removeEventListener('touchend', touchEndHandler);

        gallery.addEventListener('touchstart', touchStartHandler, { passive: false });
        gallery.addEventListener('touchmove', touchMoveHandler, { passive: false });
        gallery.addEventListener('touchend', touchEndHandler, { passive: false });

        // Добавляем обработчик для открытия ссылки при клике на изображение в галерее
        if (type === 'projects') {
            const galleryItems = gallery.querySelectorAll('.gallery-item');
            galleryItems.forEach(item => {
                const img = item.querySelector('.gallery-link');
                if (img) {
                    let touchStartTime = 0;
                    let touchStartX = 0;
                    let touchStartY = 0;
                    let isSwipingItem = false;

                    img.addEventListener('touchstart', (e) => {
                        touchStartTime = Date.now();
                        touchStartX = e.touches[0].clientX;
                        touchStartY = e.touches[0].clientY;
                        isSwipingItem = false;
                    }, { passive: true });

                    img.addEventListener('touchmove', (e) => {
                        const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
                        const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
                        if (deltaX > 10 || deltaY > 10) {
                            isSwipingItem = true;
                        }
                    }, { passive: true });

                    img.addEventListener('touchend', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const touchDuration = Date.now() - touchStartTime;
                        if (!isSwipingItem && touchDuration < 300) {
                            const url = img.dataset.url;
                            if (url) {
                                window.open(url, '_blank');
                            }
                        }
                    }, { passive: false });

                    if (!isMobile) {
                        img.addEventListener('click', (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const url = img.dataset.url;
                            if (url) {
                                window.open(url, '_blank');
                            }
                        }, { passive: false });
                    }
                }
            });
        }

        if (!isMobile) {
            const mouseDownHandler = (e) => {
                startX = e.clientX;
                isSwiping = true;
            };

            const mouseMoveHandler = (e) => {
                if (isSwiping) e.preventDefault();
            };

            const mouseUpHandler = (e) => {
                if (isSwiping) {
                    const deltaX = e.clientX - startX;
                    if (deltaX > 20) navigateGallery(-1, type);
                    else if (deltaX < -20) navigateGallery(1, type);
                }
                isSwiping = false;
            };

            gallery.removeEventListener('mousedown', mouseDownHandler);
            gallery.removeEventListener('mousemove', mouseMoveHandler);
            gallery.removeEventListener('mouseup', mouseUpHandler);

            gallery.addEventListener('mousedown', mouseDownHandler);
            gallery.addEventListener('mousemove', mouseMoveHandler);
            gallery.addEventListener('mouseup', mouseUpHandler);
        }
    }

    function navigateGallery(direction, type) {
        const container = document.getElementById(`gallery-container-${type}`);
        if (!container) return;
        const items = container.querySelectorAll('.gallery-item');
        currentIndex[type] = (currentIndex[type] + direction + items.length) % items.length;
        container.style.transform = `translateX(-${currentIndex[type] * 100}%)`;
    }

    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes window-minimize {
            to { transform: scale(0.3); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

	// System notifications removed

	// Hash checking removed








	
});

