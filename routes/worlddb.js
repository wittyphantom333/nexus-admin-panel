const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const WORLDDB_DIR = process.env.WORLDDB_DIR || '/home/nfb/NexusForever.WorldDatabase';
const WORLDDB_SCRIPT = path.join(__dirname, '..', 'scripts', 'worlddb.sh');
const DB_NAME = process.env.DB_WORLD_DB || 'nexus_forever_world';

function execPromise(cmd, cwd, timeout = 30000) {
  return new Promise((resolve) => {
    exec(cmd, { cwd, timeout, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ code: err ? err.code || 1 : 0, stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

async function runScript(args) {
  return execPromise(`bash ${WORLDDB_SCRIPT} ${args}`, undefined, 120000);
}

function getRepoInfo() {
  if (!fs.existsSync(path.join(WORLDDB_DIR, '.git'))) {
    return { cloned: false, path: WORLDDB_DIR };
  }
  let branch = 'unknown';
  let commit = 'unknown';
  try {
    branch = require('child_process').execSync(
      `cd ${WORLDDB_DIR} && git rev-parse --abbrev-ref HEAD`,
      { encoding: 'utf8' }
    ).trim();
  } catch {}
  try {
    commit = require('child_process').execSync(
      `cd ${WORLDDB_DIR} && git rev-parse --short HEAD`,
      { encoding: 'utf8' }
    ).trim();
  } catch {}
  return { cloned: true, path: WORLDDB_DIR, branch, commit };
}

function listContinentFiles(continent) {
  const dir = path.join(WORLDDB_DIR, continent);
  if (!fs.existsSync(dir)) return null;
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => ({
      name: f,
      path: `${continent}/${f}`,
      size: fs.statSync(path.join(dir, f)).size
    }));
}

function countAllFiles() {
  if (!fs.existsSync(WORLDDB_DIR)) return 0;
  let n = 0;
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith('.sql')) n++;
    }
  }
  walk(WORLDDB_DIR);
  return n;
}

async function getTableCounts() {
  const mysql = require('mysql2/promise');
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'nexusforever',
      password: process.env.DB_PASSWORD || 'nexusforever',
      database: DB_NAME,
      connectTimeout: 5000
    });
    const [rows] = await conn.query(`
      SELECT TABLE_NAME AS name, TABLE_ROWS AS \`rows\`
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_ROWS DESC
    `, [DB_NAME]);
    return rows;
  } catch (err) {
    return { error: err.message };
  } finally {
    if (conn) await conn.end();
  }
}

router.get('/status', authenticateToken, requirePermission('worlddb.view'), async (req, res) => {
  try {
    const info = getRepoInfo();
    const continents = ['Alizar', 'Isigrol', 'Olyssia', 'Instance']
      .map(c => ({ name: c, files: listContinentFiles(c) }))
      .filter(c => c.files !== null);
    const totalFiles = countAllFiles();
    const tables = await getTableCounts();
    res.json({
      success: true,
      data: {
        ...info,
        totalFiles,
        continents,
        database: DB_NAME,
        tables
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/clone', authenticateToken, requirePermission('worlddb.clone'), async (req, res) => {
  const result = await runScript('clone');
  res.json({
    success: result.code === 0,
    output: (result.stdout + result.stderr).trim(),
    code: result.code
  });
});

router.post('/pull', authenticateToken, requirePermission('worlddb.pull'), async (req, res) => {
  const result = await runScript('pull');
  res.json({
    success: result.code === 0,
    output: (result.stdout + result.stderr).trim(),
    code: result.code
  });
});

router.post('/apply', authenticateToken, requirePermission('worlddb.apply'), async (req, res) => {
  const { file } = req.body;
  if (!file || typeof file !== 'string') {
    return res.status(400).json({ success: false, error: 'file is required' });
  }
  // Reject anything that isn't a safe path under WORLDDB_DIR
  const resolved = path.resolve(WORLDDB_DIR, file);
  if (!resolved.startsWith(WORLDDB_DIR + path.sep) && resolved !== WORLDDB_DIR) {
    return res.status(400).json({ success: false, error: 'Invalid file path' });
  }
  if (!fs.existsSync(resolved) || !resolved.endsWith('.sql')) {
    return res.status(404).json({ success: false, error: 'SQL file not found' });
  }
  const result = await runScript(`apply "${file}"`);
  res.json({
    success: result.code === 0,
    output: (result.stdout + result.stderr).trim(),
    code: result.code
  });
});

router.post('/apply-continent', authenticateToken, requirePermission('worlddb.apply'), async (req, res) => {
  const { continent } = req.body;
  if (!continent || !/^[A-Za-z0-9_-]+$/.test(continent)) {
    return res.status(400).json({ success: false, error: 'Invalid continent name' });
  }
  const result = await runScript(`apply-continent "${continent}"`);
  res.json({
    success: result.code === 0,
    output: (result.stdout + result.stderr).trim(),
    code: result.code
  });
});

router.post('/apply-all', authenticateToken, requirePermission('worlddb.apply'), async (req, res) => {
  const result = await runScript('apply-all');
  res.json({
    success: result.code === 0,
    output: (result.stdout + result.stderr).trim(),
    code: result.code
  });
});

module.exports = router;
