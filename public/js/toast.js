// Lightweight toast notification system. Auto-dismisses, stacks in corner.
// Usage: window.Toast.success('Saved'); window.Toast.error('Oh no'); window.Toast.info('Heads up');
(function () {
  if (window.Toast) return;
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast-container';
  document.body.appendChild(container);

  function show(message, type = 'info', durationMs = 4000) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warn' ? '!' : 'ℹ';
    el.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg"></span><button class="toast-close" aria-label="Close">×</button>`;
    el.querySelector('.toast-msg').textContent = message;
    container.appendChild(el);
    const close = () => {
      el.classList.add('toast-leave');
      setTimeout(() => el.remove(), 200);
    };
    el.querySelector('.toast-close').addEventListener('click', close);
    if (durationMs > 0) setTimeout(close, durationMs);
    return close;
  }

  window.Toast = {
    success: (m, d) => show(m, 'success', d),
    error:   (m, d) => show(m, 'error',   d === undefined ? 6000 : d),
    warn:    (m, d) => show(m, 'warn',    d),
    info:    (m, d) => show(m, 'info',    d),
  };
})();
