let currentUser = null;
let buildInfo = null;

function toggleTheme() {
  const html = document.documentElement;
  const theme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const icon = document.getElementById('theme-icon');
  if (icon) icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
}

function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

async function handleLogout() {
  try { await API.logout(); } catch {}
  localStorage.removeItem('token');
  currentUser = null;
  renderApp();
}

async function renderApp() {
  const app = document.getElementById('app');
  const token = localStorage.getItem('token');
  const hash = window.location.hash.slice(1) || '/';

  if (!token) {
    if (hash === '/login') {
      app.innerHTML = loginPage();
      document.getElementById('login-form').addEventListener('submit', handleLogin);
    } else {
      app.innerHTML = landingPage();
    }
    return;
  }
  try {
    const me = await API.me();
    currentUser = me.data || me.user || me;
  } catch {
    localStorage.removeItem('token');
    app.innerHTML = loginPage();
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    return;
  }
  const content = router.resolve();
  app.innerHTML = sidebar(currentUser) + `<main class="main-content"><div id="page-content">${content}</div></main>`;
  const icon = document.getElementById('theme-icon');
  if (icon) {
    const theme = document.documentElement.getAttribute('data-theme');
    icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
  }
  // Load build info
  if (!buildInfo) {
    try {
      buildInfo = await API.getBuild();
      const tag = document.getElementById('version-tag');
      if (tag && buildInfo) {
        const short = (buildInfo.commit || '').slice(0, 7);
        tag.textContent = `v${buildInfo.version}${short ? ' · ' + short : ''}`;
        tag.title = `${buildInfo.version} (${buildInfo.commit}) on ${buildInfo.branch} — built ${buildInfo.builtAt || ''}`;
      }
    } catch {}
  }
  const pageHash = window.location.hash.slice(1) || '/dashboard';
  if (pageHash === '/dashboard') loadDashboard();
  else if (hash === '/server') loadServerPage();
  else if (hash === '/accounts') loadAccounts();
  else if (hash === '/characters') loadCharacters();
  else if (hash === '/worlddb') loadWorldDb();
  else if (hash === '/settings') loadSettings();
  else if (hash === '/logs') loadLogs();
  else if (hash === '/commands') loadCommands();
  else if (hash === '/announcements') loadAnnouncements();
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  try {
    const res = await API.login(username, password);
    localStorage.setItem('token', res.token);
    if (res.user) {
      localStorage.setItem('user', JSON.stringify(res.user));
      currentUser = res.user;
    }
    window.location.hash = '/dashboard';
    renderApp();
  } catch (err) {
    toast(err.message || 'Login failed', 'error');
  }
}

async function loadDashboard() {
  const page = document.getElementById('page-content');
  page.innerHTML = loadingSpinner();
  try {
    const [dashRes, accountsRes, charactersRes] = await Promise.all([
      API.getDashboard(),
      API.getAccounts(),
      API.getCharacters(),
    ]);
    const accountsArr = Array.isArray(accountsRes) ? accountsRes : (accountsRes.accounts || accountsRes.results || []);
    const charactersArr = Array.isArray(charactersRes) ? charactersRes : (charactersRes.characters || charactersRes.results || []);
    page.innerHTML = dashboardPage({
      ...dashRes,
      accounts: { total: accountsArr.length, recent: accountsArr.slice(0, 5) },
      characters: { total: charactersArr.length, recent: charactersArr.slice(0, 5) },
    });
  } catch (err) {
    page.innerHTML = `<div class="empty-state"><p>Error loading dashboard: ${escape(err.message)}</p></div>`;
  }
}

async function loadServerPage() {
  const page = document.getElementById('page-content');
  page.innerHTML = loadingSpinner();
  try {
    const statusRes = await API.getServerStatus();
    const logs = await API.getServerLogs();
    page.innerHTML = serverPage(statusRes, logs);
  } catch (err) {
    page.innerHTML = `<div class="empty-state"><p>Error loading server status: ${escape(err.message)}</p></div>`;
  }
}

