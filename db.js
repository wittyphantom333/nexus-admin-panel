const mysql = require('mysql2/promise');

const pools = {};

function getPool(name, database) {
  if (!pools[name]) {
    pools[name] = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'nexusforever',
      password: process.env.DB_PASSWORD || 'nexusforever',
      database: database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pools[name];
}

module.exports = {
  auth: () => getPool('auth', process.env.DB_AUTH_DB || 'nexus_forever_auth'),
  character: () => getPool('character', process.env.DB_CHARACTER_DB || 'nexus_forever_character'),
  world: () => getPool('world', process.env.DB_WORLD_DB || 'nexus_forever_world'),
  manager: () => getPool('manager', process.env.DB_AUTH_DB || 'nexus_forever_auth'),
  query: async (pool, sql, params) => {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(sql, params);
      return rows;
    } finally {
      conn.release();
    }
  }
};
