import { createHash } from "node:crypto";

import { p2trScriptPubKey } from "../resolvers/resolver-js.mjs";

const P = (1n << 256n) - (1n << 32n) - 977n;
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const G = {
  x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
  y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
};
const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest();

function taggedHash(tag, bytes) {
  const tagHash = sha256(Buffer.from(tag));
  return sha256(Buffer.concat([tagHash, tagHash, bytes]));
}

function mod(value, modulus = P) {
  const result = value % modulus;
  return result >= 0n ? result : result + modulus;
}

function powMod(base, exponent) {
  let result = 1n;
  let factor = mod(base);
  let power = exponent;
  while (power) {
    if (power & 1n) result = result * factor % P;
    factor = factor * factor % P;
    power >>= 1n;
  }
  return result;
}

function add(left, right) {
  if (left === null) return right;
  if (right === null) return left;
  if (left.x === right.x && mod(left.y + right.y) === 0n) return null;
  const slope = left.x === right.x && left.y === right.y
    ? mod(3n * left.x * left.x * powMod(2n * left.y, P - 2n))
    : mod((right.y - left.y) * powMod(right.x - left.x, P - 2n));
  const x = mod(slope * slope - left.x - right.x);
  return { x, y: mod(slope * (left.x - x) - left.y) };
}

function multiply(scalar) {
  let result = null;
  let addend = G;
  let value = mod(scalar, N);
  while (value) {
    if (value & 1n) result = add(result, addend);
    addend = add(addend, addend);
    value >>= 1n;
  }
  return result;
}

const to32 = (value) => Buffer.from(value.toString(16).padStart(64, "0"), "hex");
const fromBytes = (bytes) => BigInt(`0x${bytes.toString("hex")}`);

function u32le(value) {
  const out = Buffer.alloc(4);
  out.writeUInt32LE(value);
  return out;
}

function compact(value) {
  if (value < 0xfd) return Buffer.from([value]);
  throw new Error("test helper only supports compact values");
}

const variable = (bytes) => Buffer.concat([compact(bytes.length), bytes]);

function toSpend(message, script) {
  const messageHash = taggedHash("BIP0322-signed-message", Buffer.from(message));
  const scriptSig = Buffer.concat([Buffer.from([0, 32]), messageHash]);
  return Buffer.concat([
    u32le(0), Buffer.from([1]), Buffer.alloc(32), u32le(0xffffffff), variable(scriptSig), u32le(0),
    Buffer.from([1]), Buffer.alloc(8), variable(script), u32le(0),
  ]);
}

function bip322Sighash(address, message) {
  const script = p2trScriptPubKey(address);
  const spendHash = sha256(sha256(toSpend(message, script)));
  const outpoint = Buffer.concat([spendHash, u32le(0)]);
  const output = Buffer.concat([Buffer.alloc(8), Buffer.from([1, 0x6a])]);
  const sigMessage = Buffer.concat([
    Buffer.from([0]), u32le(0), u32le(0), sha256(outpoint), sha256(Buffer.alloc(8)),
    sha256(variable(script)), sha256(u32le(0)), sha256(output), Buffer.from([0]), u32le(0),
  ]);
  return taggedHash("TapSighash", Buffer.concat([Buffer.from([0]), sigMessage]));
}

function schnorrSign(secret, messageHash) {
  const publicPoint = multiply(secret);
  const adjustedSecret = publicPoint.y & 1n ? N - secret : secret;
  const publicKey = to32(publicPoint.x);
  const auxHash = taggedHash("BIP0340/aux", Buffer.alloc(32));
  const masked = Buffer.from(to32(adjustedSecret).map((byte, index) => byte ^ auxHash[index]));
  const nonce0 = fromBytes(taggedHash(
    "BIP0340/nonce",
    Buffer.concat([masked, publicKey, messageHash]),
  )) % N;
  if (nonce0 === 0n) throw new Error("zero nonce");
  const noncePoint = multiply(nonce0);
  const nonce = noncePoint.y & 1n ? N - nonce0 : nonce0;
  const rBytes = to32(noncePoint.x);
  const challenge = fromBytes(taggedHash(
    "BIP0340/challenge",
    Buffer.concat([rBytes, publicKey, messageHash]),
  )) % N;
  return Buffer.concat([rBytes, to32(mod(nonce + challenge * adjustedSecret, N))]);
}

function polymod(values) {
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let check = 1;
  for (const value of values) {
    const top = check >>> 25;
    check = ((check & 0x1ffffff) << 5) ^ value;
    for (let index = 0; index < 5; index += 1) if ((top >>> index) & 1) check ^= generators[index];
  }
  return check >>> 0;
}

function convert8to5(bytes) {
  let accumulator = 0;
  let bits = 0;
  const result = [];
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result.push((accumulator >>> bits) & 31);
    }
  }
  if (bits) result.push((accumulator << (5 - bits)) & 31);
  return result;
}

function checksum(hrp, data) {
  const expanded = [
    ...[...hrp].map((char) => char.charCodeAt(0) >>> 5), 0,
    ...[...hrp].map((char) => char.charCodeAt(0) & 31),
  ];
  const value = polymod([...expanded, ...data, 0, 0, 0, 0, 0, 0]) ^ 0x2bc830a3;
  return Array.from({ length: 6 }, (_, index) => (value >>> (5 * (5 - index))) & 31);
}

export function controllerForSecret(secret) {
  const program = to32(multiply(secret).x);
  const data = [1, ...convert8to5(program)];
  const address = `bc1${[...data, ...checksum("bc", data)].map((value) => CHARSET[value]).join("")}`;
  return { address, script_pubkey: p2trScriptPubKey(address).toString("hex") };
}

export function signBip322(secret, address, message) {
  const signature = schnorrSign(secret, bip322Sighash(address, message));
  return `smp${Buffer.concat([Buffer.from([1, 64]), signature]).toString("base64")}`;
}

