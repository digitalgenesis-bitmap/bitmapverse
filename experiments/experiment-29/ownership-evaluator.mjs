// Bitmapverse — Experiment #29: Frozen Historical District Ownership Evidence.
//
// Offline and deterministic. No network, no clock, no wallet, no signatures.
//
// Result classification (the only positive result):
//   HISTORICAL / ARCHIVED_INDEXER_LOCATION / BITCOIN_CORROBORATED
//
// What this does NOT establish:
// - Independently reconstructed ordinal ownership (no sat-flow reconstruction).
// - Bitcoin full-node validation (two third-party Esplora operators, no headers/PoW/merkle).
// - Any delegated building authority (the Experiment #23 signature is a Name binding, not a grant).
// The inscription-to-output link is an ARCHIVED indexer observation, never a Bitcoin fact.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { p2trScriptPubKey } from "../experiment-1/resolvers/resolver-js.mjs";

const TXID = "75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818";

export const EXPERIMENT_29_PROFILE = Object.freeze({
  classification: "HISTORICAL / ARCHIVED_INDEXER_LOCATION / BITCOIN_CORROBORATED",
  district: "937336.bitmap",
  district_inscription_id: "7b7c15dc952cde069a371f4628c05ffe56e164bc272cfd9ef29cd231b6b3a9d1i0",
  district_sat: 1715489001085578,
  authority_snapshot: Object.freeze({
    height: 972169,
    block_hash: "00000000000000000000634ef8bc8d9e4d893a836896b62a3e9bab888dd8bbf7",
  }),
  txid: TXID,
  vout: 15,
  expected_controller: "bc1psphv4vlce9f37zqc7jt8w3gnynfxxh3zmjuvxpqv0vjs3t3mcdesyfk5tk",
  providers: Object.freeze(["mempool.space", "blockstream.info"]),
});

// Relative to experiments/experiment-29/evidence/. Bytes are frozen exactly as received.
export const FROZEN_EVIDENCE_SHA256 = Object.freeze({
  "bitcoin-capture/mempool.space.block-height_972169": "4f53f288b1838d9cff521de3bfdf968e138d509091cff48a6f774c755c183f3a",
  "bitcoin-capture/mempool.space.blocks_tip_height": "a46c6c26085206d3393d8ae76103a6a640b579d2887b775ef5d2bd750c00a737",
  [`bitcoin-capture/mempool.space.tx_${TXID}_hex`]: "f62c812a8fcc685ed657d3096bb70e6ccbf0b1b3381b284d978e270ba3ef2efa",
  [`bitcoin-capture/mempool.space.tx_${TXID}_outspend_15`]: "fe90f0c1e4023e0cd38fd6d2132c1382dd614fed61e6aebf05d19c52a8e65a1b",
  [`bitcoin-capture/mempool.space.tx_${TXID}_status`]: "35388c57b31d8d1b1166075b82c89b2e30b5ed5660edb00e9837db2068d93ba2",
  "bitcoin-capture/blockstream.info.block-height_972169": "4f53f288b1838d9cff521de3bfdf968e138d509091cff48a6f774c755c183f3a",
  "bitcoin-capture/blockstream.info.blocks_tip_height": "a46c6c26085206d3393d8ae76103a6a640b579d2887b775ef5d2bd750c00a737",
  [`bitcoin-capture/blockstream.info.tx_${TXID}_hex`]: "f62c812a8fcc685ed657d3096bb70e6ccbf0b1b3381b284d978e270ba3ef2efa",
  [`bitcoin-capture/blockstream.info.tx_${TXID}_outspend_15`]: "fe90f0c1e4023e0cd38fd6d2132c1382dd614fed61e6aebf05d19c52a8e65a1b",
  [`bitcoin-capture/blockstream.info.tx_${TXID}_status`]: "35388c57b31d8d1b1166075b82c89b2e30b5ed5660edb00e9837db2068d93ba2",
  "experiment-0-archive/experiment.json": "07ec99d5da476d74112e26b9dcf5f1df014a3d41a66fe816ba0bfb3832e1d848",
  "experiment-0-archive/SOURCE_LEDGER.md": "11adab8ba5dc0613862ee02addbdd3f42af9c906a53e05e5487a80aa8491f933",
});

// Exact provenance rows that must appear in the archived Experiment #0 ledger.
const LEDGER_PROVENANCE_ROWS = Object.freeze([
  "| Independent location check | Ordinals Wallet public API | Matching inscription numbers, heights, content metadata, satpoints and addresses for the four authority inscriptions | No public SNS-by-name enumeration endpoint found |",
  "| `937336.bitmap` candidate District | `7b7c15dc952cde069a371f4628c05ffe56e164bc272cfd9ef29cd231b6b3a9d1i0` | `bc1psphv4vlce9f37zqc7jt8w3gnynfxxh3zmjuvxpqv0vjs3t3mcdesyfk5tk` | Ord and Ordinals Wallet match; current output created at height `942807` |",
]);

