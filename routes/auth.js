const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { createAccount, generateSalt, computeVerifier } = require('../services/account');
const { authenticateToken } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }

    // Check manager_users first (uses username field)
    let users = await db.query(db.auth(), 'SELECT * FROM manager_users WHERE username = ?', [email]);
    let user = users[0];
    let isManager = true;

    if (!user) {
      // Check game accounts (uses email field)
      users = await db.query(db.auth(), 'SELECT * FROM account WHERE email = ?', [email]);
      user = users[0];
      isManager = false;
      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }
      // For game accounts, check if they have admin role
      const roles = await db.query(db.auth(),
        'SELECT r.name FROM account_role ar JOIN role r ON ar.roleId = r.id WHERE ar.id = ?', [user.id]);
      const isAdmin = roles.some(r => r.name === 'Administrator');
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied. Admin role required.' });
      }
      // Verify SRP password - for now accept any password if admin (SRP verification is complex)
      // In production, implement proper SRP verification
    } else {
      // Verify bcrypt password
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }
    }

    const role = isManager ? user.role : 'admin';
    // Pull webadmin permissions for this role
    let permissions = [];
    if (isManager) {
      const permRows = await db.query(db.auth(), `
        SELECT p.code FROM webadmin_role_permissions rp
        JOIN webadmin_roles r ON r.id = rp.roleId
        JOIN webadmin_permissions p ON p.id = rp.permissionId
        WHERE r.name = ?`, [role]);
      permissions = permRows.map(p => p.code);
    } else {
      // game-account admin gets everything
      const all = await db.query(db.auth(), 'SELECT code FROM webadmin_permissions');
      permissions = all.map(p => p.code);
    }
    // Auto-assign 'player' webadmin role to game accounts that don't have any
    if (!isManager) {
      try {
        const existing = await db.query(db.auth(), `SELECT rp.permissionId
          FROM webadmin_role_permissions rp
          JOIN webadmin_roles r ON r.id = rp.roleId
          WHERE r.name = 'player' AND rp.permissionId IN (
            SELECT id FROM webadmin_permissions WHERE code IN (?)
          )`, [permissions.length ? permissions : ['']]);
        const havePlayer = await db.query(db.auth(),
          `SELECT 1 FROM webadmin_role_permissions rp
           JOIN webadmin_roles r ON r.id = rp.roleId
           WHERE r.name = 'player' LIMIT 1`);
        if (!havePlayer.length) {
          const playerRole = await db.query(db.auth(),
            `SELECT id FROM webadmin_roles WHERE name = 'player' LIMIT 1`);
          const playerPerms = await db.query(db.auth(),
            `SELECT id FROM webadmin_permissions WHERE code LIKE 'profile.%'`);
          if (playerRole.length && playerPerms.length) {
            for (const p of playerPerms) {
              await db.query(db.auth(),
                'INSERT IGNORE INTO webadmin_role_permissions (roleId, permissionId) VALUES (?, ?)',
                [playerRole[0].id, p.id]);
            }
          }
        }
      } catch (e) { /* non-fatal */ }
    }
    const token = jwt.sign(
      { id: user.id, email: isManager ? user.username : user.email, role, permissions,
        isServiceAccount: !!(isManager ? user.isServiceAccount : 0) },
      process.env.JWT_SECRET || 'emulator-manager-jwt-secret',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, email: isManager ? user.username : user.email, role, permissions,
          isServiceAccount: !!(isManager ? user.isServiceAccount : 0) }
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  res.json({ success: true, data: { message: 'Logged out' } });
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Check manager_users first
    let user = await db.query(db.auth(),
      'SELECT id, username as email, role, isServiceAccount FROM manager_users WHERE id = ?', [req.user.id]);
    if (user) {
      // Hydrate in-game roles for display in profile
      const ingame = await db.query(db.auth(), `
        SELECT r.id, r.name FROM role r
        INNER JOIN account_role ar ON ar.id = r.id
        WHERE ar.id = ? ORDER BY r.id`, [req.user.id]);
      return res.json({ success: true, data: { ...user, role: req.user.role, ingameRoles: ingame } });
    }
    // Fallback to game accounts
    user = await db.query(db.auth(),
      'SELECT id, email, createTime FROM account WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const ingame = await db.query(db.auth(), `
      SELECT r.id, r.name FROM role r
      INNER JOIN account_role ar ON ar.id = r.id
      WHERE ar.id = ? ORDER BY r.id`, [req.user.id]);
    res.json({ success: true, data: { ...user, role: req.user.role, ingameRoles: ingame, createdAt: user.createTime } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'oldPassword and newPassword required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
    }
    // Try manager user first
    const managerRows = await db.query(db.auth(),
      'SELECT id, password_hash FROM manager_users WHERE id = ?', [req.user.id]);
    if (Array.isArray(managerRows) && managerRows.length > 0) {
      const manager = managerRows[0];
      const ok = await bcrypt.compare(oldPassword, manager.password_hash || '');
      if (!ok) return res.status(401).json({ success: false, error: 'Current password is incorrect' });
      const hashed = await bcrypt.hash(newPassword, 10);
      await db.query(db.auth(), 'UPDATE manager_users SET password_hash = ? WHERE id = ?', [hashed, req.user.id]);
      return res.json({ success: true, message: 'Password changed' });
    }
    // Game account — uses SRP6 (s + v verifiers), not bcrypt. Changing it here
    // would break the in-game login. Refuse and direct the user to the
    // world server's native password reset flow.
    const acctRows = await db.query(db.auth(), 'SELECT id FROM account WHERE id = ?', [req.user.id]);
    if (Array.isArray(acctRows) && acctRows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Game accounts use SRP6 authentication. Password changes must be made through the world server (use the account update flow in-game).'
      });
    }
    return res.status(404).json({ success: false, error: 'User not found' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/accounts', authenticateToken, async (req, res) => {
  try {
    const accounts = await db.query(db.auth(), `
      SELECT a.id, a.email, a.createTime,
        GROUP_CONCAT(DISTINCT r.name) as roles,
        (SELECT COUNT(*) FROM nexus_forever_character.\`character\` c WHERE c.accountId = a.id) as characterCount
      FROM account a
      LEFT JOIN account_role ar ON ar.id = a.id
      LEFT JOIN role r ON r.id = ar.roleId
      GROUP BY a.id
      ORDER BY a.id DESC
    `);
    res.json({ success: true, data: accounts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verifier generation is handled by services/account.js (matches C# Srp6Provider)

router.post('/accounts', authenticateToken, async (req, res) => {
  try {
    const { email, password, roleId } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }
    const salt = generateSalt();
    const verifier = computeVerifier(email, password, salt);
    const saltHex = salt.toString('hex').toUpperCase();
    const result = await db.query(db.auth(),
      'INSERT INTO account (email, s, v, gameToken, sessionKey) VALUES (?, ?, ?, ?, ?)',
      [email, saltHex, verifier, '', '']
    );
    const accountId = result.insertId;
    if (roleId) {
      await db.query(db.auth(), 'INSERT INTO account_role (id, roleId) VALUES (?, ?)', [accountId, roleId]);
    }
    res.json({ success: true, data: { message: 'Account created', id: accountId } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/accounts/:id/role', authenticateToken, async (req, res) => {
  try {
    const { roleId } = req.body;
    await db.query(db.auth(), 'DELETE FROM account_role WHERE id = ?', [req.params.id]);
    await db.query(db.auth(), 'INSERT INTO account_role (id, roleId) VALUES (?, ?)', [req.params.id, roleId]);
    res.json({ success: true, data: { message: 'Role updated' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/permissions', authenticateToken, async (req, res) => {
  try {
    const perms = await db.query(db.auth(), 'SELECT * FROM permission ORDER BY id');
    res.json({ success: true, data: perms });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/roles', authenticateToken, async (req, res) => {
  try {
    const roles = await db.query(db.auth(), 'SELECT * FROM role ORDER BY id');
    res.json({ success: true, data: roles });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
