// Master route for the gamedata feature.
//
//   GET  /api/gamedata/tables             — list available resources
//   GET  /api/gamedata/audit              — recent audit log entries
//   GET  /api/gamedata/:key               — paginated list (resource = key)
//   GET  /api/gamedata/:key/:id           — single row
//   POST /api/gamedata/:key               — create (audited)
//   PUT  /api/gamedata/:key/:id           — update (audited)
//   DELETE /api/gamedata/:key/:id         — delete (audited)
//
// All SQL is constructed from the static tableRegistry — user input is
// never reflected into the SQL, and column names are allow-listed per
// resource. Every mutation writes a row to gamedata_audit (manager DB).
const express = require('express');
const db = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { listKeys, get, pool } = require('../services/gamedata/tableRegistry');
const { parseListParams, buildListSql } = require('../services/gamedata/paginate');
const {
  insertRow, updateRow, deleteRow, getRow,
} = require('../services/gamedata/safeWrite');

const router = express.Router();

const RESERVED = new Set(['tables', 'audit']);

function wrap(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ success: false, error: err.message });
    }
  };
}

async function handleList(req, res, key) {
  const entry = get(key);
  const params = parseListParams(req.query, entry);
  const { sql, values, countSql } = buildListSql(entry, params);
  const poolConn = pool(entry);
  const [rows, countRows] = await Promise.all([
    db.query(poolConn, sql, values),
    db.query(poolConn, countSql),
  ]);
  res.json({
    success: true,
    data: rows,
    total: countRows[0] ? Number(countRows[0].c) : 0,
    limit: params.limit,
    offset: params.offset,
  });
}

router.get('/tables', authenticateToken, requirePermission('gamedata.read'), wrap(async (req, res) => {
  res.json({ success: true, data: listKeys() });
}));

router.get('/audit', authenticateToken, requirePermission('gamedata.read'), wrap(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const rows = await db.query(db.auth(),
    `SELECT id, ts, user_id, user_email, table_key, db_name, table_name,
            action, row_pk, before_json, after_json
       FROM gamedata_audit
       ORDER BY id DESC
       LIMIT ?`, [limit]);
  res.json({ success: true, data: rows });
}));

router.get('/:key/:id', authenticateToken, requirePermission('gamedata.read'), wrap(async (req, res) => {
  if (RESERVED.has(req.params.key)) return;
  const row = await getRow(req.params.key, req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: row });
}));

router.get('/:key', authenticateToken, requirePermission('gamedata.read'), wrap(async (req, res) => {
  if (RESERVED.has(req.params.key)) return;
  await handleList(req, res, req.params.key);
}));

router.post('/:key', authenticateToken, requirePermission('gamedata.write'), wrap(async (req, res) => {
  const result = await insertRow(req.params.key, req);
  res.json({ success: true, data: result });
}));

router.put('/:key/:id', authenticateToken, requirePermission('gamedata.write'), wrap(async (req, res) => {
  const row = await updateRow(req.params.key, req.params.id, req);
  res.json({ success: true, data: row });
}));

// PATCH is identical to PUT in our model: every updatable column is a
// partial-update candidate, so we delegate to the same handler.
router.patch('/:key/:id', authenticateToken, requirePermission('gamedata.write'), wrap(async (req, res) => {
  const row = await updateRow(req.params.key, req.params.id, req);
  res.json({ success: true, data: row });
}));

router.delete('/:key/:id', authenticateToken, requirePermission('gamedata.write'), wrap(async (req, res) => {
  const result = await deleteRow(req.params.key, req.params.id, req);
  res.json({ success: true, data: result });
}));

module.exports = router;
