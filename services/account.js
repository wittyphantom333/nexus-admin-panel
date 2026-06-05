const crypto = require('crypto');
const db = require('../db');

// RFC 5054 1024-bit group N (in C# the bytes are stored LE; we use BE constant)
const N = BigInt('0xEEAF0AB9ADB38DD69C33F80AFA8FC5E86072618775FF3C0B9EA2314C9C256576D674DF7496EA81D3383B4813D692C6E0E0D5D8E250B98BE48E495C1D6089DAD15DC7D7B46154D6B6CE8EF4AD69B15D4982559B297BCF1885C529F566660E57EC68EDBC3C05726CC02FD4CBF4976EAA9AFD5138FE8376435B9FC61D2FC0EB06E3');
const G = 2n;

function generateSalt() {
  return crypto.randomBytes(16);
}

// C# `new BigInteger(bytes, isUnsigned=true, isBigEndian=false)` — treats bytes as little-endian unsigned
function leBytesToBigInt(buf) {
  const reversed = Buffer.from(buf).reverse();
  let hex = reversed.toString('hex');
  if (hex.length === 0) hex = '0';
  return BigInt('0x' + hex);
}

// C# `BigInteger.ToByteArray()` (no-arg) — returns LE, with leading 0x00 sign byte if high bit set
function bigIntToLEBytes(n) {
  if (n === 0n) return Buffer.from([0]);
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const be = Buffer.from(hex, 'hex');
  const le = Buffer.from(be).reverse();
  // Check if highest bit is set (in LE, that's the last byte)
  if (le[le.length - 1] & 0x80) {
    const padded = Buffer.alloc(le.length + 1);
    le.copy(padded);
    return padded;
  }
  return le;
}

// C# `BigInteger.ToByteArray(true)` returns LITTLE-ENDIAN bytes (the `true` means unsigned, not BE).
// The bytes are the minimum-length LE representation. To get BE you must use `ToByteArray(false, true)`.
function bigIntToLEBytes2(n) {
  if (n === 0n) return Buffer.from([0]);
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const be = Buffer.from(hex, 'hex');
  const le = Buffer.from(be).reverse();
  return le;
}

function reverseBytesAsUInt32(array) {
  const a = Buffer.from(array);
  let j = a.length - 4;
  for (let i = 0; i < a.length / 2; i += 4, j -= 4) {
    for (let k = 0; k < 4; k++) {
      const tmp = a[i + k];
      a[i + k] = a[j + k];
      a[j + k] = tmp;
    }
  }
  return a;
}

// Replicates C# Srp6Provider.Hash(bool reverse, params BigInteger[] integers)
function hashIntegers(reverse, integers) {
  const sha = crypto.createHash('sha256');
  for (let i = 0; i < integers.length; i++) {
    const leBytes = bigIntToLEBytes2(integers[i]);
    const rem = leBytes.length % 4;
    let bytes = leBytes;
    if (rem !== 0) {
      const padded = Buffer.alloc(leBytes.length + (4 - rem));
      bytes.copy(padded);
      bytes = padded;
    }
    sha.update(bytes);
  }
  let hash = sha.digest();
  if (reverse) {
    hash = reverseBytesAsUInt32(hash);
  }
  // C# returns `new BigInteger(hash, true)` which treats the 32-byte hash as LE unsigned
  return BigInt('0x' + Buffer.from(hash).reverse().toString('hex') || '0');
}

function modPow(base, exp, mod) {
  let result = 1n;
  base = ((base % mod) + mod) % mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

function computeVerifier(email, password, salt) {
  const I = email.toLowerCase();
  const P = crypto.createHash('sha256').update(`${I}:${password}`).digest();

  // C#: new BigInteger(s, true) and new BigInteger(P, true) — treat as LE unsigned
  const sBig = leBytesToBigInt(salt);
  const pBig = leBytesToBigInt(P);

  // C#: Hash(true, s, P) — hash with reverse=true
  const x = hashIntegers(true, [sBig, pBig]);

  // C#: g.ModPow(x, N).ToByteArray() — LE bytes with sign byte if high bit set
  const v = modPow(G, x, N);
  const vBytes = bigIntToLEBytes(v);
  return vBytes.toString('hex').toUpperCase();
}

async function createAccount({ email, password, role = 'User' }) {
  const existing = await db.query(db.auth(), 'SELECT id FROM account WHERE email = ?', [email]);
  if (existing.length > 0) {
    throw new Error('Account with this email already exists');
  }

  const salt = generateSalt();
  const verifier = computeVerifier(email, password, salt);
  const saltHex = salt.toString('hex').toUpperCase();

  const result = await db.query(db.auth(),
    'INSERT INTO account (email, s, v, createTime) VALUES (?, ?, ?, NOW())',
    [email, saltHex, verifier]
  );

  const accountId = result.insertId;

  if (role === 'Admin') {
    const adminRole = await db.query(db.auth(), 'SELECT id FROM role WHERE name = ?', ['Administrator']);
    if (adminRole.length > 0) {
      await db.query(db.auth(), 'INSERT INTO account_role (id, roleId) VALUES (?, ?)', [accountId, adminRole[0].id]);
    }
  }

  return { id: accountId, email, role };
}

module.exports = { createAccount, computeVerifier, generateSalt };
