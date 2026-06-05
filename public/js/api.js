const API_BASE = '/api';

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  const token = localStorage.getItem('token');
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const json = await res.json();

  if (!res.ok || (json.success === false)) {
    throw new Error(json.error || json.message || 'Request failed');
  }
  return json.data !== undefined ? json.data : json;
}

const API = {
  login: (email, password) => api('POST', '/auth/login', { email, password }),
  logout: () => api('POST', '/auth/logout'),
  me: () => api('GET', '/auth/me'),

  getAccounts: () => api('GET', '/accounts'),
  createAccount: (data) => api('POST', '/accounts', data),
  updateAccount: (id, data) => api('PUT', `/accounts/${id}`, data),
  deleteAccount: (id) => api('DELETE', `/accounts/${id}`),
  getAccount: (id) => api('GET', `/accounts/${id}`),
  createAccount: (data) => api('POST', '/accounts', data),
  updateAccount: (id, data) => api('PUT', `/accounts/${id}`, data),
  deleteAccount: (id) => api('DELETE', `/accounts/${id}`),
  getAccountCharacters: (id) => api('GET', `/accounts/${id}/characters`),
  updateAccountRole: (id, roleId) => api('PUT', `/auth/accounts/${id}/role`, { roleId }),

  // In-game RBAC (NexusForever role/permission tables)
  getIngameRoles: () => api('GET', '/rbac/ingame/roles'),
  getIngamePermissions: () => api('GET', '/rbac/ingame/permissions'),
  getIngameAccount: (id) => api('GET', `/rbac/ingame/account/${id}`),
  setIngameAccountRoles: (id, roleIds) => api('PUT', `/rbac/ingame/account/${id}/roles`, { roleIds }),
  setIngameAccountPermissions: (id, permissionIds) => api('PUT', `/rbac/ingame/account/${id}/permissions`, { permissionIds }),


  getCharacters: (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return api('GET', `/characters${q ? '?' + q : ''}`);
  },
  getCharacter: (id) => api('GET', `/characters/${id}`),
  updateCharacter: (id, data) => api('PUT', `/characters/${id}`, data),
  deleteCharacter: (id) => api('DELETE', `/characters/${id}`),

  getServers: () => api('GET', '/servers'),
  getServerStatus: () => api('GET', '/servers/status'),
  serverAction: (action, server) => api('POST', `/servers/${action}${server ? '?server=' + server : ''}`),
  getServerLogs: async (server, lines) => {
    const res = await api('GET', `/servers/logs?server=${server || 'auth'}&lines=${lines || 100}`);
    return typeof res === 'string' ? res : (res.logs || JSON.stringify(res));
  },
  getServerConfig: () => api('GET', '/servers/config'),
  updateServerConfig: (server, config) => api('PUT', `/servers/config/${server}`, config),
  getServerLogs: (server, lines) => api('GET', `/servers/logs?server=${server || 'auth'}&lines=${lines || 100}`),

  getDashboard: () => api('GET', '/dashboard'),
  getBuild: () => api('GET', '/build'),
  getSystemInfo: () => api('GET', '/system/info'),
  getSystemProcesses: () => api('GET', '/system/processes'),
  getSystemLogs: async (lines) => {
    const res = await api('GET', `/system/logs?lines=${lines || 50}`);
    return typeof res === 'string' ? res : (res.logs || JSON.stringify(res));
  },

  getCommandLog: (params) => {
    const q = params && params.params
      ? params.params
      : new URLSearchParams(params || {}).toString();
    return api('GET', `/command-log${q ? '?' + q : ''}`);
  },
  getCommandLogEntry: (id) => api('GET', `/command-log/${id}`),

  getAnnouncements: (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return api('GET', `/announcements${q ? '?' + q : ''}`);
  },
  getAnnouncement: (id) => api('GET', `/announcements/${id}`),
  sendAnnouncement: (body) => api('POST', '/announcements', body),

  getPermissions: () => api('GET', '/auth/permissions'),
  getRoles: () => api('GET', '/auth/roles'),

  getWorldDbStatus: () => api('GET', '/worlddb/status'),
  worldDbClone: () => api('POST', '/worlddb/clone'),
  worldDbPull: () => api('POST', '/worlddb/pull'),
  worldDbApply: (file) => api('POST', '/worlddb/apply', { file }),
  worldDbApplyContinent: (continent) => api('POST', '/worlddb/apply-continent', { continent }),
  worldDbApplyAll: () => api('POST', '/worlddb/apply-all'),

  getBuild: () => api('GET', '/build'),
  get: (path) => api('GET', path),
  post: (path, body) => api('POST', path, body),
};
