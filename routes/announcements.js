// Announcements routes: list history + send a broadcast (executes !broadcast message
// through the world server WS bridge and records the result).
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');
const announcements = require('../services/announcements');
const commandLog = require('../services/commandLog');
const wsBridge = require('../backend/services/worldCommandSocket');

router.get('/', authenticateToken, requirePermission('announcements.view'), async (req, res, next) => {
  try {
    const { limit, offset, q, tier, status } = req.query;
    const data = await announcements.list({ limit, offset, q, tier, status });
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const row = await announcements.get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, row });
  } catch (err) { next(err); }
});

router.post('/', authenticateToken, requirePermission('announcements.broadcast'), async (req, res, next) => {
  try {
    const { tier, message } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }
    const t = announcements.normalizeTier(tier);
    const command = `!broadcast message ${t} ${String(message).trim()}`;
    let result, status = 'ok', replyText = '';
    try {
      result = await wsBridge.executeOnce(command, { timeoutMs: 5000 });
      const r = result && (result.text || result.message || result.raw);
      replyText = typeof r === 'string' ? r : (r ? JSON.stringify(r) : '');
      if (result && result.error) { status = 'fail'; replyText = result.error; }
    } catch (e) {
      status = 'fail';
      replyText = e.message || 'Unknown error';
    }
    await announcements.record({
      account: req.user, tier: t, message: String(message).trim(),
      replyText, status, source: 'panel',
    });
    await commandLog.record({
      account: req.user, command, status, replyText,
      durationMs: result && result.durationMs, source: 'panel', ip: req.ip,
    });
    res.json({ success: status === 'ok', status, replyText, command });
  } catch (err) { next(err); }
});

module.exports = router;
