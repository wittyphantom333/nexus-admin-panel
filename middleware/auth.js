const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1] || req.cookies?.token;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'emulator-manager-jwt-secret');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
}

function requireRole(roleName) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Authentication required' });
    if (req.user.role !== roleName && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: `Requires role: ${roleName}` });
    }
    next();
  };
}

// Per-permission gate. Admin always passes.
function requirePermission(code) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Authentication required' });
    if (req.user.role === 'admin') return next();
    const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    if (!perms.includes(code)) {
      return res.status(403).json({ success: false, error: `Missing permission: ${code}` });
    }
    next();
  };
}

module.exports = { authenticateToken, requireRole, requirePermission };
