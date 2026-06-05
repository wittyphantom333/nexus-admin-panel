#!/usr/bin/env node
const v = require('./version');

const args = process.argv.slice(2);
const cmd = args[0] || 'patch';
const preId = args[1];

if (cmd === 'show' || cmd === 'current') {
  console.log(v.read().raw);
  process.exit(0);
}

if (cmd === 'set-build') {
  const build = args[1];
  if (!build) { console.error('Usage: version-bump set-build <id>'); process.exit(1); }
  console.log(v.setBuild(build));
  process.exit(0);
}

const valid = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'];
if (!valid.includes(cmd)) {
  console.error(`Usage: version-bump [${valid.join('|')}|show|set-build <id>] [preId]`);
  process.exit(1);
}

const next = v.bump(cmd, preId);
console.log(next);
