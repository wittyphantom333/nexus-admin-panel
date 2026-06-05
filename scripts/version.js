const fs = require('fs');
const path = require('path');

const VERSION_FILE = path.join(__dirname, '..', 'VERSION');
const PACKAGE_FILE = path.join(__dirname, '..', 'package.json');

function parse(v) {
  const m = v.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/);
  if (!m) throw new Error(`Invalid version: ${v}`);
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] || null, build: m[5] || null, raw: v.trim() };
}

function format({ major, minor, patch, pre, build }) {
  let s = `${major}.${minor}.${patch}`;
  if (pre) s += `-${pre}`;
  if (build) s += `+${build}`;
  return s;
}

function read() {
  return parse(fs.readFileSync(VERSION_FILE, 'utf8'));
}

function bump(type = 'patch', preId) {
  const cur = read();
  let next = { ...cur };
  if (type === 'major') { next.major++; next.minor = 0; next.patch = 0; next.pre = null; }
  else if (type === 'minor') { next.minor++; next.patch = 0; next.pre = null; }
  else if (type === 'patch') { next.patch++; next.pre = null; }
  else if (type === 'premajor') { next.major++; next.minor = 0; next.patch = 0; next.pre = preId || 'rc.0'; }
  else if (type === 'preminor') { next.minor++; next.patch = 0; next.pre = preId || 'rc.0'; }
  else if (type === 'prepatch') { next.patch++; next.pre = preId || 'rc.0'; }
  else if (type === 'prerelease') {
    if (cur.pre) {
      const m = cur.pre.match(/^([0-9A-Za-z-]+)\.(\d+)$/);
      if (m) next.pre = `${m[1]}.${+m[2] + 1}`;
      else next.pre = `${cur.pre}.0`;
    } else { next.patch++; next.pre = preId || 'rc.0'; }
  } else {
    throw new Error(`Unknown bump type: ${type}`);
  }
  next.raw = format(next);
  fs.writeFileSync(VERSION_FILE, next.raw + '\n');
  syncPackage(next.raw);
  return next.raw;
}

function setBuild(build) {
  const cur = read();
  const next = { ...cur, build, raw: format({ ...cur, build }) };
  fs.writeFileSync(VERSION_FILE, next.raw + '\n');
  syncPackage(next.raw);
  return next.raw;
}

function syncPackage(version) {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(PACKAGE_FILE, JSON.stringify(pkg, null, 2) + '\n');
}

module.exports = { read, parse, format, bump, setBuild, syncPackage };
