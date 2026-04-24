// --- Configuration & State ---
let peer = null;
let conn = null;
let isHost = false;

let notes = [];
let activeNoteId = null;
let myP2PCode = null;
let isTypewriterMode = false;

const elements = {
    app: document.getElementById('app'),
    editor: document.getElementById('editor'),
    noteTitle: document.getElementById('note-title'),
    wordCount: document.getElementById('word-count'),
    readTime: document.getElementById('read-time'),
    collabBtn: document.getElementById('collab-btn'),
    p2pModal: document.getElementById('p2p-modal'),
    closeModal: document.getElementById('close-modal'),
    connectBtn: document.getElementById('connect-btn'),
    peerIdInput: document.getElementById('peer-id-input'),
    myId: document.getElementById('my-id'),
    modalMyId: document.getElementById('modal-my-id'),
    shareIdBtn: document.getElementById('share-id-btn'),
    copyId: document.getElementById('copy-id'),
    p2pIdDisplay: document.getElementById('p2p-id-display'),
    statusText: document.getElementById('status-text'),
    indicator: document.getElementById('connection-indicator'),
    fullscreenBtn: document.getElementById('fullscreen-btn'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    sidebar: document.getElementById('sidebar'),
    noteList: document.getElementById('note-list'),
    newNoteBtn: document.getElementById('new-note-btn'),
    controls: document.getElementById('controls'),
    toast: document.getElementById('toast'),
    formatButtons: document.querySelectorAll('.format-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    noteSearch: document.getElementById('note-search'),
    exportBtn: document.getElementById('export-btn'),
    typewriterToggle: document.getElementById('typewriter-toggle'),
    helpBtn: document.getElementById('help-btn'),
    helpModal: document.getElementById('help-modal'),
    closeHelp: document.getElementById('close-help')
};

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initData();
    initPeer();
    setupEventListeners();
    renderNoteList();
    
    if (window.innerWidth > 900) {
        document.body.classList.remove('sidebar-closed');
        elements.sidebar.classList.remove('hidden');
    } else {
        document.body.classList.add('sidebar-closed');
        elements.sidebar.classList.add('hidden');
    }
});

function initTheme() {
    const savedTheme = localStorage.getItem('scribe_theme') || 'light-theme';
    document.body.className = savedTheme;
    updateThemeIcon();
}

function initData() {
    const savedNotes = localStorage.getItem('scribe_notes');
    if (savedNotes) {
        notes = JSON.parse(savedNotes);
        activeNoteId = localStorage.getItem('scribe_active_id');
    }

    if (notes.length === 0) {
        createNewNote();
    } else {
        const active = notes.find(n => n.id === activeNoteId) || notes[0];
        activeNoteId = active.id;
        loadNote(active);
    }
    saveData();
}

function setupEventListeners() {
    // Editor Events
    elements.editor.addEventListener('input', () => {
        updateActiveNote('content', elements.editor.innerHTML);
        updateStats();
        syncWithPeer();
        if (isTypewriterMode) centerActiveLine();
    });

    elements.editor.addEventListener('keyup', () => {
        if (isTypewriterMode) centerActiveLine();
        syncCursor();
    });

    elements.editor.addEventListener('mouseup', syncCursor);

    // Formatting & Toolbar
    elements.formatButtons.forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const command = btn.getAttribute('data-command');
            const value = btn.getAttribute('data-value') || null;
            if (command) {
                document.execCommand(command, false, value);
                elements.editor.focus();
                updateActiveNote('content', elements.editor.innerHTML);
                updateStats();
                syncWithPeer();
            }
        });
    });

    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.typewriterToggle.addEventListener('click', toggleTypewriterMode);
    elements.exportBtn.addEventListener('click', exportMarkdown);
    elements.noteSearch.addEventListener('input', () => renderNoteList(elements.noteSearch.value));

    elements.noteTitle.addEventListener('input', () => {
        updateActiveNote('title', elements.noteTitle.value);
        renderNoteList();
        syncWithPeer();
    });

    // Modals & UI
    elements.sidebarToggle.addEventListener('click', toggleSidebar);
    elements.newNoteBtn.addEventListener('click', () => {
        createNewNote();
        if (window.innerWidth <= 900) toggleSidebar();
    });

    elements.collabBtn.addEventListener('click', () => elements.p2pModal.classList.remove('hidden'));
    elements.closeModal.addEventListener('click', () => elements.p2pModal.classList.add('hidden'));
    elements.helpBtn.addEventListener('click', () => elements.helpModal.classList.remove('hidden'));
    elements.closeHelp.addEventListener('click', () => elements.helpModal.classList.add('hidden'));

    elements.connectBtn.addEventListener('click', connectToPeer);
    elements.shareIdBtn.addEventListener('click', copyMyCode);
    elements.copyId.addEventListener('click', copyMyCode);

    elements.fullscreenBtn.addEventListener('click', toggleDistractionFree);

    // Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') { e.preventDefault(); document.execCommand('bold'); }
            if (e.key === 'i') { e.preventDefault(); document.execCommand('italic'); }
            if (e.key === 'u') { e.preventDefault(); document.execCommand('underline'); }
            if (e.key === 's') { e.preventDefault(); saveData(); showToast('Saved locally'); }
        }
        if (e.altKey) {
            if (e.key === 'f') { e.preventDefault(); toggleDistractionFree(); }
            if (e.key === 't') { e.preventDefault(); toggleTypewriterMode(); }
        }
    });
}

