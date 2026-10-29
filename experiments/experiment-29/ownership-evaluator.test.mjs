import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  EXPERIMENT_29_PROFILE,
  FROZEN_EVIDENCE_SHA256,
  evaluateHistoricalOwnership,
  loadFrozenEvidence,
  p2trAddressFromScript,
  parseTransaction,
} from "./ownership-evaluator.mjs";

const TXID = EXPERIMENT_29_PROFILE.txid;
const PROVIDERS = EXPERIMENT_29_PROFILE.providers;
const frozen = await loadFrozenEvidence();

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const path = (provider, kind) => ({
  hash: `bitcoin-capture/${provider}.block-height_972169`,
  tip: `bitcoin-capture/${provider}.blocks_tip_height`,
  hex: `bitcoin-capture/${provider}.tx_${TXID}_hex`,
  outspend: `bitcoin-capture/${provider}.tx_${TXID}_outspend_15`,
  status: `bitcoin-capture/${provider}.tx_${TXID}_status`,
}[kind]);
const ARCHIVE = "experiment-0-archive/experiment.json";
const LEDGER = "experiment-0-archive/SOURCE_LEDGER.md";

// Returns a mutated in-memory evidence set plus a re-pinned hash manifest, so a
// test reaches the semantic check it targets instead of failing at HASH_MISMATCH.
function mutate(changes) {
  const evidence = { ...frozen };
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) delete evidence[key];
    else evidence[key] = Buffer.from(value);
  }
  const expectedHashes = Object.fromEntries(
    Object.keys(FROZEN_EVIDENCE_SHA256).map((key) => [key, evidence[key] ? sha256(evidence[key]) : FROZEN_EVIDENCE_SHA256[key]]),
  );
  return { evidence, expectedHashes };
}

function both(kind, transform) {
  return Object.fromEntries(PROVIDERS.map((provider) => {
    const key = path(provider, kind);
    return [key, transform(frozen[key].toString("utf8"))];
  }));
}

function editJson(source, edit) {
  const value = JSON.parse(source);
  edit(value);
  return JSON.stringify(value);
}

function assertReject(result, code) {
  assert.equal(result.result, "REJECT", JSON.stringify(result));
  assert.equal(result.code, code, JSON.stringify(result));
  assert.equal(result.classification, null);
}

// ---- Success ----

test("frozen evidence → HISTORICAL_HOLDER with the limited classification", () => {
  const result = evaluateHistoricalOwnership(frozen);
  assert.equal(result.result, "HISTORICAL_HOLDER");
  assert.equal(result.classification, "HISTORICAL / ARCHIVED_INDEXER_LOCATION / BITCOIN_CORROBORATED");
  assert.equal(result.district, "937336.bitmap");
  assert.equal(result.district_inscription_id, "7b7c15dc952cde069a371f4628c05ffe56e164bc272cfd9ef29cd231b6b3a9d1i0");
  assert.equal(result.height, 972169);
  assert.equal(result.block_hash, "00000000000000000000634ef8bc8d9e4d893a836896b62a3e9bab888dd8bbf7");
  assert.equal(result.holder_address, "bc1psphv4vlce9f37zqc7jt8w3gnynfxxh3zmjuvxpqv0vjs3t3mcdesyfk5tk");
  assert.equal(result.holder_script_pubkey, "5120806ecab3f8c9531f0818f49677451324d2635e22dcb8c3040c7b2508ae3bc373");
  assert.equal(result.output, `${TXID}:15`);
  assert.equal(result.output_value_sats, 330);
  assert.equal(result.output_created_at_height, 942807);
  assert.equal(result.location_observed_at_height, 959531);
  assert.equal(result.capture_tip_height, 973731);
  assert.deepEqual(result.unspent_window, [942807, 973731]);
  assert.equal(result.providers_agree, true);
});

