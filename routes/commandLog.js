// Routes for the command log (history of panel-executed commands).
const express = require('express');
const router = express.Router();
const { authenticateToken, requirePermission } = require('../middleware/auth');
const commandLog = require('../services/commandLog');

router.get('/', authenticateToken, requirePermission('logs.view'), async (req, res) => {
  try {
    const result = await commandLog.list({
      limit:  req.query.limit,
      offset: req.query.offset,
      q:      req.query.q,
      status: req.query.status,
      account:req.query.account,
      category: req.query.category,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const row = await commandLog.getById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, row });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
