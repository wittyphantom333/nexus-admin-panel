// Bans service. Persists to account_suspension (matches NexusForever auth DB
// schema) and mirrors the state to the world server via !ban / !unban commands.
const db = require('../db');
const commandLog = require('./commandLog');
const wsBridge = require('../backend/services/worldCommandSocket');

const pool = () => db.auth();

function toMysqlDateTime(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 19).replace('T', ' ');
}

function isActive(row) {
  if (!row) return false;
  if (!row.endTime) return true; // null endTime = permanent
  return new Date(row.endTime).getTime() > Date.now();
}

async function activeForAccount(accountId) {
  const [rows] = await db.query(pool(),
    'SELECT * FROM account_suspension WHERE id = ? AND (endTime IS NULL OR endTime > NOW()) ORDER BY startTime DESC LIMIT 1',
    [accountId]);
  return rows && rows[0] ? rows[0] : null;
}

async function listForAccount(accountId) {
  const [rows] = await db.query(pool(),
    'SELECT * FROM account_suspension WHERE id = ? ORDER BY startTime DESC',
    [accountId]);
  return Array.isArray(rows) ? rows : [];
}

async function listAll({ limit = 100, offset = 0, active = false } = {}) {
  const where = [];
  const params = [];
  if (active) where.push('(endTime IS NULL OR endTime > NOW())');
  const sql = `SELECT s.*, a.email
               FROM account_suspension s
               LEFT JOIN account a ON a.id = s.id
               ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY s.startTime DESC
               LIMIT ? OFFSET ?`;
  params.push(Math.min(parseInt(limit) || 100, 500), parseInt(offset) || 0);
  const [rows] = await db.query(pool(), sql, params);
  return Array.isArray(rows) ? rows : [];
}

async function ban({ accountId, accountEmail, reason, endTime, executor }) {
  const r = String(reason || '').trim();
  if (!r) throw new Error('reason is required');
  // 1. Persist locally
  await db.query(pool(),
    'INSERT INTO account_suspension (id, startTime, endTime, Reason) VALUES (?, NOW(), ?, ?)',
    [accountId, toMysqlDateTime(endTime), r]);

  // 2. Mirror to world server
  // Command: !ban account player [reason] [bannedTill]
  // The world server expects YYYY-MM-DD HH:MM:SS for bannedTill, or empty for permanent.
  const till = endTime ? toMysqlDateTime(endTime) : '';
  const command = `!ban account player "${r}" ${till}`.trim();

  const start = Date.now();
  let result, status = 'ok', replyText = '', error = null;
  try {
    result = await wsBridge.executeOnce(command, { timeoutMs: 6000 });
    const r2 = result && (result.text || result.message || result.raw);
    replyText = typeof r2 === 'string' ? r2 : (r2 ? JSON.stringify(r2) : '');
    if (result && result.error) { status = 'fail'; replyText = result.error; }
  } catch (e) {
    status = 'fail';
    error = e.message;
    replyText = e.message;
  }

  await commandLog.record({
    account: executor,
    command,
    status,
    replyText,
    replyRaw: result || null,
    durationMs: Date.now() - start,
    source: 'panel.ban'
  });

  return { ok: status === 'ok', status, replyText, error, command };
}

async function unban({ accountId, accountEmail, executor }) {
  // 1. Close any open suspensions in DB
  await db.query(pool(),
    'UPDATE account_suspension SET endTime = NOW() WHERE id = ? AND (endTime IS NULL OR endTime > NOW())',
    [accountId]);

  // 2. Mirror to world server
  // Syntax from the C# command: !unban account player [email]
  const command = `!unban account player ${accountEmail}`.trim();
  const start = Date.now();
  let result, status = 'ok', replyText = '', error = null;
  try {
    result = await wsBridge.executeOnce(command, { timeoutMs: 6000 });
    const r2 = result && (result.text || result.message || result.raw);
    replyText = typeof r2 === 'string' ? r2 : (r2 ? JSON.stringify(r2) : '');
    if (result && result.error) { status = 'fail'; replyText = result.error; }
  } catch (e) {
    status = 'fail';
    error = e.message;
    replyText = e.message;
  }

  await commandLog.record({
    account: executor,
    command,
    status,
    replyText,
    replyRaw: result || null,
    durationMs: Date.now() - start,
    source: 'panel.unban'
  });

  return { ok: status === 'ok', status, replyText, error, command };
}

module.exports = {
  activeForAccount,
  listForAccount,
  listAll,
  ban,
  unban,
  isActive
};
