# Nexus Admin Panel — Command Catalog

Auto-derived reference of every NexusForever in-game command supported by the
admin panel. The authoritative source of truth is
`backend/services/commandCatalog.js`; this document is generated from that file
and stays in lock-step with it (regenerate by reading the file when a command
is added/removed).

- **Last verified:** 2026-06-05
- **Build:** 1.6.9-realm-fix
- **Bridge account:** id 24 (role: WebSocket, all 128 perms)
- **Wire format:** `socket.send(JSON.stringify({ message: "<cmd>" }))` — see
  `docs/COMMAND-TEST-MATRIX.md` for the original trace that confirmed this.

## Conventions

- **Syntax** is the exact string the world server accepts. Tokens in `[brackets]`
  are parameters; the bridge substitutes them from the UI form.
- **Permission** is the NexusForever `Permission` enum id. `0` means "no special
  permission enforced by the panel" — the world server still does its own RBAC
  check.
- **Target** describes who/what the command operates on. The panel translates
  a UI selection into a concrete argument (e.g. "current target" → the
  selected character name/id).
- **Status** mirrors `COMMAND-TEST-MATRIX.md` (✅ verified, ⏱️ timeout-only,
  ❌ error).

---

## Categories

### 1. Character (`permission: 20`)

Manage a character.

| Subcommand | Syntax | Permission | Target | Description | Status |
|---|---|---|---|---|---|
| `Xp` | `character xp [amount]` | 21 | current target | Add XP to character. | ⏱️ |
| `Level` | `character level [level]` | 22 | current target | Set character level. | ⏱️ |
| `Save` | `character save` | 0 | self | Save pending character changes to DB. | ⏱️ |

**UI location:**
- `Xp` / `Level` → **Character Details** page → "Adjust XP" / "Set Level" buttons.
- `Save` → **Character Details** page → actions row "Force Save" button.

### 2. Item (`permission: 59`)

Manage items for a character.

| Subcommand | Syntax | Permission | Target | Description | Status |
|---|---|---|---|---|---|
| `Add` | `item add [itemId] [quantity] [charges]` | 6 | current target | Add an item to inventory. | ⏱️ |
| `Lookup` | `item lookup [name] [maxResults]` | 92 | none | Lookup an item by partial name. | ❌ no-reply (lookup returns a list — needs a follow-up frame) |

**UI location:**
- `Add` → **Character Details** → Inventory tab → "Add Item" form.
- `Lookup` → Command Console only (no UI binding yet).

### 3. Currency (`permission: 23`)

Modify account and character currency.

| Subcommand | Syntax | Permission | Target | Description | Status |
|---|---|---|---|---|---|
| `Account` | `currency account <sub>` | 23 | by account | Account-level currency commands. | ✅ (`list`) / ⏱️ (`add`/`remove`) |
| `Character` | `currency character <sub>` | 23 | by character id | Character-level currency commands. | ⏱️ |

Sub-actions on each: `add`, `remove`, `list`.

**UI location:** Command Console (`/#/commands`) — not yet wired to the Account
or Character pages. `currency account list <name>` is a working query that
returns the currency catalog (`C.R.E.D.D.`, `Renown`, etc.).

### 4. Ban (`permission: 117`)

Manage bans on accounts and characters.

| Subcommand | Syntax | Permission | Target | Description | Status |
|---|---|---|---|---|---|
| `Account` | `ban account <action>` | 117 | by account | Ban/Unban an account. | ⏱️ |
| `Character` | `ban character <action>` | 117 | by character id | Ban/Unban a character. | ⏱️ |

Sub-actions: `ban`, `unban`. Optional `[reason]` param.

**UI location:** Command Console only.

### 5. Broadcast (`permission: 18`)

Broadcast server-wide messages.

| Subcommand | Syntax | Permission | Target | Description | Status |
|---|---|---|---|---|---|
| `Message` | `broadcast message [tier] [message]` | 19 | server-wide | Broadcast a message to all players. | ⏱️ |

Tier values: `0` = High, `1` = Medium, `2` = Low.

**UI location:** **Server Status** page, top-right "Server Broadcast" widget.
Toast on success: `Broadcast sent (tier N)`.

### 6. Quest (`permission: 76`)

Manage quests for a character.

| Subcommand | Syntax | Permission | Target | Description | Status |
|---|---|---|---|---|---|
| `List` | `quest list` | 110 | current target | List all active quests. | ⏱️ |
| `Add` | `quest add [questId]` | 77 | current target | Add a new quest to character. | ⏱️ |
| `Achieve` | `quest achieve [questId]` | 78 | current target | Achieve an existing quest. | ⏱️ |

