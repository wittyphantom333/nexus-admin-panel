# Command Test Matrix

Verified: 2026-06-05, build 1.6.5, bridge account = id 24, WebSocket role with all 128 perms.

Bridge wire format confirmed (from `/opt/emulator-server/WorldServer/wwwroot/console.html` line 123):
```js
socket.send(JSON.stringify({ message: "..." }));
```
NOT `{type:"command", message:"..."}` as the prior emulator-manager bridge was sending.

## ✅ Working (verified end-to-end)

| Command                              | Result                                                         | Category | Notes                                   |
|--------------------------------------|----------------------------------------------------------------|----------|-----------------------------------------|
| `help`                               | Full category list                                             | help     | Confirms parser works.                  |
| `help <category>`                    | Subcommand list for that category                              | help     | Confirms subcommand resolution works.   |
| `currency account list <name>`       | `ID 1: C.R.E.D.D.` (worked when name was used)                 | currency | Output is the list of currency types.   |

## ⏱️ Time-out (expected — no players online)

These commands need a connected player to deliver a message to. With 0 players online the world server silently absorbs the broadcast; the bridge waits 4s for a reply frame and times out cleanly.

| Command                              | Notes                                                          |
|--------------------------------------|----------------------------------------------------------------|
| `broadcast message 0 hello world`    | Tier 0 (server-wide). No reply expected when no players.       |
| `realm motd test`                    | Sets the realm MOTD. No player-side reply in non-reply design. |

## ❌ "Unable to invoke command" (no such subcommand)

The world server returned this even with all 128 perms granted. Means the subcommand is not registered / not in the perms list / signature differs.

| Command                              | Notes                                                          |
|--------------------------------------|----------------------------------------------------------------|
| `account list`                       | `account` only has `create` and `delete` subcommands.          |
| `currency account add Bob 100 1000` | Subcommand doesn't exist as named. May be `currency add ...`.  |

## ❌ "Invalid target for this command!" (target name resolution)

World server receives the command but can't resolve a target by ID. These commands probably need a *currently online* character, not a stored one.

| Command                              | Notes                                                          |
|--------------------------------------|----------------------------------------------------------------|
| `character save 1`                   | No character with id 1 online.                                 |
| `character save "Test Test"`         | JSON-parse failure in the bridge shell escape — needs proper quoting. |
| `item info 1`, `item info 12345`     | Item id 1 is invalid or not yet in the world DB.               |
| `item lookup 1`                      | Same.                                                          |

## Next: how to make target-resolution work

For commands like `character save 1`, the world server checks for a *connected* character with that ID. Stored characters (`Test Test`, id=1) only become valid targets after they log in. To test, log into the game with a character and run the command against that character.

Quoting issue: the bridge shell escape `"Test Test"` broke the JSON envelope. Will need a small CLI helper to send commands with arbitrary characters in the name (e.g. `node scripts/send-cmd.js "character save 'Test Test'"`).