async function handleServerAction(action, server) {
  try {
    const res = await API.serverAction(action, server);
    toast(`Server ${action} command sent${server ? ' for ' + server : ''}`, 'success');
    setTimeout(loadServerPage, 1000);
  } catch (err) {
    toast(err.message || `Failed to ${action} server`, 'error');
  }
}

async function refreshLogs() {
  try {
    const sel = document.getElementById('log-server-select');
    const server = sel ? sel.value : 'auth';
    const logs = await API.getServerLogs(server);
    const viewer = document.getElementById('log-viewer');
    if (viewer) viewer.textContent = logs;
  } catch (err) {
    toast('Failed to refresh logs', 'error');
  }
}

async function loadAccounts() {
  const page = document.getElementById('page-content');
  page.innerHTML = loadingSpinner();
  try {
    const data = await API.getAccounts();
    page.innerHTML = accountsPage(data);
  } catch (err) {
    page.innerHTML = `<div class="empty-state"><p>Error loading accounts: ${escape(err.message)}</p></div>`;
  }
}

async function showCreateAccountModal() {
  const overlay = showModal(`
    <h3>Create Account</h3>
    <form id="create-account-form">
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="new-account-email" required>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="new-account-password" required>
      </div>
      <div class="form-group">
        <label>Role</label>
        <select id="new-account-role">
          <option value="2">User</option>
          <option value="1">Admin</option>
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create</button>
      </div>
    </form>
  `);
  document.getElementById('create-account-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('new-account-email').value;
    const password = document.getElementById('new-account-password').value;
    const role = document.getElementById('new-account-role').value === '1' ? 'Admin' : 'User';
    try {
      await API.createAccount({ email, password, role });
      closeModal();
      toast('Account created', 'success');
      loadAccounts();
    } catch (err) {
      toast(err.message || 'Failed to create account', 'error');
    }
  });
}

async function showEditAccountModal(id) {
  try {
    const acct = await API.getAccount(id);
    const overlay = showModal(`
      <h3>Edit Account #${id}</h3>
      <form id="edit-account-form">
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="edit-account-email" value="${escape(acct.email)}" required>
        </div>
        <div class="form-group">
          <label>New Password (leave blank to keep)</label>
          <input type="password" id="edit-account-password">
        </div>
        <div class="form-group">
          <label>Role</label>
          <select id="edit-account-role">
            <option value="2" ${acct.roleId === 2 ? 'selected' : ''}>User</option>
            <option value="1" ${acct.roleId === 1 ? 'selected' : ''}>Admin</option>
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `);
    document.getElementById('edit-account-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = { email: document.getElementById('edit-account-email').value, roleId: parseInt(document.getElementById('edit-account-role').value) };
      const pw = document.getElementById('edit-account-password').value;
      if (pw) data.password = pw;
      try {
        await API.updateAccount(id, data);
        closeModal();
        toast('Account updated', 'success');
        loadAccounts();
      } catch (err) {
        toast(err.message || 'Failed to update account', 'error');
      }
    });
  } catch (err) {
    toast('Failed to load account details', 'error');
  }
}

async function toggleBan(id, ban) {
  try {
    await API.updateAccount(id, { isBanned: ban });
    toast(ban ? 'Account banned' : 'Account unbanned', 'success');
    loadAccounts();
  } catch (err) {
    toast(err.message || 'Failed to update ban status', 'error');
  }
}

async function showAccountCharacters(accountId) {
  try {
    const chars = await API.getAccountCharacters(accountId);
    const list = chars.length ? chars.map(c => `<tr><td>${escape(c.name)}</td><td>${c.level || 1}</td></tr>`).join('') : '<tr><td colspan="2" style="text-align:center;color:var(--text2)">No characters</td></tr>';
    showModal(`
      <h3>Characters for Account #${accountId}</h3>
      <div class="table-container">
        <table>
          <thead><tr><th>Name</th><th>Level</th></tr></thead>
          <tbody>${list}</tbody>
        </table>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      </div>
    `);
  } catch (err) {
    toast('Failed to load characters', 'error');
  }
}

