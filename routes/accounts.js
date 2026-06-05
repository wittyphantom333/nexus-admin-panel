const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { createAccount } = require('../services/account');

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    const result = await createAccount({ email, password, role: role || 'User' });
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.message.includes('already exists')) {
      return res.status(409).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const accounts = await db.query(db.auth(), `
      SELECT a.id, a.email, a.createTime,
        (SELECT COUNT(*) FROM nexus_forever_character.\`character\` c WHERE c.accountId = a.id) as characterCount,
        (SELECT GROUP_CONCAT(DISTINCT r.name) FROM account_role ar JOIN role r ON r.id = ar.roleId WHERE ar.id = a.id) as roles
      FROM account a
      ORDER BY a.id DESC
    `);
    res.json({ success: true, data: accounts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const accounts = await db.query(db.auth(), 'SELECT * FROM account WHERE id = ?', [req.params.id]);
    if (accounts.length === 0) return res.status(404).json({ success: false, error: 'Account not found' });

    const characters = await db.query(db.character(),
      'SELECT id, name, level, race, class, createTime, lastOnline FROM `character` WHERE accountId = ?',
      [req.params.id]);

    const roles = await db.query(db.auth(),
      'SELECT r.* FROM account_role ar JOIN role r ON r.id = ar.roleId WHERE ar.id = ?',
      [req.params.id]);

    res.json({ success: true, data: { ...accounts[0], characters, roles } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;
    if (email) {
      await db.query(db.auth(), 'UPDATE account SET email = ? WHERE id = ?', [email, req.params.id]);
    }
    res.json({ success: true, data: { message: 'Account updated' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await db.query(db.auth(), 'DELETE FROM account_role WHERE id = ?', [req.params.id]);
    await db.query(db.auth(), 'DELETE FROM account WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: { message: 'Account deleted' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/characters', authenticateToken, async (req, res) => {
  try {
    const chars = await db.query(db.character(),
      'SELECT * FROM `character` WHERE accountId = ?', [req.params.id]);
    res.json({ success: true, data: chars });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
