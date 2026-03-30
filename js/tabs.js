/**
 * FORMAT-OFF-THE-GRID
 * Tab Bar for Multi-File Workspace
 */

import workspace from './workspace.js';
import { getFileName } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const tabBar = document.getElementById('tab-bar');

    function render() {
        if (!tabBar) return;
        tabBar.innerHTML = '';

        const openPaths = workspace.getOpenTabPaths();

        for (const path of openPaths) {
            const file = workspace.getFile(path);
            if (!file) continue;

            const tab = document.createElement('div');
            tab.className = 'tab-item';
            if (path === workspace.activeFile) {
                tab.classList.add('active');
            }
            tab.title = path;
            tab.dataset.path = path;

            if (workspace.isModified(path)) {
                const dot = document.createElement('span');
                dot.className = 'tab-modified-dot';
                tab.appendChild(dot);
            }

            const name = document.createElement('span');
            name.className = 'tab-name';
            name.textContent = getFileName(path);
            tab.appendChild(name);

            const closeBtn = document.createElement('span');
            closeBtn.className = 'tab-close material-icons';
            closeBtn.textContent = 'close';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                workspace.closeTab(path);
            });
            tab.appendChild(closeBtn);

            tab.addEventListener('click', () => {
                workspace.setActiveFile(path);
            });

            tabBar.appendChild(tab);
        }

        // Add "Close All" button if there are open tabs
        if (openPaths.length > 0) {
            const closeAllBtn = document.createElement('div');
            closeAllBtn.className = 'tab-close-all-btn';
            closeAllBtn.title = 'Close All Tabs';
            closeAllBtn.innerHTML = '<span class="material-icons">close</span>';
            closeAllBtn.addEventListener('click', () => {
                workspace.closeAllTabs();
            });
            tabBar.appendChild(closeAllBtn);
        }

        // Add "+" button at end
        const addBtn = document.createElement('div');
        addBtn.className = 'tab-add-btn';
        addBtn.title = 'Add File';
        addBtn.innerHTML = '<span class="material-icons">add</span>';
        addBtn.addEventListener('click', () => {
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
        tabBar.appendChild(addBtn);
    }

    // Scroll active tab into view
    function scrollActiveTabIntoView() {
        const activeTab = tabBar?.querySelector('.tab-item.active');
        if (activeTab) {
            activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }

    // --- Listen for workspace events ---
    window.addEventListener('workspace-changed', () => {
        render();
        scrollActiveTabIntoView();
    });

    window.addEventListener('active-file-changed', () => {
        // Update active class without full re-render
        const tabs = tabBar?.querySelectorAll('.tab-item');
        tabs?.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.path === workspace.activeFile);
        });
        scrollActiveTabIntoView();
    });

    window.addEventListener('file-content-changed', () => {
        render();
    });

    window.addEventListener('file-saved', () => {
        render();
    });

    // --- Initial render ---
    render();
});
