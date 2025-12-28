export function createSettingsManager() {
  const el = document.createElement('div');
  el.className = 'manager-page settings-manager';

  el.innerHTML = `
    <h2>Settings Manager</h2>

    <div class="setting-row">
      <span>Theme:</span>
      <div class="theme-toggle">
        <button data-theme="light">Light</button>
        <button data-theme="dark">Dark</button>
        <button data-theme="system">System</button>
      </div>
    </div>
  `;

  // Theme toggle logic
  const buttons = el.querySelectorAll('.theme-toggle button');

 buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    const theme = btn.dataset.theme;

    // Apply theme to CSS variables
    document.documentElement.dataset.theme = theme;

    // Save to localStorage if you want persistence
    localStorage.setItem('appTheme', theme);

    // Update active button visually
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// On load, apply saved theme
const savedTheme = localStorage.getItem('appTheme') || 'system';
document.documentElement.dataset.theme = savedTheme;
const activeBtn = el.querySelector(`.theme-toggle button[data-theme="${savedTheme}"]`);
if (activeBtn) activeBtn.classList.add('active');


  return el;
}
