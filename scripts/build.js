#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const v = require('./version');

const ROOT = path.join(__dirname, '..');
const BUILD_INFO = path.join(ROOT, 'public', 'build.json');
const VERSION_FILE = path.join(ROOT, 'VERSION');

const version = v.read().raw;
let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {}
let branch = 'unknown';
try { branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {}
const builtAt = new Date().toISOString();

const build = { version, commit, branch, builtAt };
fs.writeFileSync(BUILD_INFO, JSON.stringify(build, null, 2) + '\n');

// Cachebust index.html by replacing __BUILD__ placeholder with the short commit
const indexPath = path.join(ROOT, 'public', 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  if (html.includes('__BUILD__')) {
    // Use commit + builtAt (epoch seconds) so two builds with the same commit
    // (e.g. a dirty tree, or rebuild without commit) still get a fresh stamp.
    const stamp = `${commit || 'dev'}-${Math.floor(Date.now() / 1000)}`;
    html = html.split('__BUILD__').join(stamp);
    fs.writeFileSync(indexPath, html);
    console.log(`Cachebusted index.html with build stamp: ${stamp}`);
  }
}

console.log(`Built ${version} (${commit}@${branch}) at ${builtAt}`);

// Auto-tag if --tag flag is passed
if (process.argv.includes('--tag')) {
  const tag = `v${version}`;
  try {
    execSync(`git tag -a ${tag} -m "Release ${version}"`, { cwd: ROOT, stdio: 'inherit' });
    console.log(`Tagged: ${tag}`);
  } catch (e) {
    console.error(`Tag failed (may already exist): ${e.message}`);
  }
}
