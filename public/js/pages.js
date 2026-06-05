function landingPage() {
  return html`
    <div class="landing-page">
      <div class="landing-hero">
        <div class="landing-logo"><i class="fas fa-crown"></i></div>
        <h1>NexusForever</h1>
        <p>WildStar Emulator Server Management</p>
        <button class="btn btn-primary btn-lg" onclick="router.navigate('/login')">
          <i class="fas fa-sign-in-alt"></i> Sign In
        </button>
      </div>
      <div class="landing-features">
        <div class="feature-card">
          <i class="fas fa-server"></i>
          <h3>Server Control</h3>
          <p>Start, stop, and monitor your emulator servers in real-time</p>
        </div>
        <div class="feature-card">
          <i class="fas fa-users"></i>
          <h3>Account Management</h3>
          <p>Manage game accounts, roles, and permissions</p>
        </div>
        <div class="feature-card">
          <i class="fas fa-chart-line"></i>
          <h3>System Monitoring</h3>
          <p>Track CPU, memory, disk usage, and server performance</p>
        </div>
      </div>
    </div>
  `;
}

function loginPage() {
  return html`
    <div class="login-page">
      <div class="login-card">
        <div class="logo"><i class="fas fa-crown"></i></div>
        <h2>NexusForever</h2>
        <p>Server Management Panel</p>
        <form id="login-form">
          <div class="form-group">
            <label>Username</label>
            <input type="text" id="login-email" placeholder="admin" required>
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="login-password" placeholder="Enter password" required>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px">
            <i class="fas fa-sign-in-alt"></i> Sign In
          </button>
        </form>
      </div>
    </div>
  `;
}

