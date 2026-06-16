// One-time migration / seed for the gamedata feature.
// Idempotent — safe to run on every server start.
const db = require('../../db');

const AUDIT_TABLE = 'gamedata_audit';

async function ensureAuditTable() {
  await db.query(db.auth(), `
    CREATE TABLE IF NOT EXISTS \`${AUDIT_TABLE}\` (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      user_id INT UNSIGNED NOT NULL,
      user_email VARCHAR(255) NOT NULL,
      table_key VARCHAR(64) NOT NULL,
      db_name VARCHAR(64) NOT NULL,
      table_name VARCHAR(128) NOT NULL,
      action ENUM('insert','update','delete') NOT NULL,
      row_pk VARCHAR(64) NOT NULL,
      before_json JSON NULL,
      after_json  JSON NULL,
      INDEX (ts), INDEX (user_id), INDEX (table_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function tableExistsInAuth(name) {
  const rows = await db.query(db.auth(),
    `SELECT COUNT(*) AS c FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`, [name]);
  return rows[0] && rows[0].c > 0;
}

async function ensurePermissions() {
  // We avoid the description column for compatibility with older schemas.
  const havePerm = await tableExistsInAuth('permission');
  const haveRole = await tableExistsInAuth('role');
  const haveRolePerm = await tableExistsInAuth('role_permission');
  if (!havePerm) return; // older manager — skip

  const perms = [
    { name: 'gamedata.read' },
    { name: 'gamedata.write' },
  ];
  for (const p of perms) {
    await db.query(db.auth(),
      `INSERT IGNORE INTO \`permission\` (name) VALUES (?)`, [p.name]);
  }

  if (!haveRole || !haveRolePerm) return;

  const readPerms = await db.query(db.auth(),
    `SELECT id, name FROM \`permission\` WHERE name IN ('gamedata.read', 'gamedata.write')`);
  const writeIds = readPerms.filter(p => p.name === 'gamedata.write').map(p => p.id);
  const readIds  = readPerms.filter(p => p.name === 'gamedata.read').map(p => p.id);
  const adminPerms = readPerms.map(p => p.id);

  const roleRows = await db.query(db.auth(),
    `SELECT id, name FROM \`role\` WHERE LOWER(name) IN ('admin','gm','mod')`);
  for (const role of roleRows) {
    const lower = (role.name || '').toLowerCase();
    const ids = lower === 'admin' ? adminPerms
              : lower === 'gm'    ? adminPerms
              :                    readIds; // mod: read only
    for (const permId of ids) {
      await db.query(db.auth(),
        `INSERT IGNORE INTO \`role_permission\` (roleId, permissionId) VALUES (?, ?)`,
        [role.id, permId]);
    }
  }
  // Mark unused
  void writeIds;
}

async function ensureAll() {
  await ensureAuditTable();
  await ensurePermissions();
}

module.exports = { ensureAll, ensureAuditTable, ensurePermissions };
