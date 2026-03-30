/**
 * FORMAT-OFF-THE-GRID
 * Sidebar / File Tree
 */

import workspace from './workspace.js';
import { buildFileTree } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const fileTree = document.getElementById('file-tree');
    const sidebar = document.getElementById('sidebar');
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const btnSidebarCollapse = document.getElementById('btn-sidebar-collapse');
    const btnSidebarAdd = document.getElementById('btn-sidebar-add');
    const btnSidebarClear = document.getElementById('btn-sidebar-clear');

    // Track expanded folders
    const expandedFolders = new Set();

    function render() {
        if (!fileTree) return;
        const filePaths = workspace.getFilePaths();

        if (filePaths.length === 0) {
            fileTree.innerHTML = `
                <div class="workspace-empty" style="padding: 2rem 1rem;">
                    <span class="material-icons">description</span>
                    <p>No files open.<br>Use the toolbar to open files or a folder.</p>
                </div>`;
            return;
        }

        const tree = buildFileTree(filePaths);
        fileTree.innerHTML = '';
        renderTreeNodes(tree, fileTree, 0);
    }

    function renderTreeNodes(nodes, container, depth) {
        for (const node of nodes) {
            if (node.type === 'folder') {
                renderFolderNode(node, container, depth);
            } else {
                renderFileNode(node, container, depth);
            }
        }
    }

    function renderFolderNode(node, container, depth) {
        const isExpanded = expandedFolders.has(node.path);

        const item = document.createElement('div');
        item.className = 'tree-item';
        item.style.paddingLeft = `${12 + depth * 16}px`;

        const chevron = document.createElement('span');
        chevron.className = 'tree-chevron material-icons' + (isExpanded ? ' expanded' : '');
        chevron.textContent = 'chevron_right';
        item.appendChild(chevron);

        const icon = document.createElement('span');
        icon.className = 'tree-icon material-icons';
        icon.textContent = isExpanded ? 'folder_open' : 'folder';
        item.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'tree-name';
        name.textContent = node.name;
        item.appendChild(name);

        item.addEventListener('click', () => {
            if (isExpanded) {
                expandedFolders.delete(node.path);
            } else {
                expandedFolders.add(node.path);
            }
            render();
        });

        container.appendChild(item);

        if (isExpanded) {
            const childContainer = document.createElement('div');
            childContainer.className = 'tree-folder-children';
            renderTreeNodes(node.children, childContainer, depth + 1);
            container.appendChild(childContainer);
        }
    }

    function renderFileNode(node, container, depth) {
        const item = document.createElement('div');
        item.className = 'tree-item';
        if (node.path === workspace.activeFile) {
            item.classList.add('active');
        }
        item.style.paddingLeft = `${12 + depth * 16 + 18}px`; // extra space for chevron alignment

        const icon = document.createElement('span');
        icon.className = 'tree-icon material-icons';
        icon.textContent = 'article';
        item.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'tree-name';
        name.textContent = node.name;
        item.appendChild(name);

        if (workspace.isModified(node.path)) {
            const dot = document.createElement('span');
            dot.className = 'tree-modified-dot';
            item.appendChild(dot);
        }

        item.addEventListener('click', () => {
            workspace.openTab(node.path);
            workspace.setActiveFile(node.path);
        });

        container.appendChild(item);
    }

    // Auto-expand folders containing the active file
    function expandToActiveFile() {
        if (!workspace.activeFile) return;
        const parts = workspace.activeFile.split('/');
        // Expand each parent directory
        for (let i = 1; i < parts.length; i++) {
            expandedFolders.add(parts.slice(0, i).join('/'));
        }
    }

    // --- Sidebar Toggle ---
    function toggleSidebar() {
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        if (btnToggleSidebar) {
            btnToggleSidebar.classList.toggle('active', !isCollapsed);
        }
    }

    btnToggleSidebar?.addEventListener('click', toggleSidebar);
    btnSidebarCollapse?.addEventListener('click', toggleSidebar);

    // --- Add Files Button ---
    btnSidebarAdd?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md,.txt,text/markdown,text/plain';
        input.multiple = true;
        input.onchange = e => {
            if (e.target.files.length > 0) {
                workspace.addFilesFromFileList(e.target.files);
            }
        };
        input.click();
    });

    // --- Clear All Files Button ---
    btnSidebarClear?.addEventListener('click', () => {
        if (workspace.getFilePaths().length === 0) return;
        const dialog = document.getElementById('clear-workspace-dialog');
        const btnCancel = document.getElementById('btn-clear-workspace-cancel');
        const btnConfirm = document.getElementById('btn-clear-workspace-confirm');

        dialog.showModal();

        btnCancel.onclick = () => dialog.close();
        btnConfirm.onclick = () => {
            workspace.clearWorkspace();
            dialog.close();
        };
    });

    // --- Listen for workspace events ---
    window.addEventListener('workspace-changed', () => {
        expandToActiveFile();
        render();
    });

    window.addEventListener('active-file-changed', () => {
        expandToActiveFile();
        render();
    });

    window.addEventListener('file-content-changed', () => {
        render(); // update modified dots
    });

    window.addEventListener('file-saved', () => {
        render(); // update modified dots
    });

    // --- Initial render ---
    expandToActiveFile();
    render();
});
