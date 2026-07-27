/**
 * FORMAT-OFF-THE-GRID
 * Editor Initialization (CodeMirror 6) — Multi-File Workspace Edition
 */

import { EditorState } from "https://esm.sh/@codemirror/state@6.4.0";
import { EditorView, basicSetup } from "https://esm.sh/codemirror@6.0.1?deps=@codemirror/state@6.4.0";
import { markdown } from "https://esm.sh/@codemirror/lang-markdown@6.2.5?deps=@codemirror/state@6.4.0";
import workspace from './workspace.js';
import { isRelativeMdLink, stripFragment, getFragment, getFileName, getUniqueFileName } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById("editor-container");
    container.innerHTML = ""; // Clear placeholder

    const previewContainer = document.getElementById("preview-container");
    const wordCountDisplay = document.getElementById("word-count");
    const statusText = document.getElementById("status-text");

    // Debounce state
    let renderTimer = null;
    // Flag to prevent editor change events during file switching
    let isLoadingFile = false;

    // ---- Toast Notifications ----
    function showToast(message) {
        const existing = document.querySelector('.workspace-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = 'workspace-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    window.addEventListener('workspace-error', (e) => {
        showToast(e.detail.message);
    });

    // ---- Status Bar ----
    function updateStatus() {
        if (!statusText) return;
        if (workspace.activeFile) {
            const fileName = getFileName(workspace.activeFile);
            const mod = workspace.isModified(workspace.activeFile) ? ' (modified)' : '';
            const count = workspace.getFileCount();
            statusText.textContent = `${fileName}${mod} | ${count} file${count !== 1 ? 's' : ''} in workspace`;
        } else {
            statusText.textContent = 'No file open';
        }
    }

    // ---- Preview Rendering ----
    async function renderPreview(markdownText) {
        // Custom processing for video before passing to marked
        let processedText = markdownText.replace(/!\[video\]\((.*?)\)/gi, (match, url) => {
            return `<video controls style="max-width: 100%; height: auto; border-radius: 6px; margin: 1rem 0;"><source src="${url}"></video>`;
        });

        // Sanitize & Render
        const rawHtml = window.marked.parse(processedText);
        const safeHtml = window.DOMPurify.sanitize(rawHtml, {
            ADD_TAGS: ['video', 'source'],
            ADD_ATTR: ['controls', 'src', 'style']
        });
        previewContainer.innerHTML = safeHtml;

        // Make relative .md links clickable within the app
        previewContainer.querySelectorAll('a[href]').forEach(link => {
            const href = link.getAttribute('href');
            if (href && isRelativeMdLink(href)) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const cleanHref = stripFragment(href);
                    const fragment = getFragment(href);

                    // If it's a link to the same file with a different anchor
                    if (cleanHref && workspace.activeFile) {
                        const resolved = workspace.resolveAndOpenLink(cleanHref);
                        if (resolved && fragment) {
                            // Scroll to fragment after rendering
                            setTimeout(() => {
                                scrollToHeading(fragment);
                            }, 100);
                        }
                    } else if (!cleanHref && fragment) {
                        // Pure anchor within same file
                        scrollToHeading(fragment);
                    }
                });
                // Style internal links differently
                link.style.cursor = 'pointer';
            }
        });

        // Calculate Words & Chars
        const textOnly = rawHtml.replace(/<[^>]*>?/gm, '');
        const words = textOnly.trim().split(/\s+/).filter(word => word.length > 0).length;
        const chars = markdownText.length;
        wordCountDisplay.textContent = `${words} word${words !== 1 ? 's' : ''} | ${chars} char${chars !== 1 ? 's' : ''}`;

        // Trigger Syntax Highlighting
        if (window.hljs) {
            previewContainer.querySelectorAll('pre code').forEach((block) => {
                if (!block.classList.contains('language-mermaid')) {
                    window.hljs.highlightElement(block);
                }
            });
        }

        // Render Mermaid Diagrams
        const mermaidBlocks = previewContainer.querySelectorAll('pre code.language-mermaid');
        if (mermaidBlocks.length > 0) {
            if (!window.mermaid) {
                const mermaidModule = await import("https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs");
                window.mermaid = mermaidModule.default;

                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                window.mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' });
            } else {
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                window.mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' });
            }

            for (let i = 0; i < mermaidBlocks.length; i++) {
                const block = mermaidBlocks[i];
                const pre = block.parentElement;
                const source = block.textContent;
                const id = `mermaid-${Date.now()}-${i}`;

                try {
                    const { svg } = await window.mermaid.render(id, source);
                    const div = document.createElement('div');
                    div.className = 'mermaid-rendered';
                    div.style.display = 'flex';
                    div.style.justifyContent = 'center';
                    div.style.margin = '1rem 0';
                    div.innerHTML = svg;
                    div.dataset.mermaidSource = source;
                    pre.replaceWith(div);
                } catch (e) {
                    console.error('Mermaid render error', e);
                    const errorMsg = document.createElement('div');
                    errorMsg.style.color = '#ef4444';
                    errorMsg.style.fontSize = '0.85rem';
                    errorMsg.style.marginBottom = '0.5rem';
                    errorMsg.textContent = 'Mermaid syntax error';
                    pre.insertAdjacentElement('beforebegin', errorMsg);
                }
            }
        }
    }

    function scrollToHeading(id) {
        // Try finding element by id first
        let target = previewContainer.querySelector(`#${CSS.escape(id)}`);
        if (!target) {
            // Try finding heading with matching text
            const headings = previewContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
            const slug = id.toLowerCase().replace(/[^\w]+/g, '-');
            for (const h of headings) {
                const hSlug = h.textContent.toLowerCase().trim().replace(/[^\w]+/g, '-');
                if (hSlug === slug) {
                    target = h;
                    break;
                }
            }
        }
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // ---- CodeMirror Editor ----
    const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged && !isLoadingFile) {
            const currentDoc = update.state.doc.toString();
            // Save to workspace
            if (workspace.activeFile) {
                workspace.updateFileContent(workspace.activeFile, currentDoc);
            }
            // Debounced preview render
            clearTimeout(renderTimer);
            renderTimer = setTimeout(() => {
                renderPreview(currentDoc);
            }, 300);
        }
    });

    const customTheme = EditorView.theme({
        "&": {
            height: "100%",
            backgroundColor: "transparent",
            color: "var(--text-primary)"
        },
        "&.cm-focused": {
            outline: "none"
        },
        ".cm-content": {
            fontFamily: "var(--font-mono)",
            fontSize: "14px",
            padding: "var(--space-2) 0"
        },
        ".cm-gutters": {
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text-muted)",
            borderRight: "1px solid var(--border-color)",
            fontFamily: "var(--font-mono)"
        },
        ".cm-activeLine": {
            backgroundColor: "var(--editor-active-line)"
        },
        ".cm-activeLineGutter": {
            backgroundColor: "var(--editor-active-line)"
        },
        ".cm-cursor, .cm-dropCursor": {
            borderLeftColor: "var(--text-primary)"
        }
    });

    const toggleFormat = (prefix, suffix = prefix) => {
        const tr = view.state.update({
            changes: view.state.selection.ranges.map(range => ({
                from: range.from,
                to: range.to,
                insert: `${prefix}${view.state.doc.sliceString(range.from, range.to)}${suffix}`
            })),
            selection: {
                anchor: view.state.selection.main.anchor + prefix.length,
                head: view.state.selection.main.head + prefix.length
            }
        });
        view.dispatch(tr);
        view.focus();
        return true;
    };

    // Get initial content
    let initialDoc = `# Welcome to MarkShare

## Browser Compatibility

This app works best in modern browsers. Here's what each browser supports:

| Feature | Chrome | Edge | Firefox | Safari |
|---|---|---|---|---|
| Basic Markdown Preview | ✅ | ✅ | ✅ | ✅ |
| Live Preview | ✅ | ✅ | ✅ | ✅ |
| Syntax Highlighting | ✅ | ✅ | ✅ | ✅ |
| Mermaid Diagrams | ✅ | ✅ | ✅ | ✅ |
| Open Folder (File System Access API) | ✅ | ✅ | ⚠️ Partial | ⚠️ Partial |
| Save Back to Disk | ✅ | ✅ | ⚠️ Partial | ⚠️ Partial |
| Local Storage Persistence | ✅ | ✅ | ✅ | ✅ |

> **Tip:** For the full experience including folder browsing and saving files directly to disk, use **Google Chrome** or **Microsoft Edge**.
> Firefox and Safari support basic editing and preview but may have limited folder access.
`;
    if (workspace.activeFile) {
        const file = workspace.getActiveFile();
        if (file) initialDoc = file.content;
    }

    const view = new EditorView({
        state: EditorState.create({
            doc: initialDoc,
            extensions: [
                basicSetup,
                markdown(),
                customTheme,
                updateListener
            ]
        }),
        parent: container
    });

    // ---- File Switching ----
    function loadFileIntoEditor(path) {
        const file = workspace.getFile(path);
        if (!file) return;

        isLoadingFile = true;
        // Replace editor content without triggering change listener
        view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: file.content }
        });
        isLoadingFile = false;

        renderPreview(file.content);
        updateStatus();
    }

    // Listen for active file changes
    window.addEventListener('active-file-changed', (e) => {
        if (e.detail.path) {
            loadFileIntoEditor(e.detail.path);
        } else {
            // No file — show empty state
            isLoadingFile = true;
            view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: '' }
            });
            isLoadingFile = false;
            previewContainer.innerHTML = `
                <div class="workspace-empty">
                    <span class="material-icons">description</span>
                    <p>No file selected.<br>Open a file from the sidebar or toolbar.</p>
                </div>`;
            updateStatus();
        }
    });

    // Listen for file saved events
    window.addEventListener('file-saved', () => updateStatus());

    // ---- Keyboard Shortcuts ----
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    toggleFormat('**');
                    break;
                case 'i':
                    e.preventDefault();
                    toggleFormat('*');
                    break;
                case 'k':
                    e.preventDefault();
                    toggleFormat('[', '](url)');
                    break;
                case 's':
                    e.preventDefault();
                    if (e.shiftKey) {
                        document.getElementById('btn-save-all')?.click();
                    } else {
                        document.getElementById('btn-save')?.click();
                    }
                    break;
            }
        }
    });

    // ---- Synchronized Scrolling ----
    const editorScrollDOM = view.scrollDOM;
    let isSyncingLeft = false;
    let isSyncingRight = false;
    let syncScrollEnabled = true;

    editorScrollDOM.addEventListener('scroll', () => {
        if (!syncScrollEnabled) return;
        if (!isSyncingLeft) {
            isSyncingRight = true;
            const percentage = editorScrollDOM.scrollTop / (editorScrollDOM.scrollHeight - editorScrollDOM.clientHeight);
            if (!isNaN(percentage)) {
                previewContainer.scrollTop = percentage * (previewContainer.scrollHeight - previewContainer.clientHeight);
            }
        }
        isSyncingLeft = false;
    }, { passive: true });

    previewContainer.addEventListener('scroll', () => {
        if (!syncScrollEnabled) return;
        if (!isSyncingRight) {
            isSyncingLeft = true;
            const percentage = previewContainer.scrollTop / (previewContainer.scrollHeight - previewContainer.clientHeight);
            if (!isNaN(percentage)) {
                editorScrollDOM.scrollTop = percentage * (editorScrollDOM.scrollHeight - editorScrollDOM.clientHeight);
            }
        }
        isSyncingRight = false;
    }, { passive: true });

    const btnSyncScroll = document.getElementById('btn-sync-scroll');
    if (btnSyncScroll) {
        btnSyncScroll.addEventListener('click', () => {
            syncScrollEnabled = !syncScrollEnabled;
            btnSyncScroll.classList.toggle('active', syncScrollEnabled);
        });
    }

    // ---- View Mode Switcher ----
    const mainContent = document.getElementById('main-content');
    const btnViewEditor = document.getElementById('btn-view-editor');
    const btnViewSplit = document.getElementById('btn-view-split');
    const btnViewPreview = document.getElementById('btn-view-preview');
    const viewBtns = [btnViewEditor, btnViewSplit, btnViewPreview];

    function setViewMode(mode) {
        mainContent.classList.remove('view-editor', 'view-preview');
        viewBtns.forEach(b => b?.classList.remove('active'));

        if (mode === 'editor') {
            mainContent.classList.add('view-editor');
            btnViewEditor?.classList.add('active');
        } else if (mode === 'preview') {
            mainContent.classList.add('view-preview');
            btnViewPreview?.classList.add('active');
        } else {
            btnViewSplit?.classList.add('active');
        }
    }

    btnViewEditor?.addEventListener('click', () => setViewMode('editor'));
    btnViewSplit?.addEventListener('click', () => setViewMode('split'));
    btnViewPreview?.addEventListener('click', () => setViewMode('preview'));

    // ---- Toolbar Formatting ----
    document.getElementById('btn-bold')?.addEventListener('click', () => toggleFormat("**"));
    document.getElementById('btn-italic')?.addEventListener('click', () => toggleFormat("*"));
    document.getElementById('btn-link')?.addEventListener('click', () => toggleFormat("[", "](url)"));
    document.getElementById('btn-code')?.addEventListener('click', () => toggleFormat("\n```\n", "\n```\n"));
    document.getElementById('btn-mermaid')?.addEventListener('click', () => toggleFormat("\n```mermaid\n", "\n```\n"));
    document.getElementById('btn-image')?.addEventListener('click', () => toggleFormat("![alt text](", "image_url_here)"));
    document.getElementById('btn-video')?.addEventListener('click', () => toggleFormat("![video](", "video_url_here)"));

    // ---- Toolbar Export/Print ----
    document.getElementById('btn-export')?.addEventListener('click', () => {
        const title = "Markdown Viewer Export";
        const content = previewContainer.innerHTML;
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/normalize.css@8.0.1/normalize.min.css">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 2rem; }
  pre { background: #f4f4f4; padding: 1rem; border-radius: 6px; overflow-x: auto; }
  code { font-family: monospace; }
  img { max-width: 100%; height: auto; }
  blockquote { border-left: 4px solid #ccc; margin-left: 0; padding-left: 1rem; color: #666; }
</style>
</head>
<body>
${content}
</body>
</html>`;
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'export.html';
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('btn-print')?.addEventListener('click', () => {
        window.print();
    });

    document.getElementById('btn-save-pdf')?.addEventListener('click', async () => {
        const previewContainer = document.getElementById('preview-container');
        if (!previewContainer) return;
        
        let filename = 'document.pdf';
        let rawFileName = 'Untitled.md';
        if (workspace.activeFile) {
            const pathParts = workspace.activeFile.split('/');
            rawFileName = pathParts[pathParts.length - 1];
            filename = rawFileName.replace(/\.md$/i, '') + '.pdf';
        }
        
        const currentUrl = window.location.href;
        const currentDateTime = new Date().toLocaleString();

        // ponytail: pre-rasterize SVGs to PNG before pdf gen. Fixes html2canvas SVG bugs.
        const svgElements = previewContainer.querySelectorAll('svg');
        const svgBackups = []; // store {parent, svg, img} to restore after

        for (const svg of svgElements) {
            const rect = svg.getBoundingClientRect();
            if (!rect.width || !rect.height) continue;

            try {
                const svgClone = svg.cloneNode(true);
                svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                svgClone.setAttribute('width', rect.width);
                svgClone.setAttribute('height', rect.height);
                
                // Inline all computed styles into SVG clone so it renders standalone
                const allEls = svg.querySelectorAll('*');
                const cloneEls = svgClone.querySelectorAll('*');
                allEls.forEach((el, i) => {
                    if (cloneEls[i]) {
                        const cs = getComputedStyle(el);
                        let style = '';
                        for (let j = 0; j < cs.length; j++) {
                            const prop = cs[j];
                            style += `${prop}:${cs.getPropertyValue(prop)};`;
                        }
                        cloneEls[i].setAttribute('style', style);
                    }
                });
                // Also inline root SVG styles
                const rootCs = getComputedStyle(svg);
                let rootStyle = '';
                for (let j = 0; j < rootCs.length; j++) {
                    const prop = rootCs[j];
                    rootStyle += `${prop}:${rootCs.getPropertyValue(prop)};`;
                }
                svgClone.setAttribute('style', rootStyle);

                const svgData = new XMLSerializer().serializeToString(svgClone);
                const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);

                const img = await new Promise((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => resolve(image);
                    image.onerror = reject;
                    image.src = url;
                });

                const canvas = document.createElement('canvas');
                canvas.width = rect.width * 2;
                canvas.height = rect.height * 2;
                const ctx = canvas.getContext('2d');
                ctx.scale(2, 2);
                ctx.drawImage(img, 0, 0, rect.width, rect.height);
                URL.revokeObjectURL(url);

                const pngImg = document.createElement('img');
                pngImg.src = canvas.toDataURL('image/png');
                pngImg.style.width = rect.width + 'px';
                pngImg.style.height = rect.height + 'px';
                pngImg.style.display = 'block';
                pngImg.style.margin = '0 auto';

                svgBackups.push({ parent: svg.parentNode, svg, nextSibling: svg.nextSibling, img: pngImg });
                svg.parentNode.replaceChild(pngImg, svg);
            } catch (e) {
                console.warn('SVG rasterize failed, skipping:', e);
            }
        }

        // Re-render Mermaid diagrams in light theme so html2canvas captures them natively
        const mermaidDivs = previewContainer.querySelectorAll('.mermaid-rendered');
        if (window.mermaid && mermaidDivs.length > 0) {
            window.mermaid.initialize({ startOnLoad: false, theme: 'default' });
            for (const div of mermaidDivs) {
                const source = div.dataset.mermaidSource;
                if (!source) continue;
                const oldSvg = div.querySelector('svg');
                if (!oldSvg) continue;
                try {
                    const renderId = 'mermaid-pdf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
                    const { svg: lightSvg } = await window.mermaid.render(renderId, source);
                    div.innerHTML = lightSvg;
                } catch (e) {
                    console.warn('Mermaid light re-render failed for PDF:', e);
                }
            }
        }

        const opt = {
            margin:       [25, 20, 25, 20],
            filename:     filename,
            image:        { type: 'jpeg', quality: 1.0 },
            html2canvas:  { 
                scale: 2, 
                useCORS: true,
                onclone: (clonedDoc) => {
                    clonedDoc.documentElement.setAttribute('data-theme', 'light');
                    const clonedContainer = clonedDoc.getElementById('preview-container');
                    if (clonedContainer) {
                        clonedContainer.style.padding = '0';
                        clonedContainer.style.backgroundColor = '#ffffff';
                        clonedContainer.style.color = '#18181b';
                        clonedContainer.style.height = 'auto';
                        clonedContainer.style.overflow = 'visible';
                        
                        let parent = clonedContainer.parentElement;
                        while (parent && parent !== clonedDoc.body) {
                            parent.style.height = 'auto';
                            parent.style.overflow = 'visible';
                            parent = parent.parentElement;
                        }
                    }
                }
            },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const restoreSvgs = () => {
            svgBackups.forEach(({ parent, svg, nextSibling, img }) => {
                if (img.parentNode) {
                    if (nextSibling) {
                        parent.insertBefore(svg, nextSibling);
                    } else {
                        parent.appendChild(svg);
                    }
                    img.remove();
                }
            });
        };

        if (window.html2pdf) {
            try {
                const worker = window.html2pdf().from(previewContainer).set(opt);
                const pdf = await worker.toPdf().get('pdf');
                const totalPages = pdf.internal.getNumberOfPages();
                for (let i = 1; i <= totalPages; i++) {
                    pdf.setPage(i);
                    pdf.setFontSize(10);
                    pdf.setTextColor(100, 100, 100);
                    pdf.text(rawFileName, pdf.internal.pageSize.getWidth() - 20, 12, { align: 'right' });
                    pdf.text(currentDateTime, 20, pdf.internal.pageSize.getHeight() - 12);
                    pdf.text(currentUrl, pdf.internal.pageSize.getWidth() / 2, pdf.internal.pageSize.getHeight() - 12, { align: 'center' });
                    pdf.text('Page ' + i + ' of ' + totalPages, pdf.internal.pageSize.getWidth() - 20, pdf.internal.pageSize.getHeight() - 12, { align: 'right' });
                }
                await worker.save();
            } catch (e) {
                console.error('PDF generation failed:', e);
            } finally {
                restoreSvgs();
            }
        } else {
            console.error("html2pdf library not loaded.");
            alert("PDF generation library not available.");
            restoreSvgs();
        }
    });

    // ---- File I/O — Open Folder ----
    document.getElementById('btn-open-folder')?.addEventListener('click', async () => {
        await workspace.openFolder();
    });

    // ---- File I/O — Open Files ----
    const btnOpen = document.getElementById('btn-open');
    if (btnOpen) {
        btnOpen.addEventListener('click', () => {
            workspace.createNewFile();
        });
    }

    // ---- File I/O — Save ----
    const btnSave = document.getElementById('btn-save');
    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            let activePath = workspace.activeFile;

            // If no file is open, create a new one with current editor content
            if (!activePath) {
                const content = view.state.doc.toString();
                const newPath = getUniqueFileName(workspace.getFilePaths(), 'new-file.md');
                workspace.addFile(newPath, content);
                workspace.setActiveFile(newPath);
                activePath = newPath;
                showToast(`Created and saving: ${newPath}`);
            }

            const file = workspace.getFile(activePath);
            if (!file) return;

            // Try saving to disk via File System Access API
            const saved = await workspace.saveFileToDisk(activePath);
            if (saved) {
                showToast(`Saved: ${getFileName(activePath)}`);
                updateStatus();
                return;
            }

            // Fallback: download as file
            const content = file.content;
            const blob = new Blob([content], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = getFileName(activePath);
            a.click();
            URL.revokeObjectURL(url);
            workspace.markSaved(activePath);
            updateStatus();
        });
    }

    // ---- File I/O — Save All ----
    const btnSaveAll = document.getElementById('btn-save-all');
    if (btnSaveAll) {
        btnSaveAll.addEventListener('click', async () => {
            const count = await workspace.saveAll();
            if (count > 0) {
                showToast(`Saved ${count} file${count !== 1 ? 's' : ''}`);
            } else {
                showToast('No modified files to save');
            }
            updateStatus();
        });
    }

    // ---- Reset/Clear ----
    const resetBtns = document.querySelectorAll('#btn-header-reset, #btn-editor-reset');
    const resetDialog = document.getElementById('reset-dialog');
    const btnDialogConfirm = document.getElementById('btn-dialog-confirm');
    const btnDialogCancel = document.getElementById('btn-dialog-cancel');

    if (resetBtns.length > 0 && resetDialog) {
        resetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                resetDialog.showModal();
            });
        });

        btnDialogCancel.addEventListener('click', () => {
            resetDialog.close();
        });

        resetDialog.addEventListener('click', (e) => {
            if (e.target === resetDialog) {
                resetDialog.close();
            }
        });

        btnDialogConfirm.addEventListener('click', () => {
            // Clear CodeMirror editor
            isLoadingFile = true;
            view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: "" }
            });
            isLoadingFile = false;

            // Clear current active file content in workspace if exists
            if (workspace.activeFile) {
                workspace.updateFileContent(workspace.activeFile, "");
            }
            
            renderPreview("");
            resetDialog.close();
        });
    }

    // ---- Theme Re-render ----
    window.addEventListener('theme-changed', () => {
        if (workspace.activeFile) {
            renderPreview(view.state.doc.toString());
        }
    });

    // ---- Initial Render ----
    if (workspace.activeFile) {
        loadFileIntoEditor(workspace.activeFile);
    } else {
        renderPreview(initialDoc);
    }
    updateStatus();
});
