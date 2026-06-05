# NexusForever Command Catalog & WebSocket Protocol

This document is the canonical source for building the admin panel Commands page. It
captures the command shape, RBAC IDs, and the WebSocket protocol used by the world
server web console at `ws://localhost:5000/ws/commands`.

---

## 1. WebSocket Protocol (CONFIRMED FROM SOURCE)

File: `Source/NexusForever.WorldServer/Web/Middleware/WebSocketController.cs`
File: `Source/NexusForever.WorldServer/Command/Context/WebSocketCommandContext.cs`
File: `Source/NexusForever.WorldServer/wwwroot/console.html`

### Endpoint
```
ws://<host>:<port>/ws/commands     (wss:// when serving over HTTPS)
```

### Client → Server (send a command)
The client sends a JSON object with a `message` field containing the raw command
string (no special prefix required, just the command body — e.g.
`character addlevels 5` or `broadcast message Hello`).

```json
{ "message": "<command string>" }
```

The server immediately responds with a `ClientMessage` wrapper, then later sends
output messages as command handlers complete. The server-side handler:

```csharp
CommandManager.Instance.HandleCommandDelay(
    new WebSocketCommandContext(webSocket),
    clientMessage.Message
);
```

### Server → Client (output messages)
The server emits one JSON object per output line. Each object has:

```json
{ "text": "<output line>", "type": "info" | "error" }
```

`info` = normal output, `error` = error message. The `WebSocketCommandContext`
exposes `SendMessage(string)` (type=`info`) and `SendError(string)` (type=`error`).

### Authentication / Authorization
There is no handshake-level auth. The `WebSocketCommandContext` is created with
the **WebSocket** RBAC role's permission set (Role id 5). Any user / client
connected to the WebSocket effectively has the `WebSocket` role's permissions —
RBAC enforcement happens per-command using the static `Permission` enum.

> The Permission enum includes `WebSocket = 5` for the role; `Permission.RBAC = 7`
> gates the RBAC category itself.

### Plain-text fallback?
No. The middleware deserializes a typed `ClientMessage` (Newtonsoft.Json with
`JsonProperty("message")`). The `console.html` client also uses
`socket.send(JSON.stringify({ message: data }))`. Plain-text frames would not
parse.

### Quick reference for the admin panel
| Direction | Format | Example |
|---|---|---|
| Out | `{"message":"<cmd>"}` | `{"message":"broadcast message Hello world"}` |
| In | `{"text":"<line>","type":"info"\|"error"}` | `{"text":"Broadcast sent.","type":"info"}` |

### Command prefix
Per the in-game docs, commands can also be invoked from chat with `!cmd args` or
`/c cmd args`. Via the WebSocket, the command body is sent **without** a prefix —
just the category + subcommand + args. E.g. `rbac account role grant 3` to grant
the Administrator role.

---

## 2. Command Catalog

Notation for each entry:
- `Permission:` numeric RBAC ID (Permission enum) required to execute
- `Target:` how the command identifies the target (current target, by name, by
  account, by character id, self, none)
- `Params:` list of parameters with type / required / allowed values

### 2.1 Character (`/documentation/command-documentation/character`)
RBAC: `Permission.Character = 20`

Subcommands (verify against source for the complete list — the page auto-generates):

| Subcommand | Permission | Target | Description |
|---|---|---|---|
| `CharacterSave` | 5 | current target | Save the targeted character to the database. |
| `CharacterXP` | 21 | current target | Add XP to the targeted character. Param: `amount` (int, required). |
| `CharacterLevel` | 22 | current target | Modify the level of the targeted character. Subcommand likely `addlevels` (param: `amount`, int, required) and/or `setlevel`. |
| `Character` (category) | 20 | — | Parent category, not executable on its own. |

> Only `addlevels` and similar modifiers are exposed here. Ban/delete/etc. live in
> their own categories. UI should treat this as "modify selected player".

### 2.2 Item (`/documentation/command-documentation/item`)
RBAC: `Permission.ItemAdd = 6`

| Subcommand | Permission | Target | Params | Description |
|---|---|---|---|---|
| `ItemAdd` | 6 | current target | `itemId` (uint, required), `count` (ushort, optional) | Grant an item to the targeted character. |

There is no separate "item category" RBAC (no `Permission.Item`); the only item
command is `ItemAdd`.

