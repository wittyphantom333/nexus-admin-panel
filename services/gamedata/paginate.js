// Shared request parsing + SQL building for /api/gamedata/*.
// All column names are validated against the registry's allow-list.
const { get } = require('./tableRegistry');

const MAX_LIMIT = 200;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SORT_DIR = /^(ASC|DESC)$/i;

function parseListParams(query, entry) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), MAX_LIMIT);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);

  let sort = (query.sort || entry.sortDefault || entry.primaryKey).trim();
  if (!IDENT.test(sort) || !entry.listColumns.includes(sort)) {
    sort = entry.primaryKey;
  }
  const dir = SORT_DIR.test(query.dir || '') ? query.dir.toUpperCase() : 'DESC';

  return { limit, offset, sort, dir, q: (query.q || '').toString().slice(0, 100) };
}

// Build the WHERE / ORDER BY for a list query.
// Returns the SQL, the bound values, and a countSql helper.
function buildListSql(entry, params) {
  const where = [];
  const values = [];
  if (params.q) {
    const term = `%${params.q}%`;
    const parts = [];
    for (const col of entry.searchColumns) {
      if (!IDENT.test(col)) continue;
      parts.push(`\`${col}\` LIKE ?`);
      values.push(term);
    }
    if (parts.length) where.push('(' + parts.join(' OR ') + ')');
  }
  const sql =
    `SELECT \`${entry.listColumns.join('`,`')}\` FROM \`${entry.table}\` ` +
    (where.length ? 'WHERE ' + where.join(' AND ') + ' ' : '') +
    `ORDER BY \`${params.sort}\` ${params.dir} LIMIT ? OFFSET ?`;
  values.push(params.limit, params.offset);
  return { sql, values, countSql: `SELECT COUNT(*) AS c FROM \`${entry.table}\`` };
}

module.exports = { parseListParams, buildListSql, MAX_LIMIT };
