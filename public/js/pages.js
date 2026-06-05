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
    { icon: 'fa-globe-americas', label: 'World DB', path: '/worlddb', admin: true },
    { icon: 'fa-bullhorn', label: 'Announcements', path: '/announcements', admin: true },
    { icon: 'fa-terminal', label: 'Commands', path: '/commands', admin: true },
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
        <div class="version-tag" id="version-tag" title="Build info">v...</div>
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
  const statusText = status.charAt(0).toUpperCase() + status.slice(1);
  const memUsed = (sys.memory && sys.memory.used) || 0;
  const memTotal = (sys.memory && sys.memory.total) || 0;
  const memPct = memTotal ? Math.round((memUsed / memTotal) * 100) : 0;
  const diskStr = sys.disk || '0%';
  const diskPct = parseInt(diskStr) || 0;
  const cpuPct = typeof sys.cpu === 'number' ? Math.round(sys.cpu) : 0;
  const fmtUptime = sys.uptime && sys.uptime !== 'unknown' ? sys.uptime : '—';

  const servers = [
    { id: 'auth', name: 'AuthServer', icon: 'fa-shield-alt', running: s.authServer, pid: s.authPid, port: 14000 },
    { id: 'world', name: 'WorldServer', icon: 'fa-globe', running: s.worldServer, pid: s.worldPid, port: 24000 },
    { id: 'sts', name: 'StsServer', icon: 'fa-key', running: s.stsServer, pid: s.stsPid, port: 14001 },
  ];
  const onlineCount = servers.filter(x => x.running).length;

  return html`
    <div class="page-header">
      <div>
        <h2>Dashboard</h2>
        <p>Overview of your NexusForever server</p>
      </div>
      <div class="health-pill ${status === 'online' ? 'online' : status === 'offline' ? 'offline' : 'degraded'}">
        <span class="status-dot ${status}"></span>
        <span>${onlineCount} / ${servers.length} Online</span>
      </div>
    </div>

    <div class="dash-grid">
      <div class="dash-card dash-card--hero">
        <div class="dash-card-bg"></div>
        <div class="dash-card-body">
          <div class="dash-card-top">
            <div>
              <div class="dash-card-label">Server Health</div>
              <div class="dash-card-value">${statusText}</div>
              <div class="dash-card-sub">emulator-server.target · ${s.service || 'inactive'}</div>
            </div>
            <div class="dash-card-icon ${status}">
              <i class="fas fa-${status === 'online' ? 'check-circle' : status === 'offline' ? 'times-circle' : 'spinner'}"></i>
            </div>
          </div>
          <div class="dash-services">
            ${servers.map(srv => html`
              <div class="dash-service ${srv.running ? 'is-running' : 'is-stopped'}">
                <span class="status-dot ${srv.running ? 'online' : 'offline'}"></span>
                <span class="dash-service-name">${srv.name}</span>
                <span class="dash-service-port">:${srv.port}</span>
              </div>
            `).join('')}
          </div>
          <div class="dash-card-actions">
            <a href="#/servers" class="btn btn-primary"><i class="fas fa-sliders-h"></i> Manage</a>
          </div>
        </div>
      </div>

      <div class="dash-card">
        <div class="dash-card-body">
          <div class="dash-card-top">
            <div>
              <div class="dash-card-label">Accounts</div>
              <div class="dash-card-value">${a.total || 0}</div>
              <div class="dash-card-sub">Total registered</div>
            </div>
            <div class="dash-card-icon primary"><i class="fas fa-users"></i></div>
          </div>
          <a href="#/accounts" class="dash-card-link">View all <i class="fas fa-arrow-right"></i></a>
        </div>
      </div>

      <div class="dash-card">
        <div class="dash-card-body">
          <div class="dash-card-top">
            <div>
              <div class="dash-card-label">Characters</div>
              <div class="dash-card-value">${c.total || 0}</div>
              <div class="dash-card-sub">Created in world</div>
            </div>
            <div class="dash-card-icon info"><i class="fas fa-user"></i></div>
          </div>
          <a href="#/characters" class="dash-card-link">View all <i class="fas fa-arrow-right"></i></a>
        </div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="dash-card">
        <div class="dash-card-body">
          <div class="dash-card-top">
            <div>
              <div class="dash-card-label">CPU</div>
              <div class="dash-card-value">${cpuPct}<span class="dash-unit">%</span></div>
            </div>
            <div class="dash-card-icon warning"><i class="fas fa-microchip"></i></div>
          </div>
          <div class="dash-bar"><div class="dash-bar-fill ${cpuPct > 80 ? 'danger' : cpuPct > 60 ? 'warning' : 'success'}" style="width:${Math.min(cpuPct,100)}%"></div></div>
        </div>
      </div>

      <div class="dash-card">
        <div class="dash-card-body">
          <div class="dash-card-top">
            <div>
              <div class="dash-card-label">Memory</div>
              <div class="dash-card-value">${memPct}<span class="dash-unit">%</span></div>
              <div class="dash-card-sub">${memUsed} / ${memTotal} MB</div>
            </div>
            <div class="dash-card-icon info"><i class="fas fa-memory"></i></div>
          </div>
          <div class="dash-bar"><div class="dash-bar-fill ${memPct > 80 ? 'danger' : memPct > 60 ? 'warning' : 'success'}" style="width:${Math.min(memPct,100)}%"></div></div>
        </div>
      </div>

      <div class="dash-card">
        <div class="dash-card-body">
          <div class="dash-card-top">
            <div>
              <div class="dash-card-label">Disk</div>
              <div class="dash-card-value">${diskPct}<span class="dash-unit">%</span></div>
            </div>
            <div class="dash-card-icon ${diskPct > 80 ? 'danger' : 'primary'}"><i class="fas fa-hdd"></i></div>
          </div>
          <div class="dash-bar"><div class="dash-bar-fill ${diskPct > 80 ? 'danger' : diskPct > 60 ? 'warning' : 'success'}" style="width:${Math.min(diskPct,100)}%"></div></div>
        </div>
      </div>
    </div>

    <div class="dash-grid dash-grid--two">
      <div class="dash-card">
        <div class="dash-card-head">
          <h3><i class="fas fa-users"></i> Recent Accounts</h3>
          <a href="#/accounts" class="dash-card-link">View all <i class="fas fa-arrow-right"></i></a>
        </div>
        <div class="dash-card-body dash-card-body--flush">
          ${a.recent && a.recent.length ? html`
            <div class="table-container">
              <table>
                <thead><tr><th>Email</th><th>Created</th><th>Status</th></tr></thead>
                <tbody>
                  ${a.recent.map(ac => html`
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
      </div>

      <div class="dash-card">
        <div class="dash-card-head">
          <h3><i class="fas fa-user"></i> Recent Characters</h3>
          <a href="#/characters" class="dash-card-link">View all <i class="fas fa-arrow-right"></i></a>
        </div>
        <div class="dash-card-body dash-card-body--flush">
          ${c.recent && c.recent.length ? html`
            <div class="table-container">
              <table>
                <thead><tr><th>Name</th><th>Level</th><th>Account</th></tr></thead>
                <tbody>
                  ${c.recent.map(ch => html`
                    <tr>
                      <td>${escape(ch.name)}</td>
                      <td><span class="badge badge-info">Lv ${ch.level || 1}</span></td>
                      <td>${escape(ch.accountEmail || '-')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<div class="empty-state"><p>No characters yet</p></div>'}
        </div>
      </div>
    </div>
  `;
}

function serverPage(status, logs) {
  const s = status || {};
  const servers = [
    {
      id: 'auth', name: 'AuthServer', icon: 'fa-shield-alt', port: 14000,
      description: 'Handles authentication, account login, and character select.',
      running: s.authServer, pid: s.authPid,
    },
    {
      id: 'world', name: 'WorldServer', icon: 'fa-globe', port: 24000,
      description: 'Main game world — entities, maps, combat, and chat.',
      running: s.worldServer, pid: s.worldPid,
    },
    {
      id: 'sts', name: 'StsServer', icon: 'fa-key', port: 14001,
      description: 'Secure token service — issues session tokens to the client.',
      running: s.stsServer, pid: s.stsPid,
    },
  ];
  const runningCount = servers.filter(x => x.running).length;
  const serviceActive = s.service === 'active';
  const allRunning = runningCount === servers.length;
  const anyRunning = runningCount > 0;

  return html`
    <div class="page-header">
      <div>
        <h2>Server Status</h2>
        <p>Real-time view of all NexusForever services</p>
      </div>
      <div class="health-pill ${runningCount === 0 ? 'offline' : allRunning ? 'online' : 'degraded'}">
        <span class="status-dot ${allRunning ? 'online' : runningCount === 0 ? 'offline' : 'starting'}"></span>
        <span class="health-count">${runningCount}</span>
        <span class="health-sep">/</span>
        <span class="health-total">${servers.length}</span>
        <span class="health-label">Online</span>
      </div>
    </div>
    <div class="server-grid">
      ${servers.map(srv => html`
        <div class="server-card ${srv.running ? 'is-running' : 'is-stopped'}" data-server="${srv.id}">
          <div class="server-card-banner"></div>
          <div class="server-card-body">
            <div class="server-card-head">
              <div class="server-icon ${srv.running ? 'success' : 'muted'}">
                <i class="fas ${srv.icon}"></i>
              </div>
              <div class="server-card-title">
                <h3>${srv.name}</h3>
                <p>${srv.description}</p>
              </div>
              <div class="server-card-status">
                <span class="status-dot ${srv.running ? 'online' : 'offline'}"></span>
                <span class="server-card-status-text">${srv.running ? 'Online' : 'Offline'}</span>
              </div>
            </div>

            <div class="server-card-meta">
              <div class="meta-item">
                <span class="meta-label">PID</span>
                <span class="meta-value">${srv.running && srv.pid ? srv.pid : '—'}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Port</span>
                <span class="meta-value">${srv.port}</span>
              </div>
              <div class="meta-item meta-item-wide">
                <span class="meta-label">Service</span>
                <span class="meta-value mono">emulator-${srv.id}.service</span>
              </div>
            </div>

            <div class="server-card-actions">
              <button class="btn btn-success" onclick="handleServerAction('start','${srv.id}')"
                      ${srv.running ? 'disabled' : ''} title="Start ${srv.name}">
                <i class="fas fa-play"></i> Start
              </button>
              <button class="btn btn-warning" onclick="handleServerAction('restart','${srv.id}')"
                      ${!srv.running ? 'disabled' : ''} title="Restart ${srv.name}">
                <i class="fas fa-sync"></i> Restart
              </button>
              <button class="btn btn-danger" onclick="handleServerAction('stop','${srv.id}')"
                      ${!srv.running ? 'disabled' : ''} title="Stop ${srv.name}">
                <i class="fas fa-stop"></i> Stop
              </button>
              <button class="btn btn-ghost" onclick="toggleServerLogs('${srv.id}')" title="Toggle logs">
                <i class="fas fa-terminal"></i> Logs
              </button>
            </div>

            <div class="server-logs" id="server-logs-${srv.id}" hidden>
              <div class="server-logs-head">
                <span><i class="fas fa-stream"></i> Recent journalctl output</span>
                <div class="server-logs-actions">
                  <select onchange="refreshServerLogs('${srv.id}', this.value)" class="logs-lines-select">
                    <option value="50">50 lines</option>
                    <option value="100" selected>100 lines</option>
                    <option value="250">250 lines</option>
                    <option value="500">500 lines</option>
                  </select>
                  <button class="btn btn-sm btn-ghost" onclick="refreshServerLogs('${srv.id}', 100)" title="Refresh">
                    <i class="fas fa-sync"></i>
                  </button>
                </div>
              </div>
              <pre class="server-logs-body">Loading…</pre>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="bulk-actions-bar">
      <div class="bulk-actions-info">
        <i class="fas fa-layer-group"></i>
        <span>emulator-server.target · <strong>${serviceActive ? 'active' : 'inactive'}</strong></span>
      </div>
      <div class="bulk-actions-buttons">
        <button class="btn btn-success" onclick="handleServerAction('start')" ${allRunning ? 'disabled' : ''}>
          <i class="fas fa-play"></i> Start All
        </button>
        <button class="btn btn-warning" onclick="handleServerAction('restart')" ${!anyRunning ? 'disabled' : ''}>
          <i class="fas fa-sync"></i> Restart All
        </button>
        <button class="btn btn-danger" onclick="handleServerAction('stop')" ${!anyRunning ? 'disabled' : ''}>
          <i class="fas fa-stop"></i> Stop All
        </button>
      </div>
    </div>
  `;
}

async function toggleServerLogs(serverId) {
  const el = document.getElementById(`server-logs-${serverId}`);
  if (!el) return;
  if (el.hidden) {
    el.hidden = false;
    el.querySelector('.server-logs-body').textContent = 'Loading…';
    try {
      const res = await API.getServerLogs(serverId, 100);
      const text = typeof res === 'string' ? res : (res.logs || JSON.stringify(res, null, 2));
      el.querySelector('.server-logs-body').textContent = text || 'No log output.';
    } catch (err) {
      el.querySelector('.server-logs-body').textContent = `Error loading logs: ${err.message}`;
    }
  } else {
    el.hidden = true;
  }
}

async function refreshServerLogs(serverId, lines) {
  const el = document.getElementById(`server-logs-${serverId}`);
  if (!el) return;
  el.querySelector('.server-logs-body').textContent = 'Loading…';
  try {
    const res = await API.getServerLogs(serverId, lines);
    const text = typeof res === 'string' ? res : (res.logs || JSON.stringify(res, null, 2));
    el.querySelector('.server-logs-body').textContent = text || 'No log output.';
  } catch (err) {
    el.querySelector('.server-logs-body').textContent = `Error loading logs: ${err.message}`;
  }
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
                      <button class="btn btn-sm btn-ghost" onclick="showCharacterDetails(${c.id})" title="Details &amp; Actions"><i class="fas fa-eye"></i></button>
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

function logsPage(payload) {
  const rows = (payload && payload.rows) || [];
  const total = (payload && payload.total) || rows.length;
  return html`
    <div class="page-header">
      <div>
        <h2>Command Logs</h2>
        <p>History of every command executed from the admin panel</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" id="logs-refresh"><i class="fas fa-sync"></i> Refresh</button>
      </div>
    </div>
    <div class="card logs-filters">
      <div class="logs-filter-row">
        <input type="text" class="input" id="logs-q" placeholder="Search command (e.g. account, level, broadcast)..." value="${escape(_logsState.q)}" />
        <input type="text" class="input" id="logs-user" placeholder="Username / email..." value="${escape(_logsState.account)}" />
        <select class="input" id="logs-status">
          <option value="">All status</option>
          <option value="ok"   ${_logsState.status==='ok'?'selected':''}>ok</option>
          <option value="fail" ${_logsState.status==='fail'?'selected':''}>fail</option>
          <option value="info" ${_logsState.status==='info'?'selected':''}>info</option>
        </select>
        <select class="input" id="logs-category">
          <option value="">All categories</option>
          ${['account','character','item','currency','quest','xp','level','announce','broadcast','ban','unban','help','other'].map(c =>
            `<option value="${c}" ${_logsState.category===c?'selected':''}>${c}</option>`).join('')}
        </select>
        <button class="btn btn-primary" id="logs-apply"><i class="fas fa-filter"></i> Apply</button>
        <button class="btn btn-ghost" id="logs-clear"><i class="fas fa-eraser"></i> Clear</button>
      </div>
      <div class="logs-filter-row" style="margin-top:.5rem">
        <span class="muted">Showing <strong>${rows.length}</strong> of <strong>${total}</strong> entries</span>
      </div>
    </div>
    <div class="card logs-table-card">
      ${rows.length === 0 ? html`
        <div class="empty-state"><p>No command log entries found.</p></div>
      ` : html`
        <div class="logs-table-wrap">
          <table class="logs-table">
            <thead>
              <tr>
                <th style="width:160px">When</th>
                <th style="width:160px">User</th>
                <th>Command</th>
                <th style="width:110px">Status</th>
                <th style="width:90px">Duration</th>
                <th style="width:110px">Category</th>
                <th style="width:60px"></th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => html`
                <tr class="log-row" data-id="${r.id}">
                  <td class="mono">${escape(_fmtTs(r.ts))}</td>
                  <td>${escape(r.username || '—')}</td>
                  <td class="mono log-cmd" title="${escape(r.command)}">${escape(r.command)}</td>
                  <td><span class="status-pill status-${escape(r.status)}">${escape(r.status)}</span></td>
                  <td class="mono">${r.duration_ms != null ? r.duration_ms + 'ms' : '—'}</td>
                  <td><span class="category-pill">${escape(r.category || '—')}</span></td>
                  <td><button class="btn btn-ghost btn-sm log-detail" data-id="${r.id}"><i class="fas fa-eye"></i></button></td>
                </tr>
                ${r.reply_text ? html`
                  <tr class="log-reply-row" data-id="${r.id}" style="display:none">
                    <td colspan="7"><pre class="log-reply">${escape(r.reply_text)}</pre></td>
                  </tr>` : ''}
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="logs-pagination">
          <button class="btn btn-ghost btn-sm" id="logs-prev" ${_logsState.offset===0?'disabled':''}><i class="fas fa-chevron-left"></i> Prev</button>
          <span class="muted">Page ${Math.floor(_logsState.offset/_logsState.limit)+1} · rows ${_logsState.offset+1}–${Math.min(_logsState.offset+rows.length,total)}</span>
          <button class="btn btn-ghost btn-sm" id="logs-next" ${_logsState.offset+rows.length>=total?'disabled':''}>Next <i class="fas fa-chevron-right"></i></button>
        </div>
      `}
    </div>
  `;
}

const _logsState = { q:'', account:'', status:'', category:'', limit: 50, offset: 0 };

function _fmtTs(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toISOString().replace('T',' ').replace('Z','').slice(0,19);
}

function bindLogsEvents() {
  const $ = (s) => document.querySelector(s);
  const refresh = async () => {
    const page = document.getElementById('page-content');
    if (page) page.innerHTML = loadingSpinner();
    try {
      const params = new URLSearchParams({
        limit: _logsState.limit,
        offset: _logsState.offset,
      });
      if (_logsState.q) params.set('q', _logsState.q);
      if (_logsState.account) params.set('account', _logsState.account);
      if (_logsState.status) params.set('status', _logsState.status);
      if (_logsState.category) params.set('category', _logsState.category);
      const data = await API.getCommandLog({ params: params.toString() });
      const page2 = document.getElementById('page-content');
      if (page2) page2.innerHTML = logsPage(data);
      bindLogsEvents();
    } catch (e) {
      const page2 = document.getElementById('page-content');
      if (page2) page2.innerHTML = `<div class="empty-state"><p>Error: ${escape(e.message)}</p></div>`;
    }
  };
  $('logs-refresh')?.addEventListener('click', refresh);
  $('logs-apply')?.addEventListener('click', () => {
    _logsState.q = $('logs-q').value.trim();
    _logsState.account = $('logs-user').value.trim();
    _logsState.status = $('logs-status').value;
    _logsState.category = $('logs-category').value;
    _logsState.offset = 0;
    refresh();
  });
  $('logs-clear')?.addEventListener('click', () => {
    _logsState.q = ''; _logsState.account = ''; _logsState.status = ''; _logsState.category = ''; _logsState.offset = 0;
    refresh();
  });
  $('logs-prev')?.addEventListener('click', () => {
    if (_logsState.offset === 0) return;
    _logsState.offset = Math.max(0, _logsState.offset - _logsState.limit);
    refresh();
  });
  $('logs-next')?.addEventListener('click', () => {
    _logsState.offset += _logsState.limit;
    refresh();
  });
  document.querySelectorAll('.log-detail').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const row = document.querySelector(`.log-reply-row[data-id="${id}"]`);
      if (row) row.style.display = (row.style.display === 'none' || !row.style.display) ? 'table-row' : 'none';
    });
  });
}

