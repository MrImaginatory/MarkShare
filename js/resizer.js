/**
 * FORMAT-OFF-THE-GRID
 * Split Pane Resizer Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const resizer = document.getElementById('resizer');
    const leftPane = document.getElementById('editor-pane');
    const mainContent = document.getElementById('main-content');

    // Check saved width
    const savedWidth = localStorage.getItem('fotg-pane-width');
    if (savedWidth) {
        leftPane.style.flex = `0 0 ${savedWidth}px`;
    }

    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        // Prevent iframes/selection from interfering during drag
        leftPane.style.userSelect = 'none';
        leftPane.style.pointerEvents = 'none';
        document.getElementById('preview-pane').style.userSelect = 'none';
        document.getElementById('preview-pane').style.pointerEvents = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        // Calculate bounds (don't let pane shrink too much or expand too much)
        const containerWidth = mainContent.clientWidth;
        const minWidth = 200;
        const maxWidth = containerWidth - minWidth;

        let newWidth = e.clientX;

        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;

        leftPane.style.flex = `0 0 ${newWidth}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';

            // Restore pointer events
            leftPane.style.userSelect = '';
            leftPane.style.pointerEvents = '';
            document.getElementById('preview-pane').style.userSelect = '';
            document.getElementById('preview-pane').style.pointerEvents = '';

            // Save preference
            const currentWidth = leftPane.getBoundingClientRect().width;
            localStorage.setItem('fotg-pane-width', currentWidth);
        }
    });

    // Handle touch devices
    resizer.addEventListener('touchstart', (e) => {
        isResizing = true;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isResizing) return;

        const containerWidth = mainContent.clientWidth;
        const minWidth = 100;
        const maxWidth = containerWidth - minWidth;

        let newWidth = e.touches[0].clientX;

        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;

        leftPane.style.flex = `0 0 ${newWidth}px`;
    }, { passive: true });

    document.addEventListener('touchend', () => {
        if (isResizing) {
            isResizing = false;
            const currentWidth = leftPane.getBoundingClientRect().width;
            localStorage.setItem('fotg-pane-width', currentWidth);
        }
    });
});
