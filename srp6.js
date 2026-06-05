const crypto = require('crypto');
const { modPow } = require('bigint-mod-arith');

// SRP6 constants from NexusForever
const g = 2n;
// N from .NET BigInteger(byte[], true) — byte array is little-endian
const Nbytes = Buffer.from([
  0xE3, 0x06, 0xEB, 0xC0, 0x2F, 0x1D, 0xC6, 0x9F, 0x5B, 0x43, 0x76, 0x83, 0xFE, 0x38, 0x51, 0xFD,
  0x9A, 0xAA, 0x6E, 0x97, 0xF4, 0xCB, 0xD4, 0x2F, 0xC0, 0x6C, 0x72, 0x05, 0x3C, 0xBC, 0xED, 0x68,
  0xEC, 0x57, 0x0E, 0x66, 0x66, 0xF5, 0x29, 0xC5, 0x85, 0x18, 0xCF, 0x7B, 0x29, 0x9B, 0x55, 0x82,
  0x49, 0x5D, 0xB1, 0x69, 0xAD, 0xF4, 0x8E, 0xCE, 0xB6, 0xD6, 0x54, 0x61, 0xB4, 0xD7, 0xC7, 0x5D,
  0xD1, 0xDA, 0x89, 0x60, 0x1D, 0x5C, 0x49, 0x8E, 0xE4, 0x8B, 0xB9, 0x50, 0xE2, 0xD8, 0xD5, 0xE0,
  0xE0, 0xC6, 0x92, 0xD6, 0x13, 0x48, 0x3B, 0x38, 0xD3, 0x81, 0xEA, 0x96, 0x74, 0xDF, 0x74, 0xD6,
  0x76, 0x65, 0x25, 0x9C, 0x4C, 0x31, 0xA2, 0x9E, 0x0B, 0x3C, 0xFF, 0x75, 0x87, 0x61, 0x72, 0x60,
  0xE8, 0xC5, 0x8F, 0xFA, 0x0A, 0xF8, 0x33, 0x9C, 0xD6, 0x8D, 0xB3, 0xAD, 0xB9, 0x0A, 0xAF, 0xEE
]);
// Reverse from little-endian to big-endian for BigInt
const N = BigInt('0x' + Buffer.from(Nbytes).reverse().toString('hex'));

function padToMultipleOf4(buf) {
  const padding = buf.length % 4;
  if (padding !== 0) {
    const padded = Buffer.alloc(buf.length + (4 - padding));
    buf.copy(padded);
    return padded;
  }
  return buf;
}

function reverseBytesAsUInt32(buf) {
  // Swaps first 4 bytes with last 4 bytes, etc. (mirrors .NET ReverseBytesAsUInt32)
  for (let i = 0; i < buf.length / 2; i += 4) {
    const j = buf.length - 4 - i;
    for (let k = 0; k < 4; k++) {
      const tmp = buf[i + k];
      buf[i + k] = buf[j + k];
      buf[j + k] = tmp;
    }
  }
  return buf;
}

function generateSaltAndVerifier(email, password) {
  // 16 random bytes for salt
  const salt = crypto.randomBytes(16);

  // P = SHA256(I:p) where I=email, p=password
  const identity = `${email.toLowerCase()}:${password}`;
  const P = crypto.createHash('sha256').update(identity).digest();

  // x = Hash(true, new BigInteger(s, true), new BigInteger(P, true))
  // .NET BigInteger(byte[], true) interprets bytes as little-endian
  // ToByteArray(true) returns little-endian bytes
  // So we hash the raw bytes directly (they're already in the right order)
  const sha256 = crypto.createHash('sha256');
  sha256.update(padToMultipleOf4(salt));
  sha256.update(padToMultipleOf4(P));
  let xHash = sha256.digest();

  // ReverseBytesAsUInt32
  reverseBytesAsUInt32(xHash);

  // new BigInteger(hash, true) interprets hash as little-endian
  // So reverse to big-endian for BigInt
  const x = BigInt('0x' + Buffer.from(xHash).reverse().toString('hex'));

  // v = g^x mod N
  const v = modPow(g, x, N);

  // BigInteger.ModPow(g, x, N).ToByteArray() returns little-endian with optional sign byte
  let vHex = v.toString(16);
  if (vHex.length % 2) vHex = '0' + vHex;
  const vBigEndian = Buffer.from(vHex, 'hex');
  const vLittleEndian = Buffer.from(vBigEndian).reverse();

  // Add zero sign byte if high bit is set (matching .NET ToByteArray behavior)
  if (vLittleEndian.length > 0 && vLittleEndian[vLittleEndian.length - 1] >= 0x80) {
    const withSign = Buffer.alloc(vLittleEndian.length + 1);
    vLittleEndian.copy(withSign);
    withSign[vLittleEndian.length] = 0;
    return { salt: salt.toString('hex').toUpperCase(), verifier: withSign.toString('hex').toUpperCase() };
  }

  return { salt: salt.toString('hex').toUpperCase(), verifier: vLittleEndian.toString('hex').toUpperCase() };
}

module.exports = { generateSaltAndVerifier };
