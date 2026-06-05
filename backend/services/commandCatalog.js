// Command catalog: derived from NexusForever documentation
// (https://www.emulator.ws/documentation/command-documentation/...)
// All commands use either chat syntax:
//   !<category> <subcommand> [params…]
//   /c <category> <subcommand> [params…]
// targeting: "current target" by default (the issuing character/world-socket user).
// Numeric IDs are NexusForever RBAC permission IDs (Permission enum).

const CATEGORIES = [
  {
    id: 'Character', permission: 20,
    description: 'Manage a character.',
    subcommands: [
      { id: 'Xp', syntax: 'character xp [amount]', permission: 21, target: 'current target',
        description: 'Add XP to character.',
        params: [{ name: 'amount', type: 'number', required: true }] },
      { id: 'Level', syntax: 'character level [level]', permission: 22, target: 'current target',
        description: 'Set character level.',
        params: [{ name: 'level', type: 'number', required: true }] },
      { id: 'Save', syntax: 'character save', permission: 0, target: 'self',
        description: 'Save pending character changes to DB.', params: [] },
    ],
  },
  {
    id: 'Item', permission: 59,
    description: 'Manage items for a character.',
    subcommands: [
      { id: 'Add', syntax: 'item add [itemId] [quantity] [charges]', permission: 6, target: 'current target',
        description: 'Add an item to inventory.',
        params: [
          { name: 'itemId', type: 'number', required: true },
          { name: 'quantity', type: 'number', required: true },
          { name: 'charges', type: 'number', required: true },
        ] },
      { id: 'Lookup', syntax: 'item lookup [name] [maxResults]', permission: 92, target: 'none',
        description: 'Lookup an item by partial name.',
        params: [
          { name: 'name', type: 'string', required: true },
          { name: 'maxResults', type: 'number', required: false },
        ] },
    ],
  },
  {
    id: 'Currency', permission: 23,
    description: 'Modify account and character currency.',
    subcommands: [
      // The Currency category has account and character sub-categories in the server
      { id: 'Account', syntax: 'currency account <sub>', permission: 23, target: 'by account',
        description: 'Account-level currency commands (see sub-pages).',
        params: [
          { name: 'subcommand', type: 'enum', required: true, values: { 'AddCurrency': 'add', 'RemoveCurrency': 'remove', 'List': 'list' } },
          { name: 'account', type: 'string', required: true },
          { name: 'currencyId', type: 'number', required: false },
          { name: 'amount', type: 'number', required: false },
        ] },
      { id: 'Character', syntax: 'currency character <sub>', permission: 23, target: 'by character id',
        description: 'Character-level currency commands (see sub-pages).',
        params: [
          { name: 'subcommand', type: 'enum', required: true, values: { 'AddCurrency': 'add', 'RemoveCurrency': 'remove', 'List': 'list' } },
          { name: 'characterId', type: 'number', required: true },
          { name: 'currencyId', type: 'number', required: false },
          { name: 'amount', type: 'number', required: false },
        ] },
    ],
  },
  {
    id: 'Ban', permission: 117,
    description: 'Manage bans on accounts and characters.',
    subcommands: [
      { id: 'Account', syntax: 'ban account <action>', permission: 117, target: 'by account',
        description: 'Ban/Unban an account (see BanAccount sub-commands).',
        params: [
          { name: 'action', type: 'enum', required: true, values: { 'Ban': 'ban', 'Unban': 'unban' } },
          { name: 'account', type: 'string', required: true },
          { name: 'reason', type: 'string', required: false },
        ] },
      { id: 'Character', syntax: 'ban character <action>', permission: 117, target: 'by character id',
        description: 'Ban/Unban a character.',
        params: [
          { name: 'action', type: 'enum', required: true, values: { 'Ban': 'ban', 'Unban': 'unban' } },
          { name: 'characterId', type: 'number', required: true },
          { name: 'reason', type: 'string', required: false },
        ] },
    ],
  },
  {
    id: 'Broadcast', permission: 18,
    description: 'Broadcast server-wide messages.',
    subcommands: [
      { id: 'Message', syntax: 'broadcast message [tier] [message]', permission: 19, target: 'server-wide',
        description: 'Broadcast a message to all players on the server.',
        params: [
          { name: 'tier', type: 'enum', required: true, values: { 'High': 0, 'Medium': 1, 'Low': 2 } },
          { name: 'message', type: 'string', required: true },
        ] },
    ],
  },
  {
    id: 'Quest', permission: 76,
    description: 'Manage quests for a character.',
    subcommands: [
      { id: 'List', syntax: 'quest list', permission: 110, target: 'current target',
        description: 'List all active quests.', params: [] },
      { id: 'Add', syntax: 'quest add [questId]', permission: 77, target: 'current target',
        description: 'Add a new quest to character.',
        params: [{ name: 'questId', type: 'number', required: true }] },
      { id: 'Achieve', syntax: 'quest achieve [questId]', permission: 78, target: 'current target',
        description: 'Achieve an existing quest by completing all objectives.',
        params: [{ name: 'questId', type: 'number', required: true }] },
    ],
  },
  {
    id: 'Help', permission: 4,
    description: 'Display help for a category or command.',
    subcommands: [
      { id: 'List', syntax: 'help list', permission: 4, target: 'none',
        description: 'List all command categories.', params: [] },
      { id: 'Category', syntax: 'help category [name]', permission: 4, target: 'none',
        description: 'Show commands in a category.',
        params: [{ name: 'name', type: 'string', required: true }] },
      { id: 'Command', syntax: 'help command [name]', permission: 4, target: 'none',
        description: 'Show details for a specific command.',
        params: [{ name: 'name', type: 'string', required: true }] },
    ],
  },
  {
    id: 'RBAC', permission: 0,
    description: 'Role-based access control management.',
    subcommands: [
      { id: 'Account', syntax: 'rbac account <sub>', permission: 0, target: 'by account',
        description: 'Manage RBAC account associations.', params: [] },
      { id: 'AccountRole', syntax: 'rbac accountrole <sub>', permission: 0, target: 'by account',
        description: 'Assign/remove roles on an account.', params: [] },
      { id: 'AccountPermission', syntax: 'rbac accountpermission <sub>', permission: 0, target: 'by account',
        description: 'Assign/remove permissions on an account.', params: [] },
      { id: 'CharacterRole', syntax: 'rbac characterrole <sub>', permission: 0, target: 'by character id',
        description: 'Assign/remove roles on a character.', params: [] },
    ],
  },
  {
    id: 'Debug', permission: 0,
    description: 'Debug commands (availability depends on build).',
    subcommands: [
      { id: 'Info', syntax: 'debug info', permission: 0, target: 'self',
        description: 'Print debug info.', params: [] },
    ],
  },
  {
    id: 'Server', permission: 0,
    description: 'Server-level commands (availability depends on build).',
    subcommands: [
      { id: 'Status', syntax: 'server status', permission: 0, target: 'self',
        description: 'Show server status.', params: [] },
      { id: 'Shutdown', syntax: 'server shutdown [seconds]', permission: 0, target: 'self',
        description: 'Schedule server shutdown.',
        params: [{ name: 'seconds', type: 'number', required: false }] },
    ],
  },
];

// RBAC permission reference (NexusForever Permission enum, partial)
// Map: name -> numeric id. 0 = no special permission.
const PERMISSIONS = {
  'Help': 4,
  'ItemAdd': 6,
  'Broadcast': 18,
  'BroadcastMessage': 19,
  'Character': 20,
  'CharacterXP': 21,
  'CharacterLevel': 22,
  'Currency': 23,
  'Item': 59,
  'Quest': 76,
  'QuestAdd': 77,
  'QuestAchieve': 78,
  'ItemLookup': 92,
  'QuestList': 110,
  'Ban': 117,
};

module.exports = { CATEGORIES, PERMISSIONS };
