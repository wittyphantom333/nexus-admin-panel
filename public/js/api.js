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

  getDashboard: () => api('GET', '/dashboard'),
  getBuild: () => api('GET', '/build'),
  getSystemInfo: () => api('GET', '/system/info'),
  getSystemProcesses: () => api('GET', '/system/processes'),
  getSystemLogs: async (lines) => {
    const res = await api('GET', `/system/logs?lines=${lines || 50}`);
    return typeof res === 'string' ? res : (res.logs || JSON.stringify(res));
  },

  getPermissions: () => api('GET', '/auth/permissions'),
  getRoles: () => api('GET', '/auth/roles'),
};