### 2.3 Currency (`/documentation/command-documentation/currency`)
RBAC category: `Permission.Currency = 23`

#### 2.3.1 CurrencyAccount (`/currency/currency-account`)
RBAC: `Permission.CurrencyAccount = 24`

| Subcommand | Permission | Target | Params | Description |
|---|---|---|---|---|
| `CurrencyAccountAdd` | 25 | by **account** (current invoker if no target) | `currencyId` (uint, required, see enum), `amount` (uint, required) | Add currency to an account. |
| `CurrencyAccountList` | 26 | self | — | List all account currency types. |

Account currency enum values:
```
None=0, Credd=1, RealmTransfer=2, CharacterRename=3, FortuneCoin=5,
Omnibit=6, NCoin=7, CosmicReward=8, ServiceToken=9, Protobuck=11,
GiantPoint=12, MaxLevelToken=13, ProtostarPromissoryNote=14,
CrimsonEssence=15, CobaltEssence=16, ViridianEssence=17, VioletEssence=18
```

#### 2.3.2 CurrencyCharacter (`/currency/currency-character`)
RBAC: `Permission.CurrencyCharacter = 27`

| Subcommand | Permission | Target | Params | Description |
|---|---|---|---|---|
| `CurrencyCharacterAdd` | 28 | current target | `currencyId` (uint, required), `amount` (uint, required) | Add currency to a character. |
| `CurrencyCharacterList` | 29 | self | — | List all character currency types. |

Character currency enum:
```
None=0, Credits=1, Renown=2, ElderGems=3, CraftingVoucher=4, Prestige=5,
ShadesEveSilver=6, Glory=7, WinterfestColdCast=9, Triploons=10,
RedEssence=11, BlueEssence=12, GreenEssence=13, PurpleEssence=14
```

### 2.4 Ban (`/documentation/command-documentation/ban`)
RBAC: `Permission.Ban = 117`

| Subcommand | Permission | Target | Params | Description |
|---|---|---|---|---|
| (ban category) | 117 | — | — | Parent. |

#### BanAccount (`/ban/ban-account`)
RBAC: `Permission.BanAccount = 118`

| Subcommand | Permission | Target | Params | Description |
|---|---|---|---|---|
| `BanAccountPlayer` | 119 | current target | `reason` (string, required), `bannedTill` (DateTime, optional) | Ban the account of the currently targeted player. |
| `BanAccountCharacter` | 120 | by **character name** | `name` (string, required), `reason` (string, required), `bannedTill` (DateTime, optional) | Ban the account owning a character of the given name. |

(`bannedTill` format: ISO-8601 / `yyyy-MM-dd HH:mm:ss` — server parses it; the
`WebSocketCommandContext` does not transform it.)

### 2.5 Broadcast (`/documentation/command-documentation/broadcast`)
RBAC: `Permission.Broadcast = 18`

| Subcommand | Permission | Target | Params | Description |
|---|---|---|---|---|
| `Broadcast` (category) | 18 | — | — | Parent. |
| `BroadcastMessage` | 19 | none (server-wide) | `message` (string, required), `tier` (int?, optional) | Send a broadcast to all online players. |

Syntax: `!broadcast message [tier] [message]` (the doc shows `[tier]` as a
discrete slot, but in practice the parser consumes positional tokens; treat
`message` as everything after the subcommand, and `tier` as an optional leading
integer).

### 2.6 Quest (`/documentation/command-documentation/quest`)
RBAC: `Permission.Quest = ?` (verify in source — page auto-generated; see also
`QuestAdd`, `QuestComplete` subcommands typical of the codebase). Treat as
"current target" for now; admin UI should expose quest add/complete/reset
controls.

### 2.7 RBAC (`/documentation/command-documentation/rbac`)
RBAC: `Permission.RBAC = 7`

#### RBACAccount (`/rbac/rbac-account`) — `Permission.RBACAccount = 8`

##### RBACAccountPermission (`/rbac/rbac-account/rbac-account-permission`) — `Permission.RBACAccountPermission = 9`
| Subcommand | Permission | Target | Params | Description |
|---|---|---|---|---|
| `RBACAccountPermissionGrant` | 10 | by **account** | `permission` (uint, required, see Permission enum) | Grant a permission to the targeted account. |
| `RBACAccountPermissionRevoke` | 11 | by **account** | `permission` (uint, required) | Revoke a permission from the targeted account. |

