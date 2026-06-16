// Persistent WebSocket connection to the world server's /ws/commands endpoint.
// Each browser tab gets a temporary "one-shot" socket via the REST endpoint,
// OR a long-lived console socket via /ws/console that we proxy through here.
//
// Message format on the wire (browser → world):
//   { "type": "command", "message": "character xp 5" }
//   Plain-text server → world; reply is a JSON envelope { type, message, level, time }.
const WebSocket = require('ws');
const { CATEGORIES } = require('./commandCatalog');

let endpoint = 'ws://localhost:5000/ws/commands';
let ws = null;
let pendingResolve = null;
let readyResolvers = [];
let consoleClients = new Set();
// Tracked online characters, keyed by realmId (or 'default' if unknown).
// World server may push a "characters" or "online" frame; we keep whatever
// we see so /api/character-actions/online can answer from cached state.
let onlineByRealm = new Map();
// Raw session frames: keyed by clientId (the GUID from the [NetworkSession] log).
// World server should push { type:"session", clientId, name?, realmId?, ip?, since? }
// We keep up to 500 entries with a 30-min TTL.
const SESSION_TTL_MS = 30 * 60 * 1000;
const SESSION_MAX = 500;
const SESSION_TYPE = { SESSION: 'session', JOIN: 'session.join', LEAVE: 'session.leave' };
const DEFAULT_REALM = 'default';
let sessionByClientId = new Map();
let lastPruneAt = 0;
function rememberSession(s) {
  if (!s || !s.clientId) return;
  s.lastSeen = Date.now();
  sessionByClientId.set(String(s.clientId), s);
  if (sessionByClientId.size > SESSION_MAX) {
    const firstKey = sessionByClientId.keys().next().value;
    sessionByClientId.delete(firstKey);
  }
  if (Date.now() - lastPruneAt > SESSION_TTL_MS) {
    pruneSessions();
    lastPruneAt = Date.now();
  }
}
function pruneSessions() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [k, v] of sessionByClientId) if (v.lastSeen < cutoff) sessionByClientId.delete(k);
  lastPruneAt = Date.now();
}

function setEndpoint(url) {
  if (url && url !== endpoint) {
    endpoint = url;
    try { if (ws) ws.close(); } catch (_) {}
  }
}

function getEndpoint() { return endpoint; }

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  ws = new WebSocket(endpoint);
  ws.on('open', () => {
    for (const r of readyResolvers) r(); readyResolvers = [];
  });
  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { msg = { type: 'raw', text: raw.toString() }; }
    // Capture online-character lists pushed by the world server.
    // Accepts: {type:"characters", realmId, characters:[{name,...}]}
    //          {type:"online", ...} as alias.
    if (msg && (msg.type === 'characters' || msg.type === 'online')) {
      const realm = msg.realmId != null ? String(msg.realmId) : DEFAULT_REALM;
      onlineByRealm.set(realm, Array.isArray(msg.characters) ? msg.characters : []);
    }
    // Per-session metadata. We accept several shapes:
    //   { type:"session", clientId, name, realmId, accountId, ip, since, level }
    //   { type:"session.join", ... }  /  { type:"session.leave", clientId }
    if (msg && (msg.type === SESSION_TYPE.SESSION || msg.type === SESSION_TYPE.JOIN)) {
      rememberSession(msg);
    } else if (msg && msg.type === SESSION_TYPE.LEAVE && msg.clientId) {
      sessionByClientId.delete(String(msg.clientId));
    }
    if (pendingResolve) {
      const r = pendingResolve; pendingResolve = null; r(msg);
      return;
    }
    for (const client of consoleClients) {
      try { client.send(JSON.stringify({ type: 'frame', frame: msg })); } catch (_) {}
    }
  });
  ws.on('close', () => { ws = null; for (const c of consoleClients) { try { c.send(JSON.stringify({ type: 'system', text: 'World socket closed', severity: 'system' })); } catch (_) {} } });
  ws.on('error', (err) => { for (const c of consoleClients) { try { c.send(JSON.stringify({ type: 'system', text: 'World socket error: ' + err.message, severity: 'error' })); } catch (_) {} } });
}

function waitOpen() {
  return new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.OPEN) return resolve();
    if (!ws) connect();
    const t = setTimeout(() => { readyResolvers = readyResolvers.filter(r => r !== onOpen); reject(new Error('Connection timeout')); }, 5000);
    const onOpen = () => { clearTimeout(t); resolve(); };
    readyResolvers.push(onOpen);
  });
}

// Commands the world server executes and then closes the socket on
// (no in-band reply is sent). For these, "no error frame within 500ms"
// counts as success.
const FIRE_AND_FORGET = /^\s*\.?\s*(broadcast\s|save\s*$|realm\s+motd\s)/i;

