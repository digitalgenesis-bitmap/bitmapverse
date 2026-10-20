import { createHash } from "node:crypto";

const EVENT_SCHEMA = "bitmapverse.la_puerta.event.v0.1";
const STATE_SCHEMA = "bitmapverse.la_puerta.state.v0.1";
const EXPERIMENT = "bitmapverse.experiment-1.la-puerta";
const SCOPE = "local-reversible-unpublished-disposable";
const DOMAIN = "BITMAPVERSE EXPERIMENT 1 / LA PUERTA / v0.1\n";
const ZERO_HASH = "0".repeat(64);
const HEX64 = /^[0-9a-f]{64}$/;
const INSCRIPTION_ID = /^[0-9a-f]{64}i[0-9]+$/;
const P = (1n << 256n) - (1n << 32n) - 977n;
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const G = {
  x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
  y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
};
const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function fail(message) {
  throw new Error(`La Puerta inválida: ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest();
}

function taggedHash(tag, bytes) {
  const tagHash = sha256(Buffer.from(tag, "utf8"));
  return sha256(Buffer.concat([tagHash, tagHash, bytes]));
}

function u32le(value) {
  const out = Buffer.alloc(4);
  out.writeUInt32LE(value);
  return out;
}

function u64le(value) {
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(BigInt(value));
  return out;
}

function compactSize(value) {
  assert(Number.isSafeInteger(value) && value >= 0, "compactSize fuera de rango");
  if (value < 0xfd) return Buffer.from([value]);
  if (value <= 0xffff) {
    const out = Buffer.alloc(3);
    out[0] = 0xfd;
    out.writeUInt16LE(value, 1);
    return out;
  }
  const out = Buffer.alloc(5);
  out[0] = 0xfe;
  out.writeUInt32LE(value, 1);
  return out;
}

function varBytes(bytes) {
  return Buffer.concat([compactSize(bytes.length), bytes]);
}

function dsha256(bytes) {
  return sha256(sha256(bytes));
}

function mod(value, modulus = P) {
  const result = value % modulus;
  return result >= 0n ? result : result + modulus;
}

function powMod(base, exponent, modulus = P) {
  let result = 1n;
  let factor = mod(base, modulus);
  let power = exponent;
  while (power > 0n) {
    if (power & 1n) result = (result * factor) % modulus;
    factor = (factor * factor) % modulus;
    power >>= 1n;
  }
  return result;
}

function inverse(value) {
  return powMod(value, P - 2n);
}

function pointAdd(left, right) {
  if (left === null) return right;
  if (right === null) return left;
  if (left.x === right.x && mod(left.y + right.y) === 0n) return null;
  const slope = left.x === right.x && left.y === right.y
    ? mod((3n * left.x * left.x) * inverse(2n * left.y))
    : mod((right.y - left.y) * inverse(right.x - left.x));
  const x = mod(slope * slope - left.x - right.x);
  return { x, y: mod(slope * (left.x - x) - left.y) };
}

function pointMultiply(scalar, point = G) {
  let result = null;
  let addend = point;
  let value = mod(scalar, N);
  while (value > 0n) {
    if (value & 1n) result = pointAdd(result, addend);
    addend = pointAdd(addend, addend);
    value >>= 1n;
  }
  return result;
}

function bytesToBigInt(bytes) {
  return BigInt(`0x${bytes.toString("hex") || "0"}`);
}

function bigIntTo32(value) {
  return Buffer.from(value.toString(16).padStart(64, "0"), "hex");
}

function liftX(x) {
  if (x >= P) return null;
  const ySquared = mod(x * x * x + 7n);
  let y = powMod(ySquared, (P + 1n) / 4n);
  if (mod(y * y) !== ySquared) return null;
  if (y & 1n) y = P - y;
  return { x, y };
}

function schnorrVerify(publicKey, messageHash, signature) {
  if (publicKey.length !== 32 || messageHash.length !== 32 || signature.length !== 64) return false;
  const publicX = bytesToBigInt(publicKey);
  const r = bytesToBigInt(signature.subarray(0, 32));
  const s = bytesToBigInt(signature.subarray(32));
  if (publicX >= P || r >= P || s >= N) return false;
  const publicPoint = liftX(publicX);
  if (publicPoint === null) return false;
  const challenge = bytesToBigInt(taggedHash(
    "BIP0340/challenge",
    Buffer.concat([bigIntTo32(r), publicKey, messageHash]),
  )) % N;
  const result = pointAdd(pointMultiply(s), pointMultiply(N - challenge, publicPoint));
  return result !== null && (result.y & 1n) === 0n && result.x === r;
}

function bech32Polymod(values) {
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let check = 1;
  for (const value of values) {
    const top = check >>> 25;
    check = ((check & 0x1ffffff) << 5) ^ value;
    for (let index = 0; index < 5; index += 1) {
      if ((top >>> index) & 1) check ^= generators[index];
    }
  }
  return check >>> 0;
}

function hrpExpand(hrp) {
  return [
    ...[...hrp].map((char) => char.charCodeAt(0) >>> 5),
    0,
    ...[...hrp].map((char) => char.charCodeAt(0) & 31),
  ];
}

function convertBits(values, fromBits, toBits, pad) {
  let accumulator = 0;
  let bits = 0;
  const result = [];
  const maxValue = (1 << toBits) - 1;
  for (const value of values) {
    assert(value >= 0 && value < (1 << fromBits), "valor bech32 fuera de rango");
    accumulator = (accumulator << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((accumulator >>> bits) & maxValue);
    }
  }
  if (pad && bits > 0) result.push((accumulator << (toBits - bits)) & maxValue);
  if (!pad) {
    assert(bits < fromBits, "padding bech32 excesivo");
    assert(((accumulator << (toBits - bits)) & maxValue) === 0, "padding bech32 no nulo");
  }
  return result;
}

export function p2trScriptPubKey(address) {
  assert(typeof address === "string" && address === address.toLowerCase(), "dirección no normalizada");
  const separator = address.lastIndexOf("1");
  assert(separator > 0 && separator + 7 <= address.length, "dirección bech32 inválida");
  const hrp = address.slice(0, separator);
  assert(hrp === "bc", "solo se acepta Bitcoin mainnet");
  const data = [...address.slice(separator + 1)].map((char) => BECH32_CHARSET.indexOf(char));
  assert(data.every((value) => value >= 0), "carácter bech32 inválido");
  assert(bech32Polymod([...hrpExpand(hrp), ...data]) === 0x2bc830a3, "checksum bech32m inválido");
  const payload = data.slice(0, -6);
  assert(payload[0] === 1, "la autoridad no es P2TR v1");
  const program = Buffer.from(convertBits(payload.slice(1), 5, 8, false));
  assert(program.length === 32, "programa P2TR de longitud inválida");
  return Buffer.concat([Buffer.from([0x51, 0x20]), program]);
}

function toSpendTx(message, scriptPubKey) {
  const messageHash = taggedHash("BIP0322-signed-message", Buffer.from(message, "utf8"));
  const scriptSig = Buffer.concat([Buffer.from([0x00, 0x20]), messageHash]);
  return Buffer.concat([
    u32le(0), compactSize(1), Buffer.alloc(32), u32le(0xffffffff), varBytes(scriptSig), u32le(0),
    compactSize(1), u64le(0), varBytes(scriptPubKey), u32le(0),
  ]);
}

function taprootSignatureHash(message, scriptPubKey, hashType) {
  const toSpendHash = dsha256(toSpendTx(message, scriptPubKey));
  const outpoint = Buffer.concat([toSpendHash, u32le(0)]);
  const output = Buffer.concat([u64le(0), varBytes(Buffer.from([0x6a]))]);
  const sigMessage = Buffer.concat([
    Buffer.from([hashType]), u32le(0), u32le(0),
    sha256(outpoint), sha256(u64le(0)), sha256(varBytes(scriptPubKey)), sha256(u32le(0)),
    sha256(output), Buffer.from([0]), u32le(0),
  ]);
  return taggedHash("TapSighash", Buffer.concat([Buffer.from([0]), sigMessage]));
}

function readCompactSize(bytes, offset) {
  assert(offset < bytes.length, "witness truncado");
  const prefix = bytes[offset];
  if (prefix < 0xfd) return { value: prefix, offset: offset + 1 };
  if (prefix === 0xfd) {
    assert(offset + 3 <= bytes.length, "witness truncado");
    return { value: bytes.readUInt16LE(offset + 1), offset: offset + 3 };
  }
  fail("compactSize no mínimo o demasiado grande");
}

function parseSimpleSignature(encoded) {
  assert(typeof encoded === "string" && encoded.length > 0, "falta firma BIP-322");
  const base64 = encoded.startsWith("smp") ? encoded.slice(3) : encoded;
  assert(/^[A-Za-z0-9+/]+={0,2}$/.test(base64), "firma BIP-322 no es base64");
  const bytes = Buffer.from(base64, "base64");
  let cursor = readCompactSize(bytes, 0);
  assert(cursor.value === 1, "P2TR key-path exige un elemento witness");
  const length = readCompactSize(bytes, cursor.offset);
  cursor = { value: length.value, offset: length.offset };
  assert(cursor.value === 64 || cursor.value === 65, "firma Schnorr de longitud inválida");
  assert(cursor.offset + cursor.value === bytes.length, "bytes sobrantes en witness");
  return bytes.subarray(cursor.offset);
}

export function verifyBip322P2TR(address, message, encodedSignature) {
  try {
    const scriptPubKey = p2trScriptPubKey(address);
    const witnessSignature = parseSimpleSignature(encodedSignature);
    const hashType = witnessSignature.length === 64 ? 0 : witnessSignature[64];
    if (hashType !== 0 && hashType !== 1) return false;
    const signature = witnessSignature.subarray(0, 64);
    return schnorrVerify(
      scriptPubKey.subarray(2),
      taprootSignatureHash(message, scriptPubKey, hashType),
      signature,
    );
  } catch {
    return false;
  }
}

function exactKeys(value, keys, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} no es objeto`);
  assert(
    JSON.stringify(Object.keys(value).toSorted()) === JSON.stringify([...keys].toSorted()),
    `${label} contiene campos faltantes o desconocidos`,
  );
}

