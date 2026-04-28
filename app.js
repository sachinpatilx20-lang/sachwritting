/* ========================================
   ListCraft — Application Logic
   ======================================== */

(function () {
    'use strict';

    // ── DOM References ──────────────────────────
    const body = document.body;
    const listTitle = document.getElementById('list-title');
    const listItems = document.getElementById('list-items');
    const btnAddItem = document.getElementById('btn-add-item');
    const btnNewList = document.getElementById('btn-new-list');
    const btnExportPdf = document.getElementById('btn-export-pdf');
    const btnBgOptions = document.getElementById('btn-bg-options');
    const bgPanel = document.getElementById('bg-panel');
    const btnCloseBg = document.getElementById('btn-close-bg');
    const fontSizeSelect = document.getElementById('font-size-select');
    const toast = document.getElementById('toast');

    let itemCounter = 1;
    let dragSrcEl = null;

    // ── Initialize ──────────────────────────────
    function init() {
        loadFromStorage();
        setupFormatButtons();
        setupBackgroundPanel();
        setupEventListeners();
        setupDragAndDrop();
    }

    // ── List Item Creation ──────────────────────
    function createListItem(content = '', checked = false) {
        const item = document.createElement('div');
        item.className = 'list-item' + (checked ? ' checked' : '');
        item.setAttribute('data-index', itemCounter++);
        item.draggable = true;

        item.innerHTML = `
            <div class="item-handle" title="Drag to reorder">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                    <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                    <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                </svg>
            </div>
            <label class="item-checkbox">
                <input type="checkbox" ${checked ? 'checked' : ''}>
                <span class="checkmark"></span>
            </label>
            <div class="item-content" contenteditable="true" data-placeholder="Type something...">${content}</div>
            <button class="item-delete" title="Delete item">&times;</button>
        `;

        // Checkbox toggle
        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => {
            item.classList.toggle('checked', checkbox.checked);
            saveToStorage();
        });

        // Delete button
        const deleteBtn = item.querySelector('.item-delete');
        deleteBtn.addEventListener('click', () => {
            item.style.transform = 'translateX(40px)';
            item.style.opacity = '0';
            setTimeout(() => {
                item.remove();
                saveToStorage();
                // If no items left, add one
                if (listItems.children.length === 0) {
                    addItem();
                }
            }, 200);
        });

        // Content editing - Enter creates new item
        const contentEl = item.querySelector('.item-content');
        contentEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const newItem = addItem();
                const newContent = newItem.querySelector('.item-content');
                if (newContent) newContent.focus();
            }
            // Backspace on empty item removes it
            if (e.key === 'Backspace' && contentEl.textContent.trim() === '' && listItems.children.length > 1) {
                e.preventDefault();
                const prevItem = item.previousElementSibling;
                item.remove();
                if (prevItem) {
                    const prevContent = prevItem.querySelector('.item-content');
                    prevContent.focus();
                    // Place cursor at end
                    const range = document.createRange();
                    const sel = window.getSelection();
                    range.selectNodeContents(prevContent);
                    range.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                saveToStorage();
            }
        });

        contentEl.addEventListener('input', debounce(saveToStorage, 500));

        // Drag events
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
        item.addEventListener('drop', handleDrop);

        return item;
    }

    function addItem(content = '', checked = false) {
        const item = createListItem(content, checked);
        listItems.appendChild(item);
        saveToStorage();
        return item;
    }

    // ── Formatting ──────────────────────────────
    function setupFormatButtons() {
        document.querySelectorAll('.fmt-btn[data-cmd]').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Don't lose selection
            });
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const cmd = btn.getAttribute('data-cmd');
                document.execCommand(cmd, false, null);
                updateToolbarState();
            });
        });

        fontSizeSelect.addEventListener('mousedown', (e) => {
            // Allow the select to open
        });

        fontSizeSelect.addEventListener('change', () => {
            document.execCommand('fontSize', false, fontSizeSelect.value);
            saveToStorage();
        });

        // Track selection changes to update toolbar state
        document.addEventListener('selectionchange', updateToolbarState);
    }

    function updateToolbarState() {
        const commands = ['bold', 'italic', 'underline', 'strikeThrough'];
        commands.forEach(cmd => {
            const btn = document.querySelector(`.fmt-btn[data-cmd="${cmd}"]`);
            if (btn) {
                btn.classList.toggle('active', document.queryCommandState(cmd));
            }
        });
    }

    // ── Background Panel ────────────────────────
    function setupBackgroundPanel() {
        btnBgOptions.addEventListener('click', () => {
            bgPanel.classList.toggle('hidden');
        });

        btnCloseBg.addEventListener('click', () => {
            bgPanel.classList.add('hidden');
        });

        document.querySelectorAll('.bg-option').forEach(option => {
            option.addEventListener('click', () => {
                const bg = option.getAttribute('data-bg');
                body.setAttribute('data-bg', bg);

                // Update active state
                document.querySelectorAll('.bg-option').forEach(o => o.classList.remove('active'));
                option.classList.add('active');

                localStorage.setItem('listcraft-bg', bg);
                showToast('Background updated');
            });
        });

        // Close panel on outside click
        document.addEventListener('click', (e) => {
            if (!bgPanel.contains(e.target) && e.target !== btnBgOptions && !btnBgOptions.contains(e.target)) {
                bgPanel.classList.add('hidden');
            }
        });

        // Load saved background
        const savedBg = localStorage.getItem('listcraft-bg');
        if (savedBg) {
            body.setAttribute('data-bg', savedBg);
            document.querySelectorAll('.bg-option').forEach(o => {
                o.classList.toggle('active', o.getAttribute('data-bg') === savedBg);
            });
        }
    }

    // ── Event Listeners ─────────────────────────
    function setupEventListeners() {
        btnAddItem.addEventListener('click', () => {
            const item = addItem();
            const content = item.querySelector('.item-content');
            if (content) {
                content.focus();
                content.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });

        btnNewList.addEventListener('click', () => {
            if (confirm('Start a new list? Current list will be cleared.')) {
                listTitle.innerHTML = '';
                listItems.innerHTML = '';
                addItem();
                listTitle.focus();
                showToast('New list created');
            }
        });

        btnExportPdf.addEventListener('click', exportPdf);

        // Save title changes
        listTitle.addEventListener('input', debounce(saveToStorage, 500));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S to save/export
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveToStorage();
                showToast('List saved');
            }
        });
    }

    // ── Drag & Drop ─────────────────────────────
    function setupDragAndDrop() {
        // Initial items already have drag events from createListItem
    }

    function handleDragStart(e) {
        dragSrcEl = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.innerHTML);
    }

    function handleDragEnd() {
        this.classList.remove('dragging');
        document.querySelectorAll('.list-item').forEach(item => {
            item.classList.remove('drag-over');
        });
        saveToStorage();
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    function handleDragEnter(e) {
        e.preventDefault();
        if (this !== dragSrcEl) {
            this.classList.add('drag-over');
        }
    }

    function handleDragLeave() {
        this.classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.stopPropagation();
        if (dragSrcEl !== this) {
            // Swap positions
            const parent = this.parentNode;
            const srcNext = dragSrcEl.nextElementSibling;

            if (srcNext === this) {
                parent.insertBefore(dragSrcEl, this.nextElementSibling);
            } else {
                parent.insertBefore(dragSrcEl, this);
            }
        }
        this.classList.remove('drag-over');
        return false;
    }

    // ── PDF Export ───────────────────────────────
    function exportPdf() {
        showToast('Generating PDF...');

        const title = listTitle.textContent.trim() || 'Untitled List';

        // Create a clone for PDF rendering
        const pdfContent = document.createElement('div');
        pdfContent.style.cssText = `
            font-family: 'Inter', -apple-system, sans-serif;
            padding: 40px;
            max-width: 680px;
            margin: 0 auto;
            color: #0a0a0a;
            background: #ffffff;
        `;

        // Title
        const pdfTitle = document.createElement('h1');
        pdfTitle.style.cssText = `
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
            color: #0a0a0a;
        `;
        pdfTitle.textContent = title;
        pdfContent.appendChild(pdfTitle);

        // Date
        const pdfDate = document.createElement('p');
        pdfDate.style.cssText = `
            font-size: 12px;
            color: #999;
            margin-bottom: 28px;
            padding-bottom: 16px;
            border-bottom: 1px solid #e0e0e0;
        `;
        pdfDate.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        pdfContent.appendChild(pdfDate);

        // Items
        const items = listItems.querySelectorAll('.list-item');
        items.forEach((item, i) => {
            const content = item.querySelector('.item-content');
            const checkbox = item.querySelector('input[type="checkbox"]');
            const isChecked = checkbox && checkbox.checked;

            const pdfItem = document.createElement('div');
            pdfItem.style.cssText = `
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 10px 0;
                border-bottom: 1px solid #f0f0f0;
                ${isChecked ? 'opacity: 0.45;' : ''}
            `;

            // Checkbox visual
            const checkVisual = document.createElement('div');
            checkVisual.style.cssText = `
                width: 16px;
                height: 16px;
                border: 2px solid ${isChecked ? '#0a0a0a' : '#ccc'};
                border-radius: 3px;
                flex-shrink: 0;
                margin-top: 3px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: ${isChecked ? '#0a0a0a' : 'transparent'};
                color: #fff;
                font-size: 10px;
            `;
            if (isChecked) {
                checkVisual.textContent = '✓';
            }
            pdfItem.appendChild(checkVisual);

            // Content
            const pdfItemContent = document.createElement('div');
            pdfItemContent.style.cssText = `
                flex: 1;
                font-size: 14px;
                line-height: 1.6;
                ${isChecked ? 'text-decoration: line-through;' : ''}
            `;
            pdfItemContent.innerHTML = content.innerHTML;
            pdfItem.appendChild(pdfItemContent);

            pdfContent.appendChild(pdfItem);
        });

        // Footer
        const footer = document.createElement('div');
        footer.style.cssText = `
            margin-top: 32px;
            padding-top: 16px;
            border-top: 1px solid #e0e0e0;
            font-size: 10px;
            color: #bbb;
            text-align: center;
        `;
        footer.textContent = 'Created with ListCraft';
        pdfContent.appendChild(footer);

        // Add to DOM temporarily
        document.body.appendChild(pdfContent);

        const opt = {
            margin: [10, 10, 10, 10],
            filename: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(pdfContent).save().then(() => {
            document.body.removeChild(pdfContent);
            showToast('PDF exported successfully!');
        }).catch(err => {
            console.error('PDF export failed:', err);
            document.body.removeChild(pdfContent);
            showToast('Export failed. Try again.');
        });
    }

    // ── Storage ─────────────────────────────────
    function saveToStorage() {
        const data = {
            title: listTitle.innerHTML,
            items: []
        };

        listItems.querySelectorAll('.list-item').forEach(item => {
            const content = item.querySelector('.item-content');
            const checkbox = item.querySelector('input[type="checkbox"]');
            data.items.push({
                content: content.innerHTML,
                checked: checkbox ? checkbox.checked : false
            });
        });

        localStorage.setItem('listcraft-data', JSON.stringify(data));
    }

    function loadFromStorage() {
        const saved = localStorage.getItem('listcraft-data');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                listTitle.innerHTML = data.title || '';

                // Clear default items
                listItems.innerHTML = '';

                if (data.items && data.items.length > 0) {
                    data.items.forEach(item => {
                        addItem(item.content, item.checked);
                    });
                } else {
                    addItem();
                }
            } catch (e) {
                console.error('Failed to load saved data:', e);
                addItem();
            }
        } else {
            // First load — set up initial item
            const firstItem = listItems.querySelector('.list-item');
            if (firstItem) {
                setupExistingItem(firstItem);
            }
        }
    }

    function setupExistingItem(item) {
        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => {
            item.classList.toggle('checked', checkbox.checked);
            saveToStorage();
        });

        const deleteBtn = item.querySelector('.item-delete');
        deleteBtn.addEventListener('click', () => {
            item.style.transform = 'translateX(40px)';
            item.style.opacity = '0';
            setTimeout(() => {
                item.remove();
                saveToStorage();
                if (listItems.children.length === 0) addItem();
            }, 200);
        });

        const contentEl = item.querySelector('.item-content');
        contentEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const newItem = addItem();
                newItem.querySelector('.item-content')?.focus();
            }
            if (e.key === 'Backspace' && contentEl.textContent.trim() === '' && listItems.children.length > 1) {
                e.preventDefault();
                const prevItem = item.previousElementSibling;
                item.remove();
                if (prevItem) {
                    const prevContent = prevItem.querySelector('.item-content');
                    prevContent.focus();
                    const range = document.createRange();
                    const sel = window.getSelection();
                    range.selectNodeContents(prevContent);
                    range.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                saveToStorage();
            }
        });

        contentEl.addEventListener('input', debounce(saveToStorage, 500));

        item.draggable = true;
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
        item.addEventListener('drop', handleDrop);
    }

    // ── Toast ───────────────────────────────────
    function showToast(message, duration = 2500) {
        toast.textContent = message;
        toast.classList.remove('hidden');
        toast.classList.add('show');

        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

    // ── Utility ─────────────────────────────────
    function debounce(fn, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // ── Boot ────────────────────────────────────
    document.addEventListener('DOMContentLoaded', init);
})();