async function loadCharacters() {
  const page = document.getElementById('page-content');
  page.innerHTML = loadingSpinner();
  try {
    const data = await API.getCharacters();
    page.innerHTML = charactersPage(data);
  } catch (err) {
    page.innerHTML = `<div class="empty-state"><p>Error loading characters: ${escape(err.message)}</p></div>`;
  }
}

async function loadWorldDb() {
  const page = document.getElementById('page-content');
  page.innerHTML = loadingSpinner();
  try {
    const res = await API.getWorldDbStatus();
    const data = res.data || res;
    page.innerHTML = worldDbPage(data);
  } catch (err) {
    page.innerHTML = `<div class="empty-state"><p>Error loading world DB: ${escape(err.message)}</p></div>`;
  }
}

async function withWorldDbOutput(promise) {
  const block = document.getElementById('worlddb-output');
  const body = document.getElementById('worlddb-output-body');
  if (block) block.style.display = 'block';
  if (body) body.textContent = 'Running...';
  try {
    const res = await promise;
    if (body) body.textContent = (res.output || res.error || JSON.stringify(res, null, 2));
    if (block) block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return res;
  } catch (err) {
    if (body) body.textContent = `Error: ${err.message}`;
    throw err;
  }
}

async function worldDbClone() {
  try {
    const res = await withWorldDbOutput(API.worldDbClone());
    if (res.success) toast('Repository cloned', 'success'); else toast('Clone failed', 'error');
    loadWorldDb();
  } catch (err) { toast(err.message || 'Clone failed', 'error'); }
}

async function worldDbPull() {
  try {
    const res = await withWorldDbOutput(API.worldDbPull());
    toast(res.success ? 'Pulled latest' : 'Pull failed', res.success ? 'success' : 'error');
    loadWorldDb();
  } catch (err) { toast(err.message || 'Pull failed', 'error'); }
}

async function worldDbApplyFile(file) {
  if (!confirm(`Apply ${file}?`)) return;
  try {
    const res = await withWorldDbOutput(API.worldDbApply(file));
    toast(res.success ? 'File applied' : 'Apply failed', res.success ? 'success' : 'error');
    loadWorldDb();
  } catch (err) { toast(err.message || 'Apply failed', 'error'); }
}

async function worldDbApplyContinent(continent) {
  if (!confirm(`Apply all files in ${continent}?`)) return;
  try {
    const res = await withWorldDbOutput(API.worldDbApplyContinent(continent));
    toast(res.success ? `${continent} applied` : 'Apply failed', res.success ? 'success' : 'error');
    loadWorldDb();
  } catch (err) { toast(err.message || 'Apply failed', 'error'); }
}

async function worldDbApplyAll() {
  if (!confirm('Apply ALL continents? This can take a while.')) return;
  try {
    const res = await withWorldDbOutput(API.worldDbApplyAll());
    toast(res.success ? 'All applied' : 'Apply failed', res.success ? 'success' : 'error');
    loadWorldDb();
  } catch (err) { toast(err.message || 'Apply failed', 'error'); }
}

async function showEditCharacterModal(id) {
  try {
    const ch = await API.getCharacter(id);
    const overlay = showModal(`
      <h3>Edit Character #${id}</h3>
      <form id="edit-character-form">
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="edit-char-name" value="${escape(ch.name)}" required>
        </div>
        <div class="form-group">
          <label>Level</label>
          <input type="number" id="edit-char-level" value="${ch.level || 1}" min="1" max="50">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `);
    document.getElementById('edit-character-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = { name: document.getElementById('edit-char-name').value, level: parseInt(document.getElementById('edit-char-level').value) };
      try {
        await API.updateCharacter(id, data);
        closeModal();
        toast('Character updated', 'success');
        loadCharacters();
      } catch (err) {
        toast(err.message || 'Failed to update character', 'error');
      }
    });
  } catch (err) {
    toast('Failed to load character details', 'error');
  }
}

