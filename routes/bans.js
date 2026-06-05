// Bans routes: list, ban, unban, check status.
const express = require('express');
const router = express.Router();
const { authenticateToken, requirePermission } = require('../middleware/auth');
const bans = require('../services/bans');
const accounts = require('./accounts');
const commandLog = require('../services/commandLog');
const db = require('../db');

router.get('/', authenticateToken, requirePermission('accounts.bans.view'), async (req, res, next) => {
  try {
    const { limit, offset, active } = req.query;
    const rows = await bans.listAll({ limit, offset, active: active === '1' || active === 'true' });
    res.json({ success: true, bans: rows });
  } catch (err) { next(err); }
});

router.get('/account/:id', authenticateToken, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid id' });
    const [active, history] = await Promise.all([
      bans.activeForAccount(id),
      bans.listForAccount(id)
    ]);
    res.json({ success: true, active, history, banned: !!active });
  } catch (err) { next(err); }
});

router.post('/account/:id', authenticateToken, requirePermission('accounts.bans.manage'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid id' });
    const { reason, endTime, email } = req.body || {};
    const result = await bans.ban({
      accountId: id,
      accountEmail: email,
      reason,
      endTime,
      executor: req.user
    });
    res.json({ success: result.ok, ...result });
  } catch (err) { next(err); }
});

router.delete('/account/:id', authenticateToken, requirePermission('accounts.bans.manage'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid id' });
    const { email } = req.body || {};
    const result = await bans.unban({
      accountId: id,
      accountEmail: email,
      executor: req.user
    });
    res.json({ success: result.ok, ...result });
  } catch (err) { next(err); }
});

module.exports = router;