const HEX64 = /^[0-9a-f]{64}$/;
const DIGITS = /^[0-9]+$/;

class Rejection extends Error {
  constructor(code, reason) {
    super(`${code}: ${reason}`);
    this.code = code;
    this.reason = reason;
  }
}

function ensure(condition, code, reason) {
  if (!condition) throw new Rejection(code, reason);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactKeys(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).toSorted()) === JSON.stringify([...keys].toSorted());
}

function text(evidence, path) {
  return evidence[path].toString("utf8");
}

function parseJson(evidence, path) {
  try {
    return JSON.parse(text(evidence, path));
  } catch {
    throw new Rejection("MALFORMED_EVIDENCE", `${path}: invalid JSON`);
  }
}

// ---- Raw transaction parsing (BIP-141 aware) ----

export function parseTransaction(bytes) {
  let offset = 0;
  const take = (length) => {
    ensure(offset + length <= bytes.length, "MALFORMED_EVIDENCE", "transaction truncated");
    const slice = bytes.subarray(offset, offset + length);
    offset += length;
    return slice;
  };
  const varint = () => {
    const prefix = take(1)[0];
    if (prefix < 0xfd) return prefix;
    const size = prefix === 0xfd ? 2 : prefix === 0xfe ? 4 : 8;
    const raw = take(size);
    const value = size === 2 ? raw.readUInt16LE(0) : size === 4 ? raw.readUInt32LE(0) : Number(raw.readBigUInt64LE(0));
    ensure(Number.isSafeInteger(value), "MALFORMED_EVIDENCE", "varint out of range");
    return value;
  };

  const version = take(4);
  const segwit = bytes[offset] === 0x00 && bytes[offset + 1] === 0x01;
  if (segwit) take(2);
  const bodyStart = offset;
  const inputCount = varint();
  ensure(inputCount > 0, "MALFORMED_EVIDENCE", "no inputs");
  for (let index = 0; index < inputCount; index += 1) {
    take(36);
    take(varint());
    take(4);
  }
  const outputCount = varint();
  const outputs = [];
  for (let index = 0; index < outputCount; index += 1) {
    const value = take(8).readBigUInt64LE(0);
    const scriptPubKey = Buffer.from(take(varint()));
    outputs.push({ value, scriptPubKey });
  }
  const bodyEnd = offset;
  if (segwit) {
    for (let index = 0; index < inputCount; index += 1) {
      const items = varint();
      for (let item = 0; item < items; item += 1) take(varint());
    }
  }
  const locktime = take(4);
  ensure(offset === bytes.length, "MALFORMED_EVIDENCE", "trailing transaction bytes");

  const stripped = Buffer.concat([version, bytes.subarray(bodyStart, bodyEnd), locktime]);
  const txid = Buffer.from(sha256(Buffer.from(sha256(stripped), "hex")), "hex").reverse().toString("hex");
  return { txid, segwit, inputCount, outputs };
}

// ---- P2TR address derivation (bech32m), cross-checked with the Experiment #1 primitive ----

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function bech32Polymod(values) {
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let checksum = 1;
  for (const value of values) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    for (let bit = 0; bit < 5; bit += 1) if ((top >>> bit) & 1) checksum ^= generators[bit];
  }
  return checksum >>> 0;
}

function toFiveBit(bytes) {
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
  if (bits > 0) result.push((accumulator << (5 - bits)) & 31);
  return result;
}

export function p2trAddressFromScript(scriptPubKey) {
  ensure(
    scriptPubKey.length === 34 && scriptPubKey[0] === 0x51 && scriptPubKey[1] === 0x20,
    "NOT_P2TR_OUTPUT",
    scriptPubKey.toString("hex"),
  );
  const hrp = "bc";
  const data = [1, ...toFiveBit(scriptPubKey.subarray(2))];
  const expanded = [...[...hrp].map((char) => char.charCodeAt(0) >> 5), 0, ...[...hrp].map((char) => char.charCodeAt(0) & 31)];
  const polymod = bech32Polymod([...expanded, ...data, 0, 0, 0, 0, 0, 0]) ^ 0x2bc830a3;
  const checksum = Array.from({ length: 6 }, (_, index) => (polymod >>> (5 * (5 - index))) & 31);
  const address = `${hrp}1${[...data, ...checksum].map((value) => BECH32_CHARSET[value]).join("")}`;
  ensure(
    p2trScriptPubKey(address).equals(scriptPubKey),
    "ADDRESS_DERIVATION_MISMATCH",
    "bech32m encoding disagrees with the Experiment #1 decoder",
  );
  return address;
}