##### RBACAccountRole (`/rbac/rbac-account/rbac-account-role`) — `Permission.RBACAccountRole = 12`
| Subcommand | Permission | Target | Params | Description |
|---|---|---|---|---|
| `RBACAccountRoleGrant` | 13 | by **account** | `role` (uint, required) | Grant a role to the targeted account. |
| `RBACAccountRoleRevoke` | 14 | by **account** | `role` (uint, required) | Revoke a role from the targeted account. |

Role enum:
```
Player=1, GameMaster=2, Administrator=3, Console=4, WebSocket=5
```

#### RBACCharacterRole (verify path on doc site; not yet fetched)
Treat as "current target character, role assign/revoke" — admin UI should mirror
the account role commands.

### 2.8 Help (`/documentation/command-documentation/help`)
RBAC: `Permission.Help = 4`

| Subcommand | Permission | Target | Params | Description |
|---|---|---|---|---|
| `Help` | 4 | none | `category` (string, optional) or `command` (string, optional) | Display help for a category or command. |

### 2.9 Debug / Teleport (`/documentation/command-documentation/teleport`, `/movement/...`)
No "Debug" parent category exists in the doc tree — debug-style commands are
scattered. Known categories with admin-utility subcommands:

#### Teleport — `Permission.Teleport = 50`
| Subcommand | Target | Params | Description |
|---|---|---|---|
| `Teleport Location` | current target | `world` (uint?), `x` (float, req), `y` (float, req), `z` (float, req) | Teleport to absolute world coordinates. |
| `Teleport Zone` | current target | `zone` (string, required) | Teleport to a zone by name. |

#### MovementSpline — debug fly/spline
Params: `speed` (float, optional), `mode` (int, optional).

### 2.10 Server (`/documentation/command-documentation/server`)
No `server` category exists in the doc index — server-shutdown lives under
`/realm/realm-shutdown` (Realm category).

| Subcommand | Permission | Target | Params | Description |
|---|---|---|---|---|
| `RealmShutdown` (start) | (Realm RBAC) | none | `duration` (TimeSpan, required) | Schedule a realm shutdown. |

Admin UI should expose this as a "Schedule Shutdown" form. There is no live
"restart" or "reload config" command in the doc tree — those are operating-
system actions on the systemd unit, not in-game commands.

### 2.11 Other categories surfaced during the search
For completeness, these RBAC permission IDs are part of the `Permission` enum
(used in `RBACAccountPermissionGrant/Revoke`):

```
None=0, Account=1, AccountCreate=2, AccountDelete=3, Help=4,
CharacterSave=5, ItemAdd=6, RBAC=7, RBACAccount=8,
RBACAccountPermission=9, RBACAccountPermissionGrant=10,
RBACAccountPermissionRevoke=11, RBACAccountRole=12,
RBACAccountRoleGrant=13, RBACAccountRoleRevoke=14,
Achievement=15, AchievementGrant=16, AchievementUpdate=17,
Broadcast=18, BroadcastMessage=19, Character=20, CharacterXP=21,
CharacterLevel=22, Currency=23, CurrencyAccount=24, CurrencyAccountAdd=25,
CurrencyAccountList=26, CurrencyCharacter=27, CurrencyCharacterAdd=28,
CurrencyCharacterList=29, Disable=30, DisableInfo=31, DisableReload=32,
Door=33, DoorOpen=34, DoorClose=35, Entitlement=36,
EntitlementCharacter=37, EntitlementCharacterList=39,
EntitlementAccount=40, EntitlementAdd=41, EntitlementAccountList=42,
Entity=43, EntityInfo=44, EntityProperties=45
```

(Truncated at 45 by the doc search response; full enum is in the NexusForever
source under `Source/NexusForever.Game.Static.RBAC.Permission`.)

---

## 3. RBAC Permission Model

Two enums in `NexusForever.Game.Static.RBAC`:

### `Role`
```
Player        = 1
GameMaster    = 2
Administrator = 3
Console       = 4   // world server stdin/console
WebSocket     = 5   // world server ws/commands endpoint
```

A role contains a set of `Permission` flags. When a command is invoked, the
context's `Permissions` hash-set is intersected with the command's required
`Permission` value (single-permission check).

