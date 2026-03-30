/**
 * FORMAT-OFF-THE-GRID
 * Shared Path Utilities
 */

/**
 * Normalize a file path: replace backslashes, remove trailing slashes,
 * resolve ./ and ../ segments.
 */
export function normalizePath(path) {
    if (!path) return '';
    // Replace backslashes with forward slashes
    let normalized = path.replace(/\\/g, '/');
    // Remove leading ./ if present
    normalized = normalized.replace(/^\.\//, '');
    // Resolve ../ segments
    const parts = normalized.split('/');
    const resolved = [];
    for (const part of parts) {
        if (part === '..') {
            resolved.pop();
        } else if (part !== '.' && part !== '') {
            resolved.push(part);
        }
    }
    return resolved.join('/');
}

/**
 * Resolve a relative path from a base file path.
 * e.g., resolveRelativePath("docs/guide.md", "../api.md") => "api.md"
 */
export function resolveRelativePath(fromFile, relativeLink) {
    if (!relativeLink) return '';
    // If the link starts with /, it's root-relative
    if (relativeLink.startsWith('/')) {
        return normalizePath(relativeLink.substring(1));
    }
    // Get the directory of the fromFile
    const fromDir = getDirectoryName(fromFile);
    // Combine and normalize
    const combined = fromDir ? `${fromDir}/${relativeLink}` : relativeLink;
    return normalizePath(combined);
}

/**
 * Get the directory portion of a file path.
 * e.g., getDirectoryName("docs/guide.md") => "docs"
 * e.g., getDirectoryName("index.md") => ""
 */
export function getDirectoryName(path) {
    if (!path) return '';
    const normalized = normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash >= 0 ? normalized.substring(0, lastSlash) : '';
}

/**
 * Get the filename portion of a file path.
 * e.g., getFileName("docs/guide.md") => "guide.md"
 */
export function getFileName(path) {
    if (!path) return '';
    const normalized = normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;
}

/**
 * Check if a URL/href is a relative markdown link that should be opened in the editor.
 * Returns false for external URLs, anchor links, and non-markdown files.
 */
export function isRelativeMdLink(href) {
    if (!href) return false;
    // Skip external URLs
    if (/^https?:\/\//i.test(href)) return false;
    // Skip mailto:
    if (/^mailto:/i.test(href)) return false;
    // Skip pure anchor links (same-file anchors like #heading)
    if (href.startsWith('#')) return false;
    // Only handle .md and .txt files
    const cleanHref = href.split('#')[0].split('?')[0]; // strip anchors and query params
    return /\.(md|txt)$/i.test(cleanHref);
}

/**
 * Strip anchor and query string from a path.
 * e.g., stripFragment("docs/api.md#section") => "docs/api.md"
 */
export function stripFragment(path) {
    if (!path) return '';
    return path.split('#')[0].split('?')[0];
}

/**
 * Extract the anchor/fragment from a path.
 * e.g., getFragment("docs/api.md#section") => "section"
 */
export function getFragment(path) {
    if (!path) return '';
    const hashIndex = path.indexOf('#');
    return hashIndex >= 0 ? path.substring(hashIndex + 1) : '';
}

/**
 * Build a tree structure from a flat list of file paths.
 * Returns an array of tree nodes: { name, type: 'file'|'folder', path?, children? }
 */
export function buildFileTree(filePaths) {
    const root = [];

    for (const filePath of filePaths) {
        const parts = normalizePath(filePath).split('/');
        let current = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            const existing = current.find(n => n.name === part);

            if (existing && !isFile && existing.type === 'folder') {
                // Folder already exists, navigate into it
                current = existing.children;
            } else if (!existing) {
                if (isFile) {
                    current.push({ name: part, type: 'file', path: filePath });
                } else {
                    const folder = { name: part, type: 'folder', children: [], path: parts.slice(0, i + 1).join('/') };
                    current.push(folder);
                    current = folder.children;
                }
            }
            // If existing && isFile: duplicate file path, skip
            // If existing && folder but isFile: name collision (folder/file conflict), skip
        }
    }

    // Sort: folders first, then files, alphabetically
    function sortTree(nodes) {
        nodes.sort((a, b) => {
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
        for (const node of nodes) {
            if (node.type === 'folder') {
                sortTree(node.children);
            }
        }
    }

    sortTree(root);
    return root;
}
