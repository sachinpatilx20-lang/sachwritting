document.addEventListener('DOMContentLoaded', () => {
    const editorContainer = document.getElementById('editor-container');
    const STORAGE_KEY = 'minimal-write-data';
    const THEME_KEY = 'minimal-write-theme';
    let saveTimeout = null;

    // Delegate click events for page removal to handle dynamic pages safely
    editorContainer.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.page-delete-btn');
        if (deleteBtn) {
            deleteBtn.closest('.page').remove();
            
            // If we deleted the final page, automatically provision a new blank one
            if (editorContainer.children.length === 0) {
                addPage('text');
            } else {
                autoSave();
            }
        }
    });

    // --- State & Auto-Save ---
    const loadContent = () => {
        const savedTheme = localStorage.getItem(THEME_KEY);
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }

        const savedContent = localStorage.getItem(STORAGE_KEY);
        if (savedContent) {
            editorContainer.innerHTML = savedContent;
            attachPageListeners();
        } else {
            addPage('text');
        }
    };

    const saveContent = () => {
        try {
            localStorage.setItem(STORAGE_KEY, editorContainer.innerHTML);
        } catch (e) {
            console.error("Storage limit reached! Images may be too large.", e);
            alert("Warning: Cannot save document. The images might be too large for local storage.");
        }
    };

    const autoSave = () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveContent, 500); // Debounce save
    };

    const attachPageListeners = () => {
        const textPages = document.querySelectorAll('.page-content[contenteditable="true"]');
        textPages.forEach(page => {
            page.removeEventListener('input', autoSave);
            page.addEventListener('input', autoSave);
        });
    };

    // --- Page Creation ---
    const createPageWrapper = (type) => {
        const page = document.createElement('div');
        page.className = `page ${type === 'image' ? 'image-page' : ''}`;
        page.dataset.type = type;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'page-delete-btn';
        deleteBtn.innerHTML = '<i class="ri-delete-bin-line"></i>';
        deleteBtn.title = 'Delete Page';
        deleteBtn.contentEditable = "false";

        page.appendChild(deleteBtn);
        return page;
    };

    const addPage = (type, contentSrc = null) => {
        const page = createPageWrapper(type);
        
        if (type === 'text') {
            const content = document.createElement('div');
            content.className = 'page-content';
            content.contentEditable = "true";
            content.setAttribute('placeholder', 'Start typing...');
            
            // Core formatting logic requirement: optional center-aligned title
            // Users can just type and use the formatting toolbar. 
            page.appendChild(content);
        } else if (type === 'list') {
            const content = document.createElement('div');
            content.className = 'page-content';
            content.contentEditable = "true";
            content.innerHTML = '<ul><li></li></ul>';
            page.appendChild(content);
        } else if (type === 'image' && contentSrc) {
            const img = document.createElement('img');
            img.src = contentSrc;
            page.appendChild(img);
        }

        editorContainer.appendChild(page);
        attachPageListeners();
        autoSave();

        // Focus new text pages
        if (type === 'text' || type === 'list') {
            const contentDiv = page.querySelector('.page-content');
            contentDiv.focus();
        }
        
        // Scroll to the bottom where the new page is
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };

    // --- Toolbar Formatting ---
    const toolbarButtons = document.querySelectorAll('.formatting-toolbar button');
    toolbarButtons.forEach(btn => {
        // Prevent loss of focus/selection in contenteditable
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
        btn.addEventListener('click', (e) => {
            e.preventDefault(); 
            const command = btn.getAttribute('data-command');
            const value = btn.getAttribute('data-value') || null;
            
            if (command) {
                document.execCommand(command, false, value);
                autoSave();
            }
        });
    });

    // Handle Title explicit center alignment optionally
    // If a user clicks H1/H2, wrap it with a center alignment since titles should often be center
    const formatBlockOverride = (command, value) => {
        document.execCommand(command, false, value);
    };

    // --- Header Actions ---
    document.getElementById('add-page-btn').addEventListener('click', () => addPage('text'));
    document.getElementById('add-list-page-btn').addEventListener('click', () => addPage('list'));
    
    // Toggle theme
    document.getElementById('toggle-theme-btn').addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'dark') {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem(THEME_KEY, 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem(THEME_KEY, 'dark');
        }
    });

    // Image Uploading
    const imageUpload = document.getElementById('image-upload');
    document.getElementById('add-image-btn').addEventListener('click', () => {
        imageUpload.click();
    });

    imageUpload.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                // Ensure image isn't compressed and full quality is maintained via data URL
                addPage('image', event.target.result);
            };
            reader.readAsDataURL(file);
        });
        
        // Reset so same files can be re-selected if needed
        imageUpload.value = '';
    });

    // --- PDF Export ---
    document.getElementById('export-pdf-btn').addEventListener('click', () => {
        // Temporarily reset theme to Light for clean PDF export if needed
        const wasDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (wasDark) document.documentElement.removeAttribute('data-theme');

        // We use the editor container because it wraps all the pages
        // We temporarily hide the delete buttons to ensure they do not render on PDF
        const deleteBtns = document.querySelectorAll('.page-delete-btn');
        deleteBtns.forEach(btn => btn.style.display = 'none');

        const element = document.getElementById('editor-container');
        const opt = {
            margin:       0,
            filename:     'document.pdf',
            image:        { type: 'jpeg', quality: 1 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: 'css' } 
            /* Because .page has page-break-after: always injected via css @media print (though html2pdf handles it manually too) */
        };

        // If css mode doesn't separate pages, we fallback to avoiding class .page splitting:
        opt.pagebreak = { mode: ['css', 'legacy'], avoid: '.page' };

        html2pdf().set(opt).from(element).save().then(() => {
            // Restore theme & buttons
            if (wasDark) document.documentElement.setAttribute('data-theme', 'dark');
            deleteBtns.forEach(btn => btn.style.display = ''); // Reset display to CSS rule
        });
    });

    // Initialize
    loadContent();
});