function canonicalPayload(event) {
  return {
    schema: event.schema,
    experiment: event.experiment,
    binding_id: event.binding_id,
    kind: event.kind,
    sequence: event.sequence,
    previous_event_hash: event.previous_event_hash,
    scope: event.scope,
    name_inscription_id: event.name_inscription_id,
    district_inscription_id: event.district_inscription_id,
    authority_snapshot: {
      height: event.authority_snapshot.height,
      block_hash: event.authority_snapshot.block_hash,
    },
    name_controller: {
      address: event.name_controller.address,
      script_pubkey: event.name_controller.script_pubkey,
    },
    district_controller: {
      address: event.district_controller.address,
      script_pubkey: event.district_controller.script_pubkey,
    },
  };
}

export function eventMessage(event) {
  return `${DOMAIN}${JSON.stringify(canonicalPayload(event))}`;
}

export function eventHash(event) {
  return sha256(Buffer.from(eventMessage(event), "utf8")).toString("hex");
}

export function bindingId(nameInscriptionId, districtInscriptionId) {
  return sha256(Buffer.from(
    `bitmapverse.la-puerta.v0.1\0${nameInscriptionId}\0${districtInscriptionId}`,
    "utf8",
  )).toString("hex");
}

function validateEventShape(event) {
  exactKeys(event, [
    "schema", "experiment", "binding_id", "kind", "sequence", "previous_event_hash", "scope",
    "name_inscription_id", "district_inscription_id", "authority_snapshot", "name_controller",
    "district_controller", "consents",
  ], "evento");
  exactKeys(event.authority_snapshot, ["height", "block_hash"], "authority_snapshot");
  exactKeys(event.name_controller, ["address", "script_pubkey"], "name_controller");
  exactKeys(event.district_controller, ["address", "script_pubkey"], "district_controller");
  exactKeys(event.consents, ["name", "district"], "consents");
  exactKeys(event.consents.name, ["format", "signature"], "consents.name");
  exactKeys(event.consents.district, ["format", "signature"], "consents.district");
  assert(event.schema === EVENT_SCHEMA, "schema de evento desconocido");
  assert(event.experiment === EXPERIMENT, "experimento incorrecto");
  assert(event.scope === SCOPE, "alcance incorrecto");
  assert(event.kind === "CREATE" || event.kind === "REVOKE", "tipo de evento desconocido");
  assert(Number.isSafeInteger(event.sequence) && event.sequence >= 0, "secuencia inválida");
  assert(HEX64.test(event.previous_event_hash), "previous_event_hash inválido");
  assert(INSCRIPTION_ID.test(event.name_inscription_id), "Name inscription ID inválido");
  assert(INSCRIPTION_ID.test(event.district_inscription_id), "District inscription ID inválido");
  assert(Number.isSafeInteger(event.authority_snapshot.height) && event.authority_snapshot.height >= 0, "altura inválida");
  assert(HEX64.test(event.authority_snapshot.block_hash), "hash de snapshot inválido");
  assert(event.binding_id === bindingId(event.name_inscription_id, event.district_inscription_id), "binding_id no coincide con los objetos");
  for (const role of ["name", "district"]) {
    const controller = event[`${role}_controller`];
    assert(/^bc1p[0-9a-z]+$/.test(controller.address), `${role}: dirección P2TR inválida`);
    assert(/^[0-9a-f]+$/.test(controller.script_pubkey), `${role}: script_pubkey inválido`);
    assert(p2trScriptPubKey(controller.address).toString("hex") === controller.script_pubkey, `${role}: dirección y script no coinciden`);
    assert(event.consents[role].format === "bip322-simple", `${role}: formato de firma incorrecto`);
    assert(typeof event.consents[role].signature === "string", `${role}: falta firma`);
  }
}

