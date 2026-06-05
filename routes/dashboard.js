const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

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
    const [accountCount] = await db.query(db.auth(), 'SELECT COUNT(*) as count FROM account');
    const [characterCount] = await db.query(db.character(), 'SELECT COUNT(*) as count FROM `character`');

    const { stdout: cpu } = await execPromise("top -bn1 | grep 'Cpu(s)' | awk '{print $2}'");
    const { stdout: mem } = await execPromise("free -m | awk '/Mem:/ {print $3}'");
    const { stdout: memTotal } = await execPromise("free -m | awk '/Mem:/ {print $2}'");
    const { stdout: disk } = await execPromise("df -h / | awk 'NR==2 {print $5}'");
    const { stdout: uptime } = await execPromise("uptime -p | sed 's/up //'");

    const { stdout: stsStatus } = await execPromise('systemctl is-active emulator-sts.service 2>/dev/null || echo inactive');
    const { stdout: authStatus } = await execPromise('systemctl is-active emulator-auth.service 2>/dev/null || echo inactive');
    const { stdout: worldStatus } = await execPromise('systemctl is-active emulator-world.service 2>/dev/null || echo inactive');
    const { stdout: authProc } = await execPromise('pgrep -f NexusForever.AuthServer || echo 0');
    const { stdout: worldProc } = await execPromise('pgrep -f NexusForever.WorldServer || echo 0');
    const { stdout: stsProc } = await execPromise('pgrep -f NexusForever.StsServer || echo 0');

    const allRunning = authStatus.trim() === 'active' && worldStatus.trim() === 'active' && stsStatus.trim() === 'active';
    const anyRunning = authStatus.trim() === 'active' || worldStatus.trim() === 'active' || stsStatus.trim() === 'active';
    const status = allRunning ? 'online' : (anyRunning ? 'starting' : 'offline');

    res.json({
      success: true,
      data: {
        accounts: accountCount.count,
        characters: characterCount.count,
        system: {
          cpu: parseFloat(cpu) || 0,
          memory: { used: parseInt(mem) || 0, total: parseInt(memTotal) || 0 },
          disk: disk ? disk.trim() : '0%',
          uptime: uptime ? uptime.trim() : 'unknown'
        },
        server: {
          status,
          service: authStatus.trim(),
          authServer: authStatus.trim() === 'active' && authProc.trim() !== '0',
          worldServer: worldStatus.trim() === 'active' && worldProc.trim() !== '0',
          stsServer: stsStatus.trim() === 'active' && stsProc.trim() !== '0',
          authPid: parseInt(authProc.trim()) || null,
          worldPid: parseInt(worldProc.trim()) || null,
          stsPid: parseInt(stsProc.trim()) || null
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
