// Shared command execution helper for the admin panel.
// Wraps API.exec (POST /api/commands/exec) with a consistent shape:
//   { ok, text, raw, durationMs, logId }
// Centralises error display (toast) and log metadata.
//
// Usage:
//   const { execCommand } = window.CX;
//   const r = await execCommand('account list', { account: 'Adam', notify: true });
//   if (r.ok) { ... }
window.CX = (function () {
  async function execCommand(command, opts = {}) {
    const started = performance.now();
    let r;
    try {
      r = await window.API.post('/commands/exec', { command, timeoutMs: opts.timeoutMs || 5000 });
    } catch (e) {
      const durationMs = Math.round(performance.now() - started);
      const text = (e && e.message) || 'Network error';
      if (opts.notify !== false) window.Toast && window.Toast.error(`Command failed: ${text}`);
      return { ok: false, text, raw: null, durationMs, logId: null };
    }
    const durationMs = Math.round(performance.now() - started);
    const reply = r && r.reply ? r.reply : {};
    const text = reply.text || reply.message || (r && r.success ? '(no output)' : 'No response');
    const ok = !!(r && r.success);
    if (opts.notify !== false) {
      if (ok) window.Toast && window.Toast.success(prettySummary(command, text));
      else window.Toast && window.Toast.error(`Failed: ${text.substring(0, 120)}`);
    }
    return { ok, text, raw: reply, durationMs, logId: r && r.logId != null ? r.logId : null };
  }

  function prettySummary(cmd, text) {
    const t = (text || '').replace(/\s+/g, ' ').trim();
    const short = t.length > 80 ? t.substring(0, 80) + '…' : t;
    return short ? `${cmd} → ${short}` : cmd;
  }

  return { execCommand };
})();
