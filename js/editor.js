/**
 * FORMAT-OFF-THE-GRID
 * Editor Initialization (CodeMirror 6)
 */

import { EditorState } from "https://esm.sh/@codemirror/state@6.4.0";
import { EditorView, basicSetup } from "https://esm.sh/codemirror@6.0.1?deps=@codemirror/state@6.4.0";
import { markdown } from "https://esm.sh/@codemirror/lang-markdown@6.2.5?deps=@codemirror/state@6.4.0";

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById("editor-container");
    container.innerHTML = ""; // Clear placeholder

    const SAVED_DOC_KEY = "fotg-content";
    const initialDoc = localStorage.getItem(SAVED_DOC_KEY) || "# Welcome to Markdown Viewer\n\nStart typing your markdown here...";
    const previewContainer = document.getElementById("preview-container");
    const wordCountDisplay = document.getElementById("word-count");

    // Debounce state
    let renderTimer = null;

    async function renderPreview(markdownText) {
        // Custom processing for video before passing to marked: 
        // We'll support a custom syntax like: ![video](url)
        let processedText = markdownText.replace(/!\[video\]\((.*?)\)/gi, (match, url) => {
            return `<video controls style="max-width: 100%; height: auto; border-radius: 6px; margin: 1rem 0;"><source src="${url}"></video>`;
        });

        // Sanitize & Render
        const rawHtml = window.marked.parse(processedText);
        // We must allow video, source tags and specific attributes in DOMPurify
        const safeHtml = window.DOMPurify.sanitize(rawHtml, {
            ADD_TAGS: ['video', 'source'],
            ADD_ATTR: ['controls', 'src', 'style']
        });
        previewContainer.innerHTML = safeHtml;

        // Calculate Words & Chars
        const textOnly = rawHtml.replace(/<[^>]*>?/gm, ''); // strip html tags
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
        if (window.mermaid) {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            window.mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' });

            const mermaidBlocks = previewContainer.querySelectorAll('pre code.language-mermaid');
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
                    pre.replaceWith(div);
                } catch (e) {
                    console.error('Mermaid render error', e);
                    // If error, we leave the <pre> block alone so they can see their source
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

    const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
            const currentDoc = update.state.doc.toString();
            // LocalStorage persistence
            localStorage.setItem(SAVED_DOC_KEY, currentDoc);

            // Debounced render
            clearTimeout(renderTimer);
            renderTimer = setTimeout(() => {
                renderPreview(currentDoc);
            }, 300); // 300ms debounce
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

    // Action function generating the transaction
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

    // Keyboard Shortcuts (DOM-level to avoid keymap import conflicts)
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
                    document.getElementById('btn-save')?.click();
                    break;
            }
        }
    });

    // Synchronized Scrolling Logic
    const editorScrollDOM = view.scrollDOM;
    let isSyncingLeft = false;
    let isSyncingRight = false;
    let syncScrollEnabled = true; // default ON

    // Editor -> Preview mapping
    editorScrollDOM.addEventListener('scroll', () => {
        if (!syncScrollEnabled) return;
        if (!isSyncingLeft) {
            isSyncingRight = true;

            // Calculate percentage
            const percentage = editorScrollDOM.scrollTop / (editorScrollDOM.scrollHeight - editorScrollDOM.clientHeight);

            // Apply it to right pane
            if (!isNaN(percentage)) {
                previewContainer.scrollTop = percentage * (previewContainer.scrollHeight - previewContainer.clientHeight);
            }
        }
        isSyncingLeft = false;
    }, { passive: true });

    // Preview -> Editor mapping
    previewContainer.addEventListener('scroll', () => {
        if (!syncScrollEnabled) return;
        if (!isSyncingRight) {
            isSyncingLeft = true;

            // Calculate percentage
            const percentage = previewContainer.scrollTop / (previewContainer.scrollHeight - previewContainer.clientHeight);

            // Apply it to left pane
            if (!isNaN(percentage)) {
                editorScrollDOM.scrollTop = percentage * (editorScrollDOM.scrollHeight - editorScrollDOM.clientHeight);
            }
        }
        isSyncingRight = false;
    }, { passive: true });

    // --- Sync Scroll Toggle ---
    const btnSyncScroll = document.getElementById('btn-sync-scroll');
    if (btnSyncScroll) {
        btnSyncScroll.addEventListener('click', () => {
            syncScrollEnabled = !syncScrollEnabled;
            btnSyncScroll.classList.toggle('active', syncScrollEnabled);
        });
    }

    // --- View Mode Switcher ---
    const mainContent = document.getElementById('main-content');
    const btnViewEditor = document.getElementById('btn-view-editor');
    const btnViewSplit = document.getElementById('btn-view-split');
    const btnViewPreview = document.getElementById('btn-view-preview');
    const viewBtns = [btnViewEditor, btnViewSplit, btnViewPreview];

    function setViewMode(mode) {
        // Remove all view classes
        mainContent.classList.remove('view-editor', 'view-preview');

        // Remove active from all view buttons
        viewBtns.forEach(b => b?.classList.remove('active'));

        if (mode === 'editor') {
            mainContent.classList.add('view-editor');
            btnViewEditor?.classList.add('active');
        } else if (mode === 'preview') {
            mainContent.classList.add('view-preview');
            btnViewPreview?.classList.add('active');
        } else {
            // split (default)
            btnViewSplit?.classList.add('active');
        }
    }

    btnViewEditor?.addEventListener('click', () => setViewMode('editor'));
    btnViewSplit?.addEventListener('click', () => setViewMode('split'));
    btnViewPreview?.addEventListener('click', () => setViewMode('preview'));


    // Toolbar Listeners
    document.getElementById('btn-bold')?.addEventListener('click', () => toggleFormat("**"));
    document.getElementById('btn-italic')?.addEventListener('click', () => toggleFormat("*"));
    document.getElementById('btn-link')?.addEventListener('click', () => toggleFormat("[", "](url)"));
    document.getElementById('btn-code')?.addEventListener('click', () => toggleFormat("\n```\n", "\n```\n"));
    document.getElementById('btn-mermaid')?.addEventListener('click', () => toggleFormat("\n```mermaid\n", "\n```\n"));
    document.getElementById('btn-image')?.addEventListener('click', () => toggleFormat("![alt text](", "image_url_here)"));
    document.getElementById('btn-video')?.addEventListener('click', () => toggleFormat("![video](", "video_url_here)"));

    // Toolbar Export/Print
    document.getElementById('btn-export')?.addEventListener('click', () => {
        const title = "Markdown Viewer Export";
        const content = previewContainer.innerHTML;
        // Generate self-contained HTML
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

    // Initial render
    renderPreview(initialDoc);

    // Re-render when theme changes so Mermaid adapts
    window.addEventListener('theme-changed', () => {
        renderPreview(view.state.doc.toString());
    });

    // File I/O
    const btnSave = document.getElementById('btn-save');
    const btnOpen = document.getElementById('btn-open');

    if (btnSave) {
        btnSave.addEventListener('click', () => {
            const content = view.state.doc.toString();
            const blob = new Blob([content], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'document.md';
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    if (btnOpen) {
        btnOpen.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.md,.txt,text/markdown,text/plain';
            input.onchange = e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = e => {
                    const content = e.target.result;
                    view.dispatch({
                        changes: { from: 0, to: view.state.doc.length, insert: content }
                    });
                };
                reader.readAsText(file);
            };
            input.click();
        });
    }

    // --- Reset Editor ---
    const btnReset = document.getElementById('btn-reset');
    const resetDialog = document.getElementById('reset-dialog');
    const btnDialogConfirm = document.getElementById('btn-dialog-confirm');
    const btnDialogCancel = document.getElementById('btn-dialog-cancel');

    if (btnReset && resetDialog) {
        btnReset.addEventListener('click', () => {
            resetDialog.showModal();
        });

        btnDialogCancel.addEventListener('click', () => {
            resetDialog.close();
        });

        // Optional: close on backdrop click for native dialogs
        resetDialog.addEventListener('click', (e) => {
            if (e.target === resetDialog) {
                resetDialog.close();
            }
        });

        btnDialogConfirm.addEventListener('click', () => {
            // Clear CodeMirror content
            view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: "" }
            });
            resetDialog.close();
        });
    }
});
