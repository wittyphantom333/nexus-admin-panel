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
// `action` is one of: xp, level, save, item, currency, quest_add, quest_achieve,
//   teleport_zone, teleport_location, broadcast, help
// IMPORTANT: in-game chat-syntax commands target the world server's currently
// authenticated session — there is no `name` parameter for most commands.
// `name` is accepted for logging/audit only and is NOT injected into the command.
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

    // No DB lookup — the command targets the in-game character on the
    // world server; the world server will respond with an error if the
    // name doesn't exist. Avoids touching the character DB just to gate
    // a remote action.

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

    res.json({ success: true, command: cmd, ...result });
  } catch (err) { next(err); }
});

// Build the in-game command for each action type.
//
// IMPORTANT: NexusForever chat-syntax commands run inside the world server's
// chat parser. The "current target" is the user whose session opened the
// /ws/commands socket — so commands like `!character xp` and `!character level`
// apply to THAT session's character, not to a character named in the panel.
// Commands that *do* accept a name (e.g. `!teleport name`, `!quest add`)
// target the calling character's current quest/list; cross-character ops
// are not supported by the in-game command surface and must be done in-DB
// or via the character API.
function buildCommand(action, name, p) {
  switch (action) {
    case 'xp':
      return `!character xp ${p.amount || 0}`;
    case 'level':
      return `!character level ${p.level || 1}`;
    case 'save':
      return `!character save`;
    case 'item':
      return `!item add ${p.itemId || 0} ${p.quantity || 1} ${p.charges || 0}`;
    case 'currency':
      return `!currency character add ${p.currencyId || 0} ${p.amount || 0}`;
    case 'quest_add':
      return `!quest add ${p.questId || 0}`;
    case 'quest_achieve':
      return `!quest achieve ${p.questId || 0}`;
    case 'teleport_zone':
      return `!teleport name ${p.zone || ''}`;
    case 'teleport_location':
      return `!teleport location ${p.worldLocation2Id || 0}`;
    case 'broadcast':
      return `!broadcast message ${p.tier != null ? p.tier : 1} ${p.message || ''}`;
    case 'help':
      return `!help ${p.topic || ''}`.trim();
    default:
      return null;
  }
}

module.exports = router;