function validateConsents(event) {
  const message = eventMessage(event);
  assert(verifyBip322P2TR(event.name_controller.address, message, event.consents.name.signature), "firma del Name inválida");
  assert(verifyBip322P2TR(event.district_controller.address, message, event.consents.district.signature), "firma del District inválida");
}

export function resolveLaPuerta(events) {
  assert(Array.isArray(events) && events.length >= 1 && events.length <= 2, "se requieren uno o dos eventos");
  const ordered = [...events].toSorted((left, right) => left.sequence - right.sequence);
  assert(new Set(ordered.map(({ sequence }) => sequence)).size === ordered.length, "secuencia duplicada");
  for (const event of ordered) validateEventShape(event);

  const first = ordered[0];
  assert(first.kind === "CREATE" && first.sequence === 0, "el primer evento debe ser CREATE/0");
  assert(first.previous_event_hash === ZERO_HASH, "CREATE debe partir del hash cero");
  validateConsents(first);

  let status = "ACTIVE";
  let last = first;
  if (ordered.length === 2) {
    const second = ordered[1];
    assert(second.kind === "REVOKE" && second.sequence === 1, "el segundo evento debe ser REVOKE/1");
    assert(second.previous_event_hash === eventHash(first), "REVOKE no referencia el CREATE exacto");
    for (const field of [
      "binding_id", "name_inscription_id", "district_inscription_id", "scope",
    ]) assert(second[field] === first[field], `REVOKE cambia ${field}`);
    assert(JSON.stringify(second.authority_snapshot) === JSON.stringify(first.authority_snapshot), "REVOKE cambia el snapshot de autoridad");
    assert(JSON.stringify(second.name_controller) === JSON.stringify(first.name_controller), "REVOKE cambia el controlador Name");
    assert(JSON.stringify(second.district_controller) === JSON.stringify(first.district_controller), "REVOKE cambia el controlador District");
    validateConsents(second);
    status = "INACTIVE";
    last = second;
  }

  return {
    schema: STATE_SCHEMA,
    experiment: EXPERIMENT,
    binding_id: first.binding_id,
    status,
    last_sequence: last.sequence,
    last_event_hash: eventHash(last),
    create_event_hash: eventHash(first),
    revoke_event_hash: ordered.length === 2 ? eventHash(ordered[1]) : null,
    name_inscription_id: first.name_inscription_id,
    district_inscription_id: first.district_inscription_id,
    authority_snapshot: first.authority_snapshot,
  };
}

