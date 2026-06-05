const db = require('../db');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    // Create manager_users table if not exists
    await db.query(db.auth(), `
      CREATE TABLE IF NOT EXISTS manager_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(128) NOT NULL UNIQUE,
        password_hash VARCHAR(256) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'operator',
        createTime DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed admin user if none exists
    const users = await db.query(db.auth(), 'SELECT COUNT(*) as count FROM manager_users');
    if (users[0].count === 0) {
      const hash = await bcrypt.hash('admin', 10);
      await db.query(db.auth(),
        'INSERT INTO manager_users (username, password_hash, role) VALUES (?, ?, ?)',
        ['admin', hash, 'admin']
      );
      console.log('Seeded admin user (admin/admin)');
    }
  } catch (err) {
    console.error('Seed error:', err.message);
  }
}

module.exports = seed();
