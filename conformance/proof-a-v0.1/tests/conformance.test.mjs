import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { canonicalize, canonicalizeToBytes } from "../adapters/canonical-json.mjs";
import { validate } from "../adapters/json-schema-lite.mjs";
import { toResolutionResult } from "../adapters/js-adapter.mjs";
import { buildEvidenceManifest } from "../adapters/evidence-enrichment.mjs";
import { generateJsReference } from "../generate-js-reference.mjs";
import { verifyCustodyChain } from "../custody.mjs";
import {
  ValidationError,
  assertDistrictNameMatchesDistrict,
  assertSelectedPositionNotAfterSnapshot,
  assertBoundaryBlockHashAgrees,
  assertRequiredFieldsPresent,
  assertValidIdsAndHashes,
  validateResolutionResultCore,
  CORE_REQUIRED_FIELDS,
} from "../adapters/resolution-result-rules.mjs";

const projectRoot = new URL("../../../", import.meta.url);
const sealedZipPath = new URL("bitmapverse-blind-submission-a-001.zip", projectRoot);
const SEALED_ZIP_SHA256 =
  "e882577e231043a0556d22a8348e4d90f607ccee188250341c1415df64ed1de3";

const CASES = [
  { fixtureId: "507999-at-959531", fixturePath: "fixtures/507999.snapshot.json" },
  { fixtureId: "7187-at-959531", fixturePath: "fixtures/7187.snapshot.json" },
];

async function sha256OfFile(url) {
  const bytes = await readFile(url);
  return createHash("sha256").update(bytes).digest("hex");
}

async function assertSealedZipUnchanged() {
  const hash = await sha256OfFile(sealedZipPath);
  assert.equal(hash, SEALED_ZIP_SHA256, "bitmapverse-blind-submission-a-001.zip must stay byte-identical");
}

async function extractSealedSubmission() {
  const dir = await mkdtemp(join(tmpdir(), "bitmapverse-proof-a-sealed-"));
  execFileSync("unzip", ["-o", "-q", sealedZipPath.pathname, "-d", dir]);
  return dir;
}

function runPythonConformanceCli(sealedResultPath, fixtureId, frozenFixturePath) {
  const cliPath = new URL("../python_conformance_cli.py", import.meta.url).pathname;
  const stdout = execFileSync(
    "python3",
    [cliPath, sealedResultPath, fixtureId, frozenFixturePath],
    { encoding: "utf8" },
  );
  return JSON.parse(stdout);
}

/** Strips eligible_candidate_count for an apples-to-apples core comparison
 * against Python's resolution_result_core, which never has that field. */
function toCore(resolutionResult) {
  const { eligible_candidate_count, ...core } = resolutionResult;
  void eligible_candidate_count;
  return core;
}

let sealedDir;
let jsReferences;

test.before(async () => {
  await assertSealedZipUnchanged();
  sealedDir = await extractSealedSubmission();
  jsReferences = await generateJsReference();
});

test.after(async () => {
  await assertSealedZipUnchanged();
  if (sealedDir) await rm(sealedDir, { recursive: true, force: true });
});

const schemas = {};
test.before(async () => {
  schemas.resolutionResult = JSON.parse(
    await readFile(new URL("schemas/resolution-result-v01.schema.json", projectRoot), "utf8"),
  );
  schemas.evidenceManifest = JSON.parse(
    await readFile(new URL("schemas/evidence-manifest-v01.schema.json", projectRoot), "utf8"),
  );
});

// --- Schema conformance: JS is fully conformant; Python's sealed output can
// only ever produce the core (missing exactly one required field).

