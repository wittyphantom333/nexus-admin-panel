require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const { authenticateToken, requirePermission } = require('./middleware/auth');
const wsBridge = require('./backend/services/worldCommandSocket');
const { CATEGORIES } = require('./backend/services/commandCatalog');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/servers', require('./routes/servers'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/characters', require('./routes/characters'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/system', require('./routes/system'));
app.use('/api/worlddb', require('./routes/worlddb'));
app.use('/api/bans', require('./routes/bans'));
app.use('/api/rbac', require('./routes/rbac'));
app.use('/api/character-actions', require('./routes/character-actions'));
app.use('/api/command-log', require('./routes/commandLog'));
app.use('/api/announcements', require('./routes/announcements'));

// Commands catalog (static snapshot for the UI)
app.get('/api/commands/catalog', authenticateToken, (req, res) => {
  res.json({ success: true, categories: CATEGORIES });
});

// One-shot command execution
app.post('/api/commands/exec', authenticateToken, requirePermission('commands.exec'), async (req, res) => {
  const started = Date.now();
  const commandLog = require('./services/commandLog');
  try {
    const { command, timeoutMs, url } = req.body || {};
    if (!command || typeof command !== 'string') {
      await commandLog.record({
        account: req.user, command, status: 'fail',
        replyText: 'command is required', durationMs: Date.now() - started,
        source: 'panel', ip: req.ip,
      });
      return res.status(400).json({ success: false, error: 'command is required' });
    }
    const result = await wsBridge.executeOnce(command, { timeoutMs, url });
    const replyText = (result && (result.text || result.message)) ? (result.text || result.message) : JSON.stringify(result || {});
    const status = result && (result.success === false || result.error) ? 'fail' : 'ok';
    await commandLog.record({
      account: req.user, command, status, replyText, replyRaw: result,
      durationMs: Date.now() - started, source: 'panel', ip: req.ip,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    await commandLog.record({
      account: req.user, command: req.body && req.body.command, status: 'fail',
      replyText: err.message, durationMs: Date.now() - started, source: 'panel', ip: req.ip,
    });
    res.status(500).json({ success: false, error: err.message });
  }
});

// WebSocket bridge: browser ↔ admin server ↔ world server /ws/commands
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  if (req.url && req.url.startsWith('/ws/console')) {
    // Token comes from query string (browser WS has no headers)
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    try {
      const jwt = require('jsonwebtoken');
      jwt.verify(token, process.env.JWT_SECRET || 'emulator-manager-jwt-secret');
    } catch (e) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const url = new URL(req.url, 'http://localhost');
      const upstream = url.searchParams.get('upstream');
      if (upstream) wsBridge.setEndpoint(upstream);
      wsBridge.attach(ws);
    });
  } else {
    socket.destroy();
  }
});
wsBridge.bootstrap();

// Build info
app.get('/api/build', (req, res) => {
  const fs = require('fs');
  const buildFile = path.join(__dirname, 'public', 'build.json');
  try {
    res.json(JSON.parse(fs.readFileSync(buildFile, 'utf8')));
  } catch {
    res.json({ version: '0.0.0', commit: 'unknown', branch: 'unknown', builtAt: null });
  }
});

// SPA fallback
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

server.listen(PORT, () => {
  console.log(`Emulator Manager running on port ${PORT}`);
  // Seed admin user
  require('./services/seed');
});