async function deleteCharacter(id) {
  if (!confirm('Delete this character? This cannot be undone.')) return;
  try {
    await API.deleteCharacter(id);
    toast('Character deleted', 'success');
    loadCharacters();
  } catch (err) {
    toast(err.message || 'Failed to delete character', 'error');
  }
}

// Character Details drawer with the in-game Actions dropdown
// (XP/Level/Item/Currency/Quest/Revive/Kick/Teleport/Say) —
// admin-only, hits /api/character-actions/exec, toasts the result, logs to /api/command-log.
async function showCharacterDetails(id) {
  try {
    const ch = await API.getCharacter(id);
    // Check online state (best-effort; world server may not push us a list)
    let onlineInfo = { online: false, session: null };
    try {
      const r = await api('GET', `/character-actions/online?name=${encodeURIComponent(ch.name)}&realmId=${ch.realmId || ''}`);
      onlineInfo = r.data || r;
    } catch (_) { /* ignore */ }

    const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.roleId === 1);

    showModal(`
      <h3><i class="fas fa-user"></i> ${escape(ch.name)} <span class="char-lvl">Lv ${ch.level || 1}</span></h3>
      <div class="char-detail-grid">
        <div><span>Race</span><b>${escape(ch.race || '-')}</b></div>
        <div><span>Class</span><b>${escape(ch.class || '-')}</b></div>
        <div><span>Account</span><b>${escape(ch.accountEmail || ch.accountId || '-')}</b></div>
        <div><span>Status</span>
          <b class="char-online ${onlineInfo.online ? 'on' : 'off'}">
            <i class="fas fa-circle"></i> ${onlineInfo.online ? 'Online' : 'Offline'}
          </b>
        </div>
      </div>

      ${isAdmin ? `
      <div class="char-actions">
        <label><i class="fas fa-bolt"></i> In-Game Action</label>
        <div class="char-action-row">
          <select id="char-action-type" onchange="window.__renderCharActionForm && window.__renderCharActionForm()">
            <option value="xp">Add XP</option>
            <option value="level">Set Level</option>
            <option value="item">Add Item</option>
            <option value="currency">Add Currency</option>
            <option value="quest">Complete Quest</option>
            <option value="quest_reset">Reset Quest</option>
            <option value="revive">Revive</option>
            <option value="teleport">Teleport</option>
            <option value="kick">Kick</option>
            <option value="say">Send Say</option>
          </select>
        </div>
        <div id="char-action-params" class="char-action-params"></div>
        <div class="char-action-exec">
          <button class="btn btn-primary" id="char-action-run" onclick="window.__runCharAction(${ch.id})">
            <i class="fas fa-play"></i> Run Command
          </button>
          <span class="char-action-hint">Result is sent to your toast and the Logs page.</span>
        </div>
      </div>
      ` : ''}

      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Close</button>
      </div>
    `);

    // Per-action param form
    const paramForms = {
      xp: [{ k: 'amount', label: 'XP Amount', type: 'number', min: 0 }],
      level: [{ k: 'level', label: 'Level (1-50)', type: 'number', min: 1, max: 50 }],
      item: [
        { k: 'itemId', label: 'Item ID', type: 'number', min: 0 },
        { k: 'quantity', label: 'Quantity', type: 'number', min: 1, value: 1 },
      ],
      currency: [
        { k: 'currencyId', label: 'Currency ID', type: 'number', min: 0 },
        { k: 'amount', label: 'Amount', type: 'number', min: 0 },
      ],
      quest: [{ k: 'questId', label: 'Quest ID', type: 'number', min: 0 }],
      quest_reset: [{ k: 'questId', label: 'Quest ID', type: 'number', min: 0 }],
      revive: [],
      teleport: [
        { k: 'worldId', label: 'World ID', type: 'number', min: 0 },
        { k: 'x', label: 'X', type: 'number', step: '0.1' },
        { k: 'y', label: 'Y', type: 'number', step: '0.1' },
        { k: 'z', label: 'Z', type: 'number', step: '0.1' },
      ],
      kick: [{ k: 'reason', label: 'Reason', type: 'text', placeholder: 'Kicked by admin' }],
      say: [{ k: 'message', label: 'Message', type: 'text', placeholder: 'Hello, world' }],
    };
    function renderForm() {
      const type = document.getElementById('char-action-type').value;
      const fields = paramForms[type] || [];
      const host = document.getElementById('char-action-params');
      if (!fields.length) { host.innerHTML = '<em class="muted">No parameters required.</em>'; return; }
      host.innerHTML = fields.map(f => `
        <div class="form-group">
          <label>${f.label}</label>
          <input type="${f.type}" id="cap-${f.k}" ${f.min!=null?`min="${f.min}"`:''} ${f.max!=null?`max="${f.max}"`:''} ${f.step?`step="${f.step}"`:''} ${f.value!=null?`value="${f.value}"`:''} ${f.placeholder?`placeholder="${f.placeholder}"`:''}>
        </div>
      `).join('');
    }
    window.__renderCharActionForm = renderForm;
    renderForm();

    window.__runCharAction = async (charId) => {
      const type = document.getElementById('char-action-type').value;
      const fields = paramForms[type] || [];
      const params = {};
      fields.forEach(f => {
        const el = document.getElementById('cap-' + f.k);
        if (!el) return;
        const v = el.value;
        params[f.k] = f.type === 'number' ? (v === '' ? null : Number(v)) : v;
      });
      try {
        const r = await api('POST', '/character-actions/exec', { name: ch.name, action: type, params });
        const result = r.data || r;
        const ok = result.ok !== false && result.success !== false;
        toast(ok ? `Action ${type} OK: ${result.text || 'sent'}` : `Action ${type} failed`, ok ? 'success' : 'error');
        // Append to log store if present
        if (window.commandLog && Array.isArray(window.commandLog)) {
          window.commandLog.unshift({
            ts: new Date().toISOString(),
            user: currentUser.email,
            category: 'character',
            action: type,
            target: ch.name,
            command: result.command,
            status: ok ? 'ok' : 'fail',
            reply: result.text || result.raw || null,
          });
        }
      } catch (err) {
        toast(err.message || 'Action failed', 'error');
      }
    };
  } catch (err) {
    toast('Failed to load character details', 'error');
  }
}

