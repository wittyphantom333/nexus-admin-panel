let currentUser = null;
let buildInfo = null;

// Defensive wrapper: if a page function isn't loaded (e.g. browser is serving
// a cached app.js against freshly-built pages.js), show a clear error
// pointing the user at a hard refresh instead of a blank page.
function renderPageOrError(fnName, render) {
  try {
    if (typeof window[fnName] === 'function') return render();
    return `<div style="padding:2rem;color:#f88;background:#1a0d0d;border:1px solid #a33;border-radius:8px;margin:1rem">
      <h3 style="margin:0 0 0.5rem">Page module not loaded</h3>
      <p style="margin:0 0 0.5rem">The function <code>${fnName}</code> is missing. Your browser is likely serving a cached <code>app.js</code> from before the latest build.</p>
      <p style="margin:0">Fix: <b>Ctrl+Shift+R</b> (or Cmd+Shift+R on Mac) to hard-reload.</p>
    </div>`;
  } catch (e) {
    console.error(`Render error in ${fnName}:`, e);
    return `<div style="padding:2rem;color:#f88">Error rendering page: ${e.message}</div>`;
  }
}

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
  const shell = (typeof sidebar === 'function')
    ? sidebar(currentUser)
    : `<div style="padding:2rem;color:#f88">Layout error: sidebar() missing. Hard-refresh the page (Ctrl+Shift+R).</div>`;
  app.innerHTML = shell + `<main class="main-content"><div id="page-content">${content}</div></main>`;
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
  else if (hash === '/accounts') loadAccounts();
  else if (hash === '/characters') loadCharacters();
  else if (hash === '/sessions') loadSessions();
  else if (hash === '/worlddb') loadWorldDb();
  else if (hash === '/gamedata' || hash.startsWith('/gamedata/')) loadGameData();
  else if (hash === '/quests-manager' || hash.startsWith('/quests-manager')) loadQuestsManager();
  else if (hash === '/settings') loadSettings();
  else if (hash === '/logs') loadLogs();
  else if (hash === '/profile') loadProfile();
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
    page.innerHTML = renderPageOrError('dashboardPage', () => dashboardPage({
      ...dashRes,
      accounts: { total: accountsArr.length, recent: accountsArr.slice(0, 5) },
      characters: { total: charactersArr.length, recent: charactersArr.slice(0, 5) },
    }));
  } catch (err) {
    page.innerHTML = `<div class="empty-state"><p>Error loading dashboard: ${escape(err.message)}</p></div>`;
  }
}