for (const { fixtureId, fixturePath } of CASES) {
  test(`${fixtureId}: JS resolution_result fully validates against the stable schema`, () => {
    const jsResult = toResolutionResult(jsReferences[fixtureId]);
    assert.deepEqual(validate(schemas.resolutionResult, jsResult), { valid: true, errors: [] });
  });

  test(`${fixtureId}: Python resolution_result_core fails full-schema validation with exactly one missing field`, () => {
    const pyOutput = runPythonConformanceCli(
      join(sealedDir, "result.json"),
      fixtureId,
      new URL(fixturePath, projectRoot).pathname,
    );
    const { valid, errors } = validate(schemas.resolutionResult, pyOutput.resolution_result_core);
    assert.equal(valid, false);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /eligible_candidate_count/);
  });

  test(`${fixtureId}: python_adapter.to_resolution_result always fails, with a precise explanation`, () => {
    const pyOutput = runPythonConformanceCli(
      join(sealedDir, "result.json"),
      fixtureId,
      new URL(fixturePath, projectRoot).pathname,
    );
    assert.equal(typeof pyOutput.resolution_result_full_error, "string");
    assert.match(pyOutput.resolution_result_full_error, /eligible_candidate_count/);
    assert.match(pyOutput.resolution_result_full_error, /candidate_count/);
    assert.match(pyOutput.resolution_result_full_error, /must not consult the frozen fixture/);
  });

  test(`${fixtureId}: JS and Python resolution_result_core are semantically equal (core fields only)`, () => {
    const jsCore = toCore(toResolutionResult(jsReferences[fixtureId]));
    const pyOutput = runPythonConformanceCli(
      join(sealedDir, "result.json"),
      fixtureId,
      new URL(fixturePath, projectRoot).pathname,
    );
    assert.deepEqual(jsCore, pyOutput.resolution_result_core);
  });

  test(`${fixtureId}: JS and Python produce identical core canonical bytes and SHA-256`, () => {
    const jsCore = toCore(toResolutionResult(jsReferences[fixtureId]));
    const jsCanonical = canonicalize(jsCore);
    const jsHash = createHash("sha256").update(Buffer.from(jsCanonical, "utf8")).digest("hex");

    const pyOutput = runPythonConformanceCli(
      join(sealedDir, "result.json"),
      fixtureId,
      new URL(fixturePath, projectRoot).pathname,
    );
    const pyCanonicalFromJsCodec = canonicalize(pyOutput.resolution_result_core);

    assert.equal(jsCanonical, pyCanonicalFromJsCodec, "core canonical bytes must be identical");
    assert.equal(
      jsHash,
      pyOutput.resolution_result_core_canonical_sha256,
      "core canonical SHA-256 must be identical",
    );
  });

  test(`${fixtureId}: core canonical bytes are independent of input key order`, () => {
    const jsCore = toCore(toResolutionResult(jsReferences[fixtureId]));
    const reordered = Object.fromEntries(Object.entries(jsCore).reverse());
    assert.equal(canonicalize(jsCore), canonicalize(reordered));
  });

  test(`${fixtureId}: evidence_manifest validates on both sides (fixture-enriched, not a result claim)`, () => {
    const wrapped = jsReferences[fixtureId];
    const jsResult = toResolutionResult(wrapped);
    const jsHash = createHash("sha256").update(canonicalizeToBytes(jsResult)).digest("hex");
    const jsManifest = buildEvidenceManifest(wrapped, jsHash);
    assert.deepEqual(validate(schemas.evidenceManifest, jsManifest), { valid: true, errors: [] });

    const pyOutput = runPythonConformanceCli(
      join(sealedDir, "result.json"),
      fixtureId,
      new URL(fixturePath, projectRoot).pathname,
    );
    assert.deepEqual(validate(schemas.evidenceManifest, pyOutput.evidence_manifest), {
      valid: true,
      errors: [],
    });
  });
}

// --- Real semantic validators: every rule is exercised by actually calling
// the validator and asserting it throws — not by computing a boolean inline.

test("assertDistrictNameMatchesDistrict throws on a mismatched district_name", () => {
  const good = toCore(toResolutionResult(jsReferences["507999-at-959531"]));
  const bad = { ...good, district_name: "999999.bitmap" };
  assert.throws(() => assertDistrictNameMatchesDistrict(bad), ValidationError);
  assert.doesNotThrow(() => assertDistrictNameMatchesDistrict(good));
});