async function loadSettings() {
  const page = document.getElementById('page-content');
  page.innerHTML = loadingSpinner();
  try {
    const roles = await API.getRoles();
    const permissions = await API.getPermissions();
    page.innerHTML = settingsPage(roles, permissions);
    loadConfigContent();
  } catch (err) {
    page.innerHTML = `<div class="empty-state"><p>Error loading settings: ${escape(err.message)}</p></div>`;
  }
}

function switchSettingsTab(el, tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  document.getElementById(`settings-${tab}`).style.display = 'block';
  if (tab === 'config') loadConfigContent();
}

async function loadConfigContent() {
  const textarea = document.getElementById('config-editor');
  if (!textarea) return;
  try {
    const config = await API.getServerConfig();
    textarea.value = config;
  } catch {
    textarea.value = '// Unable to load config';
  }
}

async function saveServerConfig() {
  const textarea = document.getElementById('config-editor');
  if (!textarea) return;
  try {
    await API.saveServerConfig(textarea.value);
    toast('Configuration saved', 'success');
  } catch (err) {
    toast(err.message || 'Failed to save config', 'error');
  }
}

async function showCreateRoleModal() {
  const overlay = showModal(`
    <h3>Create Role</h3>
    <form id="create-role-form">
      <div class="form-group">
        <label>Role Name</label>
        <input type="text" id="new-role-name" required>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create</button>
      </div>
    </form>
  `);
  document.getElementById('create-role-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-role-name').value;
    try {
      await API.createRole({ name });
      closeModal();
      toast('Role created', 'success');
      loadSettings();
    } catch (err) {
      toast(err.message || 'Failed to create role', 'error');
    }
  });
}