function worldDbPage(data) {
  if (!data) return '<div class="empty-state"><p>No data</p></div>';
  const continents = data.continents || [];
  const tables = Array.isArray(data.tables) ? data.tables : [];
  const cloned = data.cloned;
  const actions = cloned
    ? `<button class="btn btn-ghost" onclick="worldDbPull()"><i class="fas fa-download"></i> Pull</button>
       <button class="btn btn-primary" onclick="worldDbApplyAll()"><i class="fas fa-database"></i> Apply All</button>`
    : `<button class="btn btn-primary" onclick="worldDbClone()"><i class="fab fa-git-alt"></i> Clone Repo</button>`;
  const continentCards = continents.map(c => {
    const fileList = c.files.length
      ? `<ul class="file-list">${c.files.map(f =>
          `<li class="file-item">
             <span class="file-name" title="${escape(f.path)}"><i class="fas fa-file-code"></i> ${escape(f.name)}</span>
             <span class="file-size">${(f.size / 1024).toFixed(1)} KB</span>
             <button class="btn btn-ghost btn-sm" onclick="worldDbApplyFile('${escape(f.path).replace(/'/g, "\\'")}')" title="Apply this file">
               <i class="fas fa-play"></i>
             </button>
           </li>`).join('')}</ul>`
      : `<div class="file-empty">No files in this continent</div>`;
    return `
      <div class="continent-card">
        <div class="continent-header">
          <div>
            <div class="continent-name">${escape(c.name)}</div>
            <div class="continent-count">${c.files.length} file${c.files.length === 1 ? '' : 's'}</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="worldDbApplyContinent('${escape(c.name)}')">
            <i class="fas fa-play"></i> Apply
          </button>
        </div>
        ${fileList}
      </div>`;
  }).join('');

  const tablesBlock = tables.length
    ? `<div class="table-container">
         <table>
           <thead><tr><th>Table</th><th>Rows</th></tr></thead>
           <tbody>${tables.map(t => `<tr><td><code>${escape(t.name)}</code></td><td>${(t.rows || 0).toLocaleString()}</td></tr>`).join('')}</tbody>
         </table>
       </div>`
    : `<div class="empty-state">No tables found</div>`;

  const body = !cloned
    ? `<div class="card">
         <div class="empty-state">
           <i class="fab fa-git-alt" style="font-size:3rem;color:var(--text2);margin-bottom:12px"></i>
           <h3>Repository not cloned</h3>
           <p>Clone the NexusForever.WorldDatabase repository to begin applying SQL data.</p>
           <button class="btn btn-primary" onclick="worldDbClone()"><i class="fab fa-git-alt"></i> Clone Repo</button>
         </div>
       </div>`
    : `<div class="card">
         <h3><i class="fas fa-map"></i> Continents</h3>
         <p class="card-sub">Apply a single continent or an individual file. Continents group related zone/content data.</p>
         <div class="continent-grid">${continentCards}</div>
       </div>
       <div class="card">
         <h3><i class="fas fa-table"></i> Database Tables</h3>
         <p class="card-sub">Live table row counts in <code>${escape(data.database || '')}</code></p>
         ${tablesBlock}
       </div>`;

  return `
    <div class="page-header">
      <div>
        <h2>World Database</h2>
        <p>NexusForever.WorldDatabase content and live database</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${actions}
        <button class="btn btn-ghost" onclick="loadWorldDb()"><i class="fas fa-sync"></i> Refresh</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon" style="background:linear-gradient(135deg,#0ea5e9,#0284c7)"><i class="fas fa-code-branch"></i></div>
        <div class="stat-info">
          <div class="stat-label">Repository</div>
          <div class="stat-value">${cloned ? escape(data.branch || '') : 'Not cloned'}</div>
          <div class="stat-sub">${cloned ? escape(data.commit || '') : '—'}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:linear-gradient(135deg,#10b981,#059669)"><i class="fas fa-file-code"></i></div>
        <div class="stat-info">
          <div class="stat-label">SQL Files</div>
          <div class="stat-value">${data.totalFiles || 0}</div>
          <div class="stat-sub">${escape(data.path || '')}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:linear-gradient(135deg,#f59e0b,#d97706)"><i class="fas fa-table"></i></div>
        <div class="stat-info">
          <div class="stat-label">Database</div>
          <div class="stat-value" style="font-size:1.1rem">${escape(data.database || '')}</div>
          <div class="stat-sub">${tables.length} table${tables.length === 1 ? '' : 's'}</div>
        </div>
      </div>
    </div>

    <div id="worlddb-output" class="card" style="display:none">
      <h3><i class="fas fa-terminal"></i> Last Action Output</h3>
      <pre class="command-output" id="worlddb-output-body"></pre>
    </div>

    ${body}
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

function commandsPage() {
  return html`
    <div class="page-header">
      <h2><i class="fas fa-terminal"></i> Command Console</h2>
      <p>Execute in-game commands against the world server via /ws/commands.</p>
    </div>
    <div class="commands-toolbar">
      <span class="conn-pill" id="cmd-conn-pill"><i class="fas fa-circle"></i> <span id="cmd-conn-text">Disconnected</span></span>
      <input type="text" id="cmd-ws-url" class="cmd-input cmd-url" value="ws://localhost:5000/ws/commands" />
      <button class="btn btn-secondary btn-sm" id="cmd-reconnect"><i class="fas fa-sync"></i> Reconnect</button>
      <span style="flex:1"></span>
      <input type="text" id="cmd-filter" class="cmd-input" placeholder="Filter commands…" />
    </div>
    <div class="commands-grid">
      <aside class="commands-catalog">
        <ul id="cmd-cat-list" class="cmd-cat-list"></ul>
      </aside>
      <section class="commands-form">
        <div id="cmd-form-empty" class="empty-state">
          <i class="fas fa-hand-pointer"></i>
          <p>Select a command from the catalog to begin.</p>
        </div>
        <div id="cmd-form" style="display:none">
          <div class="cmd-form-head">
            <h3 id="cmd-form-title"></h3>
            <code id="cmd-form-syntax" class="cmd-syntax"></code>
          </div>
          <p id="cmd-form-desc" class="cmd-form-desc"></p>
          <div id="cmd-form-target" class="cmd-form-target"></div>
          <form id="cmd-form-fields"></form>
          <div class="cmd-form-actions">
            <button class="btn btn-primary" type="button" id="cmd-execute"><i class="fas fa-paper-plane"></i> Execute</button>
            <button class="btn btn-secondary" type="button" id="cmd-cancel">Clear</button>
            <span class="cmd-hint">Permission ID: <code id="cmd-perm-id"></code></span>
          </div>
        </div>
      </section>
      <section class="commands-output">
        <div class="cmd-out-head">
          <h4>Output</h4>
          <button class="btn btn-sm btn-secondary" id="cmd-clear-out"><i class="fas fa-eraser"></i> Clear</button>
        </div>
        <div id="cmd-output" class="cmd-output"></div>
      </section>
    </div>
  `;
}

function announcementsPage(data) {
  const rows = (data && data.rows) || [];
  const total = (data && data.total) || 0;
  return html`
    <section class="ann-page">
      <header class="ann-head">
        <div>
          <h2><i class="fas fa-bullhorn"></i> Announcements</h2>
          <p class="subtle">Broadcast messages to all online players. Tier controls the system notification color (High/Medium/Low).</p>
        </div>
        <span class="muted">${total} total</span>
      </header>

      <div class="ann-composer card">
        <div class="ann-composer-row">
          <label class="ann-tier">
            <span>Tier</span>
            <select id="ann-tier">
              <option value="2">Low</option>
              <option value="1" selected>Medium</option>
              <option value="0">High</option>
            </select>
          </label>
          <input type="text" id="ann-message" class="ann-input" maxlength="500"
                 placeholder="Type a broadcast message…" />
          <button class="btn btn-primary" id="ann-send"><i class="fas fa-paper-plane"></i> Broadcast</button>
        </div>
        <p class="ann-hint subtle">Command sent: <code id="ann-preview">!broadcast message 1 …</code></p>
      </div>

      <div class="ann-filters card">
        <input type="text" id="ann-q" placeholder="Search message…" />
        <select id="ann-tier-filter">
          <option value="">All tiers</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select id="ann-status-filter">
          <option value="">All status</option>
          <option value="ok">Sent</option>
          <option value="fail">Failed</option>
        </select>
        <button class="btn btn-sm" id="ann-reload"><i class="fas fa-sync"></i> Refresh</button>
      </div>

      <div class="ann-list card" id="ann-list">
        ${rows.length === 0 ? html`
          <div class="empty-state">
            <i class="fas fa-bullhorn"></i>
            <p>No announcements yet. Send the first one above.</p>
          </div>
        ` : rows.map(r => html`
          <div class="ann-row ann-tier-${r.tier_name.toLowerCase()} ann-status-${r.status}">
            <div class="ann-row-head">
              <span class="ann-tier-pill ann-pill-${r.tier_name.toLowerCase()}">${r.tier_name}</span>
              <span class="ann-status-pill ann-pill-status-${r.status}">${r.status === 'ok' ? 'Sent' : r.status === 'fail' ? 'Failed' : 'Info'}</span>
              <span class="ann-meta">
                <i class="fas fa-user"></i> ${escape(r.username || 'system')}
                <span class="dot">·</span>
                <i class="fas fa-clock"></i> ${_fmtTs(r.created_at)}
                <span class="dot">·</span>
                <i class="fas fa-tag"></i> #${r.id}
              </span>
            </div>
            <div class="ann-message">${escape(r.message)}</div>
            ${r.reply_text ? html`<div class="ann-reply"><strong>Reply:</strong> ${escape(r.reply_text)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

