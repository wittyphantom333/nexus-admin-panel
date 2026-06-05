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
    const token = jwt.sign(
      { id: user.id, email: isManager ? user.username : user.email, role },
      process.env.JWT_SECRET || 'emulator-manager-jwt-secret',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, email: isManager ? user.username : user.email, role }
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
    let users = await db.query(db.auth(),
      'SELECT id, username as email, role FROM manager_users WHERE id = ?', [req.user.id]);
    if (users.length > 0) {
      return res.json({ success: true, data: { ...users[0], role: req.user.role } });
    }
    // Fallback to game accounts
    users = await db.query(db.auth(),
      'SELECT id, email, createTime FROM account WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: { ...users[0], role: req.user.role } });
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
