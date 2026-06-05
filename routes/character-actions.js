// Character Actions: in-game commands triggered from the admin panel.
// Verifies the character is online before executing, runs the command via the
// world server WebSocket bridge, and records every call to the command log.
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');
const db = require('../db');
const wsBridge = require('../backend/services/worldCommandSocket');
const commandLog = require('../services/commandLog');

const ADMIN = ['admin', 1, '1'];

function isAdmin(user) {
  return user && (ADMIN.includes(user.role) || ADMIN.includes(user.roleId));
}

// GET /online?realmId=&name= — quick check that a character is currently
// logged in on the world server. Uses the bridge's `online` list (set by the
// world server on connect). Falls back to false.
router.get('/online', authenticateToken, async (req, res, next) => {
  try {
    const { realmId, name } = req.query;
    if (!name) return res.status(400).json({ success: false, error: 'name required' });
    const list = wsBridge.getOnline && wsBridge.getOnline(realmId) || [];
    const found = list.find(c => String(c.name).toLowerCase() === String(name).toLowerCase());
    res.json({ success: true, online: !!found, session: found || null });
  } catch (err) { next(err); }
});

// POST /exec — body: { realmId, name, action, params }
// `action` is one of: xp, level, item, currency, quest, revive, kick, teleport
// All commands target the named in-game character; `!` prefix is added here.
router.post('/exec', authenticateToken, requirePermission('characters.actions'), async (req, res, next) => {
  try {
    const { realmId, name, action, params } = req.body || {};
    if (!name || !action) {
      return res.status(400).json({ success: false, error: 'name and action required' });
    }

    // Build the in-game command string
    const cmd = buildCommand(action, name, params || {});
    if (!cmd) {
      return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
    }

    // Verify character exists in DB
    const [[char]] = await db.character.query(
      'SELECT id, name, realmId FROM character WHERE LOWER(name) = LOWER(?) LIMIT 1',
      [name]
    );
    if (!char) {
      return res.status(404).json({ success: false, error: `Character not found: ${name}` });
    }

    // Execute via WS bridge (with a short timeout; many in-game commands are sync)
    const result = await wsBridge.executeOnce(cmd, { timeoutMs: 4000 });

    // Persist to command log
    commandLog.append({
      userId: req.user.id,
      username: req.user.email,
      category: 'character',
      action,
      target: name,
      command: cmd,
      status: result.ok ? 'ok' : 'fail',
      reply: result.text || result.raw || null,
    });

    res.json({ success: true, command: cmd, ...result, character: char });
  } catch (err) { next(err); }
});

// Build the in-game command for each action type
function buildCommand(action, name, p) {
  switch (action) {
    case 'xp':
      return `!character xp add ${name} ${p.amount || 0}`;
    case 'level':
      return `!character level set ${name} ${p.level || 1}`;
    case 'item':
      return `!character item add ${name} ${p.itemId || 0} ${p.quantity || 1}`;
    case 'currency':
      return `!character currency add ${name} ${p.currencyId || 0} ${p.amount || 0}`;
    case 'quest':
      return `!character quest complete ${name} ${p.questId || 0}`;
    case 'quest_reset':
      return `!character quest reset ${name} ${p.questId || 0}`;
    case 'revive':
      return `!character revive ${name}`;
    case 'kick':
      return `!character kick ${name} ${p.reason || 'Kicked by admin'}`;
    case 'teleport':
      return `!character teleport ${name} ${p.worldId || 0} ${p.x || 0} ${p.y || 0} ${p.z || 0}`;
    case 'say':
      return `!say ${p.message || ''}`;
    case 'broadcast':
      return `!broadcast message ${p.tier || 1} ${p.message || ''}`;
    default:
      return null;
  }
}

module.exports = router;
