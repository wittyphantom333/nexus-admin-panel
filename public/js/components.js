function html(strings, ...values) {
  return strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '');
}

function escape(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  el.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${escape(message)}`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

function showModal(content) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${content}</div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  return overlay.querySelector('.modal');
}

function closeModal() {
  document.querySelector('.modal-overlay')?.remove();
}

function loadingSpinner() {
  return '<div class="loading"><i class="fas fa-spinner spinner"></i></div>';
}

function statusDot(status) {
  const cls = (status === 'running' || status === 'online') ? 'online' : status === 'starting' ? 'starting' : 'offline';
  return `<span class="status-dot ${cls}"></span>`;
}

function badge(text, type = 'primary') {
  return `<span class="badge badge-${type}">${escape(text)}</span>`;
}

function statCard(icon, iconType, label, value) {
  return html`
    <div class="stat-card">
      <div class="stat-icon ${iconType}"><i class="fas ${icon}"></i></div>
      <div class="stat-info">
        <h4>${value}</h4>
        <p>${escape(label)}</p>
      </div>
    </div>
  `;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  if (!seconds) return '-';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(d + 'd');
  if (h) parts.push(h + 'h');
  if (m) parts.push(m + 'm');
  return parts.join(' ') || '<1m';
}
