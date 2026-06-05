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
      const realm = msg.realmId != null ? String(msg.realmId) : 'default';
      onlineByRealm.set(realm, Array.isArray(msg.characters) ? msg.characters : []);
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

function executeOnce(command, opts = {}) {
  return new Promise(async (resolve, reject) => {
    const t = setTimeout(() => { if (pendingResolve) { const r = pendingResolve; pendingResolve = null; r({ type: 'timeout', text: 'Command timed out' }); } reject(new Error('Timeout')); }, opts.timeoutMs || 8000);
    try {
      await waitOpen();
      pendingResolve = (frame) => { clearTimeout(t); resolve({ reply: frame, sent: command }); };
      // World server expects JSON envelope: { type: "command", message: "..." }
      const payload = JSON.stringify({ type: 'command', message: command });
      ws.send(payload);
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

module.exports = { bootstrap, attach, executeOnce, setEndpoint, getEndpoint, getOnline, setOnline };
