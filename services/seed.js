// Idempotent schema + data seed for the web admin panel.
// Runs on server boot. Safe to re-run; everything is CREATE IF NOT EXISTS
// or "INSERT IGNORE" with stable primary keys.
const db = require('../db');
const bcrypt = require('bcryptjs');

// Webadmin permission codes (the matrix)
const PERMISSIONS = [
  // Account management
  { code: 'accounts.view',     desc: 'View accounts' },
  { code: 'accounts.create',   desc: 'Create accounts' },
  { code: 'accounts.edit',     desc: 'Edit accounts' },
  { code: 'accounts.delete',   desc: 'Delete accounts' },
  { code: 'accounts.ban',      desc: 'Ban / unban accounts' },
  { code: 'accounts.rbac',     desc: 'Assign roles to accounts' },
  // Characters
  { code: 'characters.view',   desc: 'View characters' },
  { code: 'characters.edit',   desc: 'Edit characters' },
  { code: 'characters.delete', desc: 'Delete characters' },
  { code: 'characters.actions', desc: 'Run in-game character actions (XP, items, etc.)' },
  // Servers
  { code: 'servers.view',      desc: 'View server status' },
  { code: 'servers.control',   desc: 'Start / stop / restart servers' },
  { code: 'servers.console',   desc: 'View server console' },
  // World DB
  { code: 'worlddb.view',      desc: 'View WorldDatabase page' },
  { code: 'worlddb.clone',     desc: 'Clone WorldDatabase repo' },
  { code: 'worlddb.pull',      desc: 'Pull WorldDatabase updates' },
  { code: 'worlddb.apply',     desc: 'Apply WorldDatabase SQL' },
  // Announcements
  { code: 'announcements.view',    desc: 'View announcements' },
  { code: 'announcements.broadcast', desc: 'Send global broadcast' },
  // Logs
  { code: 'logs.view',         desc: 'View command log' },
  // RBAC management
  { code: 'rbac.view',         desc: 'View roles & permissions' },
  { code: 'rbac.manage',       desc: 'Edit roles & permissions' },
  // One-shot commands
  { code: 'commands.exec',     desc: 'Run ad-hoc in-game commands' },
  // Server config
  { code: 'servers.config',    desc: 'Edit server config files' },
];

// Role permission matrix (only the named codes per role)
const ROLE_PERMS = {
  admin: PERMISSIONS.map(p => p.code), // everything
  operator: [
    'accounts.view', 'accounts.create', 'accounts.edit', 'accounts.ban',
    'characters.view', 'characters.edit', 'characters.actions',
    'servers.view', 'servers.control', 'servers.console', 'servers.config',
    'worlddb.view', 'worlddb.clone', 'worlddb.pull', 'worlddb.apply',
    'announcements.view', 'announcements.broadcast',
    'commands.exec',
    'logs.view',
  ],
  moderator: [
    'accounts.view', 'accounts.ban',
    'characters.view', 'characters.edit', 'characters.actions',
    'servers.view', 'servers.console',
    'announcements.view',
    'commands.exec',
    'logs.view',
  ],
  viewer: [
    'accounts.view',
    'characters.view',
    'servers.view', 'servers.console',
    'worlddb.view',
    'announcements.view',
    'logs.view',
  ],
};

async function ensureWebAdminSchema() {
  const auth = db.auth();

  await db.query(auth, `
    CREATE TABLE IF NOT EXISTS webadmin_roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(64) NOT NULL UNIQUE,
      description VARCHAR(255) DEFAULT NULL,
      isSystem TINYINT(1) NOT NULL DEFAULT 0,
      createTime DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await db.query(auth, `
    CREATE TABLE IF NOT EXISTS webadmin_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(64) NOT NULL UNIQUE,
      description VARCHAR(255) DEFAULT NULL
    ) ENGINE=InnoDB
  `);

  await db.query(auth, `
    CREATE TABLE IF NOT EXISTS webadmin_role_permissions (
      roleId INT NOT NULL,
      permissionId INT NOT NULL,
      PRIMARY KEY (roleId, permissionId),
      FOREIGN KEY (roleId) REFERENCES webadmin_roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permissionId) REFERENCES webadmin_permissions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  // Seed default roles (idempotent via INSERT IGNORE on the unique name)
  const defaults = [
    { name: 'admin',     description: 'Full access to every feature',       isSystem: 1 },
    { name: 'operator',  description: 'Server ops: accounts, characters, services', isSystem: 1 },
    { name: 'moderator', description: 'Limited moderation: bans, character edits',   isSystem: 1 },
    { name: 'viewer',    description: 'Read-only access to most pages',             isSystem: 1 },
  ];
  for (const r of defaults) {
    await db.query(auth,
      'INSERT IGNORE INTO webadmin_roles (name, description, isSystem) VALUES (?, ?, ?)',
      [r.name, r.description, r.isSystem]
    );
  }

  // Seed permissions (idempotent)
  for (const p of PERMISSIONS) {
    await db.query(auth,
      'INSERT IGNORE INTO webadmin_permissions (code, description) VALUES (?, ?)',
      [p.code, p.description]
    );
  }

  // Seed role-permission matrix (idempotent; uses INSERT IGNORE on PK)
  const [roleRows] = await db.query(auth, 'SELECT id, name FROM webadmin_roles');
  const [permRows] = await db.query(auth, 'SELECT id, code FROM webadmin_permissions');
  const roleByName = Object.fromEntries(roleRows.map(r => [r.name, r.id]));
  const permByCode = Object.fromEntries(permRows.map(p => [p.code, p.id]));
  for (const [roleName, codes] of Object.entries(ROLE_PERMS)) {
    const rid = roleByName[roleName];
    if (!rid) continue;
    for (const code of codes) {
      const pid = permByCode[code];
      if (!pid) continue;
      await db.query(auth,
        'INSERT IGNORE INTO webadmin_role_permissions (roleId, permissionId) VALUES (?, ?)',
        [rid, pid]
      );
    }
  }
}

async function ensureManagerUsers() {
  await db.query(db.auth(), `
    CREATE TABLE IF NOT EXISTS manager_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(128) NOT NULL UNIQUE,
      password_hash VARCHAR(256) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'viewer',
      createTime DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const users = await db.query(db.auth(), 'SELECT COUNT(*) as count FROM manager_users');
  if (users[0].count === 0) {
    const hash = await bcrypt.hash('admin', 10);
    await db.query(db.auth(),
      'INSERT INTO manager_users (username, password_hash, role) VALUES (?, ?, ?)',
      ['admin', hash, 'admin']
    );
    console.log('Seeded admin user (admin/admin)');
  }
}

async function seed() {
  try {
    await ensureWebAdminSchema();
    await ensureManagerUsers();
    console.log('Web admin schema ready.');
  } catch (err) {
    console.error('Seed error:', err.message);
  }
}

module.exports = seed();