test("assertSelectedPositionNotAfterSnapshot throws when selected position is after the snapshot", () => {
  const good = toCore(toResolutionResult(jsReferences["507999-at-959531"]));
  const bad = {
    ...good,
    selected_position: { ...good.selected_position, block_height: good.snapshot.block_height + 1 },
  };
  assert.throws(() => assertSelectedPositionNotAfterSnapshot(bad), ValidationError);
  assert.doesNotThrow(() => assertSelectedPositionNotAfterSnapshot(good));
});

test("assertBoundaryBlockHashAgrees throws when the boundary candidate contradicts the snapshot hash", () => {
  // 7187-at-959531's selected candidate sits exactly at snapshot_height, so
  // corrupting its block_hash actually exercises the boundary rule.
  const good = toCore(toResolutionResult(jsReferences["7187-at-959531"]));
  assert.equal(good.selected_position.block_height, good.snapshot.block_height);
  const bad = { ...good, selected_position: { ...good.selected_position, block_hash: "f".repeat(64) } };
  assert.throws(() => assertBoundaryBlockHashAgrees(bad), ValidationError);
  assert.doesNotThrow(() => assertBoundaryBlockHashAgrees(good));
});

test("assertRequiredFieldsPresent throws when a required field is missing", () => {
  const good = toCore(toResolutionResult(jsReferences["507999-at-959531"]));
  const bad = { ...good };
  delete bad.selected_content_sha256;
  assert.throws(() => assertRequiredFieldsPresent(bad, CORE_REQUIRED_FIELDS), ValidationError);
  assert.doesNotThrow(() => assertRequiredFieldsPresent(good, CORE_REQUIRED_FIELDS));
});

test("assertValidIdsAndHashes throws on a malformed inscription id", () => {
  const good = toCore(toResolutionResult(jsReferences["507999-at-959531"]));
  const bad = { ...good, selected_inscription_id: "not-an-id" };
  assert.throws(() => assertValidIdsAndHashes(bad), ValidationError);
  assert.doesNotThrow(() => assertValidIdsAndHashes(good));
});

test("assertValidIdsAndHashes throws on a malformed content hash", () => {
  const good = toCore(toResolutionResult(jsReferences["507999-at-959531"]));
  const bad = { ...good, selected_content_sha256: "xyz" };
  assert.throws(() => assertValidIdsAndHashes(bad), ValidationError);
});

test("validateResolutionResultCore accepts both real fixtures' core output", () => {
  for (const fixtureId of ["507999-at-959531", "7187-at-959531"]) {
    const core = toCore(toResolutionResult(jsReferences[fixtureId]));
    assert.doesNotThrow(() => validateResolutionResultCore(core));
  }
});

