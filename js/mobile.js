/**
 * FORMAT-OFF-THE-GRID
 * Mobile View Toggle Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const tabEditor = document.getElementById('tab-editor');
    const tabPreview = document.getElementById('tab-preview');
    const editorPane = document.getElementById('editor-pane');
    const previewPane = document.getElementById('preview-pane');

    // Default state for mobile
    function updateMobileVisibility() {
        if (window.innerWidth <= 768) {
            // Apply current active tab
            if (tabEditor.classList.contains('active')) {
                editorPane.style.display = 'flex';
                previewPane.style.display = 'none';
            } else {
                editorPane.style.display = 'none';
                previewPane.style.display = 'flex';
            }
        } else {
            // Desktop: restore flex
            editorPane.style.display = '';
            previewPane.style.display = '';
        }
    }

    // Bind clicks
    if (tabEditor && tabPreview) {
        tabEditor.addEventListener('click', () => {
            tabEditor.classList.add('active');
            tabPreview.classList.remove('active');
            updateMobileVisibility();
        });

        tabPreview.addEventListener('click', () => {
            tabPreview.classList.add('active');
            tabEditor.classList.remove('active');
            updateMobileVisibility();
        });
    }

    // Monitor window resizing to flip gracefully between desktop/mobile thresholds
    window.addEventListener('resize', updateMobileVisibility);

    // Initial run
    updateMobileVisibility();
});
