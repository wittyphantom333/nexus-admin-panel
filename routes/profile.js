// Self-service profile for any logged-in user.
// Works for players and admins alike: see your characters, change your
// own email + password, but never touch another account.
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function ownId(req) {
  // Both webadmin users and the JWT middleware put the id here.
  return req.user?.id || req.user?.userId || req.user?.sub;
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const id = ownId(req);
    if (!id) return res.status(401).json({ success: false, error: 'Unauthenticated' });
    const rows = await db.query(db.auth(),
      'SELECT id, username, role, isServiceAccount, createTime FROM manager_users WHERE id = ?',
      [id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }
    res.json({ success: true, account: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/', authenticateToken, async (req, res) => {
  try {
    const id = ownId(req);
    if (!id) return res.status(401).json({ success: false, error: 'Unauthenticated' });

    // Service accounts cannot be edited through this endpoint.
    const rows = await db.query(db.auth(),
      'SELECT id, isServiceAccount FROM manager_users WHERE id = ?',
      [id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }
    if (rows[0].isServiceAccount) {
      return res.status(403).json({ success: false, error: 'Service accounts cannot be edited via the profile page' });
    }

    const { username, password } = req.body || {};
    const updates = [];
    const params = [];
    if (username && typeof username === 'string' && username.trim()) {
      updates.push('username = ?');
      params.push(username.trim());
    }
    if (password && typeof password === 'string' && password.length >= 4) {
      const hash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      params.push(hash);
    }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Nothing to update' });
    }
    params.push(id);
    await db.query(db.auth(),
      `UPDATE manager_users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/characters', authenticateToken, async (req, res) => {
  try {
    const id = ownId(req);
    if (!id) return res.status(401).json({ success: false, error: 'Unauthenticated' });

    // Map webadmin manager_users.id to auth.account by username.
    const acct = await db.query(db.auth(),
      'SELECT username FROM manager_users WHERE id = ?',
      [id]
    );
    if (!acct || acct.length === 0) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    const accountRows = await db.query(db.auth(),
      'SELECT id FROM account WHERE email = ?',
      [acct[0].username]
    );
    if (!accountRows || accountRows.length === 0) {
      return res.json({ success: true, characters: [] });
    }
    const accountId = accountRows[0].id;

    const characters = await db.query(db.world(),
      `SELECT c.id, c.name, c.race, c.sex, c.class, c.level, c.worldZoneId, c.mapZoneId
       FROM character c
       WHERE c.accountId = ?
       ORDER BY c.name`,
      [accountId]
    );
    res.json({ success: true, characters });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
