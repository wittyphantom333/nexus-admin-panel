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
  else if (hash === '/settings') loadSettings();
  else if (hash === '/logs') loadLogs();
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
    const logs = await API.getSystemLogs();
    page.innerHTML = logsPage(logs);
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