test("success result never claims reconstruction, full-node validation or building authority", () => {
  const result = evaluateHistoricalOwnership(frozen);
  assert.equal(result.independent_ordinal_reconstruction, false);
  assert.equal(result.full_node_validation, false);
  assert.equal(result.delegated_building_authority, false);
  assert.ok(result.limitations.length >= 5);
});

test("evaluation is deterministic", () => {
  assert.deepEqual(evaluateHistoricalOwnership(frozen), evaluateHistoricalOwnership(frozen));
});

test("independent parse: txid recomputes and output 15 derives to the controller", () => {
  const transaction = parseTransaction(Buffer.from(frozen[path("mempool.space", "hex")].toString("utf8"), "hex"));
  assert.equal(transaction.txid, TXID);
  assert.equal(transaction.segwit, true);
  assert.equal(transaction.outputs.length, 22);
  assert.equal(p2trAddressFromScript(transaction.outputs[15].scriptPubKey), EXPERIMENT_29_PROFILE.expected_controller);
});

// ---- Fail-closed: integrity ----

test("missing evidence file → MISSING_EVIDENCE", () => {
  const { evidence } = mutate({ [path("blockstream.info", "outspend")]: undefined });
  assertReject(evaluateHistoricalOwnership(evidence), "MISSING_EVIDENCE");
  assertReject(evaluateHistoricalOwnership(null), "MISSING_EVIDENCE");
});

test("extra evidence file → UNEXPECTED_EVIDENCE", () => {
  assertReject(evaluateHistoricalOwnership({ ...frozen, "bitcoin-capture/extra": Buffer.from("x") }), "UNEXPECTED_EVIDENCE");
});

test("tampered byte against pinned hashes → HASH_MISMATCH", () => {
  const { evidence } = mutate({ [path("mempool.space", "tip")]: "973732" });
  assertReject(evaluateHistoricalOwnership(evidence), "HASH_MISMATCH");
});

// ---- Fail-closed: Bitcoin facts ----

test("providers disagree → PROVIDER_DISAGREEMENT", () => {
  const { evidence, expectedHashes } = mutate({ [path("mempool.space", "tip")]: "973732" });
  assertReject(evaluateHistoricalOwnership(evidence, { expectedHashes }), "PROVIDER_DISAGREEMENT");
});

test("block hash at 972169 differs from the signed snapshot → SNAPSHOT_HASH_MISMATCH", () => {
  const { evidence, expectedHashes } = mutate(both("hash", () => "1".repeat(64)));
  assertReject(evaluateHistoricalOwnership(evidence, { expectedHashes }), "SNAPSHOT_HASH_MISMATCH");
});

test("capture tip not after 972169 → TIP_NOT_AFTER_SNAPSHOT", () => {
  const { evidence, expectedHashes } = mutate(both("tip", () => "972169"));
  assertReject(evaluateHistoricalOwnership(evidence, { expectedHashes }), "TIP_NOT_AFTER_SNAPSHOT");
});

test("output created after 972169 → CREATED_AFTER_SNAPSHOT", () => {
  const { evidence, expectedHashes } = mutate(both("status", (s) => editJson(s, (v) => { v.block_height = 972170; })));
  assertReject(evaluateHistoricalOwnership(evidence, { expectedHashes }), "CREATED_AFTER_SNAPSHOT");
});

test("unconfirmed transaction → UNCONFIRMED_OUTPUT", () => {
  const { evidence, expectedHashes } = mutate(both("status", (s) => editJson(s, (v) => { v.confirmed = false; })));
  assertReject(evaluateHistoricalOwnership(evidence, { expectedHashes }), "UNCONFIRMED_OUTPUT");
});

test("output spent at capture → OUTPUT_SPENT_AT_CAPTURE", () => {
  const { evidence, expectedHashes } = mutate(both("outspend", () => '{"spent":true}'));
  assertReject(evaluateHistoricalOwnership(evidence, { expectedHashes }), "OUTPUT_SPENT_AT_CAPTURE");
});