async function handleServerAction(action, server) {
  try {
    const res = await API.serverAction(action, server);
    toast(`Server ${action} command sent${server ? ' for ' + server : ''}`, 'success');
    setTimeout(loadDashboard, 1000);
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
    page.innerHTML = renderPageOrError('accountsPage', () => accountsPage(data));
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
    const [acct, ingame] = await Promise.all([
      API.getAccount(id),
      API.getIngameAccount(id).catch(() => ({ roleIds: [], permissionIds: [] }))
    ]);

    const showProfile = () => `
      <form id="edit-account-profile-form" class="acct-tab-pane">
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="edit-account-email" value="${escape(acct.email)}" required>
        </div>
        <div class="form-group">
          <label>New Password (leave blank to keep)</label>
          <input type="password" id="edit-account-password">
        </div>
        <div class="form-group">
          <label>Panel Role</label>
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
    `;

    const showIngame = () => `
      <div class="acct-tab-pane" id="edit-account-ingame-pane">
        <p class="text-muted" style="margin-top:0">
          In-game roles &amp; permissions are enforced by the WorldServer and attach to the <strong>account</strong> (characters inherit). Changes apply on next login.
        </p>
        <div id="ingame-rbac-loader" class="text-muted">Loading…</div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Close</button>
        <button type="button" class="btn btn-primary" id="ingame-rbac-save" style="display:none"
                onclick="saveIngameRbac(${id})">Save</button>
      </div>
    `;

    const overlay = showModal(`
      <h3>Edit Account #${id} — ${escape(acct.email)}</h3>
      <div class="tabs" style="margin-bottom:12px">
        <button class="tab active" data-tab="profile">Profile</button>
        <button class="tab" data-tab="ingame">In-Game RBAC</button>
      </div>
      <div id="acct-tab-profile">${showProfile()}</div>
      <div id="acct-tab-ingame" style="display:none">${showIngame()}</div>
    `);

    // Tab switching
    overlay.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const t = btn.dataset.tab;
        document.getElementById('acct-tab-profile').style.display = (t === 'profile') ? '' : 'none';
        document.getElementById('acct-tab-ingame').style.display = (t === 'ingame') ? '' : 'none';
        if (t === 'ingame' && !window.__ingameRbacLoaded) loadIngameRbac(id);
      });
    });

    // Profile form submit
    document.getElementById('edit-account-profile-form').addEventListener('submit', async (e) => {
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

async function loadIngameRbac(accountId) {
  const pane = document.getElementById('edit-account-ingame-pane');
  if (!pane) return;
  try {
    const [rolesRes, permsRes, acctRes] = await Promise.all([
      API.getIngameRoles().catch(() => ({ roles: [] })),
      API.getIngamePermissions().catch(() => ({ permissions: [] })),
      API.getIngameAccount(accountId).catch(() => null)
    ]);
    if (!acctRes) {
      pane.innerHTML = `<p class="text-muted" style="margin-top:0">No in-game account is linked to this user.</p>`;
      return;
    }
    const roles = Array.isArray(rolesRes && rolesRes.roles) ? rolesRes.roles : [];
    const perms = Array.isArray(permsRes && permsRes.permissions) ? permsRes.permissions : [];
    const acct = acctRes;
    const roleIds = new Set(acct.roleIds || []);
    const permIds = new Set(acct.permissionIds || []);
    pane.innerHTML = `
      <p class="text-muted" style="margin-top:0">
        In-game roles &amp; permissions are enforced by the WorldServer and attach to the <strong>account</strong> (characters inherit). Changes apply on next login.
      </p>
      <div class="form-group">
        <label><i class="fas fa-shield-alt"></i> Roles (${roles.length})</label>
        <input type="text" class="ingame-search" data-target="ingame-role-list" placeholder="Search roles…">
        <div id="ingame-role-list" class="checkbox-grid" style="max-height:160px;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:8px;margin-top:4px">
          ${roles.map(r => `
            <label class="checkbox-row" data-name="${escape(r.name).toLowerCase()}">
              <input type="checkbox" class="ingame-role-cb" value="${r.id}" ${roleIds.has(r.id) ? 'checked' : ''}>
              <span>${escape(r.name)}</span>
              <small class="text-muted">flags=${r.flags||0}</small>
            </label>
          `).join('')}
        </div>
      </div>
      <div class="form-group">
        <label><i class="fas fa-key"></i> Direct Permissions (${perms.length})</label>
        <input type="text" class="ingame-search" data-target="ingame-perm-list" placeholder="Search permissions…">
        <div id="ingame-perm-list" class="checkbox-grid" style="max-height:200px;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:8px;margin-top:4px">
          ${perms.map(p => `
            <label class="checkbox-row" data-name="${escape(p.name).toLowerCase()}" title="${escape(p.description || '')}">
              <input type="checkbox" class="ingame-perm-cb" value="${p.id}" ${permIds.has(p.id) ? 'checked' : ''}>
              <span>${escape(p.name)}</span>
              ${p.description ? `<small class="text-muted">${escape(p.description)}</small>` : ''}
            </label>
          `).join('')}
        </div>
        <small class="text-muted">Direct grants add to whatever the assigned roles grant.</small>
      </div>
    `;
    // Wire up search inputs
    pane.querySelectorAll('.ingame-search').forEach(inp => {
      inp.addEventListener('input', () => {
        const q = inp.value.toLowerCase();
        const target = document.getElementById(inp.dataset.target);
        target.querySelectorAll('.checkbox-row').forEach(row => {
          row.style.display = row.dataset.name.includes(q) ? '' : 'none';
        });
      });
    });
    document.getElementById('ingame-rbac-save').style.display = '';
    window.__ingameRbacLoaded = true;
  } catch (err) {
    pane.innerHTML = `<p class="text-danger">Failed to load in-game RBAC: ${escape(err.message)}</p>`;
  }
}

async function saveIngameRbac(accountId) {
  const roleIds = [...document.querySelectorAll('.ingame-role-cb:checked')].map(c => parseInt(c.value));
  const permissionIds = [...document.querySelectorAll('.ingame-perm-cb:checked')].map(c => parseInt(c.value));
  try {
    await Promise.all([
      API.setIngameAccountRoles(accountId, roleIds),
      API.setIngameAccountPermissions(accountId, permissionIds)
    ]);
    toast('In-game RBAC updated', 'success');
  } catch (err) {
    toast(err.message || 'Failed to update in-game RBAC', 'error');
  }
}

async function toggleBan(id, ban, email) {
  if (ban) {
    return showBanAccountModal(id, email);
  }
  // Unban path
  if (!confirm(`Unban account ${email}?`)) return;
  try {
    const res = await fetch(`/api/bans/account/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('authToken') },
      body: JSON.stringify({ email })
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || json.replyText || 'Unban failed');
    toast(`Account ${email} unbanned`, 'success');
    loadAccounts();
  } catch (err) {
    toast(err.message || 'Failed to unban', 'error');
  }
}

function showBanAccountModal(id, email) {
  showModal(`
    <h3><i class="fas fa-ban"></i> Ban Account</h3>
    <p style="color:var(--text2)">Banning <b>${escape(email)}</b> will block login on the auth server and notify the world server.</p>
    <div class="form-row">
      <label>Reason <span style="color:var(--color-danger)">*</span></label>
      <input id="ban-reason" placeholder="e.g. cheating, harassment" autofocus>
    </div>
    <div class="form-row">
      <label>Ban until <span style="color:var(--text2);font-weight:400">(leave blank for permanent)</span></label>
      <input id="ban-until" type="datetime-local">
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="ban-submit"><i class="fas fa-ban"></i> Ban Account</button>
    </div>
  `, { onMount: () => {
    document.getElementById('ban-submit').addEventListener('click', async () => {
      const reason = document.getElementById('ban-reason').value.trim();
      const until = document.getElementById('ban-until').value;
      if (!reason) { toast('Reason is required', 'error'); return; }
      const btn = document.getElementById('ban-submit');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Banning…';
      try {
        const res = await fetch(`/api/bans/account/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('authToken') },
          body: JSON.stringify({ reason, endTime: until || null, email })
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || json.replyText || 'Ban failed');
        toast(`Account ${email} banned`, 'success');
        closeModal();
        loadAccounts();
      } catch (err) {
        toast(err.message || 'Failed to ban', 'error');
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-ban"></i> Ban Account';
      }
    });
  }});
}

