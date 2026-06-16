// Audited write helpers. Every mutation:
//   - validates the resource exists in the static registry
//   - allow-lists the columns it will write
//   - checks the row exists (for update/delete) before touching it
//   - records an entry in gamedata_audit (manager DB)
// The registry itself never reflects user input — entries are static, and
// only column names from the entry's allow-list appear in generated SQL.
const db = require('../../db');
const { get } = require('./tableRegistry');

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const AUDIT_TABLE = 'gamedata_audit';

// Resolve the column list that identifies a row. By default it's the single
// `primaryKey` declared on the registry entry, but a few tables use a composite
// PK (e.g. character_quest is (id, questId)) and accept a `primaryKeyColumns`
// array — the row URL is the values joined with `::`.
function pkColumns(entry) {
  if (Array.isArray(entry.primaryKeyColumns) && entry.primaryKeyColumns.length) {
    return entry.primaryKeyColumns;
  }
  return [entry.primaryKey];
}

// Split a composite row id ("123::456") into its parts, matching the order of
// `pkColumns(entry)`. Returns null if the id is malformed.
function splitCompositeId(entry, id) {
  const cols = pkColumns(entry);
  if (cols.length === 1) return [id];
  if (typeof id !== 'string') return null;
  const parts = id.split('::');
  if (parts.length !== cols.length) return null;
  if (parts.some(p => p === '' || !PK_RE.test(p))) return null;
  // If a part is purely numeric, coerce to Number so MySQL gets the right type.
  return parts.map(p => (/^\d+$/.test(p) ? Number(p) : p));
}

// Allow row PKs to be digits, identifiers, or short alphanumeric forms
// (e.g. composite "1:2" — used by character_quest / character_quest_objective,
// safe because we always pass them as bound parameters).
const PK_RE = /^[A-Za-z0-9_:-]{1,64}$/;

function badId(id) {
  return !PK_RE.test(String(id));
}

