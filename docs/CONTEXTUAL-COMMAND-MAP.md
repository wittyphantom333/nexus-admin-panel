# Nexus Admin Panel — Contextual Command Map

This doc maps every NexusForever in-game command (from the live `commandCatalog.js`
+ the world server's RBAC permission table) to **where** it's exposed in the admin
panel UI. The goal is to avoid a single monolithic "command console" and instead
expose each command where it makes operational sense.

## How the bridge works

```
Browser tab
   │  (JWT in query string)
   ▼
admin server  /ws/console  ───►  worldCommandSocket.js
   │  (account=24, sessionKey=…)
   ▼
world server  ws://host:5000/ws/commands
   │  (executes the command, replies via JSON)
   ▼
{ type, message, level, time }
```

- One **persistent** world WS, kept by the admin server.
- Browser tabs share the bridge — only the admin server holds the world WS open.
- All commands and replies are also written to the `command_log` table and visible
  on **Logs → Command Log** (filter by `broadcast`, `ban`, `xp`, etc.).

## Where each command lives in the UI

| Command | Where it lives | Why |
|---|---|---|
| `broadcast message [tier] [msg]` | **Server Status** page, top-right "Server Broadcast" widget | Global operational notice; admins fire it when they want to reach *all* players immediately. Toast = "Broadcast sent (tier N)" → log row. |
| `realm motd [msg]` | **Server Status** page, "Realm MOTD" sub-widget next to broadcast | Realm-scoped, lives next to broadcast. Reuses the same form pattern. |
| `character xp [amount]` | **Character Details** page, "Adjust XP" button next to the XP bar | Operates on the character the user is looking at. |
| `character level [level]` | **Character Details** page, "Set Level" button | Same as XP — act on the visible character. |
| `character save` | **Character Details** page, "Force Save" button in the actions row | Save-now use case. |
| `item add [itemId] [qty] [charges]` | **Character Details** page → Inventory tab → "+ Add Item" modal (item-id picker) | Operates on the current character; uses item-id not name to avoid ambiguity. |
| `item lookup [name] [max]` | The Add Item modal's search box (server-side lookup) | Catalog lookup, not an inventory action. |
| `currency account <sub>` | **Account Details** page, "Currency" tab | Account-scoped currency, sibling of characters. |
| `currency character <sub>` | **Character Details** page → Currency tab | Character-scoped currency, lives with the character. |
| `ban account <action>` | **Accounts** table, red ban-icon button on each row. Modal asks for reason + duration. | Targeted at a specific account; lives next to the account. |
| `ban character <action>` | **Character Details** page, ban button in the actions row | Targeted at a specific character. |
| `quest list` | **Character Details** → Quests tab → "Refresh Quests" button | Need the live quest state for this character. |
| `quest add [id]` | **Character Details** → Quests tab → "+ Add Quest" (searchable quest-id picker) | Same scope as above. |
| `quest achieve [id]` | **Character Details** → Quests tab → "✓ Force Complete" per quest row | Same scope. |
| `help list` / `help category` / `help command` | **Command Console** page (`/#/commands`), "?" button next to each form field | Discoverability tool, paired with the catalog. |
| `rbac account …` | **Account Details** → "In-Game RBAC" tab | Manages in-game roles for this account. |
| `rbac accountrole …` | **Account Details** → "In-Game RBAC" tab → Roles section | Granular role grant/revoke. |
| `rbac accountpermission …` | **Account Details** → "In-Game RBAC" tab → Permissions section | Granular per-permission grant/revoke. |
| `account create` / `account delete` | **Accounts** page, "+ Create Account" and the delete button in the row | Direct account CRUD, lives in the same module. |
| `achievement grant` / `achievement update` | **Character Details** → Achievements tab | Operates on the visible character. |
| All 23 subcommands (free-form) | **Command Console** page (`/#/commands`) | Power-user / fallback — searchable catalog with all categories. |

## RBAC permission codes

Each subcommand carries a `permission` id from NexusForever's `Permission` enum.
The admin server maps these to **panel-side** RBAC codes (in
`backend/services/seed.js`) so a panel user without, e.g., `accounts.ban` will
not see the Ban button at all. A panel user *with* the code sees the button and
the command is dispatched; the **world server** then enforces in-game RBAC.

The two systems are intentionally decoupled:

- A player who is a GM in-game has no panel access by default.
- A player who is a panel Admin has no in-game GM powers unless the account is
  also granted the matching in-game permission (see `account_permission` table).
- The bridge itself runs as account 24 (the admin bridge account) and holds
  **all 128 in-game permissions** so the bridge can dispatch any command the
  panel-side user is authorised to fire.

## How a command fires end-to-end

1. User clicks a contextual button (e.g. "Set Level" in Character Details).
2. Frontend calls `window.CX.execCommand("character level 50", { notify: true })`.
3. `execCommand` POSTs to `/api/commands/exec` with the user's JWT.
4. Admin server checks **panel-side RBAC** (`requiresPerm("characters.adjust")`).
5. Admin server opens a one-shot WS to the world server (or reuses the long-lived
   bridge if present), sends `{ type: "command", message: "character level 50" }`.
6. World server checks **in-game RBAC** for account 24, executes the command.
7. World server replies with `{ type, message, level, time }` (or "command timed
   out" if there's no observable effect, e.g. no players online for `broadcast`).
8. Admin server writes a row to `command_log` and returns the reply.
9. Frontend shows a toast and the user can later browse the row under
   **Logs → Command Log**.