test("Python's resolution_result_rules raise ValidationError on the same five rules (subprocess)", () => {
  execFileSync(
    "python3",
    [
      "-c",
      `
import sys
sys.path.insert(0, ${JSON.stringify(new URL("../adapters", import.meta.url).pathname)})
from resolution_result_rules import (
    ValidationError,
    assert_district_name_matches_district,
    assert_selected_position_not_after_snapshot,
    assert_boundary_block_hash_agrees,
    assert_required_fields_present,
    assert_valid_ids_and_hashes,
    CORE_REQUIRED_FIELDS,
)

good = {
    "schema": "bitmapverse.resolution_result.v0.1",
    "district": 507999,
    "district_name": "507999.bitmap",
    "resolver": "same_sat_latest_v0.1",
    "original_inscription_id": "2505f63d9bf8aad28ddfc7b6dc49e0fa38a3196f7d159f29235585d3fd6958d0i0",
    "selected_inscription_id": "16c5bedd987167d6d5e7a8097d2dacb22ac112eaa0d6d5b1ff030578e75f9675i0",
    "selected_content_sha256": "177e29dbaaf7cb10440535b4da29cd669332a336779dd96f0b0a408d4909775f",
    "sat": 1931628970942295,
    "selected_position": {
        "block_height": 959318, "block_hash": "0"*64, "transaction_id": "1"*64,
        "transaction_index": 2781, "inscription_index": 0,
    },
    "snapshot": {"block_height": 959531, "block_hash": "2"*64, "block_timestamp": None},
    "status": "experimental",
}

checks = 0

try:
    bad = dict(good, district_name="999999.bitmap")
    assert_district_name_matches_district(bad)
    raise SystemExit("district_name check did not raise")
except ValidationError:
    checks += 1

try:
    bad = dict(good, selected_position=dict(good["selected_position"], block_height=999999))
    assert_selected_position_not_after_snapshot(bad)
    raise SystemExit("position-after-snapshot check did not raise")
except ValidationError:
    checks += 1

try:
    bad = dict(good, snapshot=dict(good["snapshot"], block_height=good["selected_position"]["block_height"]), selected_position=dict(good["selected_position"], block_hash="f"*64))
    assert_boundary_block_hash_agrees(bad)
    raise SystemExit("boundary-hash check did not raise")
except ValidationError:
    checks += 1

try:
    bad = dict(good)
    del bad["selected_content_sha256"]
    assert_required_fields_present(bad, CORE_REQUIRED_FIELDS)
    raise SystemExit("required-fields check did not raise")
except ValidationError:
    checks += 1

try:
    bad = dict(good, selected_inscription_id="not-an-id")
    assert_valid_ids_and_hashes(bad)
    raise SystemExit("id-format check did not raise")
except ValidationError:
    checks += 1

assert checks == 5
`,
    ],
    { stdio: "pipe" },
  );
});

// --- Honest custody chain: real comparisons against cited prior
// commitments, plus an explicit, non-fabricated baseline where none exists.

test("custody chain: every artifact with a prior commitment matches it", async () => {
  const { allVerifiedMatch, results } = await verifyCustodyChain();
  assert.equal(allVerifiedMatch, true);
  const verified = results.filter((r) => r.kind === "verified_against_prior_commitment");
  assert.ok(verified.length >= 10, "expected at least 10 artifacts with real prior commitments");
  for (const entry of verified) {
    assert.equal(entry.matches, true, `${entry.path} does not match its cited prior commitment (${entry.commitment_source})`);
    assert.notEqual(entry.commitment_source, null);
  }
});

test("custody chain: proof-a-001.md is honestly reported as a new baseline, not a fabricated match", async () => {
  const { results } = await verifyCustodyChain();
  const auditEntry = results.find((r) => r.path === "blind/audits/proof-a-001.md");
  assert.ok(auditEntry, "expected an entry for blind/audits/proof-a-001.md");
  assert.equal(auditEntry.kind, "new_baseline");
  assert.equal(auditEntry.commitment_source, null);
  assert.match(auditEntry.actual_sha256, /^[0-9a-f]{64}$/);
  assert.match(auditEntry.note, /no puede demostrarse criptográficamente/);
});

// --- Offline check: adapters, enrichment, and codecs must not reference any
// networking primitive. Static-content scan, same technique as
// tests/blind-package.test.mjs.

test("adapters, enrichment modules, and codecs contain no networking primitives", async () => {
  const forbidden = [
    "fetch(",
    "http.request",
    "https.request",
    "XMLHttpRequest",
    "net.connect",
    "urllib",
    "requests.",
    "socket.",
  ];
  const files = [
    "../adapters/canonical-json.mjs",
    "../adapters/canonical_json.py",
    "../adapters/json-schema-lite.mjs",
    "../adapters/json_schema_lite.py",
    "../adapters/js-adapter.mjs",
    "../adapters/python_adapter.py",
    "../adapters/evidence-enrichment.mjs",
    "../adapters/evidence_enrichment.py",
    "../adapters/resolution-result-rules.mjs",
    "../adapters/resolution_result_rules.py",
    "../generate-js-reference.mjs",
    "../python_conformance_cli.py",
    "../custody.mjs",
  ];
  for (const relative of files) {
    const content = await readFile(new URL(relative, import.meta.url), "utf8");
    for (const fragment of forbidden) {
      assert.equal(content.includes(fragment), false, `${relative} references ${fragment}`);
    }
  }
});