async function loadLogs() {
  const page = document.getElementById('page-content');
  page.innerHTML = loadingSpinner();
  try {
    const data = await API.getCommandLog({ limit: 50, offset: 0 });
    page.innerHTML = logsPage(data);
    bindLogsEvents();
  } catch (err) {
    page.innerHTML = `<div class="empty-state"><p>Error loading logs: ${escape(err.message)}</p></div>`;
  }
}

async function refreshSystemLogs() {
  try {
    const logs = await API.getSystemLogs();
    const viewer = document.getElementById('system-log-viewer');
    if (viewer) viewer.textContent = logs;
  } catch (err) {
    toast('Failed to refresh logs', 'error');
  }
}

initTheme();
document.addEventListener('DOMContentLoaded', renderApp);
window.addEventListener('hashchange', renderApp);

// ─── Commands page ─────────────────────────────────────────────────────────
let cmdState = {
  ws: null,
  catalog: [],
  selected: null,       // { category, subcommand }
  connected: false,
};

function cmdSetConn(state, text) {
  const pill = document.getElementById('cmd-conn-pill');
  const t = document.getElementById('cmd-conn-text');
  if (pill) pill.className = 'conn-pill conn-' + state;
  if (t) t.textContent = text;
}

function cmdAppendOutput(text, severity) {
  const box = document.getElementById('cmd-output');
  if (!box) return;
  const line = document.createElement('div');
  line.className = 'cmd-line cmd-' + (severity || 'info');
  const ts = new Date().toLocaleTimeString();
  line.innerHTML = `<span class="cmd-ts">[${ts}]</span> <span class="cmd-text">${escape(text)}</span>`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function cmdConnect() {
  if (cmdState.ws) { try { cmdState.ws.close(); } catch (_) {} }
  const urlInput = document.getElementById('cmd-ws-url');
  const token = localStorage.getItem('token') || '';
  const upstream = urlInput ? urlInput.value.trim() : 'ws://localhost:5000/ws/commands';
  const bridgeUrl = new URL('/ws/console', window.location.href);
  bridgeUrl.protocol = bridgeUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  bridgeUrl.searchParams.set('token', token);
  bridgeUrl.searchParams.set('upstream', upstream);
  cmdState.ws = new WebSocket(bridgeUrl.toString());
  cmdSetConn('connecting', 'Connecting…');
  cmdState.ws.onopen = () => cmdSetConn('connected', 'Connected');
  cmdState.ws.onclose = () => { cmdSetConn('disconnected', 'Disconnected'); cmdState.connected = false; };
  cmdState.ws.onerror = () => { cmdSetConn('error', 'Error'); cmdAppendOutput('WebSocket error', 'error'); };
  cmdState.ws.onmessage = (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type === 'catalog') { cmdState.catalog = msg.categories || []; renderCmdCatalog(); }
    else if (msg.type === 'system') cmdAppendOutput(msg.text, msg.severity);
    else if (msg.type === 'frame' && msg.frame) cmdAppendOutput(msg.frame.text, msg.frame.type);
  };
}

function renderCmdCatalog() {
  const list = document.getElementById('cmd-cat-list');
  if (!list) return;
  const filter = (document.getElementById('cmd-filter')?.value || '').toLowerCase();
  list.innerHTML = '';
  const cats = cmdState.catalog.filter(c => {
    if (!filter) return true;
    return c.id.toLowerCase().includes(filter)
      || c.subcommands.some(s => s.id.toLowerCase().includes(filter) || s.description.toLowerCase().includes(filter));
  });
  for (const cat of cats) {
    const li = document.createElement('li');
    li.className = 'cmd-cat';
    li.innerHTML = `<div class="cmd-cat-title"><i class="fas fa-folder"></i> ${escape(cat.id)} <span class="cmd-cat-count">${cat.subcommands.length}</span></div>`;
    const ul = document.createElement('ul');
    ul.className = 'cmd-sub-list';
    for (const sub of cat.subcommands) {
      const s = document.createElement('li');
      s.className = 'cmd-sub';
      s.textContent = sub.id;
      s.title = sub.description;
      s.onclick = () => selectSubcommand(cat, sub);
      ul.appendChild(s);
    }
    li.appendChild(ul);
    list.appendChild(li);
  }
}

