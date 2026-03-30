/**
 * FORMAT-OFF-THE-GRID
 * Workspace / Multi-File Manager
 */

import { normalizePath, resolveRelativePath, stripFragment } from './utils.js';

const LEGACY_CONTENT_KEY = 'fotg-content';
const WORKSPACE_KEY = 'fotg-workspace';
const ACTIVE_FILE_KEY = 'fotg-active-file';

function fileStorageKey(path) {
    return `fotg-file:${normalizePath(path)}`;
}

/**
 * Workspace singleton — manages multi-file state.
 * Dispatches custom events for UI to react to:
 *   'workspace-changed' — files added/removed
 *   'active-file-changed' — active file switched
 *   'file-content-changed' — content of a file changed (from editor)
 *   'file-saved' — a file was saved to disk
 *   'workspace-error' — an error occurred (detail: { message })
 */
const workspace = {
    /** @type {Map<string, {content: string, name: string, path: string, handle?: FileSystemFileHandle, modified: boolean}>} */
    files: new Map(),
    /** @type {Set<string>} */
    openTabs: new Set(),
    /** @type {string|null} */
    activeFile: null,
    /** @type {FileSystemDirectoryHandle|null} */
    rootHandle: null,
    /** @type {string} */
    rootName: '',

    // ---- File Management ----

    addFile(path, content, handle = null, openAsTab = true) {
        const normalizedPath = normalizePath(path);
        const name = normalizedPath.split('/').pop();
        this.files.set(normalizedPath, {
            content,
            name,
            path: normalizedPath,
            handle,
            modified: false,
        });
        if (openAsTab) {
            this.openTabs.add(normalizedPath);
        }
        this._saveFileToStorage(normalizedPath);
        this._saveWorkspaceMeta();
        dispatchEvent(new CustomEvent('workspace-changed', { detail: { path: normalizedPath, action: 'add' } }));
    },

    removeFile(path) {
        const normalizedPath = normalizePath(path);
        this.files.delete(normalizedPath);
        localStorage.removeItem(fileStorageKey(normalizedPath));
        this._saveWorkspaceMeta();
        if (this.activeFile === normalizedPath) {
            const remaining = this.files.keys();
            const next = remaining.next().value || null;
            this.setActiveFile(next);
        }
        dispatchEvent(new CustomEvent('workspace-changed', { detail: { path: normalizedPath, action: 'remove' } }));
    },

    getFile(path) {
        const normalizedPath = normalizePath(path);
        return this.files.get(normalizedPath) || null;
    },

    getFilePaths() {
        return Array.from(this.files.keys());
    },

    hasFile(path) {
        return this.files.has(normalizePath(path));
    },

    setActiveFile(path) {
        if (!path) {
            this.activeFile = null;
            localStorage.removeItem(ACTIVE_FILE_KEY);
            dispatchEvent(new CustomEvent('active-file-changed', { detail: { path: null } }));
            return;
        }
        const normalizedPath = normalizePath(path);
        if (!this.files.has(normalizedPath)) return;
        this.activeFile = normalizedPath;
        localStorage.setItem(ACTIVE_FILE_KEY, normalizedPath);
        dispatchEvent(new CustomEvent('active-file-changed', { detail: { path: normalizedPath } }));
    },

    getActiveFile() {
        if (!this.activeFile) return null;
        return this.files.get(this.activeFile) || null;
    },

    /**
     * Update the content of a file (called from editor on change).
     */
    updateFileContent(path, content) {
        const normalizedPath = normalizePath(path);
        const file = this.files.get(normalizedPath);
        if (!file) return;
        file.content = content;
        file.modified = true;
        this._saveFileToStorage(normalizedPath);
        dispatchEvent(new CustomEvent('file-content-changed', { detail: { path: normalizedPath } }));
    },

    /**
     * Mark a file as saved (no longer modified).
     */
    markSaved(path) {
        const normalizedPath = normalizePath(path);
        const file = this.files.get(normalizedPath);
        if (!file) return;
        file.modified = false;
        dispatchEvent(new CustomEvent('file-saved', { detail: { path: normalizedPath } }));
    },

    /**
     * Resolve a relative link from the currently active file and open that file.
     * Returns the resolved file object, or null if not found.
     */
    resolveAndOpenLink(href) {
        const cleanHref = stripFragment(href);
        if (!this.activeFile || !cleanHref) return null;
        const resolved = resolveRelativePath(this.activeFile, cleanHref);
        if (this.hasFile(resolved)) {
            this.setActiveFile(resolved);
            return this.getFile(resolved);
        }
        dispatchEvent(new CustomEvent('workspace-error', { detail: { message: `File not found: ${cleanHref}` } }));
        return null;
    },

    // ---- Persistence ----

    _saveFileToStorage(path) {
        const file = this.files.get(path);
        if (!file) return;
        try {
            localStorage.setItem(fileStorageKey(path), file.content);
        } catch (e) {
            console.warn('localStorage write failed for', path, e);
        }
    },

    _saveWorkspaceMeta() {
        const meta = {
            filePaths: this.getFilePaths(),
            openTabs: this.getOpenTabPaths(),
            rootName: this.rootName,
        };
        try {
            localStorage.setItem(WORKSPACE_KEY, JSON.stringify(meta));
        } catch (e) {
            console.warn('localStorage write failed for workspace meta', e);
        }
    },

    /**
     * Restore workspace from localStorage.
     * Also handles migration from legacy single-file storage.
     */
    loadFromStorage() {
        const metaRaw = localStorage.getItem(WORKSPACE_KEY);
        if (metaRaw) {
            try {
                const meta = JSON.parse(metaRaw);
                this.rootName = meta.rootName || '';
                for (const path of meta.filePaths) {
                    const content = localStorage.getItem(fileStorageKey(path)) || '';
                    this.files.set(normalizePath(path), {
                        content,
                        name: path.split('/').pop(),
                        path: normalizePath(path),
                        handle: null,
                        modified: false,
                    });
                }
                const savedActive = localStorage.getItem(ACTIVE_FILE_KEY);
                if (savedActive && this.files.has(normalizePath(savedActive))) {
                    this.activeFile = normalizePath(savedActive);
                } else if (this.files.size > 0) {
                    this.activeFile = this.files.keys().next().value;
                }
                // Restore open tabs
                if (Array.isArray(meta.openTabs)) {
                    for (const path of meta.openTabs) {
                        if (this.files.has(normalizePath(path))) {
                            this.openTabs.add(normalizePath(path));
                        }
                    }
                }
                return;
            } catch (e) {
                console.warn('Failed to parse workspace meta, resetting', e);
            }
        }

        // Legacy migration
        this._migrateLegacy();
    },

    _migrateLegacy() {
        const legacyContent = localStorage.getItem(LEGACY_CONTENT_KEY);
        if (legacyContent !== null) {
            this.addFile('untitled.md', legacyContent);
            this.setActiveFile('untitled.md');
            localStorage.removeItem(LEGACY_CONTENT_KEY);
        }
    },

    // ---- Folder Opening (File System Access API) ----

    /**
     * Open a folder using the File System Access API.
     * Returns true if successful.
     */
    async openFolder() {
        if (!('showDirectoryPicker' in window)) {
            dispatchEvent(new CustomEvent('workspace-error', { detail: { message: 'Your browser does not support opening folders. Please use "Open Files" instead.' } }));
            return false;
        }
        try {
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            this.rootHandle = dirHandle;
            this.rootName = dirHandle.name;
            // Clear existing workspace
            this.files.clear();
            this.activeFile = null;
            // Load all .md/.txt files recursively
            await this._loadDirectory(dirHandle, '');
            this._saveWorkspaceMeta();
            if (this.files.size > 0) {
                // Try to open index.md or README.md first, else first file
                const paths = this.getFilePaths();
                const preferred = paths.find(p => /index\.md$/i.test(p) || /readme\.md$/i.test(p));
                const activePath = preferred || paths[0];
                this.openTabs.add(activePath);
                this.setActiveFile(activePath);
            }
            dispatchEvent(new CustomEvent('workspace-changed', { detail: { action: 'load-folder' } }));
            return true;
        } catch (e) {
            if (e.name === 'AbortError') return false; // user cancelled
            console.error('Failed to open folder', e);
            dispatchEvent(new CustomEvent('workspace-error', { detail: { message: 'Failed to open folder: ' + e.message } }));
            return false;
        }
    },

    async _loadDirectory(dirHandle, prefix) {
        for await (const [name, handle] of dirHandle.entries()) {
            const path = prefix ? `${prefix}/${name}` : name;
            if (handle.kind === 'directory') {
                // Skip hidden directories
                if (name.startsWith('.')) continue;
                await this._loadDirectory(handle, path);
            } else if (handle.kind === 'file') {
                if (/\.(md|txt)$/i.test(name)) {
                    try {
                        const file = await handle.getFile();
                        const content = await file.text();
                        this.addFile(path, content, handle, false);
                    } catch (e) {
                        console.warn('Failed to read file', path, e);
                    }
                }
            }
        }
    },

    /**
     * Add multiple files from a FileList (from <input type="file">).
     */
    async addFilesFromFileList(fileList) {
        // Try to detect directory structure from webkitRelativePath
        let hasRelativePaths = false;
        for (const file of fileList) {
            if (file.webkitRelativePath) {
                hasRelativePaths = true;
                break;
            }
        }

        for (const file of fileList) {
            if (!/\.(md|txt)$/i.test(file.name)) continue;
            try {
                const content = await file.text();
                const path = hasRelativePaths && file.webkitRelativePath
                    ? file.webkitRelativePath
                    : file.name;
                this.addFile(path, content, null);
            } catch (e) {
                console.warn('Failed to read file', file.name, e);
            }
        }

        this._saveWorkspaceMeta();
        if (this.files.size > 0 && !this.activeFile) {
            const paths = this.getFilePaths();
            const preferred = paths.find(p => /index\.md$/i.test(p) || /readme\.md$/i.test(p));
            this.setActiveFile(preferred || paths[0]);
        }
        dispatchEvent(new CustomEvent('workspace-changed', { detail: { action: 'add-files' } }));
    },

    /**
     * Save a file back to disk using File System Access API (if handle available).
     */
    async saveFileToDisk(path) {
        const normalizedPath = normalizePath(path);
        const file = this.files.get(normalizedPath);
        if (!file) return false;

        // If we have a direct file handle, use it
        if (file.handle) {
            try {
                const writable = await file.handle.createWritable();
                await writable.write(file.content);
                await writable.close();
                this.markSaved(normalizedPath);
                return true;
            } catch (e) {
                console.error('Failed to save file', normalizedPath, e);
            }
        }

        // If we have a root directory handle, try to find/create the file there
        if (this.rootHandle) {
            try {
                const parts = normalizedPath.split('/');
                let dir = this.rootHandle;
                for (let i = 0; i < parts.length - 1; i++) {
                    dir = await dir.getDirectoryHandle(parts[i], { create: true });
                }
                const fileHandle = await dir.getFileHandle(parts[parts.length - 1], { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(file.content);
                await writable.close();
                file.handle = fileHandle;
                this.markSaved(normalizedPath);
                return true;
            } catch (e) {
                console.error('Failed to save file via directory handle', normalizedPath, e);
            }
        }

        return false;
    },

    /**
     * Save all modified files.
     */
    async saveAll() {
        let saved = 0;
        for (const [path, file] of this.files) {
            if (file.modified) {
                const ok = await this.saveFileToDisk(path);
                if (ok) saved++;
            }
        }
        return saved;
    },

    // ---- Open Tabs Management ----

    openTab(path) {
        const normalizedPath = normalizePath(path);
        if (!this.files.has(normalizedPath)) return;
        this.openTabs.add(normalizedPath);
        this._saveWorkspaceMeta();
        dispatchEvent(new CustomEvent('workspace-changed', { detail: { path: normalizedPath, action: 'open-tab' } }));
    },

    closeTab(path) {
        const normalizedPath = normalizePath(path);
        this.openTabs.delete(normalizedPath);
        if (this.activeFile === normalizedPath) {
            const remaining = Array.from(this.openTabs);
            const next = remaining.length > 0 ? remaining[remaining.length - 1] : null;
            this.setActiveFile(next);
        }
        this._saveWorkspaceMeta();
        dispatchEvent(new CustomEvent('workspace-changed', { detail: { path: normalizedPath, action: 'close-tab' } }));
    },

    closeAllTabs() {
        this.openTabs.clear();
        this.setActiveFile(null);
        this._saveWorkspaceMeta();
        dispatchEvent(new CustomEvent('workspace-changed', { detail: { action: 'close-all-tabs' } }));
    },

    getOpenTabPaths() {
        return Array.from(this.openTabs);
    },

    isTabOpen(path) {
        return this.openTabs.has(normalizePath(path));
    },

    // ---- Utility ----

    getFileCount() {
        return this.files.size;
    },

    isModified(path) {
        const normalizedPath = normalizePath(path);
        const file = this.files.get(normalizedPath);
        return file ? file.modified : false;
    },

    hasAnyModified() {
        for (const file of this.files.values()) {
            if (file.modified) return true;
        }
        return false;
    },

    clearWorkspace() {
        this.files.clear();
        this.rootHandle = null;
        this.rootName = '';
        localStorage.removeItem(WORKSPACE_KEY);
        // Remove all file content from storage
        for (const key of Object.keys(localStorage)) {
            if (key.startsWith('fotg-file:')) {
                localStorage.removeItem(key);
            }
        }
        this.setActiveFile(null);
        dispatchEvent(new CustomEvent('workspace-changed', { detail: { action: 'clear' } }));
    },
};

// Auto-load workspace from storage when module is imported
// Defer to next microtask to ensure DOM and other modules are ready
queueMicrotask(() => {
    workspace.loadFromStorage();
});

export default workspace;