// ---- Per-provider Bitcoin facts ----

function providerFacts(evidence, provider) {
  const { txid, vout, authority_snapshot: snapshot } = EXPERIMENT_29_PROFILE;
  const prefix = `bitcoin-capture/${provider}`;

  const snapshotHash = text(evidence, `${prefix}.block-height_972169`);
  ensure(HEX64.test(snapshotHash), "MALFORMED_EVIDENCE", `${provider}: block hash at ${snapshot.height}`);

  const tipText = text(evidence, `${prefix}.blocks_tip_height`);
  ensure(DIGITS.test(tipText) && Number.isSafeInteger(Number(tipText)), "MALFORMED_EVIDENCE", `${provider}: tip height`);

  const status = parseJson(evidence, `${prefix}.tx_${txid}_status`);
  ensure(
    exactKeys(status, ["confirmed", "block_height", "block_hash", "block_time"])
      && typeof status.confirmed === "boolean"
      && Number.isSafeInteger(status.block_height)
      && typeof status.block_hash === "string" && HEX64.test(status.block_hash)
      && Number.isSafeInteger(status.block_time),
    "MALFORMED_EVIDENCE",
    `${provider}: transaction status`,
  );

  const outspend = parseJson(evidence, `${prefix}.tx_${txid}_outspend_${vout}`);
  ensure(
    outspend !== null && typeof outspend === "object" && typeof outspend.spent === "boolean"
      && (outspend.spent === true || exactKeys(outspend, ["spent"])),
    "MALFORMED_EVIDENCE",
    `${provider}: outspend`,
  );

  const hex = text(evidence, `${prefix}.tx_${txid}_hex`);
  ensure(/^[0-9a-f]+$/.test(hex) && hex.length % 2 === 0, "MALFORMED_EVIDENCE", `${provider}: transaction hex`);

  return {
    snapshot_hash: snapshotHash,
    tip_height: Number(tipText),
    status,
    outspend,
    transaction_hex: hex,
  };
}

// ---- Archived Experiment #0 inscription-location observation ----

function archivedLocation(evidence) {
  const record = parseJson(evidence, "experiment-0-archive/experiment.json");
  ensure(
    record && exactKeys(record.snapshot, ["height", "block_hash"])
      && Number.isSafeInteger(record.snapshot.height)
      && HEX64.test(record.snapshot.block_hash)
      && Array.isArray(record.pairs),
    "ARCHIVED_RECORD_INVALID",
    "snapshot or pairs",
  );
  const matches = record.pairs
    .map((pair) => pair?.district_authority)
    .filter((authority) => authority?.district_inscription_id === EXPERIMENT_29_PROFILE.district_inscription_id);
  ensure(matches.length === 1, "ARCHIVED_RECORD_INVALID", `expected one District record, found ${matches.length}`);
  const authority = matches[0];

  const { txid, vout, district, district_sat: sat, expected_controller: controller } = EXPERIMENT_29_PROFILE;
  ensure(
    authority.content === district
      && authority.sat === sat
      && authority.snapshot_output === `${txid}:${vout}`
      && authority.snapshot_satpoint === `${txid}:${vout}:0`
      && authority.snapshot_address === controller
      && Number.isSafeInteger(authority.current_output_created_at_height),
    "ARCHIVED_LOCATION_MISMATCH",
    "archived District record does not place the inscription in the expected output",
  );

  const ledger = text(evidence, "experiment-0-archive/SOURCE_LEDGER.md").split("\n");
  for (const row of LEDGER_PROVENANCE_ROWS) {
    ensure(ledger.includes(row), "ARCHIVED_PROVENANCE_MISSING", row.slice(0, 60));
  }

  return {
    observation_height: record.snapshot.height,
    observation_block_hash: record.snapshot.block_hash,
    output_created_at_height: authority.current_output_created_at_height,
    satpoint: authority.snapshot_satpoint,
    address: authority.snapshot_address,
  };
}

// ---- Evaluation ----

const LIMITATIONS = Object.freeze([
  "Inscription-to-output location is an archived two-indexer observation (Ord, Ordinals Wallet), not a Bitcoin fact.",
  "No sat-flow reconstruction: this is not independently reconstructed ordinal ownership.",
  "Bitcoin facts come from two third-party Esplora operators; no full-node, header, proof-of-work or merkle validation.",
  "Historical holder only: says nothing about who holds the District now beyond the capture tip.",
  "Not delegated building authority; the Experiment #23 signature is a Name-binding signature, not a grant.",
]);

