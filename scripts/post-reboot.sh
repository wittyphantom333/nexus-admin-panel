#!/bin/bash
# NexusForever - Post-reboot recovery script
# Run after a server reboot to verify all services are online and healthy.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[-]${NC} $*"; }

echo "==============================================="
echo " NexusForever Post-Reboot Recovery"
echo "==============================================="

# 1. Make sure no stray processes are squatting on the manager's port
if ss -tlnp 2>/dev/null | grep -q ':3000'; then
  warn "Port 3000 is already in use. Killing stray node process..."
  pkill -f 'node server.js' || true
  sleep 2
fi

# 1b. Make sure the emulator user can read systemd journal (for in-panel logs)
if id emulator &>/dev/null; then
  if ! id -nG emulator | tr ' ' '\n' | grep -qx 'systemd-journal'; then
    warn "Adding emulator user to systemd-journal group..."
    usermod -aG systemd-journal emulator
  fi
fi

# 2. Start services in the right order (target pulls them all in)
log "Starting emulator-server.target (manager + auth + world + sts)..."
systemctl start emulator-server.target

# 3. Wait a moment for systemd to settle
sleep 3

# 4. Check status of each service
echo ""
echo "Service status:"
echo "-----------------------------------------------"
for svc in mariadb emulator-manager emulator-auth emulator-world emulator-sts; do
  state=$(systemctl is-active "$svc" 2>&1)
  if [ "$state" = "active" ]; then
    log "$svc: $state"
  else
    err "$svc: $state"
  fi
done

# 5. Verify ports are listening
echo ""
echo "Listening ports:"
echo "-----------------------------------------------"
ss -tlnp 2>/dev/null | grep -E ':(3306|3000|24000|5000|5001)\b' | awk '{print $4, $6}' | sort -u

# 6. Smoke test - check auth server is responding (login endpoint)
echo ""
echo "Smoke test (auth server login endpoint):"
echo "-----------------------------------------------"
code=$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://127.0.0.1:5001/Account/Auth?serverName=AuthServer 2>&1)
if [ -n "$code" ] && [ "$code" != "000" ]; then
  log "Auth server responded with HTTP $code"
else
  warn "Auth server did not respond (this may be normal if the endpoint requires a real session)"
fi

# 7. Web panel health
echo ""
echo "Web panel (port 3000):"
echo "-----------------------------------------------"
code=$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://127.0.0.1:3000/ 2>&1)
if [ "$code" = "200" ]; then
  log "Web panel is responding (HTTP 200)"
else
  warn "Web panel returned HTTP $code"
fi

echo ""
echo "==============================================="
echo " Recovery complete. Review the output above."
echo "==============================================="
