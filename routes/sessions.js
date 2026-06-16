const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const wsBridge = require('../backend/services/worldCommandSocket');

const CHUNK = 500;
function chunk(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i += CHUNK) out.push(arr.slice(i, i + CHUNK));
  return out;
}
function placeholders(n) { return new Array(n).fill('?').join(','); }

async function fetchCharactersByNames(names) {
  if (!names.length) return [];
  const rows = [];
  for (const part of chunk(names)) {
    const r = await db.query(db.character(),
      `SELECT c.id, c.name, c.accountId, c.level, c.race, c.class, c.lastOnline, a.email AS accountEmail
       FROM \`character\` c
       JOIN nexus_forever_auth.account a ON a.id = c.accountId
       WHERE c.name IN (${placeholders(part.length)})`, part);
    rows.push(...r);
  }
  return rows;
}

async function fetchAccountsByIds(ids) {
  if (!ids.length) return [];
  const rows = [];
  for (const part of chunk(ids)) {
    const r = await db.query(db.auth(),
      `SELECT id, email FROM account WHERE id IN (${placeholders(part.length)})`, part);
    rows.push(...r);
  }
  return rows;
}

router.get('/', authenticateToken, requirePermission('sessions.view'), async (req, res) => {
  try {
    const online = wsBridge.getAllOnline();
    const sessions = wsBridge.getSessions();

    const sessByName = new Map();
    for (const s of sessions) {
      if (!s.name) continue;
      sessByName.set(String(s.name).toLowerCase(), s);
    }

    const byName = new Map();
    const byId = new Map();
    const namesToFetch = [];
    const idsToFetch = new Set();

    for (const c of online) {
      const name = c.name || c.CharacterName || null;
      const accId = c.accountId != null ? Number(c.accountId) : null;
      if (accId != null) idsToFetch.add(accId);
      else if (name) namesToFetch.push(name);
    }

    const [chars, accts] = await Promise.all([
      fetchCharactersByNames(namesToFetch),
      fetchAccountsByIds([...idsToFetch]),
    ]);
    for (const r of chars) byName.set(String(r.name).toLowerCase(), r);
    for (const a of accts) byId.set(Number(a.id), a);

    const out = online.map((c) => {
      const name = c.name || c.CharacterName || null;
      const sess = name ? sessByName.get(String(name).toLowerCase()) : null;
      const accId = c.accountId != null ? Number(c.accountId) : null;
      const acct = accId != null ? byId.get(accId) : (name ? byName.get(String(name).toLowerCase()) : null);
      return {
        realmId: c.realmId,
        name,
        level: c.level ?? acct?.level ?? null,
        race: c.race ?? null,
        class: c.class ?? null,
        accountId: acct?.accountId ?? acct?.id ?? accId,
        accountEmail: acct?.email ?? acct?.accountEmail ?? null,
        lastOnline: acct?.lastOnline ?? null,
        session: sess ? { clientId: sess.clientId, ip: sess.ip || null, since: sess.since || null } : null,
      };
    });

    res.json({ success: true, data: { count: out.length, online: out }, note: 'Live session metadata depends on the world server pushing { type:"session", clientId, name, ip, since } frames. Until then, the session column is empty.' });
  } catch (err) {
    console.error('GET /api/sessions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/lookup', authenticateToken, requirePermission('sessions.view'), async (req, res) => {
  try {
    const { clientId, ip, name } = req.query;
    if (!clientId && !ip && !name) {
      return res.status(400).json({ success: false, error: 'Provide at least one of: clientId, ip, name' });
    }

    let sessionMatches = [];
    if (clientId) {
      const s = wsBridge.getSession(String(clientId));
      if (s) sessionMatches = [s];
    }
    if (!sessionMatches.length && ip) sessionMatches = wsBridge.findSessionsByIp(String(ip));
    if (!sessionMatches.length && name) sessionMatches = wsBridge.findSessionsByName(String(name));

    const namesFromSessions = [...new Set(sessionMatches.map(s => s.name).filter(Boolean))];
    if (name && !namesFromSessions.length) namesFromSessions.push(String(name));

    const chars = await fetchCharactersByNames(namesFromSessions);

    res.json({
      success: true,
      data: {
        sessions: sessionMatches.map(s => ({
          clientId: s.clientId, name: s.name || null, ip: s.ip || null,
          realmId: s.realmId || null, since: s.since || null,
          lastSeen: s.lastSeen || null,
        })),
        characters: chars.map(c => ({ character: c })),
        note: 'Sessions are cached for 30 min and only populated when the world server pushes session frames. Character matches are looked up by name in the world DB.',
      },
    });
  } catch (err) {
    console.error('GET /api/sessions/lookup error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