function sidebar(user) {
  const isAdmin = user.role === 'admin' || user.roleId === 1;
  const items = [
    { icon: 'fa-tachometer-alt', label: 'Dashboard', path: '/dashboard' },
    { icon: 'fa-server', label: 'Server Status', path: '/server' },
    { icon: 'fa-users', label: 'Accounts', path: '/accounts', admin: true },
    { icon: 'fa-user', label: 'Characters', path: '/characters' },
    { icon: 'fa-cog', label: 'Settings', path: '/settings', admin: true },
    { icon: 'fa-file-alt', label: 'Logs', path: '/logs' },
  ];
  const currentPath = window.location.hash.slice(1) || '/dashboard';
  return html`
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="logo"><i class="fas fa-crown"></i></div>
        <h1>NexusForever</h1>
      </div>
      <nav class="sidebar-nav">
        ${items.filter(i => !i.admin || isAdmin).map(item => html`
          <div class="nav-item ${currentPath === item.path ? 'active' : ''}"
               onclick="router.navigate('${item.path}')">
            <i class="fas ${item.icon}"></i>
            <span>${item.label}</span>
          </div>
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar">${(user.email || 'U')[0].toUpperCase()}</div>
          <div>
            <div class="user-name">${escape(user.email || 'User')}</div>
            <div class="user-role">${user.roleId === 1 ? 'Admin' : 'User'}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="theme-toggle" onclick="toggleTheme()" title="Toggle theme">
            <i class="fas fa-moon" id="theme-icon"></i>
          </button>
          <button class="theme-toggle" onclick="handleLogout()" title="Logout">
            <i class="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>
    </aside>
  `;
}

function dashboardPage(data) {
  const s = data.server || {};
  const a = data.accounts || {};
  const c = data.characters || {};
  const sys = data.system || {};
  const status = s.status || 'offline';
  const statusDot = status === 'online' ? 'online' : status === 'starting' ? 'starting' : 'offline';
  return html`
    <div class="page-header">
      <div>
        <h2>Dashboard</h2>
        <p>Overview of your NexusForever server</p>
      </div>
      <div class="server-status">
        <span class="status-dot ${statusDot}"></span>
        Server: ${status.charAt(0).toUpperCase() + status.slice(1)}
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon primary"><i class="fas fa-server"></i></div>
        <div class="stat-info">
          <h4>${escape(sys.hostname || '-')}</h4>
          <p>Hostname</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon success"><i class="fas fa-users"></i></div>
        <div class="stat-info">
          <h4>${a.total || 0}</h4>
          <p>Total Accounts</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon info"><i class="fas fa-user"></i></div>
        <div class="stat-info">
          <h4>${c.total || 0}</h4>
          <p>Total Characters</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon warning"><i class="fas fa-microchip"></i></div>
        <div class="stat-info">
          <h4>${sys.cpu || '-%'}</h4>
          <p>CPU Usage</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon danger"><i class="fas fa-memory"></i></div>
        <div class="stat-info">
          <h4>${sys.memory || '-'}</h4>
          <p>Memory</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon primary"><i class="fas fa-hdd"></i></div>
        <div class="stat-info">
          <h4>${sys.disk || '-'}</h4>
          <p>Disk Usage</p>
        </div>
      </div>
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-users"></i> Recent Accounts</h3>
          <button class="btn btn-sm btn-ghost" onclick="router.navigate('/accounts')">View All</button>
        </div>
        ${a.recent && a.recent.length ? html`
          <div class="table-container">
            <table>
              <thead><tr><th>Email</th><th>Created</th><th>Status</th></tr></thead>
              <tbody>
                ${a.recent.slice(0, 5).map(ac => html`
                  <tr>
                    <td>${escape(ac.email)}</td>
                    <td>${ac.createTime ? new Date(ac.createTime).toLocaleDateString() : '-'}</td>
                    <td>${ac.isBanned ? '<span class="badge badge-danger">Banned</span>' : '<span class="badge badge-success">Active</span>'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty-state"><p>No accounts yet</p></div>'}
      </div>
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-user"></i> Recent Characters</h3>
          <button class="btn btn-sm btn-ghost" onclick="router.navigate('/characters')">View All</button>
        </div>
        ${c.recent && c.recent.length ? html`
          <div class="table-container">
            <table>
              <thead><tr><th>Name</th><th>Level</th><th>Account</th></tr></thead>
              <tbody>
                ${c.recent.slice(0, 5).map(ch => html`
                  <tr>
                    <td>${escape(ch.name)}</td>
                    <td>${ch.level || 1}</td>
                    <td>${escape(ch.accountEmail || '-')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty-state"><p>No characters yet</p></div>'}
      </div>
    </div>
  `;
}

function serverPage(status, logs) {
  const s = status || {};
  const servers = [
    { id: 'auth', name: 'AuthServer', icon: 'fa-shield-alt', running: s.authServer, pid: s.authPid },
    { id: 'world', name: 'WorldServer', icon: 'fa-globe', running: s.worldServer, pid: s.worldPid },
    { id: 'sts', name: 'StsServer', icon: 'fa-key', running: s.stsServer, pid: s.stsPid },
  ];
  const serviceActive = s.service === 'active';
  return html`
    <div class="page-header">
      <div>
        <h2>Server Status</h2>
        <p>Manage the NexusForever server</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-success" onclick="handleServerAction('start')" ${serviceActive ? 'disabled' : ''}>
          <i class="fas fa-play"></i> Start All
        </button>
        <button class="btn btn-warning" onclick="handleServerAction('restart')">
          <i class="fas fa-sync"></i> Restart All
        </button>
        <button class="btn btn-danger" onclick="handleServerAction('stop')" ${!serviceActive ? 'disabled' : ''}>
          <i class="fas fa-stop"></i> Stop All
        </button>
      </div>
    </div>
    <div class="stats-grid">
      ${servers.map(srv => html`
        <div class="stat-card">
          <div class="stat-icon ${srv.running ? 'success' : 'muted'}"><i class="fas ${srv.icon}"></i></div>
          <div class="stat-info">
            <h4><span class="status-dot ${srv.running ? 'online' : 'offline'}"></span> ${srv.name}</h4>
            <p>${srv.running ? 'PID: ' + (srv.pid || 'N/A') : 'Stopped'}</p>
          </div>
          <div class="stat-actions" style="display:flex;gap:4px;margin-top:8px">
            <button class="btn btn-sm btn-success" onclick="handleServerAction('start','${srv.id}')" ${srv.running ? 'disabled' : ''} title="Start ${srv.name}">
              <i class="fas fa-play"></i>
            </button>
            <button class="btn btn-sm btn-warning" onclick="handleServerAction('restart','${srv.id}')" title="Restart ${srv.name}">
              <i class="fas fa-sync"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="handleServerAction('stop','${srv.id}')" ${!srv.running ? 'disabled' : ''} title="Stop ${srv.name}">
              <i class="fas fa-stop"></i>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="card">
      <div class="card-header">
        <h3><i class="fas fa-terminal"></i> Server Logs</h3>
        <div style="display:flex;gap:8px;align-items:center">
          <select id="log-server-select" class="form-input" style="width:auto;padding:4px 8px" onchange="refreshLogs()">
            <option value="auth">AuthServer</option>
            <option value="world">WorldServer</option>
            <option value="sts">StsServer</option>
          </select>
          <button class="btn btn-sm btn-ghost" onclick="refreshLogs()"><i class="fas fa-sync"></i> Refresh</button>
        </div>
      </div>
      <div class="log-viewer" id="log-viewer">${escape(logs || 'No logs available')}</div>
    </div>
  `;
}

function accountsPage(data) {
  const accounts = Array.isArray(data) ? data : (data.accounts || data.results || []);
  const total = data.total || accounts.length;
  return html`
    <div class="page-header">
      <div>
        <h2>Accounts</h2>
        <p>Manage player accounts (${total} total)</p>
      </div>
      <button class="btn btn-primary" onclick="showCreateAccountModal()">
        <i class="fas fa-plus"></i> Create Account
      </button>
    </div>
    <div class="card">
      ${accounts.length ? html`
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${accounts.map(a => html`
                <tr>
                  <td>${a.id}</td>
                  <td>${escape(a.email)}</td>
                  <td><span class="badge ${a.roles === 'Administrator' ? 'badge-primary' : 'badge-info'}">${a.roles === 'Administrator' ? 'Admin' : a.roles || 'User'}</span></td>
                  <td>${a.createTime ? new Date(a.createTime).toLocaleDateString() : '-'}</td>
                  <td>${a.isBanned ? '<span class="badge badge-danger">Banned</span>' : '<span class="badge badge-success">Active</span>'}</td>
                  <td>
                    <div style="display:flex;gap:4px">
                      <button class="btn btn-sm btn-ghost" onclick="showEditAccountModal(${a.id})" title="Edit"><i class="fas fa-edit"></i></button>
                      <button class="btn btn-sm btn-ghost" onclick="showAccountCharacters(${a.id})" title="Characters"><i class="fas fa-user"></i></button>
                      ${a.isBanned
                        ? `<button class="btn btn-sm btn-success" onclick="toggleBan(${a.id}, false)" title="Unban"><i class="fas fa-check"></i></button>`
                        : `<button class="btn btn-sm btn-danger" onclick="toggleBan(${a.id}, true)" title="Ban"><i class="fas fa-ban"></i></button>`
                      }
                      <button class="btn btn-sm btn-ghost" onclick="deleteAccountConfirm(${a.id}, '${escape(a.email)}')" title="Delete" style="color:var(--color-danger)"><i class="fas fa-trash"></i></button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty-state"><i class="fas fa-users"></i><p>No accounts found</p></div>'}
    </div>
  `;
}

function charactersPage(data) {
  const chars = Array.isArray(data) ? data : (data.characters || data.results || []);
  const total = data.total || chars.length;
  return html`
    <div class="page-header">
      <div>
        <h2>Characters</h2>
        <p>Manage in-game characters (${total} total)</p>
      </div>
    </div>
    <div class="card">
      ${chars.length ? html`
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Level</th>
                <th>Race</th>
                <th>Class</th>
                <th>Account</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${chars.map(c => html`
                <tr>
                  <td>${c.id}</td>
                  <td>${escape(c.name)}</td>
                  <td>${c.level || 1}</td>
                  <td>${escape(c.race || '-')}</td>
                  <td>${escape(c.class || '-')}</td>
                  <td>${escape(c.accountEmail || c.accountId || '-')}</td>
                  <td>
                    <div style="display:flex;gap:4px">
                      <button class="btn btn-sm btn-ghost" onclick="showEditCharacterModal(${c.id})" title="Edit"><i class="fas fa-edit"></i></button>
                      <button class="btn btn-sm btn-danger" onclick="deleteCharacter(${c.id})" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty-state"><i class="fas fa-user"></i><p>No characters found</p></div>'}
    </div>
  `;
}

function settingsPage(roles, permissions) {
  return html`
    <div class="page-header">
      <div>
        <h2>Settings</h2>
        <p>Configure server roles, permissions, and settings</p>
      </div>
    </div>
    <div class="tabs">
      <button class="tab active" onclick="switchSettingsTab(this, 'roles')">Roles & Permissions</button>
      <button class="tab" onclick="switchSettingsTab(this, 'config')">Server Config</button>
    </div>
    <div id="settings-roles" class="tab-content">
      <div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <h3><i class="fas fa-shield-alt"></i> Roles</h3>
          <button class="btn btn-sm btn-primary" onclick="showCreateRoleModal()"><i class="fas fa-plus"></i> Add Role</button>
        </div>
        ${roles && roles.length ? html`
          <div class="table-container">
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Permissions</th></tr></thead>
              <tbody>
                ${roles.map(r => html`
                  <tr>
                    <td>${r.id}</td>
                    <td>${escape(r.name || r.roleName || 'Unknown')}</td>
                    <td>${r.permissionCount || r.permissions || 0}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty-state"><p>No roles defined</p></div>'}
      </div>
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-key"></i> Permissions</h3>
        </div>
        ${permissions && permissions.length ? html`
          <div class="table-container">
            <table>
              <thead><tr><th>ID</th><th>Name</th></tr></thead>
              <tbody>
                ${permissions.map(p => html`
                  <tr><td>${p.id}</td><td>${escape(p.name || p.permissionName || 'Unknown')}</td></tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty-state"><p>No permissions defined</p></div>'}
      </div>
    </div>
    <div id="settings-config" class="tab-content" style="display:none">
      <div class="card config-editor">
        <div class="card-header">
          <h3><i class="fas fa-code"></i> AuthServer Configuration</h3>
          <button class="btn btn-sm btn-primary" onclick="saveServerConfig()"><i class="fas fa-save"></i> Save</button>
        </div>
        <textarea id="config-editor" spellcheck="false"></textarea>
      </div>
    </div>
  `;
}

function logsPage(logs) {
  return html`
    <div class="page-header">
      <div>
        <h2>System Logs</h2>
        <p>View system and application logs</p>
      </div>
      <button class="btn btn-ghost" onclick="refreshSystemLogs()"><i class="fas fa-sync"></i> Refresh</button>
    </div>
    <div class="card">
      <div class="log-viewer" id="system-log-viewer" style="max-height:70vh">${escape(logs || 'No logs available')}</div>
    </div>
  `;
}

function loadingSpinner() {
  return '<div class="loading"><i class="fas fa-spinner spinner"></i></div>';
}

function showModal(content) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${content}</div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
  return overlay;
}

function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
}

function toast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  el.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${escape(message)}`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

function escape(str) {
  if (typeof str !== 'string') return str;
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, c => map[c]);
}

async function deleteAccountConfirm(id, email) {
  if (!confirm(`Delete account "${email}"? This cannot be undone.`)) return;
  try {
    await API.deleteAccount(id);
    toast('Account deleted', 'success');
    loadAccounts();
  } catch (err) {
    toast('Failed to delete account: ' + (err.message || err), 'error');
  }
}