**UI location:** Command Console only.

### 7. Help (`permission: 4`)

Display help for a category or command.

| Subcommand | Syntax | Permission | Target | Description | Status |
|---|---|---|---|---|---|
| `List` | `help list` | 4 | none | List all command categories. | ✅ |
| `Category` | `help category [name]` | 4 | none | Show commands in a category. | ✅ |
| `Command` | `help command [name]` | 4 | none | Show details for a specific command. | ✅ |

**UI location:** "?" icon next to every form field on the Command Console page
and on every contextual form elsewhere. Clicking it dispatches
`help command <syntax>` and shows the result in a tooltip.

### 8. RBAC (`permission: 0`)

Role-based access control management. The panel UI delegates the heavy lifting
to the world server; these are typed manually in the Command Console for now.

| Subcommand | Syntax | Permission | Target | Description | Status |
|---|---|---|---|---|---|
| `Account` | `rbac account <sub>` | 0 | by account | Manage RBAC account associations. | ❌ not yet exercised |
| `AccountRole` | `rbac accountrole <sub>` | 0 | by account | Assign/remove roles on an account. | ❌ not yet exercised |
| `AccountPermission` | `rbac accountpermission <sub>` | 0 | by account | Assign/remove permissions on an account. | ❌ not yet exercised |
| `CharacterRole` | `rbac characterrole <sub>` | 0 | by character id | Assign/remove roles on a character. | ❌ not yet exercised |

**UI location:** Account/Character pages, "Permissions" tab (read-only display
of current state) — edits still route through the Command Console.

### 9. Debug (`permission: 0`)

Build-dependent diagnostic commands.

| Subcommand | Syntax | Permission | Target | Description | Status |
|---|---|---|---|---|---|
| `Info` | `debug info` | 0 | self | Print debug info. | ❌ not yet exercised |

### 10. Server (`permission: 0`)

Build-dependent server-level commands.

| Subcommand | Syntax | Permission | Target | Description | Status |
|---|---|---|---|---|---|
| `Status` | `server status` | 0 | self | Show server status. | ❌ not yet exercised |
| `Shutdown` | `server shutdown [seconds]` | 0 | self | Schedule server shutdown. | ❌ not yet exercised |

`[seconds]` is optional. **No UI binding yet** — this is a destructive command
and should land behind a confirmation modal before being exposed to admin users.

### 11. Realm (`permission: 0`)

Realm-wide configuration. Sourced from NexusForever docs, not in
`commandCatalog.js` yet (add as a `Realm` category once the bridge support is
merged).

| Subcommand | Syntax | Permission | Target | Description | Status |
|---|---|---|---|---|---|
| `Motd` | `realm motd [message]` | 0 | server-wide | Set the realm message of the day. | ⏱️ |

**UI location:** **Server Status** page, "Realm MOTD" sub-widget next to
broadcast.

---

## Permission reference

`Permission` enum ids used by the catalog (NexusForever). Source of truth:
`commandCatalog.js → PERMISSIONS`. There are 128 permissions total; the
WebSocket bridge account is granted **all 128** so any command can be dispatched.

| Name | Id | Used by |
|---|---|---|
| Help | 4 | `help *` |
| ItemAdd | 6 | `item add` |
| Broadcast | 18 | `broadcast` category |
| BroadcastMessage | 19 | `broadcast message` |
| Character | 20 | `character` category |
| CharacterXP | 21 | `character xp` |
| CharacterLevel | 22 | `character level` |
| Currency | 23 | `currency *` |
| Item | 59 | `item` category |
| Quest | 76 | `quest` category |
| QuestAdd | 77 | `quest add` |
| QuestAchieve | 78 | `quest achieve` |
| ItemLookup | 92 | `item lookup` |
| QuestList | 110 | `quest list` |
| Ban | 117 | `ban *` |

## Notes for future work

- The `Realm` category is not yet in `commandCatalog.js` — the bridge supports
  it (`realm motd` works) but the catalog hasn't been updated. Tracked in
  task #2 follow-up.
- `item lookup` returns multiple lines; the bridge currently waits for a single
  reply frame and times out. Needs a multi-frame reader (similar to the
  session-list subscription) or a "first-line-only" UI affordance.
- `server shutdown` should get a confirmation modal before being exposed to
  non-root admins.