async function writeAudit({ req, entry, action, pk, before, after }) {
  const user = req.user || {};
  await db.query(db.auth(),
    `INSERT INTO \`${AUDIT_TABLE}\`
       (user_id, user_email, table_key, db_name, table_name, action, row_pk, before_json, after_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id || 0,
      user.email || 'unknown',
      entry._key || '',
      entry.db,
      entry.table,
      action,
      String(pk ?? ''),
      before == null ? null : JSON.stringify(before),
      after == null ? null : JSON.stringify(after),
    ]
  );
}

// Build a {col: value} map for an insert/update. Only columns that:
//   1. appear in the relevant allow-list (entry.insertable for inserts,
//      entry.updatable for updates)
//   2. are valid identifiers
//   3. (for updates only) are not the primary key
// are accepted from req.body. Everything else is silently dropped.
//
// For inserts the primary key is included if the resource lists it in
// entry.insertable — this supports composite primary keys (e.g. quests
// where the PK is (id, questId) and both must be supplied).
function pickWrites(entry, body, mode) {
  const allowedList = mode === 'insert' ? (entry.insertable || entry.updatable || []) : (entry.updatable || []);
  const allowed = new Set(allowedList);
  const out = {};
  // For inserts we may or may not include the primary key:
  //   - entry.insertablePk === true  => PK is required and must be in the allow-list
  //     (composite keys like character_quest.id, character_quest.questId)
  //   - otherwise the PK is auto-increment and we skip it (allow the DB to
  //     fill it in).
  const includePk = mode === 'insert' && entry.insertablePk === true;
  for (const [k, v] of Object.entries(body || {})) {
    if (!IDENT.test(k)) continue;
    if (!allowed.has(k)) continue;
    if (k === entry.primaryKey && !includePk) continue;
    out[k] = v;
  }
  return out;
}

async function insertRow(key, req) {
  const entry = get(key);
  if (!entry.editable) {
    throw Object.assign(new Error('This resource is read-only'), { status: 403 });
  }
  const data = pickWrites(entry, req.body, 'insert');
  if (Object.keys(data).length === 0) {
    throw Object.assign(new Error('No writable columns provided'), { status: 400 });
  }
  const cols = Object.keys(data);
  const placeholders = cols.map(() => '?').join(',');
  const sql = `INSERT INTO \`${entry.table}\` (\`${cols.join('`,`')}\`) VALUES (${placeholders})`;
  const pool = require('./tableRegistry').pool(entry);
  const result = await db.query(pool, sql, cols.map(c => data[c]));
  // For single-column PKs use the auto-incremented id; for composite PKs
  // build a `::` joined id from the supplied values.
  const pkCols = pkColumns(entry);
  const pk = pkCols.length === 1
    ? result.insertId
    : pkCols.map(c => data[c]).join('::');
  const inserted = await getRow(key, pk);
  await writeAudit({ req, entry: { ...entry, _key: key }, action: 'insert', pk, before: null, after: inserted });
  return { pk, row: inserted };
}

// Build `WHERE \`a\` = ? AND \`b\` = ?` plus the matching parameter list for
// the given row id (which is either a single value or "v1::v2").
function pkWhere(entry, id) {
  const pkCols = pkColumns(entry);
  const parts = splitCompositeId(entry, id);
  if (!parts) {
    throw Object.assign(new Error('Invalid id'), { status: 400 });
  }
  const sql = pkCols.map(c => `\`${c}\` = ?`).join(' AND ');
  return { sql, params: parts };
}

async function updateRow(key, id, req) {
  const entry = get(key);
  if (!entry.editable) {
    throw Object.assign(new Error('This resource is read-only'), { status: 403 });
  }
  if (badId(id)) {
    throw Object.assign(new Error('Invalid id'), { status: 400 });
  }
  const pool = require('./tableRegistry').pool(entry);
  const w = pkWhere(entry, id);
  const before = await db.query(pool,
    `SELECT * FROM \`${entry.table}\` WHERE ${w.sql}`, w.params);
  if (before.length === 0) {
    throw Object.assign(new Error('Row not found'), { status: 404 });
  }
  const data = pickWrites(entry, req.body, 'update');
  if (Object.keys(data).length === 0) {
    throw Object.assign(new Error('No writable columns provided'), { status: 400 });
  }
  const set = Object.keys(data).map(c => `\`${c}\` = ?`).join(', ');
  const values = Object.keys(data).map(c => data[c]);
  values.push(...w.params);
  await db.query(pool,
    `UPDATE \`${entry.table}\` SET ${set} WHERE ${w.sql}`, values);
  const after = await db.query(pool,
    `SELECT * FROM \`${entry.table}\` WHERE ${w.sql}`, w.params);
  await writeAudit({ req, entry: { ...entry, _key: key }, action: 'update', pk: id, before: before[0], after: after[0] });
  return after[0];
}

async function deleteRow(key, id, req) {
  const entry = get(key);
  if (!entry.editable) {
    throw Object.assign(new Error('This resource is read-only'), { status: 403 });
  }
  if (badId(id)) {
    throw Object.assign(new Error('Invalid id'), { status: 400 });
  }
  const pool = require('./tableRegistry').pool(entry);
  const w = pkWhere(entry, id);
  const before = await db.query(pool,
    `SELECT * FROM \`${entry.table}\` WHERE ${w.sql}`, w.params);
  if (before.length === 0) {
    throw Object.assign(new Error('Row not found'), { status: 404 });
  }
  await db.query(pool,
    `DELETE FROM \`${entry.table}\` WHERE ${w.sql}`, w.params);
  await writeAudit({ req, entry: { ...entry, _key: key }, action: 'delete', pk: id, before: before[0], after: null });
  return { id };
}

async function getRow(key, id) {
  if (badId(id)) return null;
  const entry = get(key);
  const pool = require('./tableRegistry').pool(entry);
  const w = pkWhere(entry, id);
  const rows = await db.query(pool,
    `SELECT * FROM \`${entry.table}\` WHERE ${w.sql}`, w.params);
  return rows[0] || null;
}

module.exports = { insertRow, updateRow, deleteRow, getRow };