function selectSubcommand(cat, sub) {
  cmdState.selected = { category: cat, subcommand: sub };
  document.querySelectorAll('.cmd-sub').forEach(n => n.classList.remove('active'));
  // Re-mark the active one
  const subs = document.querySelectorAll('.cmd-sub');
  const idx = cat.subcommands.findIndex(s => s.id === sub.id);
  if (subs && idx >= 0) {
    const allSub = Array.from(subs);
    // Find by matching text
    const target = allSub.find(n => n.textContent === sub.id && !n.classList.contains('active'));
    // Better: just iterate in order
  }
  document.getElementById('cmd-form-empty').style.display = 'none';
  document.getElementById('cmd-form').style.display = 'block';
  document.getElementById('cmd-form-title').textContent = `${cat.id} → ${sub.id}`;
  document.getElementById('cmd-form-syntax').textContent = sub.syntax;
  document.getElementById('cmd-form-desc').textContent = sub.description || '';
  document.getElementById('cmd-perm-id').textContent = sub.permission;
  document.getElementById('cmd-form-target').innerHTML =
    `<span class="cmd-badge">Target: ${escape(sub.target)}</span>` +
    `<span class="cmd-badge cmd-badge-muted">Perm: ${sub.permission}</span>`;
  const form = document.getElementById('cmd-form-fields');
  form.innerHTML = '';
  (sub.params || []).forEach((param, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'form-group';
    const label = `<label>${escape(param.name)}<span class="cmd-type">${param.type}${param.required ? ' *' : ''}</span></label>`;
    let inputHtml;
    if (param.values && typeof param.values === 'object') {
      const opts = Object.entries(param.values).map(([k, v]) => `<option value="${v}">${escape(k)} (${v})</option>`).join('');
      inputHtml = `<select class="cmd-input" data-param="${escape(param.name)}" ${param.required ? 'required' : ''}><option value="">— select —</option>${opts}</select>`;
    } else {
      const ph = param.values ? param.values.join(' | ') : '';
      inputHtml = `<input type="text" class="cmd-input" data-param="${escape(param.name)}" ${param.required ? 'required' : ''} placeholder="${ph}">`;
    }
    wrap.innerHTML = label + inputHtml;
    form.appendChild(wrap);
  });
  // Highlight active subcommand
  document.querySelectorAll('.cmd-sub').forEach(n => n.classList.remove('active'));
  // Find again with proper selection
  Array.from(document.querySelectorAll('.cmd-sub')).forEach(n => {
    if (n.textContent === sub.id) n.classList.add('active');
  });
}

function buildCommandString() {
  const sel = cmdState.selected;
  if (!sel) return null;
  const sub = sel.subcommand;
  const inputs = document.querySelectorAll('#cmd-form-fields [data-param]');
  const params = {};
  inputs.forEach(i => { params[i.getAttribute('data-param')] = i.value.trim(); });
  // Validate required
  for (const p of (sub.params || [])) {
    if (p.required && !params[p.name]) {
      cmdAppendOutput(`Missing required parameter: ${p.name}`, 'error');
      return null;
    }
  }
  // sub.syntax example: "character xp [amount]" → split first 2 tokens, append params
  const parts = sub.syntax.split(/\s+/);
  // Drop the param placeholders
  const fixed = parts.filter(t => !/^\[.*\]$/.test(t));
  // For each parameter, append
  const ordered = (sub.params || []).map(p => params[p.name]).filter(v => v !== '' && v !== undefined && v !== null);
  return [...fixed, ...ordered].join(' ');
}