// --- Theme & Mode Management ---
function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    document.body.classList.toggle('light-theme', !isDark);
    localStorage.setItem('scribe_theme', isDark ? 'dark-theme' : 'light-theme');
    updateThemeIcon();
}

function updateThemeIcon() {
    const isDark = document.body.classList.contains('dark-theme');
    elements.themeToggle.querySelector('.sun').style.display = isDark ? 'none' : 'block';
    elements.themeToggle.querySelector('.moon').style.display = isDark ? 'block' : 'none';
}

function toggleTypewriterMode() {
    isTypewriterMode = !isTypewriterMode;
    document.body.classList.toggle('typewriter-mode', isTypewriterMode);
    elements.typewriterToggle.classList.toggle('active', isTypewriterMode);
    showToast(isTypewriterMode ? 'Typewriter Mode On' : 'Typewriter Mode Off');
    if (isTypewriterMode) centerActiveLine();
}

function centerActiveLine() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.top > 0) {
            const editorScroller = document.getElementById('editor-container');
            const targetY = rect.top + editorScroller.scrollTop - (window.innerHeight / 2);
            editorScroller.scrollTo({ top: targetY, behavior: 'smooth' });
        }
    }
}

function toggleDistractionFree() {
    const isFocus = document.body.classList.toggle('distraction-free');
    if (isFocus) {
        if (!elements.sidebar.classList.contains('hidden')) toggleSidebar();
        showToast('Focus Mode Enabled');
    }
}

// --- Note Management ---
function createNewNote() {
    const newNote = {
        id: Date.now().toString(),
        title: '',
        content: '',
        updatedAt: Date.now()
    };
    notes.unshift(newNote);
    activeNoteId = newNote.id;
    loadNote(newNote);
    renderNoteList();
    saveData();
    elements.noteTitle.focus();
}

function loadNote(note) {
    activeNoteId = note.id;
    elements.editor.innerHTML = note.content;
    elements.noteTitle.value = note.title;
    updateStats();
    renderNoteList();
    saveData();
    if (window.innerWidth <= 900 && !elements.sidebar.classList.contains('hidden')) toggleSidebar();
}

function updateActiveNote(field, value) {
    const note = notes.find(n => n.id === activeNoteId);
    if (note) {
        note[field] = value;
        note.updatedAt = Date.now();
        debounceSave();
    }
}

function deleteNote(id, e) {
    e.stopPropagation();
    if (notes.length === 1) return showToast("Keep at least one story.");
    notes = notes.filter(n => n.id !== id);
    if (activeNoteId === id) loadNote(notes[0]);
    renderNoteList();
    saveData();
    showToast("Note deleted");
}

let saveTimeout;
function debounceSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveData, 1000);
}

function saveData() {
    localStorage.setItem('scribe_notes', JSON.stringify(notes));
    localStorage.setItem('scribe_active_id', activeNoteId);
}

