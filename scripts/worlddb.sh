#!/bin/bash
# NexusForever - WorldDatabase management
# Clones/pulls the NexusForever.WorldDatabase repo and applies its SQL dumps
# to the world MySQL database.
#
# Usage:
#   worlddb.sh clone          # Clone the repo if missing
#   worlddb.sh pull           # Pull latest changes
#   worlddb.sh status         # Show status (cloned? up-to-date? file count)
#   worlddb.sh list           # List all .sql files (relative paths)
#   worlddb.sh list-continents # List continents and their .sql files
#   worlddb.sh apply [PATH]   # Apply one .sql file (relative or absolute)
#   worlddb.sh apply-all      # Apply all .sql files
#   worlddb.sh apply-continent <name>   # Apply all .sql files in a continent
#                                       # (Alizar, Isigrol, Olyssia, Instance)

set -e

WORLDDB_REPO="https://github.com/NexusForever/NexusForever.WorldDatabase.git"
WORLDDB_DIR="${WORLDDB_DIR:-/home/nfb/NexusForever.WorldDatabase}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-nexusforever}"
DB_PASSWORD="${DB_PASSWORD:-nexusforever}"
DB_NAME="${DB_NAME:-nexus_forever_world}"

log()  { echo -e "\033[0;32m[+]\033[0m $*"; }
warn() { echo -e "\033[1;33m[!]\033[0m $*"; }
err()  { echo -e "\033[0;31m[-]\033[0m $*" >&2; }

cmd_clone() {
  if [ -d "$WORLDDB_DIR/.git" ]; then
    log "Already cloned at $WORLDDB_DIR"
    return 0
  fi
  if [ -e "$WORLDDB_DIR" ] && [ ! -d "$WORLDDB_DIR" ]; then
    err "$WORLDDB_DIR exists and is not a directory"
    return 1
  fi
  log "Cloning $WORLDDB_REPO into $WORLDDB_DIR ..."
  git clone --depth 1 "$WORLDDB_REPO" "$WORLDDB_DIR"
  log "Done."
}

cmd_pull() {
  if [ ! -d "$WORLDDB_DIR/.git" ]; then
    warn "Not cloned yet. Running clone first."
    cmd_clone
    return 0
  fi
  log "Pulling latest changes in $WORLDDB_DIR ..."
  (cd "$WORLDDB_DIR" && git pull --ff-only)
  log "Done."
}

cmd_status() {
  if [ -d "$WORLDDB_DIR/.git" ]; then
    local branch
    branch=$(cd "$WORLDDB_DIR" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    local commit
    commit=$(cd "$WORLDDB_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local count
    count=$(find "$WORLDDB_DIR" -name '*.sql' -not -path '*/.git/*' | wc -l)
    log "Cloned: yes"
    log "Path:   $WORLDDB_DIR"
    log "Branch: $branch"
    log "Commit: $commit"
    log "SQL files: $count"
  else
    warn "Not cloned. Run: $0 clone"
  fi
}

cmd_list() {
  if [ ! -d "$WORLDDB_DIR" ]; then
    err "WorldDatabase directory does not exist: $WORLDDB_DIR"
    return 1
  fi
  find "$WORLDDB_DIR" -name '*.sql' -not -path '*/.git/*' \
    | sed "s|^$WORLDDB_DIR/||" | sort
}

cmd_list_continents() {
  if [ ! -d "$WORLDDB_DIR" ]; then
    err "WorldDatabase directory does not exist: $WORLDDB_DIR"
    return 1
  fi
  for d in "$WORLDDB_DIR"/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    [ "$name" = ".git" ] && continue
    count=$(find "$d" -name '*.sql' | wc -l)
    echo "$name ($count files)"
  done
}

apply_file() {
  local file="$1"
  if [ ! -f "$file" ]; then
    err "File not found: $file"
    return 1
  fi
  log "Applying $file ..."
  # Disable foreign key checks so cross-table inserts succeed in any order
  local pwd_arg=()
  if [ -n "$DB_PASSWORD" ]; then
    pwd_arg=(-p"$DB_PASSWORD")
  fi
  if mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "${pwd_arg[@]}" \
        --default-character-set=utf8mb4 "$DB_NAME" <<SQL
SET FOREIGN_KEY_CHECKS=0;
SOURCE $file;
SET FOREIGN_KEY_CHECKS=1;
SQL
  then
    log "OK: $file"
    return 0
  else
    err "FAILED: $file"
    return 1
  fi
}

cmd_apply() {
  local target="${1:-}"
  if [ -z "$target" ]; then
    err "Usage: $0 apply <file.sql>"
    return 1
  fi
  if [ ! -f "$target" ] && [ -f "$WORLDDB_DIR/$target" ]; then
    target="$WORLDDB_DIR/$target"
  fi
  apply_file "$target"
}

cmd_apply_all() {
  if [ ! -d "$WORLDDB_DIR" ]; then
    err "WorldDatabase directory does not exist: $WORLDDB_DIR"
    return 1
  fi
  local count=0 failed=0
  while IFS= read -r f; do
    if apply_file "$f"; then
      count=$((count + 1))
    else
      failed=$((failed + 1))
    fi
  done < <(find "$WORLDDB_DIR" -name '*.sql' -not -path '*/.git/*' | sort)
  log "Applied $count files, $failed failed."
}

cmd_apply_continent() {
  local continent="$1"
  if [ -z "$continent" ]; then
    err "Usage: $0 apply-continent <Alizar|Isigrol|Olyssia|Instance>"
    return 1
  fi
  local dir="$WORLDDB_DIR/$continent"
  if [ ! -d "$dir" ]; then
    err "Continent directory not found: $dir"
    return 1
  fi
  local count=0
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    if apply_file "$f"; then
      count=$((count + 1))
    fi
  done < <(find "$dir" -name '*.sql' | sort)
  log "Applied $count files in $continent."
}

action="${1:-}"
shift || true
case "$action" in
  clone) cmd_clone ;;
  pull) cmd_pull ;;
  status) cmd_status ;;
  list) cmd_list ;;
  list-continents) cmd_list_continents ;;
  apply) cmd_apply "$@" ;;
  apply-all) cmd_apply_all ;;
  apply-continent) cmd_apply_continent "$@" ;;
  *)
    cat <<USAGE
NexusForever WorldDatabase Manager

Usage: $0 <command> [args]

Commands:
  clone                          Clone the WorldDatabase repo
  pull                           Pull latest changes
  status                         Show repo status
  list                           List all SQL files
  list-continents                List continents and counts
  apply <file>                   Apply a single SQL file
  apply-continent <name>         Apply all SQL files in a continent
  apply-all                      Apply all SQL files in the repo
USAGE
    exit 1
    ;;
esac