export function evaluateHistoricalOwnership(evidence, {
  expectedHashes = FROZEN_EVIDENCE_SHA256,
  expectedController = EXPERIMENT_29_PROFILE.expected_controller,
} = {}) {
  try {
    ensure(evidence !== null && typeof evidence === "object", "MISSING_EVIDENCE", "no evidence supplied");
    const paths = Object.keys(expectedHashes);
    for (const path of paths) {
      ensure(Buffer.isBuffer(evidence[path]), "MISSING_EVIDENCE", path);
    }
    ensure(
      JSON.stringify(Object.keys(evidence).toSorted()) === JSON.stringify(paths.toSorted()),
      "UNEXPECTED_EVIDENCE",
      "evidence set contains files outside the frozen manifest",
    );
    for (const path of paths) {
      ensure(sha256(evidence[path]) === expectedHashes[path], "HASH_MISMATCH", path);
    }

    const [first, second] = EXPERIMENT_29_PROFILE.providers.map((provider) => providerFacts(evidence, provider));
    ensure(JSON.stringify(first) === JSON.stringify(second), "PROVIDER_DISAGREEMENT", "providers returned different facts");
    const facts = first;
    const { authority_snapshot: snapshot, txid, vout } = EXPERIMENT_29_PROFILE;

    ensure(facts.snapshot_hash === snapshot.block_hash, "SNAPSHOT_HASH_MISMATCH", facts.snapshot_hash);
    ensure(facts.status.confirmed === true, "UNCONFIRMED_OUTPUT", "transaction not confirmed");
    ensure(facts.status.block_height <= snapshot.height, "CREATED_AFTER_SNAPSHOT", String(facts.status.block_height));
    ensure(facts.tip_height > snapshot.height, "TIP_NOT_AFTER_SNAPSHOT", String(facts.tip_height));
    ensure(facts.status.block_height <= facts.tip_height, "MALFORMED_EVIDENCE", "confirmation after tip");
    ensure(facts.outspend.spent === false, "OUTPUT_SPENT_AT_CAPTURE", "spend height not captured; cannot evaluate");

    const transaction = parseTransaction(Buffer.from(facts.transaction_hex, "hex"));
    ensure(transaction.txid === txid, "TXID_MISMATCH", transaction.txid);
    ensure(transaction.outputs.length > vout, "MALFORMED_EVIDENCE", "output index out of range");
    const output = transaction.outputs[vout];
    const address = p2trAddressFromScript(output.scriptPubKey);
    ensure(address === expectedController, "CONTROLLER_MISMATCH", address);

    const archived = archivedLocation(evidence);
    ensure(
      archived.output_created_at_height === facts.status.block_height,
      "ARCHIVED_LOCATION_MISMATCH",
      "archived creation height differs from Bitcoin evidence",
    );
    ensure(archived.address === address, "ARCHIVED_LOCATION_MISMATCH", "archived address differs from derived address");
    ensure(
      facts.status.block_height <= archived.observation_height && archived.observation_height <= facts.tip_height,
      "OBSERVATION_OUTSIDE_UNSPENT_WINDOW",
      String(archived.observation_height),
    );

    return {
      result: "HISTORICAL_HOLDER",
      classification: EXPERIMENT_29_PROFILE.classification,
      district: EXPERIMENT_29_PROFILE.district,
      district_inscription_id: EXPERIMENT_29_PROFILE.district_inscription_id,
      height: snapshot.height,
      block_hash: snapshot.block_hash,
      holder_address: address,
      holder_script_pubkey: output.scriptPubKey.toString("hex"),
      output: `${txid}:${vout}`,
      output_value_sats: Number(output.value),
      output_created_at_height: facts.status.block_height,
      location_observed_at_height: archived.observation_height,
      capture_tip_height: facts.tip_height,
      unspent_window: [facts.status.block_height, facts.tip_height],
      providers_agree: true,
      independent_ordinal_reconstruction: false,
      full_node_validation: false,
      delegated_building_authority: false,
      limitations: [...LIMITATIONS],
    };
  } catch (error) {
    return {
      result: "REJECT",
      code: error instanceof Rejection ? error.code : "MALFORMED_EVIDENCE",
      reason: error instanceof Rejection ? error.reason : String(error?.message ?? error),
      classification: null,
    };
  }
}

export async function loadFrozenEvidence(directory = new URL("./evidence/", import.meta.url)) {
  const evidence = {};
  for (const path of Object.keys(FROZEN_EVIDENCE_SHA256)) {
    try {
      evidence[path] = await readFile(new URL(path, directory));
    } catch {
      // Missing files are reported by the evaluator as MISSING_EVIDENCE.
    }
  }
  return evidence;
}