test("altered transaction body bytes → TXID_MISMATCH", () => {
  // Byte 7 = first byte of input 0's previous txid (after version, segwit marker/flag and input count).
  const { evidence, expectedHashes } = mutate(both("hex", (h) => {
    const bytes = Buffer.from(h, "hex");
    assert.equal(bytes[4], 0x00);
    assert.equal(bytes[5], 0x01);
    bytes[7] ^= 0x01;
    return bytes.toString("hex");
  }));
  assertReject(evaluateHistoricalOwnership(evidence, { expectedHashes }), "TXID_MISMATCH");
});
test("truncated transaction hex → MALFORMED_EVIDENCE", () => {
  const { evidence, expectedHashes } = mutate(both("hex", (h) => h.slice(0, -8)));
  assertReject(evaluateHistoricalOwnership(evidence, { expectedHashes }), "MALFORMED_EVIDENCE");
});

test("malformed status JSON → MALFORMED_EVIDENCE", () => {
  const { evidence, expectedHashes } = mutate(both("status", (s) => s.slice(0, -1)));
  assertReject(evaluateHistoricalOwnership(evidence, { expectedHashes }), "MALFORMED_EVIDENCE");
});

test("derived controller differs from expected → CONTROLLER_MISMATCH", () => {
  const result = evaluateHistoricalOwnership(frozen, {
    expectedController: "bc1pupqk7jjtm7mucm9uvr2324c8jpm467ncgsy5zwe0g8szt906jk7s08k5jq",
  });
  assertReject(result, "CONTROLLER_MISMATCH");
});

// ---- Fail-closed: archived inscription-location record ----

function editArchive(edit) {
  return mutate({ [ARCHIVE]: editJson(frozen[ARCHIVE].toString("utf8"), edit) });
}

test("archived satpoint in another output → ARCHIVED_LOCATION_MISMATCH", () => {
  const { evidence, expectedHashes } = editArchive((record) => {
    record.pairs[1].district_authority.snapshot_satpoint = `${TXID}:14:0`;
  });
  assertReject(evaluateHistoricalOwnership(evidence, { expectedHashes }), "ARCHIVED_LOCATION_MISMATCH");
});

test("archived creation height contradicts Bitcoin evidence → ARCHIVED_LOCATION_MISMATCH", () => {
  const { evidence, expectedHashes } = editArchive((record) => {
    record.pairs[1].district_authority.current_output_created_at_height = 942808;
  });
  assertReject(evaluateHistoricalOwnership(evidence, { expectedHashes }), "ARCHIVED_LOCATION_MISMATCH");
});

test("archived observation before output creation → OBSERVATION_OUTSIDE_UNSPENT_WINDOW", () => {
  const { evidence, expectedHashes } = editArchive((record) => {
    record.snapshot.height = 942000;
  });
  assertReject(evaluateHistoricalOwnership(evidence, { expectedHashes }), "OBSERVATION_OUTSIDE_UNSPENT_WINDOW");
});

test("archived District record absent → ARCHIVED_RECORD_INVALID", () => {
  const { evidence, expectedHashes } = editArchive((record) => {
    record.pairs = record.pairs.filter((pair) => pair.district_authority?.district_inscription_id !== EXPERIMENT_29_PROFILE.district_inscription_id);
  });
  assertReject(evaluateHistoricalOwnership(evidence, { expectedHashes }), "ARCHIVED_RECORD_INVALID");
});

test("ledger provenance row removed → ARCHIVED_PROVENANCE_MISSING", () => {
  const ledger = frozen[LEDGER].toString("utf8").split("\n").filter((line) => !line.startsWith("| Independent location check")).join("\n");
  const { evidence, expectedHashes } = mutate({ [LEDGER]: ledger });
  assertReject(evaluateHistoricalOwnership(evidence, { expectedHashes }), "ARCHIVED_PROVENANCE_MISSING");
});
