// Bitmapverse — Experiment #31: verified ownership-evidence boundary.
//
// The only producer of non-fixture ownership evidence for Experiment #28.
// Evidence is minted only after the byte-pinned capture and Experiment #29's
// frozen evidence verify; it is deep-frozen and registered in a module-private
// WeakMap. Experiment #28 accepts non-fixture evidence only if that exact object
// is registered here, so caller-built objects, copies and proxies are refused
// regardless of their label.
//
// No permission policy lives here. Offline; no network, no clock.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  EXPERIMENT_29_PROFILE,
  evaluateHistoricalOwnership,
  loadFrozenEvidence,
} from "../experiment-29/ownership-evaluator.mjs";

const TXID = EXPERIMENT_29_PROFILE.txid;
const VOUT = EXPERIMENT_29_PROFILE.vout;
const PROVIDERS = EXPERIMENT_29_PROFILE.providers;

export const EVIDENCE_SOURCES = Object.freeze({
  real: "REAL_PROVIDER_CORROBORATED",
  synthetic: "SYNTHETIC_TEST_CAPTURE",
});

// Relative to experiments/experiment-31/evidence/. Bytes frozen exactly as captured (2026-10-30 ~12:38 UTC).
export const PINNED_CAPTURE_SHA256 = Object.freeze({
  "bitcoin-capture/mempool.space.blocks_tip_height": "ece0075a625992301735e3b14a3c49a951376ccfbff22db88b2806309c37161e",
  "bitcoin-capture/mempool.space.blocks_tip_hash": "1c4d37cf1a6de85e79cf63c80fb43d2974f35066a237c01cbc0c51db4060a1c3",
  [`bitcoin-capture/mempool.space.tx_${TXID}_outspend_15`]: "fe90f0c1e4023e0cd38fd6d2132c1382dd614fed61e6aebf05d19c52a8e65a1b",
  "bitcoin-capture/blockstream.info.blocks_tip_height": "ece0075a625992301735e3b14a3c49a951376ccfbff22db88b2806309c37161e",
  "bitcoin-capture/blockstream.info.blocks_tip_hash": "1c4d37cf1a6de85e79cf63c80fb43d2974f35066a237c01cbc0c51db4060a1c3",
  [`bitcoin-capture/blockstream.info.tx_${TXID}_outspend_15`]: "fe90f0c1e4023e0cd38fd6d2132c1382dd614fed61e6aebf05d19c52a8e65a1b",
});

const HEX64 = /^[0-9a-f]{64}$/;
const DIGITS = /^(0|[1-9][0-9]*)$/;

export class EvidenceError extends Error {
  constructor(code, reason) {
    super(`${code}: ${reason}`);
    this.code = code;
    this.reason = reason;
  }
}