async function loadCommands() {
  const page = document.getElementById('page-content');
  page.innerHTML = commandsPage();
  document.getElementById('cmd-filter')?.addEventListener('input', renderCmdCatalog);
  document.getElementById('cmd-reconnect')?.addEventListener('click', cmdConnect);
  document.getElementById('cmd-clear-out')?.addEventListener('click', () => {
    const box = document.getElementById('cmd-output');
    if (box) box.innerHTML = '';
  });
  document.getElementById('cmd-execute')?.addEventListener('click', () => {
    const cmd = buildCommandString();
    if (!cmd) return;
    if (!cmdState.ws || cmdState.ws.readyState !== 1) {
      cmdAppendOutput('Not connected to world server.', 'error');
      return;
    }
    cmdAppendOutput(`> ${cmd}`, 'info');
    cmdState.ws.send(JSON.stringify({ type: 'command', message: cmd }));
  });
  document.getElementById('cmd-cancel')?.addEventListener('click', () => {
    document.getElementById('cmd-form-fields').querySelectorAll('input,select').forEach(i => i.value = '');
  });
  // Try to load catalog from REST as a fallback (works even before WS connects)
  try {
    const res = await API.get('/api/commands/catalog');
    if (res && res.categories) { cmdState.catalog = res.categories; renderCmdCatalog(); }
  } catch (e) { /* ignore — will be filled in via WS */ }
  cmdConnect();
}

// ─── Announcements page ────────────────────────────────────────────────────
async function loadAnnouncements() {
  const page = document.getElementById('page-content');
  page.innerHTML = loadingSpinner();
  try {
    const data = await API.getAnnouncements({ limit: 100 });
    page.innerHTML = announcementsPage(data);
    bindAnnouncements();
  } catch (err) {
    page.innerHTML = `<div class="empty-state"><p>Error loading announcements: ${escape(err.message)}</p></div>`;
  }
}

function bindAnnouncements() {
  const tier = document.getElementById('ann-tier');
  const msg = document.getElementById('ann-message');
  const preview = document.getElementById('ann-preview');
  const send = document.getElementById('ann-send');
  const reload = document.getElementById('ann-reload');
  const q = document.getElementById('ann-q');
  const tierF = document.getElementById('ann-tier-filter');
  const statusF = document.getElementById('ann-status-filter');

  if (!send) return;

  const updatePreview = () => {
    if (!preview || !tier) return;
    preview.textContent = `!broadcast message ${tier.value} ${msg.value || '…'}`;
  };
  if (tier) tier.addEventListener('change', updatePreview);
  if (msg) msg.addEventListener('input', updatePreview);

  send.addEventListener('click', async () => {
    const message = (msg.value || '').trim();
    if (!message) { toast('Message required', 'error'); return; }
    send.disabled = true;
    try {
      const res = await execCmd(`broadcast message ${tier.value} ${message}`);
      msg.value = '';
      updatePreview();
      await loadAnnouncements();
    } catch (err) {
      toast(err.message || 'Broadcast failed', 'error');
    } finally {
      send.disabled = false;
    }
  });

  reload.addEventListener('click', loadAnnouncements);
  const filterHandler = () => {
    const params = { limit: 100 };
    if (q && q.value) params.q = q.value;
    if (tierF && tierF.value) params.tier = tierF.value;
    if (statusF && statusF.value) params.status = statusF.value;
    const list = document.getElementById('ann-list');
    if (list) list.style.opacity = '0.5';
    API.getAnnouncements(params).then(data => {
      const newHtml = announcementsPage(data);
      const tmp = document.createElement('div');
      tmp.innerHTML = newHtml;
      const newList = tmp.querySelector('#ann-list');
      const oldList = document.getElementById('ann-list');
      if (newList && oldList) oldList.outerHTML = newList.outerHTML;
    }).catch(err => toast(err.message || 'Filter failed', 'error'));
  };
  if (q) q.addEventListener('input', debounce(filterHandler, 300));
  if (tierF) tierF.addEventListener('change', filterHandler);
  if (statusF) statusF.addEventListener('change', filterHandler);

  updatePreview();
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
