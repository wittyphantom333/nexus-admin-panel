// Command log service. Records every command executed from the admin panel
// (and any other source) to the command_log table for audit/history.
const db = require('../db');

const pool = () => db.manager();

function detectCategory(command) {
  const c = (command || '').trim().toLowerCase();
  if (!c) return null;
  const head = c.split(/\s+/)[0].replace(/^!/, '');
  if (['account','character','item','currency','quest','xp','level','help'].includes(head)) return head;
  if (['announce','broadcast','server','world','ban','unban','kick','teleport','summon'].includes(head)) return head;
  return 'other';
}

async function record({ account, command, status, replyText, replyRaw, durationMs, source = 'panel', ip = null }) {
  try {
    const sql = `INSERT INTO command_log
      (account_id, username, command, category, status, reply_text, reply_raw, duration_ms, source, ip)
      VALUES (?,?,?,?,?,?,?,?,?,?)`;
    const params = [
      account && account.id != null ? account.id : null,
      account && account.username ? account.username : (account && account.email ? account.email : null),
      (command || '').substring(0, 255),
      detectCategory(command),
      ['ok','fail','info'].includes(status) ? status : 'info',
      replyText ? String(replyText).substring(0, 65000) : null,
      replyRaw ? JSON.stringify(replyRaw) : null,
      durationMs != null ? Math.min(Math.max(parseInt(durationMs) || 0, 0), 3600000) : null,
      String(source).substring(0, 32),
      ip ? String(ip).substring(0, 45) : null,
    ];
    await db.query(pool(), sql, params);
  } catch (e) {
    console.error('[commandLog] record failed:', e.message);
  }
}

async function list({ limit = 100, offset = 0, q = '', status = '', account = '', category = '' } = {}) {
  const where = [];
  const params = [];
  if (q)        { where.push('command LIKE ?');       params.push('%' + q + '%'); }
  if (status)   { where.push('status = ?');           params.push(status); }
  if (account)  { where.push('username LIKE ?');      params.push('%' + account + '%'); }
  if (category) { where.push('category = ?');         params.push(category); }
  const wsql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
  const lim = Math.max(1, Math.min(parseInt(limit) || 100, 500));
  const off = Math.max(0, parseInt(offset) || 0);
  const rows = await db.query(pool(),
    `SELECT id, ts, account_id, username, command, category, status, reply_text, duration_ms, source, ip
     FROM command_log ${wsql} ORDER BY id DESC LIMIT ${lim} OFFSET ${off}`, params);
  const cnt = await db.query(pool(), `SELECT COUNT(*) AS n FROM command_log ${wsql}`, params);
  return { rows, total: cnt[0].n };
}

async function getById(id) {
  const rows = await db.query(pool(), `SELECT * FROM command_log WHERE id = ?`, [id]);
  return rows[0] || null;
}

module.exports = { record, list, getById, detectCategory };
