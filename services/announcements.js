// Announcements service: every broadcast sent from the admin panel is stored
// here for history/auditing. Tier is High|Medium|Low (0/1/2 in C#).
const db = require('../db');
const pool = () => db.manager();

const TIER_NAME = { 0: 'High', 1: 'Medium', 2: 'Low' };
const TIER_VALUE = { High: 0, Medium: 1, Low: 2, high: 0, medium: 1, low: 2, '0': 0, '1': 1, '2': 2 };

function normalizeTier(t) {
  if (t == null) return 1; // default Medium
  if (typeof t === 'number') return [0,1,2].includes(t) ? t : 1;
  const v = TIER_VALUE[String(t)];
  return v != null ? v : 1;
}

function tierName(t) { return TIER_NAME[normalizeTier(t)] || 'Medium'; }

async function record({ account, tier, message, replyText, status, source = 'panel' }) {
  try {
    const sql = `INSERT INTO announcements
      (account_id, username, tier, tier_name, message, status, reply_text, source)
      VALUES (?,?,?,?,?,?,?,?)`;
    const params = [
      account && account.id != null ? account.id : null,
      account && (account.username || account.email) ? (account.username || account.email) : null,
      normalizeTier(tier),
      tierName(tier),
      String(message || '').substring(0, 4000),
      ['ok','fail','info'].includes(status) ? status : 'info',
      replyText ? String(replyText).substring(0, 4000) : null,
      String(source).substring(0, 32),
    ];
    await db.query(pool(), sql, params);
  } catch (e) {
    console.error('[announcements] record failed:', e.message);
  }
}

async function list({ limit = 50, offset = 0, q = '', tier = '', status = '' } = {}) {
  const where = [];
  const params = [];
  if (q)       { where.push('message LIKE ?'); params.push('%' + q + '%'); }
  if (status)  { where.push('status = ?');     params.push(status); }
  if (tier) {
    if (TIER_VALUE[tier] != null) { where.push('tier = ?'); params.push(TIER_VALUE[tier]); }
    else if (tier.toLowerCase() === 'high')   { where.push('tier = 0'); }
    else if (tier.toLowerCase() === 'medium') { where.push('tier = 1'); }
    else if (tier.toLowerCase() === 'low')    { where.push('tier = 2'); }
  }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const lim = Math.min(Math.max(parseInt(limit) || 50, 1), 500);
  const off = Math.max(parseInt(offset) || 0, 0);
  const rows = await db.query(pool(),
    `SELECT id, account_id, username, tier, tier_name, message, status, reply_text, source, created_at
     FROM announcements ${w} ORDER BY id DESC LIMIT ${lim} OFFSET ${off}`, params);
  const totalRows = await db.query(pool(), `SELECT COUNT(*) AS c FROM announcements ${w}`, params);
  return { rows, total: totalRows[0]?.c || 0 };
}

async function get(id) {
  const rows = await db.query(pool(), 'SELECT * FROM announcements WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

module.exports = { record, list, get, normalizeTier, tierName };
