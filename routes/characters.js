const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { level, name, accountId, online } = req.query;
    let sql = `
      SELECT c.id, c.accountId, c.name, c.level, c.race, c.class, c.sex,
        c.factionId, c.createTime, c.lastOnline, c.isOnline,
        a.email as accountEmail
      FROM nexus_forever_character.\`character\` c
      JOIN nexus_forever_auth.account a ON a.id = c.accountId
      WHERE 1=1
    `;
    const params = [];
    if (level) { sql += ' AND c.level = ?'; params.push(parseInt(level)); }
    if (name) { sql += ' AND c.name LIKE ?'; params.push(`%${name}%`); }
    if (accountId) { sql += ' AND c.accountId = ?'; params.push(parseInt(accountId)); }
    if (online === 'true') { sql += ' AND c.isOnline = 1'; }
    sql += ' ORDER BY c.lastOnline DESC LIMIT 200';

    const chars = await db.query(db.character(), sql, params);
    res.json({ success: true, data: chars });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const chars = await db.query(db.character(),
      `SELECT c.*, a.email as accountEmail
       FROM \`character\` c
       JOIN nexus_forever_auth.account a ON a.id = c.accountId
       WHERE c.id = ?`, [req.params.id]);
    if (chars.length === 0) return res.status(404).json({ success: false, error: 'Character not found' });
    res.json({ success: true, data: chars[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const allowed = ['name', 'level', 'race', 'class', 'factionId', 'title'];
    const updates = [];
    const params = [];
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });
    params.push(req.params.id);
    await db.query(db.character(), `UPDATE \`character\` SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, data: { message: 'Character updated' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await db.query(db.character(), 'DELETE FROM `character` WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: { message: 'Character deleted' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