function _rolesString(roles) {
  if (roles == null) return '';
  if (typeof roles === 'string') return roles;
  if (Array.isArray(roles)) return roles.map(r => (r == null ? '' : (typeof r === 'string' ? r : (r.name || r.roleName || r.RoleName || '')))).filter(Boolean).join(', ');
  if (typeof roles === 'object') return roles.name || roles.roleName || roles.RoleName || '';
  return String(roles);
}
function _isAdminAccount(acct) {
  if (!acct) return false;
  if (acct.roleId === 1 || acct.role === 'admin' || acct.role === 'Admin' || acct.role === 'Administrator') return true;
  if (Array.isArray(acct.roles)) {
    return acct.roles.some(r => r && (r.name === 'Administrator' || r.name === 'Admin' || r.id === 1 || r.id === 3));
  }
  const s = String(_rolesString(acct.roles) || '');
  return s.toLowerCase().includes('admin');
}
function _isBannedAccount(acct) {
  if (!acct) return false;
  return acct.isBanned === true || acct.isBanned === 1 || acct.isBanned === '1';
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

async function showAccountDetails(id) {
  try {
    const [acct, ingame] = await Promise.all([
      API.getAccount(id),
      API.getIngameAccount(id).catch(() => ({ roleIds: [], permissionIds: [] }))
    ]);
    const isBanned = _isBannedAccount(acct);
    const isAdmin = _isAdminAccount(acct);
    const rolesStr = _rolesString(acct.roles);
    const roleLabel = isAdmin ? 'Admin' : (rolesStr || 'User');
    const created = acct.createTime ? new Date(acct.createTime).toLocaleString() : '-';

    showModal(`
      <div class="acct-detail-head">
        <h3><i class="fas fa-user-shield"></i> ${escape(acct.email)} <span class="badge ${isAdmin ? 'badge-primary' : 'badge-info'}">${escape(roleLabel)}</span> ${isBanned ? '<span class="badge badge-danger">Banned</span>' : '<span class="badge badge-success">Active</span>'}</h3>
        <div class="acct-detail-meta">
          <span><b>ID:</b> ${acct.id}</span>
          <span><b>Created:</b> ${created}</span>
        </div>
      </div>

      <div class="char-edit" style="margin-top:0">
        <label><i class="fas fa-pen"></i> Edit Profile</label>
        <form id="acct-detail-profile-form" class="acct-tab-pane">
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="ad-email" value="${escape(acct.email)}" required>
          </div>
          <div class="form-group">
            <label>New Password (leave blank to keep)</label>
            <input type="password" id="ad-password" autocomplete="new-password">
          </div>
          <div class="form-group">
            <label>Panel Role</label>
            <select id="ad-role">
              <option value="2" ${!isAdmin ? 'selected' : ''}>User</option>
              <option value="1" ${isAdmin ? 'selected' : ''}>Admin</option>
            </select>
          </div>
        </form>
      </div>

      <div class="char-edit">
        <label><i class="fas fa-gamepad"></i> In-Game RBAC</label>
        <div id="edit-account-ingame-pane" class="acct-tab-pane">
          <p class="text-muted" style="margin-top:0">
            Roles &amp; permissions enforced by the WorldServer; attach to the <strong>account</strong> (characters inherit). Changes apply on next login.
          </p>
          <div id="ingame-rbac-loader" class="text-muted">Loading…</div>
        </div>
        <div class="modal-actions" style="margin-top:8px">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Close</button>
          <button type="button" class="btn btn-primary" id="ingame-rbac-save" style="display:none" onclick="saveIngameRbac(${id})">Save RBAC</button>
        </div>
      </div>

      <div class="char-edit">
        <label><i class="fas fa-ban"></i> ${isBanned ? 'Ban Status' : 'Ban Account'}</label>
        ${isBanned ? `
          <p class="text-muted" style="margin-top:0">This account is currently banned.</p>
          <div class="modal-actions" style="margin-top:8px">
            <button type="button" class="btn btn-ghost" onclick="closeModal()">Close</button>
            <button type="button" class="btn btn-success" onclick="toggleBan(${id}, false, '${escape(acct.email)}')">
              <i class="fas fa-unlock"></i> Unban
            </button>
          </div>
        ` : `
          <div class="form-row">
            <label>Reason <span style="color:var(--color-danger)">*</span></label>
            <input id="ban-reason" placeholder="e.g. cheating, harassment" autofocus>
          </div>
          <div class="form-row">
            <label>Ban until <span style="color:var(--text2);font-weight:400">(leave blank for permanent)</span></label>
            <input id="ban-until" type="datetime-local">
          </div>
          <div class="modal-actions" style="margin-top:8px">
            <button type="button" class="btn btn-ghost" onclick="closeModal()">Close</button>
            <button type="button" class="btn btn-danger" id="ban-confirm-btn"
                    onclick="(function(btn){btn.disabled=true;btn.innerHTML='<i class=\\'fas fa-spinner fa-spin\\'></i> Banning…';fetch('/api/auth/ban/${id}',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+localStorage.getItem('authToken')},body:JSON.stringify({reason:document.getElementById('ban-reason').value,endTime:document.getElementById('ban-until').value||null,email:'${escape(acct.email)}'})}).then(async r=>{const j=await r.json();if(!r.ok||!j.success)throw new Error(j.error||j.replyText||'Ban failed');toast('Account ${escape(acct.email)} banned','success');closeModal();loadAccounts();}).catch(e=>{toast(e.message||'Failed to ban','error');btn.disabled=false;btn.innerHTML='<i class=\\'fas fa-ban\\'></i> Ban Account';});})(this)">
              <i class="fas fa-ban"></i> Ban Account
            </button>
          </div>
        `}
      </div>

      <div class="modal-actions modal-actions-split">
        <button type="button" class="btn btn-danger" onclick="deleteAccountConfirm(${id}, '${escape(acct.email)}')">
          <i class="fas fa-trash"></i> Delete Account
        </button>
        <div class="modal-actions-right">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Close</button>
          <button type="button" class="btn btn-primary" id="ad-save-btn"
                  onclick="saveAccountEdit(${id}, this)">
            <i class="fas fa-save"></i> Save Profile
          </button>
        </div>
      </div>
    `);

    // Only fetch in-game RBAC for game accounts (those with rows in the `account` table).
    // Manager users (id 1=admin, etc.) don't exist there and would 404.
    if (acct && acct.email) loadIngameRbac(id);
  } catch (err) {
    toast(err.message || 'Failed to load account', 'error');
  }
}

async function saveAccountEdit(id, btn) {
  const email = document.getElementById('ad-email');
  const role  = document.getElementById('ad-role');
  const pw    = document.getElementById('ad-password');
  if (!email || !role) return;
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }
  try {
    const data = { email: email.value.trim(), roleId: parseInt(role.value, 10) };
    if (pw && pw.value) data.password = pw.value;
    await API.updateAccount(id, data);
    toast('Account updated', 'success');
    closeModal();
    loadAccounts();
  } catch (err) {
    toast(err.message || 'Failed to update account', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Profile'; }
  }
}

async function loadCharacters() {
  const page = document.getElementById('page-content');
  page.innerHTML = loadingSpinner();
  try {
    const data = await API.getCharacters();
    page.innerHTML = renderPageOrError('charactersPage', () => charactersPage(data));
  } catch (err) {
    page.innerHTML = `<div class="empty-state"><p>Error loading characters: ${escape(err.message)}</p></div>`;
  }
}

async function loadSessions() {
  const page = document.getElementById('page-content');
  page.innerHTML = loadingSpinner();
  try {
    const data = await API.get('/sessions');
    const list = (data && (data.online || data)) || [];
    page.innerHTML = renderPageOrError('sessionsPage', () => sessionsPage({ data: list, count: data && data.count }));
  } catch (err) {
    page.innerHTML = `<div class="empty-state"><p>Error loading sessions: ${escape(err.message)}</p></div>`;
  }
}

async function doSessionLookup() {
  const out = document.getElementById('session-lookup-out');
  const clientId = document.getElementById('lk-clientId').value.trim();
  const ip = document.getElementById('lk-ip').value.trim();
  const name = document.getElementById('lk-name').value.trim();
  if (!clientId && !ip && !name) {
    out.innerHTML = '<p style="color:#fa8">Provide a clientId, IP, or name.</p>';
    return;
  }
  out.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Looking up…';
  try {
    const q = new URLSearchParams({ ...(clientId && { clientId }), ...(ip && { ip }), ...(name && { name }) }).toString();
    const res = await API.get(`/sessions/lookup?${q}`);
    renderSessionLookup(res);
  } catch (err) {
    out.innerHTML = `<p style="color:#f88">Lookup failed: ${escape(err.message)}</p>`;
  }
}

function renderSessionLookup(res) {
  const out = document.getElementById('session-lookup-out');
  const sessions = res.sessions || [];
  const chars = res.characters || [];
  out.innerHTML = html`
    <div style="margin-bottom:.5rem;padding:.5rem;background:#222;border-radius:6px;font-size:.85rem;color:#aaa">
      <b>Note:</b> ${escape(res.note || '')}
    </div>
    <h4>Sessions (${sessions.length})</h4>
    ${sessions.length ? html`
      <table class="clickable-rows"><thead><tr>
        <th>clientId</th><th>name</th><th>ip</th><th>since</th><th>lastSeen</th>
      </tr></thead><tbody>
        ${sessions.map(s => html`<tr>
          <td><code>${escape(s.clientId)}</code></td>
          <td>${escape(s.name || '-')}</td>
          <td>${escape(s.ip || '-')}</td>
          <td>${escape(s.since || '-')}</td>
          <td>${s.lastSeen ? new Date(s.lastSeen).toLocaleString() : '-'}</td>
        </tr>`).join('')}
      </tbody></table>
    ` : '<p style="color:#888">No live session frames matched.</p>'}
    <h4 style="margin-top:1rem">Characters (${chars.length})</h4>
    ${chars.length ? html`
      <table class="clickable-rows"><thead><tr>
        <th>id</th><th>name</th><th>level</th><th>race</th><th>class</th>
        <th>accountId</th><th>account</th><th>lastOnline</th>
      </tr></thead><tbody>
        ${chars.map(r => html`<tr onclick="showCharacterDetails(${r.character.id})">
          <td>${r.character.id}</td>
          <td>${escape(r.character.name)}</td>
          <td>${r.character.level || 1}</td>
          <td>${escape(r.character.race || '-')}</td>
          <td>${escape(r.character.class || '-')}</td>
          <td>${r.character.accountId}</td>
          <td>${escape(r.character.accountEmail || '-')}</td>
          <td>${r.character.lastOnline ? new Date(r.character.lastOnline).toLocaleString() : '-'}</td>
        </tr>`).join('')}
      </tbody></table>
    ` : '<p style="color:#888">No character matched.</p>'}
  `;
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

async function loadGameData() {
  const page = document.getElementById('page-content');
  page.innerHTML = loadingSpinner();
  // Parse /gamedata or /gamedata/<key>?<qs>
  const hash = window.location.hash.slice(1) || '/gamedata';
  const rest = hash.replace(/^\/gamedata\/?/, '');
  const [key, qs = ''] = rest.split('?');
  const params = Object.fromEntries(new URLSearchParams(qs));
  try {
    const tables = await API.getGameDataTables();
    let data = null;
    if (key) {
      const meta = (tables || []).find(t => t.key === key);
      if (!meta) {
        return page.innerHTML = gamedataPage({ tables, error: `Unknown table "${key}"` });
      }
      const sp = {
        limit: String(params.pageSize || 25),
        offset: String(((parseInt(params.page || '1', 10) - 1) * parseInt(params.pageSize || 25, 10))),
        sort: params.sort || meta.listColumns[0],
        dir: (params.dir || 'asc').toUpperCase(),
      };
      if (params.q) sp.q = params.q;
      const env = await API.getGameDataTable(key, sp);
      // env = { success, data: [rows], total, limit, offset }
      data = { rows: env.data || [], total: env.total || 0, limit: env.limit, offset: env.offset };
    }
    page.innerHTML = gamedataPage({ tables, selectedKey: key || null, tableData: data });
  } catch (err) {
    page.innerHTML = `<div class="empty-state"><p><i class="fa-solid fa-triangle-exclamation"></i> ${escape(err.message || 'Failed to load')}</p></div>`;
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

async function deleteCharacter(id, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Deleting...'; }
  if (!confirm('Delete this character? This cannot be undone.')) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash"></i> Delete'; }
    return;
  }
  try {
    await API.deleteCharacter(id);
    toast('Character deleted', 'success');
    closeModal();
    loadCharacters();
  } catch (err) {
    toast(err.message || 'Failed to delete character', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash"></i> Delete'; }
  }
}

async function saveCharacterEdit(id, btn) {
  const nameEl = document.getElementById('cd-name');
  const levelEl = document.getElementById('cd-level');
  if (!nameEl || !levelEl) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  try {
    await API.updateCharacter(id, {
      name: nameEl.value.trim(),
      level: parseInt(levelEl.value, 10) || 1,
    });
    toast('Character updated', 'success');
    closeModal();
    loadCharacters();
  } catch (err) {
    toast(err.message || 'Failed to update character', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save'; }
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

      <div class="char-edit">
        <label><i class="fas fa-pen"></i> Edit Character</label>
        <div class="char-edit-row">
          <div class="form-group">
            <label>Name</label>
            <input type="text" id="cd-name" value="${escape(ch.name || '')}" maxlength="64" required>
          </div>
          <div class="form-group">
            <label>Level</label>
            <input type="number" id="cd-level" value="${ch.level || 1}" min="1" max="50">
          </div>
        </div>
      </div>

      <div class="modal-actions modal-actions-split">
        <button type="button" class="btn btn-danger" id="cd-delete-btn" onclick="deleteCharacter(${ch.id}, this)">
          <i class="fas fa-trash"></i> Delete
        </button>
        <div class="modal-actions-right">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Close</button>
          <button type="button" class="btn btn-primary" id="cd-save-btn" onclick="saveCharacterEdit(${ch.id}, this)">
            <i class="fas fa-save"></i> Save
          </button>
        </div>
      </div>
    `);

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
    const res = await API.getServerConfig();
    const configs = res && res.data ? res.data : res;
    textarea.value = JSON.stringify(configs, null, 2);
  } catch {
    textarea.value = '// Unable to load config';
  }
}

async function saveServerConfig() {
  const textarea = document.getElementById('config-editor');
  if (!textarea) return;
  try {
    const config = JSON.parse(textarea.value);
    await API.updateServerConfig('all', config);
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
    const [authLogs, worldLogs, stsLogs] = await Promise.all([
      API.getServerLogs('auth', 100),
      API.getServerLogs('world', 100),
      API.getServerLogs('sts', 100),
    ]);
    const logs = { auth: authLogs, world: worldLogs, sts: stsLogs };
    page.innerHTML = logsPage(logs);
    document.getElementById('logs-refresh-all')?.addEventListener('click', () => loadLogs());
    // Scroll to bottom (most recent logs)
    requestAnimationFrame(() => {
      const container = document.getElementById('combined-log');
      if (container) container.scrollTop = container.scrollHeight;
    });
  } catch (e) {
    page.innerHTML = `<div class="empty-state"><p>Error loading logs: ${escape(e.message)}</p></div>`;
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

async function loadProfile() {
  const page = document.getElementById('page-content');
  page.innerHTML = loadingSpinner();
  try {
    const [me, chars] = await Promise.all([
      API.me(),
      API.getCharacters(),
    ]);
    const characterList = Array.isArray(chars) ? chars : (chars.characters || chars.results || []);
    const myEmail = me.email || me.username || currentUser.email;
    const myId = me.id || currentUser.id;
    const myChars = characterList.filter(c => c.accountEmail === myEmail || c.accountId === myId);
    // Normalize fields the profile page expects
    const meNorm = {
      id: me.id || myId,
      email: myEmail,
      role: me.role || currentUser.role || 'user',
      ingameRoles: me.ingameRoles || [],
      createdAt: me.createdAt || me.createTime || null,
      isServiceAccount: !!(me.isServiceAccount || currentUser.isServiceAccount),
    };
    page.innerHTML = renderPageOrError('profilePage', () => profilePage(meNorm, myChars));
    bindProfile(meNorm);
  } catch (err) {
    page.innerHTML = `<div class="empty-state"><p>Error loading profile: ${escape(err.message)}</p></div>`;
  }
}

function bindProfile(me) {
  const pwForm = document.getElementById('profile-pw-form');
  if (pwForm) {
    pwForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const oldPw = document.getElementById('pw-old').value;
      const newPw = document.getElementById('pw-new').value;
      const newPw2 = document.getElementById('pw-new2').value;
      if (newPw !== newPw2) { toast('New passwords do not match', 'error'); return; }
      if (newPw.length < 8) { toast('New password must be at least 8 characters', 'error'); return; }
      try {
        const res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to change password');
        toast('Password changed', 'success');
        pwForm.reset();
      } catch (err) {
        toast(err.message || 'Failed to change password', 'error');
      }
    });
  }
}

// ---------- Quests manager (character_quest + character_quest_objective) ----------
//
// URL: /quests-manager[?charId=123&questId=456]
//   charId  -> focus a single character's quest log
//   questId -> highlight a specific quest within that log
async function loadQuestsManager() {
  const page = document.getElementById('page-content');
  page.innerHTML = loadingSpinner();
  const hash = window.location.hash.slice(1) || '/quests-manager';
  const qs = hash.split('?')[1] || '';
  const params = Object.fromEntries(new URLSearchParams(qs));
  try {
    page.innerHTML = questsManagerPage({ charId: params.charId || '', questId: params.questId || '' });
  } catch (err) {
    page.innerHTML = `<div class="empty-state"><p><i class="fa-solid fa-triangle-exclamation"></i> ${escape(err.message || 'Failed to load')}</p></div>`;
  }
}

async function qmLoadCharQuests(charId) {
  const env = await API.getGameDataTable('quests', { limit: '500', offset: '0', sort: 'questId', dir: 'ASC', q: String(charId) });
  return (env.data || []).filter(r => String(r.id) === String(charId));
}

async function qmLoadObjectives(charId, questId) {
  const env = await API.getGameDataTable('quest_objectives', { limit: '500', offset: '0', sort: 'index', dir: 'ASC', q: String(charId) });
  return (env.data || []).filter(r => String(r.id) === String(charId) && String(r.questId) === String(questId));
}

async function qmAddQuest(charId) {
  const questId = prompt('New questId (numeric):', '');
  if (!questId) return;
  const id = parseInt(questId, 10);
  if (!Number.isFinite(id)) return toast('questId must be numeric', 'error');
  try {
    await API.createGameDataRow('quests', { id: parseInt(charId, 10), questId: id, state: 0, flags: 0, timer: 0, reset: 0 });
    toast('Quest added', 'success');
    qmRenderChar();
  } catch (err) { toast(err.message || 'Insert failed', 'error'); }
}

async function qmDeleteQuest(charId, questId) {
  if (!confirm(`Delete quest ${questId} for character ${charId}? This also removes its objectives.`)) return;
  try {
    await API.deleteGameDataRow('quests', `${charId}::${questId}`);
    toast('Quest deleted', 'success');
    qmRenderChar();
  } catch (err) { toast(err.message || 'Delete failed', 'error'); }
}

async function qmAddObjective(charId, questId) {
  const idx = prompt('New objective index (0..N):', '0');
  if (idx === null) return;
  const index = parseInt(idx, 10);
  if (!Number.isFinite(index)) return toast('index must be numeric', 'error');
  try {
    await API.createGameDataRow('quest_objectives', { id: parseInt(charId, 10), questId: parseInt(questId, 10), index, progress: 0, timer: 0 });
    toast('Objective added', 'success');
    qmRenderChar();
  } catch (err) { toast(err.message || 'Insert failed', 'error'); }
}

async function qmDeleteObjective(charId, questId, index) {
  if (!confirm(`Delete objective ${index}?`)) return;
  try {
    await API.deleteGameDataRow('quest_objectives', `${charId}::${questId}::${index}`);
    toast('Objective deleted', 'success');
    qmRenderChar();
  } catch (err) { toast(err.message || 'Delete failed', 'error'); }
}

async function qmEditQuestField(charId, questId, field, value) {
  try {
    await API.updateGameDataRow('quests', `${charId}::${questId}`, { [field]: value });
    toast('Saved', 'success');
  } catch (err) { toast(err.message || 'Update failed', 'error'); }
}

async function qmEditObjectiveField(charId, questId, index, field, value) {
  try {
    await API.updateGameDataRow('quest_objectives', `${charId}::${questId}::${index}`, { [field]: value });
    toast('Saved', 'success');
  } catch (err) { toast(err.message || 'Update failed', 'error'); }
}

async function qmRenderChar() {
  const charId = document.getElementById('qm-char-id')?.value.trim();
  const wrap = document.getElementById('qm-results');
  if (!charId) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = loadingSpinner();
  try {
    const quests = await qmLoadCharQuests(charId);
    // For each quest, also fetch its objectives
    const questObjs = await Promise.all(quests.map(q => qmLoadObjectives(charId, q.questId)));
    wrap.innerHTML = qmRenderResults(charId, quests.map((q, i) => ({ ...q, _objectives: questObjs[i] })));
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state"><p>Error: ${escape(err.message)}</p></div>`;
  }
}

function qmRenderResults(charId, quests) {
  if (!quests.length) {
    return `<div class="empty-state">
      <p>No quests for character <code>${escape(charId)}</code>.</p>
      <button class="btn btn-primary" onclick="qmAddQuest(${escape(charId)})">
        <i class="fa-solid fa-plus"></i> Add quest
      </button>
    </div>`;
  }
  return `
    <div class="qm-actions">
      <button class="btn btn-primary" onclick="qmAddQuest(${escape(charId)})">
        <i class="fa-solid fa-plus"></i> Add quest
      </button>
      <span class="muted">${quests.length} quest${quests.length === 1 ? '' : 's'}</span>
    </div>
    ${quests.map(q => qmQuestCard(charId, q)).join('')}
  `;
}

function qmQuestCard(charId, q) {
  const objs = q._objectives || [];
  return `
    <div class="qm-quest-card">
      <div class="qm-quest-head">
        <div class="qm-quest-title">
          <i class="fa-solid fa-scroll"></i> Quest #${escape(String(q.questId))}
          <span class="badge">state ${escape(String(q.state))}</span>
          <span class="badge">flags ${escape(String(q.flags))}</span>
        </div>
        <div class="qm-quest-actions">
          <button class="btn btn-sm" onclick="qmAddObjective(${escape(String(charId))}, ${escape(String(q.questId))})">
            <i class="fa-solid fa-plus"></i> Objective
          </button>
          <button class="btn btn-sm btn-danger" onclick="qmDeleteQuest(${escape(String(charId))}, ${escape(String(q.questId))})">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="qm-quest-fields">
        <label>state
          <input type="number" value="${escape(String(q.state ?? 0))}"
                 onchange="qmEditQuestField(${escape(String(charId))}, ${escape(String(q.questId))}, 'state', parseInt(this.value, 10))">
        </label>
        <label>flags
          <input type="number" value="${escape(String(q.flags ?? 0))}"
                 onchange="qmEditQuestField(${escape(String(charId))}, ${escape(String(q.questId))}, 'flags', parseInt(this.value, 10))">
        </label>
        <label>timer
          <input type="number" value="${escape(String(q.timer ?? 0))}"
                 onchange="qmEditQuestField(${escape(String(charId))}, ${escape(String(q.questId))}, 'timer', parseInt(this.value, 10))">
        </label>
        <label>reset
          <input type="number" value="${escape(String(q.reset ?? 0))}"
                 onchange="qmEditQuestField(${escape(String(charId))}, ${escape(String(q.questId))}, 'reset', parseInt(this.value, 10))">
        </label>
      </div>
      <div class="qm-objectives">
        <div class="qm-obj-head">
          <strong>Objectives (${objs.length})</strong>
        </div>
        ${objs.length === 0 ? `<div class="muted qm-empty">No objectives.</div>` : `
          <table class="data-table">
            <thead><tr><th>index</th><th>progress</th><th>timer</th><th></th></tr></thead>
            <tbody>
              ${objs.map(o => `
                <tr>
                  <td>${escape(String(o.index))}</td>
                  <td><input type="number" value="${escape(String(o.progress ?? 0))}"
                              onchange="qmEditObjectiveField(${escape(String(charId))}, ${escape(String(q.questId))}, ${escape(String(o.index))}, 'progress', parseInt(this.value, 10))"></td>
                  <td><input type="number" value="${escape(String(o.timer ?? 0))}"
                              onchange="qmEditObjectiveField(${escape(String(charId))}, ${escape(String(q.questId))}, ${escape(String(o.index))}, 'timer', parseInt(this.value, 10))"></td>
                  <td><button class="btn btn-sm btn-danger" onclick="qmDeleteObjective(${escape(String(charId))}, ${escape(String(q.questId))}, ${escape(String(o.index))})">
                        <i class="fa-solid fa-trash"></i>
                      </button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>
  `;
}
window.qmLoadCharQuests = qmLoadCharQuests;
window.qmRenderChar = qmRenderChar;
window.qmAddQuest = qmAddQuest;
window.qmDeleteQuest = qmDeleteQuest;
window.qmAddObjective = qmAddObjective;
window.qmDeleteObjective = qmDeleteObjective;
window.qmEditQuestField = qmEditQuestField;
window.qmEditObjectiveField = qmEditObjectiveField;
