const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const EMULATOR_DIR = process.env.EMULATOR_DIR || '/opt/emulator-server';

function execPromise(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) resolve({ stdout, stderr, code: err.code });
      else resolve({ stdout, stderr, code: 0 });
    });
  });
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const servers = await db.query(db.auth(), 'SELECT * FROM server');
    res.json({ success: true, data: servers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const { stdout: authStatus } = await execPromise('systemctl is-active emulator-server.service 2>/dev/null || echo inactive');
    const { stdout: authProc } = await execPromise('pgrep -f NexusForever.AuthServer || echo 0');
    const { stdout: worldProc } = await execPromise('pgrep -f NexusForever.WorldServer || echo 0');
    const { stdout: stsProc } = await execPromise('pgrep -f NexusForever.StsServer || echo 0');

    res.json({
      success: true,
      data: {
        service: authStatus.trim(),
        authServer: authProc.trim() !== '0',
        worldServer: worldProc.trim() !== '0',
        stsServer: stsProc.trim() !== '0',
        authPid: parseInt(authProc.trim()) || null,
        worldPid: parseInt(worldProc.trim()) || null,
        stsPid: parseInt(stsProc.trim()) || null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/start', authenticateToken, async (req, res) => {
  try {
    const server = req.query.server || req.body.server;
    const svc = server ? `emulator-${server}.service` : 'emulator-server.target';
    await execPromise(`systemctl start ${svc}`);
    res.json({ success: true, data: { message: `${server || 'All'} server(s) started` } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/stop', authenticateToken, async (req, res) => {
  try {
    const server = req.query.server || req.body.server;
    const svc = server ? `emulator-${server}.service` : 'emulator-server.target';
    await execPromise(`systemctl stop ${svc}`);
    res.json({ success: true, data: { message: `${server || 'All'} server(s) stopped` } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/restart', authenticateToken, async (req, res) => {
  try {
    const server = req.query.server || req.body.server;
    const svc = server ? `emulator-${server}.service` : 'emulator-server.target';
    await execPromise(`systemctl restart ${svc}`);
    res.json({ success: true, data: { message: `${server || 'All'} server(s) restarted` } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/logs', authenticateToken, async (req, res) => {
  try {
    const lines = req.query.lines || 100;
    const server = req.query.server || 'auth';
    const svc = `emulator-${server}.service`;
    const { stdout } = await execPromise(`journalctl -u ${svc} --no-pager -n ${lines} 2>/dev/null || echo "No logs available"`);
    res.json({ success: true, data: { logs: stdout, server } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/config', authenticateToken, async (req, res) => {
  try {
    const servers = ['AuthServer', 'WorldServer', 'StsServer'];
    const configs = {};
    for (const server of servers) {
      const configPath = path.join(EMULATOR_DIR, server, `${server}.json`);
      if (fs.existsSync(configPath)) {
        configs[server] = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    }
    res.json({ success: true, data: configs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/config/:server', authenticateToken, async (req, res) => {
  try {
    const { server } = req.params;
    const configPath = path.join(EMULATOR_DIR, server, `${server}.json`);
    if (!fs.existsSync(configPath)) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }
    fs.writeFileSync(configPath, JSON.stringify(req.body, null, 4));
    res.json({ success: true, data: { message: 'Config updated' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
