/**
 * FORMAT-OFF-THE-GRID
 * Theme Toggle & Persistence Logic (Phase 1)
 */

document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('theme-toggle');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');

    // Check local storage or system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Determine initial theme
    const currentTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    setTheme(currentTheme);

    // Toggle event
    themeBtn.addEventListener('click', () => {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        // Update Icons
        if (theme === 'dark') {
            moonIcon.style.display = 'none';
            sunIcon.style.display = 'block';
        } else {
            moonIcon.style.display = 'block';
            sunIcon.style.display = 'none';
        }

        // Update Syntax Highlighting Theme if hljs is loaded
        const hljsLink = document.getElementById('hljs-theme');
        if (hljsLink) {
            const hljsThemeUrl = theme === 'dark'
                ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css'
                : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github.min.css';
            hljsLink.setAttribute('href', hljsThemeUrl);
        }

        // Notify other components (Mermaid, Editor) of theme change
        window.dispatchEvent(new Event('theme-changed'));
    }
});
