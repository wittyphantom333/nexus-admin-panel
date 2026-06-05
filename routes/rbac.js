// Web admin RBAC — DB-driven roles and permissions.
// Backed by webadmin_roles / webadmin_permissions / webadmin_role_permissions
// (created in services/seed.js on boot).
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const ADMIN = ['admin', 1, '1'];
function isAdmin(user) { return user && (ADMIN.includes(user.role) || ADMIN.includes(user.roleId)); }

// GET /rbac/permissions — flat list of all known permission codes
router.get('/permissions', authenticateToken, async (req, res, next) => {
  try {
    const [rows] = await db.query(db.auth(),
      'SELECT id, code, description FROM webadmin_permissions ORDER BY code'
    );
    res.json({ success: true, permissions: rows });
  } catch (err) { next(err); }
});

// GET /rbac/roles — list roles with their assigned permission ids
router.get('/roles', authenticateToken, async (req, res, next) => {
  try {
    const [roles] = await db.query(db.auth(),
      'SELECT id, name, description, isSystem, createTime FROM webadmin_roles ORDER BY name'
    );
    const [matrix] = await db.query(db.auth(), 'SELECT roleId, permissionId FROM webadmin_role_permissions');
    const byRole = {};
    for (const row of matrix) {
      (byRole[row.roleId] ||= []).push(row.permissionId);
    }
    const enriched = roles.map(r => ({
      ...r,
      permissionIds: byRole[r.id] || []
    }));
    res.json({ success: true, roles: enriched });
  } catch (err) { next(err); }
});

// GET /rbac/matrix — full role→permissions grid, convenient for the UI
router.get('/matrix', authenticateToken, async (req, res, next) => {
  try {
    const [roles] = await db.query(db.auth(),
      'SELECT id, name, description, isSystem FROM webadmin_roles ORDER BY name'
    );
    const [permissions] = await db.query(db.auth(),
      'SELECT id, code, description FROM webadmin_permissions ORDER BY code'
    );
    const [matrix] = await db.query(db.auth(),
      'SELECT roleId, permissionId FROM webadmin_role_permissions'
    );
    const set = new Set(matrix.map(m => `${m.roleId}:${m.permissionId}`));
    const grid = {};
    for (const r of roles) {
      grid[r.id] = permissions.map(p => set.has(`${r.id}:${p.id}`));
    }
    res.json({ success: true, roles, permissions, grid });
  } catch (err) { next(err); }
});

// POST /rbac/roles — create a new role (admin only)
router.post('/roles', authenticateToken, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: 'Admin only' });
    const { name, description, permissionIds } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'name required' });
    const [result] = await db.query(db.auth(),
      'INSERT INTO webadmin_roles (name, description, isSystem) VALUES (?, ?, 0)',
      [name.trim(), description || null]
    );
    const roleId = result.insertId;
    if (Array.isArray(permissionIds)) {
      for (const pid of permissionIds) {
        await db.query(db.auth(),
          'INSERT IGNORE INTO webadmin_role_permissions (roleId, permissionId) VALUES (?, ?)',
          [roleId, pid]
        );
      }
    }
    res.json({ success: true, id: roleId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, error: 'Role name already exists' });
    next(err);
  }
});

// PUT /rbac/roles/:id — rename / change description (admin only)
router.put('/roles/:id', authenticateToken, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: 'Admin only' });
    const { name, description } = req.body || {};
    const [role] = await db.query(db.auth(),
      'SELECT id, isSystem FROM webadmin_roles WHERE id = ?', [req.params.id]
    );
    if (!role.length) return res.status(404).json({ success: false, error: 'Role not found' });
    if (role[0].isSystem && name && name !== role[0].name) {
      return res.status(400).json({ success: false, error: 'Cannot rename system roles' });
    }
    await db.query(db.auth(),
      'UPDATE webadmin_roles SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?',
      [name || null, description || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, error: 'Role name already exists' });
    next(err);
  }
});