function ensure(condition, code, reason) {
  if (!condition) throw new EvidenceError(code, reason);
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sortedKeys = (value) => JSON.stringify(Object.keys(value).toSorted());

function verifyCapture(capture, expectedHashes) {
  ensure(capture !== null && typeof capture === "object", "MISSING_CAPTURE", "no capture supplied");
  ensure(
    expectedHashes !== null && typeof expectedHashes === "object"
      && sortedKeys(expectedHashes) === sortedKeys(PINNED_CAPTURE_SHA256),
    "INVALID_CAPTURE_MANIFEST",
    "manifest must name exactly the six capture files",
  );
  for (const path of Object.keys(PINNED_CAPTURE_SHA256)) {
    ensure(Buffer.isBuffer(capture[path]), "MISSING_CAPTURE", path);
  }
  ensure(sortedKeys(capture) === sortedKeys(PINNED_CAPTURE_SHA256), "UNEXPECTED_CAPTURE", "extra capture files");
  for (const path of Object.keys(PINNED_CAPTURE_SHA256)) {
    ensure(sha256(capture[path]) === expectedHashes[path], "HASH_MISMATCH", path);
  }

  const facts = PROVIDERS.map((provider) => {
    const read = (suffix) => capture[`bitcoin-capture/${provider}.${suffix}`].toString("utf8");
    const height = read("blocks_tip_height");
    const hash = read("blocks_tip_hash");
    ensure(DIGITS.test(height) && Number.isSafeInteger(Number(height)), "MALFORMED_CAPTURE", `${provider}: tip height`);
    ensure(HEX64.test(hash), "MALFORMED_CAPTURE", `${provider}: tip hash`);
    let outspend;
    try {
      outspend = JSON.parse(read(`tx_${TXID}_outspend_${VOUT}`));
    } catch {
      throw new EvidenceError("MALFORMED_CAPTURE", `${provider}: outspend is not JSON`);
    }
    ensure(outspend !== null && typeof outspend === "object" && typeof outspend.spent === "boolean", "MALFORMED_CAPTURE", `${provider}: outspend`);
    return { height: Number(height), hash, spent: outspend.spent, outspend_keys: sortedKeys(outspend) };
  });
  ensure(JSON.stringify(facts[0]) === JSON.stringify(facts[1]), "PROVIDER_DISAGREEMENT", "providers returned different facts");
  ensure(facts[0].spent === false, "OUTPUT_SPENT_AT_CAPTURE", `${TXID}:${VOUT}`);
  ensure(facts[0].outspend_keys === JSON.stringify(["spent"]), "MALFORMED_CAPTURE", "unexpected outspend fields");

  const pinned = Object.keys(PINNED_CAPTURE_SHA256).every((path) => expectedHashes[path] === PINNED_CAPTURE_SHA256[path]);
  return { tip_height: facts[0].height, tip_hash: facts[0].hash, pinned };
}

export async function loadCurrentCapture(directory = new URL("./evidence/", import.meta.url)) {
  const capture = {};
  for (const path of Object.keys(PINNED_CAPTURE_SHA256)) {
    try {
      capture[path] = await readFile(new URL(path, directory));
    } catch {
      // Reported as MISSING_CAPTURE.
    }
  }
  return capture;
}

// ---- Verified-evidence registry (module-private) ----

const VERIFIED = new WeakMap();

function deepFreeze(value) {
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === "object") deepFreeze(child);
  }
  return Object.freeze(value);
}

export function isVerifiedOwnershipEvidence(evidence) {
  return evidence !== null && typeof evidence === "object"
    && VERIFIED.has(evidence) && VERIFIED.get(evidence) === evidence.source;
}

// Returns { evidence, observed, historical }. `evidence` is accepted by Experiment #28 only by identity.
export async function deriveOwnershipEvidence({ capture, expectedHashes = PINNED_CAPTURE_SHA256 } = {}) {
  const observed = verifyCapture(capture === undefined ? await loadCurrentCapture() : capture, expectedHashes);
  const historical = evaluateHistoricalOwnership(await loadFrozenEvidence());
  ensure(historical.result === "HISTORICAL_HOLDER", "HISTORICAL_EVIDENCE_REJECTED", String(historical.code));
  ensure(historical.output === `${TXID}:${VOUT}`, "OUTPUT_MISMATCH", historical.output);
  ensure(observed.tip_height >= historical.capture_tip_height, "CAPTURE_OLDER_THAN_HISTORICAL_EVIDENCE", String(observed.tip_height));

  const source = observed.pinned ? EVIDENCE_SOURCES.real : EVIDENCE_SOURCES.synthetic;
  const evidence = deepFreeze({
    source,
    tip: { height: observed.tip_height, block_hash: observed.tip_hash },
    inscriptions: {
      [historical.district_inscription_id]: {
        inscription_id: historical.district_inscription_id,
        output: historical.output,
        address: historical.holder_address,
        script_pubkey: historical.holder_script_pubkey,
        confirmed: true,
        confirmation_height: historical.output_created_at_height,
        spent: false,
      },
    },
  });
  VERIFIED.set(evidence, source);
  return { evidence, observed, historical };
}