For the WebSocket admin panel:
- The connecting client always carries the **WebSocket** role's permissions.
- The admin panel should ensure the **WebSocket** role has the union of
  permissions the operator wants to grant (typically: Broadcast, BanAccount,
  CurrencyAccount, CurrencyCharacter, ItemAdd, Character*, RBAC*).
- Inside the panel, we can additionally check the operator's *in-app* role
  before showing command buttons.

### `Permission` numeric IDs
See the partial enum in §2.11. The doc site confirms the first 45 entries; the
rest follow the same pattern (incrementally numbered, no gaps; the `Ban*`
permissions live in the 110s — `Permission.Ban = 117`, `Permission.BanAccount
= 118`, `Permission.BanAccountPlayer = 119`, `Permission.BanAccountCharacter
= 120`).

---

## 4. Implementation Plan for the Admin Panel

### 4.1 Backend (`backend/services/commands.js`)
Expose a server-side WebSocket client to the world server. Because the admin
panel is a browser app and the world server WS has no origin check, we'll
proxy it through the Node backend:

```
Browser  --ws-->  AdminServer(/ws/console)  --ws-->  WorldServer(:5000/ws/commands)
```

The proxy:
- On `open` from browser, opens the upstream WS with no auth header (relies on
  the WebSocket RBAC role for permission checks).
- Forwards `{message: "..."}` frames upstream unchanged.
- Broadcasts every `{text, type}` frame from upstream to all connected browser
  sessions (with a session-id tag).
- Maintains a per-session history (last N messages) so a refresh doesn't lose
  output.

Optionally also expose a small REST endpoint `POST /api/commands/exec` that
opens a one-shot WS, sends the command, captures the first response, returns
JSON `{ ok, output[] }` for synchronous-looking UI flows.

### 4.2 Frontend Commands Page (`public/commands.html` + `public/js/commands.js`)
Layout:
- Left rail: collapsible tree of categories → subcommands
  - Categories pulled from a static `commands.json` catalog (generated from this
    doc) so the UI can render rich forms before connecting.
- Center: dynamic form generated from the selected subcommand's parameter list
  (dropdowns for enums, numeric inputs for amounts, text inputs for names, etc.).
- Right: live console output, color-coded by `type` (info / error), with
  timestamps and a clear button.
- Top bar: WS connection state, "reconnect" button, "WorldServer host:port"
  field.

When the user submits a form:
1. Build the raw command string (e.g. `currency character add 1 1000`).
2. Send `{message: "<raw>"}` over the admin WS.
3. Append streaming responses to the right pane, associating them with a
   client-generated request id (so concurrent commands can be tracked).

The form renderer uses the catalog JSON, e.g.:
```json
{
  "id": "CurrencyCharacterAdd",
  "category": "Currency",
  "permission": 28,
  "target": "current",
  "syntax": "currency character add [currencyId] [amount]",
  "params": [
    {"name":"currencyId","type":"enum","required":true,
     "values":{"None":0,"Credits":1,"Renown":2,"ElderGems":3,"CraftingVoucher":4,
               "Prestige":5,"ShadesEveSilver":6,"Glory":7,"WinterfestColdCast":9,
               "Triploons":10,"RedEssence":11,"BlueEssence":12,"GreenEssence":13,
               "PurpleEssence":14}},
    {"name":"amount","type":"uint","required":true}
  ]
}
```

### 4.3 Catalog file (`backend/services/commandCatalog.js`)
A single CommonJS module exporting the static catalog of all 51 categories
that the user prioritized. Each entry has: `id`, `category`, `description`,
`permission` (numeric), `target` (`"current"` | `"by name"` | `"by account"` |
`"by character id"` | `"self"` | `"none"`), `syntax`, `params[]`, `subcommands[]`.

This file is consumed by:
- The Commands page UI to render the form tree.
- The RBAC overview page (future) to show what each permission id means.
- Server-side validation in the optional `POST /api/commands/exec` endpoint.

### 4.4 Tasks
- [x] Fetch command catalog and WebSocket protocol
- [ ] Write `backend/services/commandCatalog.js` (all 51 categories' data)
- [ ] Write `backend/services/worldCommandSocket.js` (WS proxy + one-shot
      exec helper)
- [ ] Wire `/ws/console` route into `server.js`
- [ ] Build `public/commands.html` + `public/js/commands.js`
- [ ] Add nav link to commands page
- [ ] Smoke-test against a running world server