function executeOnce(command, opts = {}) {
  return new Promise(async (resolve, reject) => {
    const timeoutMs = opts.timeoutMs || 8000;
    const t = setTimeout(() => {
      if (pendingResolve) { const r = pendingResolve; pendingResolve = null; r({ type: 'timeout', text: 'Command timed out' }); }
      reject(new Error('Timeout'));
    }, timeoutMs);
    try {
      await waitOpen();
      // World server (per wwwroot/console.html) expects just { message: "..." }.
      // We also accept the longer { type: "command", message: "..." } for forward-compat.
      let payload;
      try { const j = JSON.parse(command); if (j && (j.message || j.type === 'command')) payload = JSON.stringify({ message: j.message || j.command || '' }); } catch (_) {}
      if (!payload) payload = JSON.stringify({ message: command.startsWith('.') ? command : '.' + command });
      const isFireAndForget = FIRE_AND_FORGET.test(command);
      let resolved = false;
      const finish = (ok, text, raw) => {
        if (resolved) return; resolved = true;
        clearTimeout(t);
        resolve({ ok, text, raw, sent: command });
      };
      pendingResolve = (frame) => {
        const ok = !frame || frame.type !== 'timeout';
        const text = frame && (frame.message || frame.text) || null;
        finish(ok, text, frame);
      };
      ws.send(payload);
      // For fire-and-forget commands, give the world a brief window to
      // emit any error frame; if none arrives, mark success.
      if (isFireAndForget) {
        setTimeout(() => finish(true, 'Command sent (no reply expected)', { fireAndForget: true }), 500);
      }
    } catch (e) { clearTimeout(t); reject(e); }
  });
}

function attach(client) {
  consoleClients.add(client);
  try { client.send(JSON.stringify({ type: 'system', text: `Console connected (bridge → ${endpoint})`, severity: 'system' })); } catch (_) {}
  try { client.send(JSON.stringify({ type: 'catalog', categories: CATEGORIES })); } catch (_) {}
  if (ws && ws.readyState === WebSocket.OPEN) {
    try { client.send(JSON.stringify({ type: 'system', text: 'World socket is up.', severity: 'system' })); } catch (_) {}
  } else { connect(); }
  client.on('message', (raw) => {
    let data; try { data = JSON.parse(raw.toString()); } catch { data = { type: 'command', message: raw.toString() }; }
    if (data.type === 'command' && typeof data.message === 'string') {
      const cmd = data.message.startsWith('.') ? data.message : '.' + data.message;
      try { client.send(JSON.stringify({ type: 'system', text: `> ${cmd}`, severity: 'info' })); } catch (_) {}
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        try { client.send(JSON.stringify({ type: 'system', text: 'World socket not connected.', severity: 'error' })); } catch (_) {}
        return;
      }
      ws.send(cmd);
    } else if (data.type === 'setEndpoint' && typeof data.url === 'string') {
      setEndpoint(data.url);
      try { client.send(JSON.stringify({ type: 'system', text: `Endpoint set to ${data.url}`, severity: 'system' })); } catch (_) {}
    }
  });
  client.on('close', () => consoleClients.delete(client));
}

function bootstrap() { connect(); }

function getOnline(realmId) {
  const key = realmId != null ? String(realmId) : 'default';
  return onlineByRealm.get(key) || [];
}

function setOnline(realmId, characters) {
  const key = realmId != null ? String(realmId) : 'default';
  onlineByRealm.set(key, Array.isArray(characters) ? characters : []);
}

function getAllOnline() {
  const out = [];
  for (const [realm, list] of onlineByRealm) for (const c of list) out.push({ realmId: realm, ...c });
  return out;
}

function getSession(clientId) {
  pruneSessions();
  return sessionByClientId.get(String(clientId)) || null;
}

function getSessions() {
  pruneSessions();
  return Array.from(sessionByClientId.values());
}

function findSessionsByIp(ip) {
  pruneSessions();
  const out = [];
  for (const s of sessionByClientId.values()) if (s.ip === ip) out.push(s);
  return out;
}

function findSessionsByName(name) {
  pruneSessions();
  const needle = String(name).toLowerCase();
  const out = [];
  for (const s of sessionByClientId.values())
    if (s.name && String(s.name).toLowerCase() === needle) out.push(s);
  return out;
}

module.exports = {
  bootstrap, attach, executeOnce, setEndpoint, getEndpoint,
  getOnline, setOnline, getAllOnline,
  getSession, getSessions, findSessionsByIp, findSessionsByName,
};