// PUT /rbac/roles/:id/permissions — replace the role's permission set (admin only)
router.put('/roles/:id/permissions', authenticateToken, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: 'Admin only' });
    const { permissionIds } = req.body || {};
    if (!Array.isArray(permissionIds)) return res.status(400).json({ success: false, error: 'permissionIds[] required' });
    const [role] = await db.query(db.auth(),
      'SELECT id FROM webadmin_roles WHERE id = ?', [req.params.id]
    );
    if (!role.length) return res.status(404).json({ success: false, error: 'Role not found' });
    const conn = await db.pool(db.auth()).getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM webadmin_role_permissions WHERE roleId = ?', [req.params.id]);
      for (const pid of permissionIds) {
        await conn.query(
          'INSERT IGNORE INTO webadmin_role_permissions (roleId, permissionId) VALUES (?, ?)',
          [req.params.id, pid]
        );
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /rbac/roles/:id — delete a role (admin only; cannot delete system roles)
router.delete('/roles/:id', authenticateToken, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: 'Admin only' });
    const [role] = await db.query(db.auth(),
      'SELECT id, isSystem FROM webadmin_roles WHERE id = ?', [req.params.id]
    );
    if (!role.length) return res.status(404).json({ success: false, error: 'Role not found' });
    if (role[0].isSystem) return res.status(400).json({ success: false, error: 'Cannot delete system roles' });
    // Make sure no users currently hold this role
    const [users] = await db.query(db.auth(),
      'SELECT id, username FROM manager_users WHERE role = (SELECT name FROM webadmin_roles WHERE id = ?)',
      [req.params.id]
    );
    if (users.length) {
      return res.status(409).json({
        success: false,
        error: `Role in use by ${users.length} user(s): ${users.map(u => u.username).join(', ')}`
      });
    }
    await db.query(db.auth(), 'DELETE FROM webadmin_roles WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ============================================================
// IN-GAME RBAC — backed by NexusForever `role`/`permission` tables
// and `account_role`/`account_permission` M2M joins. Attaches to the
// ACCOUNT (not character) — characters inherit the rights of the
// account they belong to. Enforced server-side by the C# WorldServer.
// ============================================================

// GET /rbac/ingame/roles — list all in-game roles
router.get('/ingame/roles', authenticateToken, async (req, res, next) => {
  try {
    const [rows] = await db.query(db.auth(),
      'SELECT id, name, flags FROM role ORDER BY id'
    );
    res.json({ success: true, roles: rows });
  } catch (err) { next(err); }
});

// GET /rbac/ingame/permissions — full permission catalog
router.get('/ingame/permissions', authenticateToken, async (req, res, next) => {
  try {
    const [rows] = await db.query(db.auth(),
      'SELECT id, name, description FROM permission ORDER BY name'
    );
    res.json({ success: true, permissions: rows });
  } catch (err) { next(err); }
});

// GET /rbac/ingame/matrix — role→permissions grid (for the read-only preview)
router.get('/ingame/matrix', authenticateToken, async (req, res, next) => {
  try {
    const [roles] = await db.query(db.auth(),
      'SELECT id, name, flags FROM role ORDER BY id'
    );
    const [perms] = await db.query(db.auth(),
      'SELECT id, name, description FROM permission ORDER BY name'
    );
    const [rows] = await db.query(db.auth(),
      'SELECT roleId, permissionId FROM role_permission'
    );
    const byRole = {};
    for (const r of rows) (byRole[r.roleId] ||= []).push(r.permissionId);
    res.json({
      success: true,
      roles: roles.map(r => ({ ...r, permissionIds: byRole[r.id] || [] })),
      permissions: perms
    });
  } catch (err) { next(err); }
});

// GET /rbac/ingame/account/:accountId — get one account's in-game grants
router.get('/ingame/account/:accountId', authenticateToken, async (req, res, next) => {
  try {
    const [acct] = await db.query(db.auth(),
      'SELECT id, email FROM account WHERE id = ?', [req.params.accountId]
    );
    if (!acct.length) return res.status(404).json({ success: false, error: 'Account not found' });
    const [roles] = await db.query(db.auth(),
      'SELECT roleId FROM account_role WHERE id = ?', [req.params.accountId]
    );
    const [perms] = await db.query(db.auth(),
      'SELECT permissionId FROM account_permission WHERE id = ?', [req.params.accountId]
    );
    res.json({
      success: true,
      account: acct[0],
      roleIds: roles.map(r => r.roleId),
      permissionIds: perms.map(p => p.permissionId)
    });
  } catch (err) { next(err); }
});

// PUT /rbac/ingame/account/:accountId/roles — replace account's in-game roles
router.put('/ingame/account/:accountId/roles', authenticateToken, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: 'Admin only' });
    const { roleIds } = req.body || {};
    if (!Array.isArray(roleIds)) return res.status(400).json({ success: false, error: 'roleIds[] required' });
    const conn = await db.pool(db.auth()).getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM account_role WHERE id = ?', [req.params.accountId]);
      for (const rid of roleIds) {
        await conn.query('INSERT IGNORE INTO account_role (id, roleId) VALUES (?, ?)',
          [req.params.accountId, rid]);
      }
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; }
    finally { conn.release(); }
    res.json({ success: true });
  } catch (err) { next(err); }
});

// PUT /rbac/ingame/account/:accountId/permissions — replace account's direct perms
router.put('/ingame/account/:accountId/permissions', authenticateToken, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: 'Admin only' });
    const { permissionIds } = req.body || {};
    if (!Array.isArray(permissionIds)) return res.status(400).json({ success: false, error: 'permissionIds[] required' });
    const conn = await db.pool(db.auth()).getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM account_permission WHERE id = ?', [req.params.accountId]);
      for (const pid of permissionIds) {
        await conn.query('INSERT IGNORE INTO account_permission (id, permissionId) VALUES (?, ?)',
          [req.params.accountId, pid]);
      }
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; }
    finally { conn.release(); }
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
