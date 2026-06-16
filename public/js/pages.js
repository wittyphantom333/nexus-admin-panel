function _roleLabel(user) {
  if (!user) return 'User';
  if (user.roleId === 1) return 'Admin';
  const r = (user.role || user.panelRole || '').toString().toLowerCase();
  if (!r) return 'User';
  if (r === 'admin' || r === 'administrator' || r === 'manager') return 'Admin';
  if (r === 'mod' || r === 'moderator') return 'Moderator';
  if (r === 'player') return 'Player';
  return r.charAt(0).toUpperCase() + r.slice(1);
}

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
    { icon: 'fa-users', label: 'Accounts', path: '/accounts', admin: true },
    { icon: 'fa-user', label: 'Characters', path: '/characters' },
    { icon: 'fa-network-wired', label: 'Sessions', path: '/sessions', admin: true },
    { icon: 'fa-globe-americas', label: 'World DB', path: '/worlddb', admin: true },
    { icon: 'fa-database', label: 'Live Data', path: '/gamedata', admin: true },
    { icon: 'fa-scroll', label: 'Quests', path: '/quests-manager', admin: true },
    { icon: 'fa-cog', label: 'Settings', path: '/settings', admin: true },
    { icon: 'fa-file-alt', label: 'Logs', path: '/logs' },
    { icon: 'fa-id-card', label: 'My Profile', path: '/profile' },
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
        <div class="sidebar-user" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;background:var(--bg-secondary,#1e1e2e);margin-bottom:8px">
          <div class="user-avatar" style="width:36px;height:36px;border-radius:50%;background:var(--accent,#7c3aed);display:flex;align-items:center;justify-content:center;font-weight:600;color:#fff">${(user.email || user.username || 'U')[0].toUpperCase()}</div>
          <div style="min-width:0;flex:1">
            <div class="user-name" style="font-weight:600;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escape(user.email || user.username || 'User')}</div>
            <div class="user-role" style="font-size:0.75rem;opacity:0.7">${escape(_roleLabel(user))}</div>
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
      </div>

    <div class="dash-grid">
      ${servers.map(srv => html`
        <div class="dash-card server-card ${srv.running ? 'is-running' : 'is-stopped'}" data-server="${srv.id}">
          <div class="server-card-banner"></div>
          <div class="dash-card-body">
            <div class="dash-card-top">
              <div>
                <div class="dash-card-label">${srv.name}</div>
                <div class="dash-card-value" style="font-size:1rem">${srv.running ? 'Online' : 'Offline'}</div>
                <div class="dash-card-sub">Port ${srv.port} · ${srv.running && srv.pid ? 'PID '+srv.pid : '—'}</div>
              </div>
              <div class="dash-card-icon ${srv.running ? 'success' : 'muted'}">
                <i class="fas ${srv.icon}"></i>
              </div>
            </div>
            <div class="server-card-actions" style="margin-top:12px">
              <button class="btn btn-success btn-sm" onclick="handleServerAction('start','${srv.id}')" ${srv.running?'disabled':''}>
                <i class="fas fa-play"></i> Start
              </button>
              <button class="btn btn-warning btn-sm" onclick="handleServerAction('restart','${srv.id}')" ${!srv.running?'disabled':''}>
                <i class="fas fa-sync"></i> Restart
              </button>
              <button class="btn btn-danger btn-sm" onclick="handleServerAction('stop','${srv.id}')" ${!srv.running?'disabled':''}>
                <i class="fas fa-stop"></i> Stop
              </button>
            </div>
          </div>
        </div>
      `).join('')}

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

      <div class="dash-card">
        <div class="dash-card-head">
          <h3><i class="fas fa-bullhorn"></i> Broadcast</h3>
        </div>
        <div class="dash-card-body">
          <form class="broadcast-form" onsubmit="return handleBroadcast(event)">
            <select id="broadcast-tier" class="broadcast-tier" style="width:100%;margin-bottom:8px">
              <option value="0">Popup Alert</option>
              <option value="1" selected>Chat Message</option>
            </select>
            <input id="broadcast-message" class="broadcast-input" type="text" maxlength="200"
                   placeholder="Announcement message…" required style="width:100%;box-sizing:border-box">
            <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px">
              <i class="fas fa-paper-plane"></i> Send
            </button>
          </form>
        </div>
      </div>

      <div class="dash-card">
        <div class="dash-card-head">
          <h3><i class="fas fa-scroll"></i> Message of the Day</h3>
        </div>
        <div class="dash-card-body">
          <form class="broadcast-form" onsubmit="return handleRealmMotd(event)">
            <input id="motd-message" class="broadcast-input" type="text" maxlength="200"
                   placeholder="MOTD text…" required style="width:100%;box-sizing:border-box">
            <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px">
              <i class="fas fa-paper-plane"></i> Set MOTD
            </button>
          </form>
        </div>
      </div>
    </div>
    </div>
  `;
}

async function handleRealmMotd(ev) {
  ev.preventDefault();
  const input = document.getElementById('motd-message');
  const message = (input.value || '').trim();
  if (!message) return false;
  const cmd = `realm motd ${message}`;
  const submitBtn = ev.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const r = await window.CX.execCommand(cmd, { notify: true });
  submitBtn.disabled = false;
  if (r.ok) input.value = '';
  return false;
}

async function handleBroadcast(ev) {
  ev.preventDefault();
  const tier = document.getElementById('broadcast-tier').value;
  const input = document.getElementById('broadcast-message');
  const message = (input.value || '').trim();
  if (!message) return false;
  const cmd = `broadcast message ${tier} ${message}`;
  const submitBtn = ev.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const r = await window.CX.execCommand(cmd, { notify: true });
  submitBtn.disabled = false;
  if (r.ok) input.value = '';
  return false;
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
          <table class="clickable-rows">
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${accounts.map(a => html`
                <tr onclick="showAccountDetails(${a.id})">
                  <td>${a.id}</td>
                  <td>${escape(a.email)}</td>
                  <td><span class="badge ${/admin/i.test(a.roles || '') ? 'badge-primary' : 'badge-info'}">${/admin/i.test(a.roles || '') ? 'Admin' : a.roles || 'User'}</span></td>
                  <td>${a.createTime ? new Date(a.createTime).toLocaleDateString() : '-'}</td>
                  <td>${(a.isBanned === 1 || a.isBanned === true) ? '<span class="badge badge-danger">Banned</span>' : '<span class="badge badge-success">Active</span>'}</td>
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
          <table class="clickable-rows">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Level</th>
                <th>Race</th>
                <th>Class</th>
                <th>Account</th>
              </tr>
            </thead>
            <tbody>
              ${chars.map(c => html`
                <tr onclick="showCharacterDetails(${c.id})" title="Click to view / edit / delete">
                  <td>${c.id}</td>
                  <td>${escape(c.name)}</td>
                  <td>${c.level || 1}</td>
                  <td>${escape(c.race || '-')}</td>
                  <td>${escape(c.class || '-')}</td>
                  <td>${escape(c.accountEmail || c.accountId || '-')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty-state"><i class="fas fa-user"></i><p>No characters found</p></div>'}
    </div>
  `;
}

function sessionsPage(data) {
  const list = (data && (data.data || data.sessions || data)) || [];
  const count = (data && data.count) != null ? data.count : (Array.isArray(list) ? list.length : 0);
  return html`
    <div class="page-header">
      <div>
        <h2>Live Sessions</h2>
        <p>Online characters joined with live session metadata from the world server (${count} online)</p>
      </div>
      <div>
        <button class="btn" onclick="loadSessions()"><i class="fas fa-sync"></i> Refresh</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:1rem">
      <h3 style="margin-top:0"><i class="fas fa-search"></i> Lookup</h3>
      <p style="color:#aaa;font-size:.9rem;margin:.25rem 0 .75rem">
        Paste a <code>clientId</code> (the GUID from <code>[NetworkSession] New client ...</code>), an IP, or a character name to find the account/character.
      </p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr) auto;gap:.5rem;align-items:end">
        <label>clientId<input id="lk-clientId" class="input" placeholder="59afdc96-7e07-43b6-..." /></label>
        <label>IP<input id="lk-ip" class="input" placeholder="45.59.162.178" /></label>
        <label>Name<input id="lk-name" class="input" placeholder="Charactername" /></label>
        <button class="btn btn-primary" onclick="doSessionLookup()"><i class="fas fa-search"></i> Lookup</button>
      </div>
      <div id="session-lookup-out" style="margin-top:1rem"></div>
    </div>

    <div class="card">
      <h3 style="margin-top:0"><i class="fas fa-plug"></i> Online now</h3>
      ${list.length ? html`
        <div class="table-container">
          <table class="clickable-rows">
            <thead><tr>
              <th>Name</th><th>Lvl</th><th>Race</th><th>Class</th>
              <th>Account</th><th>Last Online</th>
              <th>Session clientId</th><th>Session IP</th><th>Since</th>
            </tr></thead>
            <tbody>
              ${list.map(s => html`<tr>
                <td>${escape(s.name || '-')}</td>
                <td>${s.level || 1}</td>
                <td>${escape(s.race || '-')}</td>
                <td>${escape(s.class || '-')}</td>
                <td>${escape(s.accountEmail || s.accountId || '-')}</td>
                <td>${s.lastOnline ? new Date(s.lastOnline).toLocaleString() : '-'}</td>
                <td>${s.session ? html`<code>${escape(s.session.clientId.slice(0,8))}…</code>` : '<span style="color:#888">-</span>'}</td>
                <td>${s.session ? escape(s.session.ip || '-') : '<span style="color:#888">-</span>'}</td>
                <td>${s.session && s.session.since ? escape(s.session.since) : '<span style="color:#888">-</span>'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty-state"><i class="fas fa-plug"></i><p>No one online (or the world server has not pushed a session frame yet).</p></div>'}
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
          <h3><i class="fas fa-code"></i> Server Configuration</h3>
          <button class="btn btn-sm btn-primary" onclick="saveServerConfig()"><i class="fas fa-save"></i> Save</button>
        </div>
        <textarea id="config-editor" spellcheck="false"></textarea>
      </div>
    </div>
  `;
}

function logsPage(logs) {
  const servers = [
    { id: 'auth', name: 'AuthServer', icon: 'fa-shield-alt', color: '#4fc3f7', bg: 'rgba(79,195,247,0.08)' },
    { id: 'world', name: 'WorldServer', icon: 'fa-globe', color: '#81c784', bg: 'rgba(129,199,132,0.08)' },
    { id: 'sts', name: 'StsServer', icon: 'fa-key', color: '#ffb74d', bg: 'rgba(255,183,77,0.08)' },
  ];

  // Parse each server's log text into timestamped lines, tag them, combine, sort
  const allLines = [];
  for (const srv of servers) {
    const text = logs && logs[srv.id] ? logs[srv.id] : '';
    if (!text) continue;
    const lines = text.split('\n').filter(Boolean);
    for (const line of lines) {
      const tsMatch = line.match(/^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/);
      const ts = tsMatch ? tsMatch[1] : null;
      allLines.push({ srv: srv.id, name: srv.name, color: srv.color, bg: srv.bg, icon: srv.icon, ts, line });
    }
  }

  // Sort by timestamp (chronological), lines without timestamps go last
  allLines.sort((a, b) => {
    if (!a.ts && !b.ts) return 0;
    if (!a.ts) return 1;
    if (!b.ts) return -1;
    const dateA = new Date(Date.parse(a.ts));
    const dateB = new Date(Date.parse(b.ts));
    return dateA - dateB;
  });

  const legend = servers.map(srv => html`
    <span class="log-legend-item" style="color:${srv.color}">
      <i class="fas ${srv.icon}"></i> ${srv.name}
    </span>
  `).join('');

  // Store data globally for live filtering
  window.__logLines = allLines;

  return html`
    <div class="page-header">
      <div>
        <h2><i class="fas fa-terminal"></i> Server Logs</h2>
        <p>Combined journalctl output from all NexusForever services, sorted by timestamp</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" id="logs-refresh-all"><i class="fas fa-sync"></i> Refresh All</button>
      </div>
    </div>
    <div class="log-legend">${legend}</div>
    <div class="log-search">
      <i class="fas fa-search log-search-icon"></i>
      <input type="text" id="log-filter" class="log-search-input" placeholder="Filter logs..." oninput="filterLogs()">
    </div>
    <div class="combined-log" id="combined-log">${renderLogLines(allLines)}</div>
  `;
}

function renderLogLines(lines) {
  if (!lines || lines.length === 0) return '<div class="empty-state"><p>No log output.</p></div>';
  return lines.map(item => {
    const ts = item.ts ? `<span class="log-ts">${escape(item.ts)}</span>` : '';
    const tag = `<span class="log-tag" style="color:${item.color};background:${item.bg}">${escape(item.name)}</span>`;
    const raw = item.line.replace(/^[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\S+\s+\S+\s+/, '');
    let levelClass = '';
    if (/\bERROR\b/i.test(raw)) levelClass = ' log-level-error';
    else if (/\bWARN\b/i.test(raw)) levelClass = ' log-level-warn';
    const msg = escape(raw);
    return `<div class="log-line${levelClass}" style="border-left:3px solid ${item.color}">${ts} ${tag} ${msg}</div>`;
  }).join('');
}

function filterLogs() {
  const q = (document.getElementById('log-filter')?.value || '').toLowerCase();
  const all = window.__logLines || [];
  const filtered = q ? all.filter(item => item.line.toLowerCase().includes(q)) : all;
  const container = document.getElementById('combined-log');
  if (container) container.innerHTML = renderLogLines(filtered);
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

// =============================================================
// Profile (self-service) — visible to all users
// =============================================================
function profilePage(me, characters) {
  const inGameRoles = (me && me.ingameRoles) ? me.ingameRoles : [];
  const isPlayer = (me && me.role === 'user') || inGameRoles.length === 0 ||
    inGameRoles.every(r => r.name === 'Player');
  return `
    <div class="page-header">
      <h2><i class="fa-solid fa-id-card"></i> My Profile</h2>
    </div>
    <div class="profile-grid">
      <section class="card">
        <h3><i class="fa-solid fa-user"></i> Account</h3>
        <div class="profile-field"><label>Email</label><div>${escape(me.email || '—')}</div></div>
        <div class="profile-field"><label>Role</label><div><span class="badge">${escape(_roleLabel(me))}</span></div></div>
        <div class="profile-field"><label>In-Game Roles</label><div>${inGameRoles.length ? inGameRoles.map(r => `<span class="badge badge-info">${escape(r.name)}</span>`).join(' ') : '<span class="text-muted">None</span>'}</div></div>
        <div class="profile-field"><label>Created</label><div>${escape(me.createdAt ? new Date(me.createdAt).toLocaleString() : '—')}</div></div>
      </section>

      <section class="card">
        <h3><i class="fa-solid fa-key"></i> Change Password</h3>
        ${me.isServiceAccount ? `
          <p class="text-muted"><i class="fa-solid fa-lock"></i> This is a service account. Password changes are disabled.</p>
        ` : `
        <form id="profile-pw-form">
          <label>Current password
            <input type="password" id="pw-old" required autocomplete="current-password">
          </label>
          <label>New password
            <input type="password" id="pw-new" required minlength="8" autocomplete="new-password">
          </label>
          <label>Confirm new password
            <input type="password" id="pw-new2" required minlength="8" autocomplete="new-password">
          </label>
          <button type="submit" class="btn btn-primary">Change password</button>
        </form>
        `}
      </section>

      <section class="card">
        <h3><i class="fa-solid fa-users"></i> My Characters</h3>
        ${characters.length === 0 ? `
          <p class="text-muted">No characters found on this account.</p>
        ` : `
          <table class="data-table">
            <thead><tr><th>Name</th><th>Race</th><th>Class</th><th>Level</th><th>Realm</th><th>Last Online</th></tr></thead>
            <tbody>
              ${characters.map(c => `
                <tr>
                  <td>${escape(c.name || c.Name || '—')}</td>
                  <td>${escape(c.race || c.Race || '—')}</td>
                  <td>${escape(c.class || c.Class || '—')}</td>
                  <td>${c.level ?? c.Level ?? '—'}</td>
                  <td>${escape(c.realm || c.Realm || '—')}</td>
                  <td>${c.lastOnline ? new Date(c.lastOnline).toLocaleDateString() : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </section>

      ${!isPlayer ? '' : `
        <section class="card">
          <h3><i class="fa-solid fa-circle-info"></i> Need help?</h3>
          <p>If you can't log in, change your password, or don't see your characters, open a ticket or contact a panel admin.</p>
        </section>
      `}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Live Data browser
//
//   Renders two views depending on the hash:
//     /gamedata              -> table list (cards for each resource)
//     /gamedata/<key>        -> table view: search/sort/paginate + edit modal
//
//   All SQL is server-side. The client only passes page/sort/search/filter
//   query params, and column names from the static registry on the server.
// ---------------------------------------------------------------------------

function gamedataPage({ tables, selectedKey, tableData, error }) {
  if (error) {
    return `<div class="empty-state"><p><i class="fa-solid fa-triangle-exclamation"></i> ${escape(error)}</p></div>`;
  }
  if (selectedKey) return gamedataTableView(tables, selectedKey, tableData);
  return gamedataTablesList(tables);
}

function gamedataTablesList(tables) {
  if (!tables || tables.length === 0) {
    return `<div class="empty-state"><p>No gamedata resources registered.</p></div>`;
  }
  // Group by db
  const groups = {};
  for (const t of tables) {
    (groups[t.db] = groups[t.db] || []).push(t);
  }
  const dbLabels = {
    auth: 'nexus_forever_auth',
    character: 'nexus_forever_character',
    world: 'nexus_forever_world',
  };
  const section = (dbKey, label, items) => `
    <section class="card" style="margin-bottom:1rem">
      <h3 style="margin-top:0"><i class="fa-solid fa-database"></i> ${escape(label)}</h3>
      <div class="gd-table-grid">
        ${items.map(t => `
          <a class="gd-table-card" href="#/gamedata/${encodeURIComponent(t.key)}">
            <div class="gd-table-card-icon"><i class="fa-solid ${escape(t.icon || 'fa-table')}"></i></div>
            <div class="gd-table-card-body">
              <div class="gd-table-card-title">${escape(t.label)}</div>
              <div class="gd-table-card-sub">
                <code>${escape(t.table)}</code>
                ${t.editable
                  ? '<span class="gd-badge gd-badge-edit">editable</span>'
                  : '<span class="gd-badge">read-only</span>'}
              </div>
            </div>
          </a>
        `).join('')}
      </div>
    </section>
  `;
  const order = ['auth', 'character', 'world'].filter(k => groups[k]);
  return `
    <h2 style="margin:0 0 0.5rem"><i class="fa-solid fa-database"></i> Live Data</h2>
    <p style="color:var(--text-muted, #888); margin:0 0 1rem">Browse and edit the three NexusForever databases. Edits are audited.</p>
    ${order.map(k => section(k, dbLabels[k] || k, groups[k])).join('')}
  `;
}

function gamedataTableView(tables, key, data) {
  const meta = (tables || []).find(t => t.key === key);
  if (!meta) {
    return `<div class="empty-state">
      <p>Unknown table key: <code>${escape(key)}</code></p>
      <a class="btn btn-ghost" href="#/gamedata"><i class="fa-solid fa-arrow-left"></i> Back to list</a>
    </div>`;
  }
  const d = data || { rows: [], total: 0, page: 1, pageSize: 25, sort: meta.listColumns[0], dir: 'asc', q: '' };
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const search = params.get('q') || '';
  const page = parseInt(params.get('page') || '1', 10);
  const pageSize = parseInt(params.get('pageSize') || '25', 10);
  const sort = params.get('sort') || meta.listColumns[0];
  const dir = params.get('dir') || 'asc';
  const totalPages = Math.max(1, Math.ceil((d.total || 0) / pageSize));

  // Sort link builder
  const sortLink = (col) => {
    const next = (col === sort && dir === 'asc') ? 'desc' : 'asc';
    const sp = new URLSearchParams(params);
    sp.set('sort', col); sp.set('dir', next); sp.set('page', '1');
    return `#/gamedata/${encodeURIComponent(key)}?${sp.toString()}`;
  };
  const pageLink = (p) => {
    const sp = new URLSearchParams(params); sp.set('page', String(p));
    return `#/gamedata/${encodeURIComponent(key)}?${sp.toString()}`;
  };

  const header = `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:1rem">
      <a class="btn btn-ghost btn-sm" href="#/gamedata"><i class="fa-solid fa-arrow-left"></i> All tables</a>
      <h2 style="margin:0"><i class="fa-solid ${escape(meta.icon || 'fa-table')}"></i> ${escape(meta.label)}</h2>
      <code style="background:var(--bg-secondary,#1e1e2e);padding:2px 8px;border-radius:4px">${escape(meta.db)}.${escape(meta.table)}</code>
      ${meta.editable
        ? '<span class="gd-badge gd-badge-edit">editable</span>'
        : '<span class="gd-badge">read-only</span>'}
      <span style="margin-left:auto;color:var(--text-muted,#888)">${d.total || 0} row${(d.total || 0) === 1 ? '' : 's'}</span>
    </div>
  `;

  // Search form
  const searchForm = `
    <form class="gd-search" onsubmit="event.preventDefault(); gdSearch('${key}', this.q.value)" style="display:flex;gap:8px;margin-bottom:0.75rem">
      <input class="gd-input" name="q" value="${escape(search)}" placeholder="Search ${escape(meta.searchable.join(', '))}…"
             style="flex:1;background:var(--bg-secondary,#1e1e2e);border:1px solid #333;color:inherit;padding:8px 12px;border-radius:6px">
      <button class="btn btn-primary" type="submit"><i class="fa-solid fa-magnifying-glass"></i> Search</button>
      ${search ? `<a class="btn btn-ghost" href="#/gamedata/${encodeURIComponent(key)}">Clear</a>` : ''}
      ${meta.editable ? `<button type="button" class="btn btn-success" onclick="gdAddRow('${key}')"><i class="fa-solid fa-plus"></i> Add row</button>` : ''}
    </form>
  `;

  // Column headers
  const cols = meta.listColumns;
  const thead = `<tr>
    <th style="width:40px"></th>
    ${cols.map(c => `
      <th>
        <a href="${sortLink(c)}" style="color:inherit;text-decoration:none">
          ${escape(c)}
          ${sort === c ? `<i class="fa-solid fa-sort-${dir === 'asc' ? 'up' : 'down'}" style="margin-left:4px"></i>` : '<i class="fa-solid fa-sort" style="margin-left:4px;opacity:0.3"></i>'}
        </a>
      </th>
    `).join('')}
  </tr>`;

  // Rows
  const rows = (d.rows || []).map(row => {
    const pk = String(row[meta.primaryKey] ?? '');
    const editBtn = meta.editable
      ? `<button class="btn btn-ghost btn-sm" onclick="gdEditRow('${escape(key)}', '${encodeURIComponent(pk)}')" title="Edit">
           <i class="fa-solid fa-pen"></i>
         </button>`
      : '';
    return `<tr>
      <td>${editBtn}</td>
      ${cols.map(c => `<td><code style="font-size:0.85em">${escape(formatCell(row[c]))}</code></td>`).join('')}
    </tr>`;
  }).join('');

  const empty = d.rows.length === 0
    ? `<tr><td colspan="${cols.length + 1}" style="text-align:center;padding:2rem;color:var(--text-muted,#888)">No rows match.</td></tr>`
    : '';

  // Pager
  const pager = `
    <div style="display:flex;align-items:center;gap:8px;margin-top:0.75rem;flex-wrap:wrap">
      <span style="color:var(--text-muted,#888)">Page ${page} of ${totalPages}</span>
      <div style="margin-left:auto;display:flex;gap:4px">
        ${page > 1 ? `<a class="btn btn-ghost btn-sm" href="${pageLink(1)}"><i class="fa-solid fa-angles-left"></i></a>
                     <a class="btn btn-ghost btn-sm" href="${pageLink(page - 1)}"><i class="fa-solid fa-angle-left"></i></a>` : ''}
        ${page < totalPages ? `<a class="btn btn-ghost btn-sm" href="${pageLink(page + 1)}"><i class="fa-solid fa-angle-right"></i></a>
                             <a class="btn btn-ghost btn-sm" href="${pageLink(totalPages)}"><i class="fa-solid fa-angles-right"></i></a>` : ''}
      </div>
    </div>
  `;

  return `
    ${header}
    ${searchForm}
    <div style="overflow-x:auto">
      <table class="gd-table" style="width:100%;border-collapse:collapse">
        <thead>${thead}</thead>
        <tbody>${rows}${empty}</tbody>
      </table>
    </div>
    ${pager}
  `;
}

function formatCell(v) {
  if (v == null) return '<span style="color:#666">NULL</span>';
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'string' && v.length > 80) return v.slice(0, 77) + '…';
  return String(v);
}

// Expose helpers used inline by the rendered HTML
window.gdSearch = (key, q) => {
  const sp = new URLSearchParams();
  if (q) sp.set('q', q);
  window.location.hash = `/gamedata/${encodeURIComponent(key)}${sp.toString() ? '?' + sp.toString() : ''}`;
};
window.gdEditRow = async (key, encId) => {
  const id = decodeURIComponent(encId);
  try {
    const tables = await API.getGameDataTables();
    const meta = (tables || []).find(t => t.key === key);
    if (!meta) return toast('Unknown table', 'error');
    const env = await API.getGameDataRow(key, id);
    const row = env && env.data;
    if (!row) return toast('Row not found', 'error');
    showModal(gdEditModal(key, meta, id, row));
  } catch (err) {
    toast(err.message || 'Failed to load row', 'error');
  }
};

function gdEditModal(key, meta, id, row) {
  const fields = meta.updatable.map(c => {
    const v = row[c];
    const tv = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : v);
    const isBool = typeof v === 'boolean' || v === 0 || v === 1;
    const isNum = typeof v === 'number' && !isBool;
    const input = isBool
      ? `<select id="gd-field-${c}">
           <option value="0" ${v == 0 || v === false ? 'selected' : ''}>0 / false</option>
           <option value="1" ${v == 1 || v === true  ? 'selected' : ''}>1 / true</option>
         </select>`
      : `<input id="gd-field-${c}" type="${isNum ? 'number' : 'text'}" value="${escape(String(tv))}" autocomplete="off">`;
    return `
      <div class="form-group">
        <label>${escape(c)}</label>
        ${input}
      </div>
    `;
  }).join('');
  return `
    <div class="modal-header">
      <h3 style="margin:0">
        <i class="fa-solid fa-pen"></i>
        Edit ${escape(meta.label)} &middot; <code>${escape(meta.primaryKey)} = ${escape(String(id))}</code>
      </h3>
    </div>
    <form id="gd-edit-form" onsubmit="return gdSubmitEdit(event, '${escape(key)}', '${encodeURIComponent(id)}')">
      <p class="text-muted" style="margin:0 0 0.75rem">
        Only the fields below are writable. Every change is recorded in the audit log with your user id.
      </p>
      ${fields || '<p class="text-muted">No writable columns for this table.</p>'}
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save</button>
      </div>
    </form>
  `;
}

window.gdSubmitEdit = async (e, key, encId) => {
  e.preventDefault();
  const id = decodeURIComponent(encId);
  const tables = await API.getGameDataTables();
  const meta = (tables || []).find(t => t.key === key);
  if (!meta) return toast('Unknown table', 'error');
  // We need to know the original type of each cell to coerce properly.
  // Fetch the row once to inspect.
  let original = {};
  try { const env = await API.getGameDataRow(key, id); original = (env && env.data) || {}; } catch {}
  const body = {};
  for (const c of meta.updatable) {
    const el = document.getElementById('gd-field-' + c);
    if (!el) continue;
    const raw = el.value;
    if (el.tagName === 'SELECT') {
      body[c] = Number(raw);
    } else if (typeof original[c] === 'number') {
      const n = Number(raw);
      body[c] = Number.isFinite(n) ? n : raw;
    } else {
      body[c] = raw;
    }
  }
  try {
    await API.updateGameDataRow(key, id, body);
    toast('Saved', 'success');
    closeModal();
    if (typeof loadGameData === 'function') loadGameData();
  } catch (err) {
    toast(err.message || 'Save failed', 'error');
  }
  return false;
};

// ---------------------------------------------------------------------------
// Add row modal
// ---------------------------------------------------------------------------
window.gdAddRow = async (key) => {
  try {
    const tables = await API.getGameDataTables();
    const meta = (tables || []).find(t => t.key === key);
    if (!meta) return toast('Unknown table', 'error');
    if (!meta.editable) return toast('This resource is read-only', 'error');
    // Use a sample row (the first one) to infer column types, falling back to text.
    let sample = {};
    try {
      const env = await fetch(
        `/api/gamedata/${encodeURIComponent(key)}?limit=1&sort=${encodeURIComponent(meta.primaryKey)}&dir=asc`,
        { headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('em_token') || '') } }
      ).then(r => r.json());
      if (env && env.data && env.data[0]) sample = env.data[0];
    } catch {}
    showModal(gdAddModal(key, meta, sample));
  } catch (err) {
    toast(err.message || 'Failed to open add form', 'error');
  }
};

function gdAddModal(key, meta, sample) {
  // Columns the user is allowed to supply. Backend will use entry.insertable
  // (or fall back to entry.updatable) as the allow-list.
  const candidate = meta.insertable || meta.updatable || [];
  const fields = candidate.map(c => {
    const sampleVal = sample ? sample[c] : undefined;
    const isBool = (typeof sampleVal === 'boolean') || sampleVal === 0 || sampleVal === 1;
    const isNum = typeof sampleVal === 'number' && !isBool;
    const defaultVal = sampleVal == null
      ? (isBool ? '0' : (isNum ? '0' : (c === meta.primaryKey ? '0' : '')))
      : String(sampleVal);
    const input = isBool
      ? `<select id="gd-add-field-${c}">
           <option value="0" ${defaultVal === '0' ? 'selected' : ''}>0 / false</option>
           <option value="1" ${defaultVal === '1' ? 'selected' : ''}>1 / true</option>
         </select>`
      : `<input id="gd-add-field-${c}" type="${isNum || c === meta.primaryKey ? 'number' : 'text'}"
                value="${escape(defaultVal)}" autocomplete="off">`;
    const requiredNote = c === meta.primaryKey
      ? ' <span class="text-muted" style="font-size:0.85em">(primary key)</span>'
      : '';
    return `
      <div class="form-group">
        <label>${escape(c)}${requiredNote}</label>
        ${input}
      </div>
    `;
  }).join('');
  return `
    <div class="modal-header">
      <h3 style="margin:0">
        <i class="fa-solid fa-plus"></i>
        Add ${escape(meta.label)} row
      </h3>
    </div>
    <form id="gd-add-form" onsubmit="return gdSubmitAdd(event, '${escape(key)}')">
      <p class="text-muted" style="margin:0 0 0.75rem">
        Fill in the fields below. Required fields (primary key) are pre-populated with 0 —
        change them to the real id before saving.
      </p>
      ${fields || '<p class="text-muted">No writable columns for this table.</p>'}
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-success"><i class="fa-solid fa-floppy-disk"></i> Create</button>
      </div>
    </form>
  `;
}

window.gdSubmitAdd = async (e, key) => {
  e.preventDefault();
  try {
    const tables = await API.getGameDataTables();
    const meta = (tables || []).find(t => t.key === key);
    if (!meta) return toast('Unknown table', 'error');
    const candidates = meta.insertable || meta.updatable || [];
    let sample = {};
    try {
      const env = await API.getGameDataRow(key, 1).catch(() => null);
      sample = (env && env.data) || {};
    } catch {}
    const body = {};
    for (const c of candidates) {
      const el = document.getElementById('gd-add-field-' + c);
      if (!el) continue;
      const raw = el.value;
      // Skip empties for non-PK fields
      if (raw === '' && c !== meta.primaryKey) continue;
      const s = sample[c];
      if (el.tagName === 'SELECT') {
        body[c] = Number(raw);
      } else if (typeof s === 'number') {
        const n = Number(raw);
        body[c] = Number.isFinite(n) ? n : raw;
      } else {
        body[c] = raw;
      }
    }
    await API.createGameDataRow(key, body);
    toast('Row created', 'success');
    closeModal();
    if (typeof loadGameData === 'function') loadGameData();
  } catch (err) {
    toast(err.message || 'Create failed', 'error');
  }
  return false;
};

// ---------- Quests Manager ----------
//
// Focused editor for character_quest + character_quest_objective. The user
// supplies a character id, the page shows all of that character's quests
// (with state/flags/timer/reset), each quest's objectives, and inline add /
// delete / edit controls.
function questsManagerPage({ charId = '', questId = '' } = {}) {
  return `
    <div class="page-header">
      <h2><i class="fa-solid fa-scroll"></i> Quests Manager</h2>
      <p class="muted">View and edit a character's quest log, state, and per-objective progress.</p>
    </div>

    <div class="card qm-toolbar">
      <form onsubmit="event.preventDefault(); qmRenderChar();" class="qm-form">
        <label>
          Character ID
          <input type="number" id="qm-char-id" value="${escape(String(charId))}" placeholder="e.g. 1" min="0" required>
        </label>
        <button type="submit" class="btn btn-primary">
          <i class="fa-solid fa-magnifying-glass"></i> Load
        </button>
        ${charId ? `<button type="button" class="btn" onclick="qmAddQuest(${escape(String(charId))})">
                      <i class="fa-solid fa-plus"></i> Add quest
                    </button>` : ''}
        <a class="btn" href="#/live-data/quests"><i class="fa-solid fa-table"></i> Raw table</a>
      </form>
    </div>

    <div id="qm-results" class="qm-results">
      ${charId ? '' : '<div class="empty-state"><p>Enter a character id above to load their quests.</p></div>'}
    </div>
  `;
}
window.questsManagerPage = questsManagerPage;