function renderNoteList(query = '') {
    elements.noteList.innerHTML = '';
    const filtered = notes
        .filter(n => (n.title + n.content).toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => b.updatedAt - a.updatedAt);

    filtered.forEach(note => {
        const item = document.createElement('div');
        item.className = `note-item ${note.id === activeNoteId ? 'active' : ''}`;
        item.onclick = () => loadNote(note);

        const date = new Date(note.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
        
        item.innerHTML = `
            <div class="note-info">
                <span class="note-item-title">${note.title || 'Untitled Story'}</span>
                <span class="note-item-date">${date}</span>
            </div>
            <button class="delete-note-btn" onclick="deleteNote('${note.id}', event)">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        `;
        elements.noteList.appendChild(item);
    });
}

function toggleSidebar() {
    const isHidden = elements.sidebar.classList.toggle('hidden');
    document.body.classList.toggle('sidebar-closed', isHidden);
}

// --- Export ---
function exportMarkdown() {
    const title = elements.noteTitle.value || 'Untitled';
    const content = elements.editor.innerText;
    const blob = new Blob([`# ${title}\n\n${content}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    showToast('Markdown exported');
}

// --- Editor Stats ---
function updateStats() {
    const text = elements.editor.innerText.trim();
    const words = text ? text.split(/\s+/).length : 0;
    const minutes = Math.ceil(words / 200);
    elements.wordCount.textContent = `${words} words`;
    elements.readTime.textContent = `${minutes} min`;
}

// --- PeerJS & Collaboration ---
function generate6DigitCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function initPeer() {
    if (peer) peer.destroy();
    myP2PCode = generate6DigitCode();
    peer = new Peer(myP2PCode);

    peer.on('open', (id) => {
        elements.myId.textContent = id;
        elements.modalMyId.textContent = id;
    });

    peer.on('connection', (connection) => {
        if (conn) connection.close();
        else setupConnection(connection);
    });

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') initPeer();
        else showToast(`Error: ${err.type}`);
    });
}

function connectToPeer() {
    const peerId = elements.peerIdInput.value.trim();
    if (peerId.length !== 6) return showToast("Enter 6 digits");
    const connection = peer.connect(peerId);
    setupConnection(connection);
}

function setupConnection(connection) {
    conn = connection;
    conn.on('open', () => {
        elements.indicator.className = 'indicator online';
        elements.statusText.textContent = 'Connected';
        elements.p2pModal.classList.add('hidden');
        showToast('Collaborator Connected');
        conn.send({ type: 'request-sync' });
    });
    
    conn.on('data', (data) => {
        if (data.type === 'sync' || data.type === 'update') {
            if (elements.editor.innerHTML !== data.content) elements.editor.innerHTML = data.content;
            if (elements.noteTitle.value !== data.title) elements.noteTitle.value = data.title;
            updateActiveNote('content', data.content);
            updateActiveNote('title', data.title);
            updateStats();
            renderNoteList();
        } else if (data.type === 'cursor') {
            updateRemoteCursor(data.position);
        } else if (data.type === 'request-sync') {
            syncWithPeer('sync');
        }
    });

    conn.on('close', () => {
        elements.indicator.className = 'indicator offline';
        elements.statusText.textContent = 'Local';
        conn = null;
        removeRemoteCursor();
        showToast('Collaborator Disconnected');
    });
}

function syncWithPeer(type = 'update') {
    if (conn && conn.open) {
        conn.send({ type: type, title: elements.noteTitle.value, content: elements.editor.innerHTML });
    }
}

// Cursor Presence Logic
function syncCursor() {
    if (conn && conn.open) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            // Send relative position to the editor
            const editorRect = elements.editor.getBoundingClientRect();
            const position = {
                x: rect.left - editorRect.left,
                y: rect.top - editorRect.top
            };
            conn.send({ type: 'cursor', position: position });
        }
    }
}

function updateRemoteCursor(position) {
    let cursor = document.getElementById('remote-cursor');
    if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = 'remote-cursor';
        cursor.className = 'remote-cursor';
        elements.editor.appendChild(cursor);
    }
    cursor.style.left = `${position.x}px`;
    cursor.style.top = `${position.y}px`;
}

function removeRemoteCursor() {
    const cursor = document.getElementById('remote-cursor');
    if (cursor) cursor.remove();
}

// --- Helpers ---
function copyMyCode() {
    navigator.clipboard.writeText(elements.myId.textContent).then(() => showToast('Code Copied'));
}

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.remove('hidden');
    setTimeout(() => elements.toast.classList.add('hidden'), 3000);
}

window.deleteNote = deleteNote;
window.loadNote = loadNote;
