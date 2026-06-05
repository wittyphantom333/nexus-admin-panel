const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const os = require('os');
const { authenticateToken } = require('../middleware/auth');

function execPromise(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (err, stdout) => resolve(err ? '' : stdout.trim()));
  });
}

router.get('/info', authenticateToken, async (req, res) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const uptime = os.uptime();

    const diskInfo = await execPromise('df -h / | tail -1 | awk \'{print $2, $3, $4, $5}\'');
    const [diskTotal, diskUsed, diskFree, diskPct] = (diskInfo || '0 0 0 0%').split(' ');
    const loadAvg = os.loadavg();
    const cpuInfo = await execPromise('nproc');

    res.json({
      success: true,
      data: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        cpus: parseInt(cpuInfo) || os.cpus().length,
        loadAvg: loadAvg.map(v => Math.round(v * 100) / 100),
        memory: {
          total: Math.round(totalMem / 1024 / 1024),
          free: Math.round(freeMem / 1024 / 1024),
          used: Math.round((totalMem - freeMem) / 1024 / 1024),
          pct: Math.round(((totalMem - freeMem) / totalMem) * 100)
        },
        disk: {
          total: diskTotal,
          used: diskUsed,
          free: diskFree,
          pct: diskPct
        },
        uptime: Math.floor(uptime)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/processes', authenticateToken, async (req, res) => {
  try {
    const ps = await execPromise('ps aux | grep -E "NexusForever|dotnet" | grep -v grep');
    const processes = (ps || '').split('\n').filter(Boolean).map(line => {
      const parts = line.split(/\s+/);
      return {
        user: parts[0],
        pid: parseInt(parts[1]),
        cpu: parts[2],
        mem: parts[3],
        command: parts.slice(10).join(' ')
      };
    });
    res.json({ success: true, data: processes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/logs', authenticateToken, async (req, res) => {
  try {
    const lines = req.query.lines || 50;
    const logs = await execPromise(`journalctl -u emulator-server.service --no-pager -n ${lines} 2>/dev/null || echo "No logs"`);
    res.json({ success: true, data: { logs } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
