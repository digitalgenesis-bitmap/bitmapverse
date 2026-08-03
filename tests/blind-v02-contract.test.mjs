import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validate } from "../scripts/b1-prep/json-schema-lite.mjs";
import { canonicalize, canonicalizeToBytes } from "../scripts/b1-prep/jcs.mjs";

const packageRoot = new URL("../blind/v0.2/", import.meta.url);
// v0.2's reserved oracle no longer lives in the repository (secrets were
// relocated to a private, permission-restricted folder outside the repo
// as part of hardening for v0.2.1 — see blind/PREDECESSOR_STATUS.md and
// tests/oracle-secrets-git-protection.test.mjs). This is the verified,
// byte-identical archived copy, not a re-derivation.
const oracleDir = process.env.BITMAPVERSE_PRIVATE_DIR
  ? new URL(`file://${process.env.BITMAPVERSE_PRIVATE_DIR}/bitmapverse/oracle/b1-v0.2.1/archived-v0.2/`)
  : null;

async function loadSchema(name) {
  return JSON.parse(await readFile(new URL(name, packageRoot), "utf8"));
}

// --- Schemas are well-formed and internally consistent.

test("los tres esquemas v0.2 son JSON válido con additionalProperties:false en el nivel superior", async () => {
  for (const name of [
    "RESOLUTION_RESULT_SCHEMA.json",
    "CANDIDATE_SET_SCHEMA.json",
    "EVIDENCE_MANIFEST_SCHEMA.json",
  ]) {
    const schema = await loadSchema(name);
    assert.equal(schema.additionalProperties, false, name);
    assert.ok(Array.isArray(schema.required) && schema.required.length > 0, name);
  }
});

// --- The real reserved oracle (never read into the blind package) must
// validate cleanly against the schemas that ship inside the package. This
// exercises the schemas against real data without putting real data in the
// package itself.

test("el oráculo reservado real valida contra los esquemas del paquete", async () => {
  const rrSchema = await loadSchema("RESOLUTION_RESULT_SCHEMA.json");
  const csSchema = await loadSchema("CANDIDATE_SET_SCHEMA.json");
  const oracle = JSON.parse(await readFile(new URL("oracle.json", oracleDir), "utf8"));

  for (const rr of Object.values(oracle.resolution_results)) {
    const { valid, errors } = validate(rrSchema, rr);
    assert.equal(valid, true, errors.join("; "));
  }
  for (const cs of Object.values(oracle.candidate_sets_through_resolution_snapshot)) {
    const { valid, errors } = validate(csSchema, cs);
    assert.equal(valid, true, errors.join("; "));
  }
});

test("resolution_result y candidate_set del oráculo real coinciden en el conteo elegible", async () => {
  const oracle = JSON.parse(await readFile(new URL("oracle.json", oracleDir), "utf8"));
  for (const districtName of Object.keys(oracle.resolution_results)) {
    const rr = oracle.resolution_results[districtName];
    const cs = oracle.candidate_sets_through_resolution_snapshot[districtName];
    assert.equal(rr.eligible_through_resolution_snapshot_count, cs.candidate_count, districtName);
    assert.equal(cs.candidates.length, cs.candidate_count, districtName);
  }
});

// --- Schema rejects malformed instances (real assert.throws-equivalent:
// validate() returning valid:false is this validator's error-reporting
// contract, asserted explicitly, not inferred from a side computation).

test("RESOLUTION_RESULT_SCHEMA rechaza district_name con formato inválido", async () => {
  const schema = await loadSchema("RESOLUTION_RESULT_SCHEMA.json");
  const oracle = JSON.parse(await readFile(new URL("oracle.json", oracleDir), "utf8"));
  const good = Object.values(oracle.resolution_results)[0];
  const bad = { ...good, district_name: "not-a-district" };
  assert.equal(validate(schema, bad).valid, false);
});

test("RESOLUTION_RESULT_SCHEMA rechaza un campo obligatorio ausente", async () => {
  const schema = await loadSchema("RESOLUTION_RESULT_SCHEMA.json");
  const oracle = JSON.parse(await readFile(new URL("oracle.json", oracleDir), "utf8"));
  const good = Object.values(oracle.resolution_results)[0];
  const bad = { ...good };
  delete bad.eligible_through_resolution_snapshot_count;
  assert.equal(validate(schema, bad).valid, false);
});

test("RESOLUTION_RESULT_SCHEMA rechaza un entero fuera del rango seguro", async () => {
  const schema = await loadSchema("RESOLUTION_RESULT_SCHEMA.json");
  const oracle = JSON.parse(await readFile(new URL("oracle.json", oracleDir), "utf8"));
  const good = Object.values(oracle.resolution_results)[0];
  const bad = { ...good, sat: 9007199254740992 };
  assert.equal(validate(schema, bad).valid, false);
});

test("EVIDENCE_MANIFEST_SCHEMA exige evidencia registrada, no solo un booleano, para chain_ancestry_proof", async () => {
  const schema = await loadSchema("EVIDENCE_MANIFEST_SCHEMA.json");
  const bareBoolean = {
    schema: "bitmapverse.evidence_manifest.v0.2",
    contract_version: "0.2.0",
    resolution_snapshot: { height: 1, block_hash: "0".repeat(64) },
    observation_tip: { height: 2, block_hash: "1".repeat(64) },
    observed_through_observation_tip_count: 1,
    eligible_through_resolution_snapshot_count: 1,
    excluded_after_resolution_snapshot_count: 0,
    chain_ancestry_proof: { result: { ancestor: true } }, // missing method/operator/evidence_captured/evidence_sha256/limitations
    bitmap_discovery: { profile: "bitmapverse.bitmap_discovery.v0.2", implementation: "x", operator: null },
    resolution_result_canonical_sha256: "0".repeat(64),
    candidate_set_canonical_sha256: "0".repeat(64),
  };
  const { valid, errors } = validate(schema, bareBoolean);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("chain_ancestry_proof")));
});

// --- Canonicalization vectors: JS matches its own recorded bytes/hashes,
// and Python (subprocess) produces byte-identical canonical output for
// every vector.

test("los vectores de canonicalización son correctos en JavaScript", async () => {
  const doc = JSON.parse(
    await readFile(new URL("test-vectors/canonicalization-vectors.json", packageRoot), "utf8"),
  );
  for (const v of doc.vectors) {
    const canonical = canonicalize(v.input);
    const hash = createHash("sha256").update(Buffer.from(canonical, "utf8")).digest("hex");
    assert.equal(canonical, v.canonical_bytes_utf8, v.name);
    assert.equal(hash, v.sha256, v.name);
  }
});

test("los vectores de canonicalización son correctos en Python y coinciden byte a byte con JavaScript", () => {
  const script = `
import json, sys
sys.path.insert(0, ${JSON.stringify(new URL("../scripts/b1-prep", import.meta.url).pathname)})
from jcs import canonicalize

with open(${JSON.stringify(new URL("test-vectors/canonicalization-vectors.json", packageRoot).pathname)}) as f:
    doc = json.load(f)

mismatches = []
for v in doc["vectors"]:
    c = canonicalize(v["input"])
    if c != v["canonical_bytes_utf8"]:
        mismatches.append(v["name"])

if mismatches:
    raise SystemExit("mismatches: " + ",".join(mismatches))
print("OK", len(doc["vectors"]))
`;
  const output = execFileSync("python3", ["-c", script], { encoding: "utf8" });
  assert.match(output, /^OK 12/);
});

test("los vectores de rechazo se comportan igual en Python", () => {
  const script = `
import json, sys
sys.path.insert(0, ${JSON.stringify(new URL("../scripts/b1-prep", import.meta.url).pathname)})
from jcs import canonicalize, JcsError

with open(${JSON.stringify(new URL("test-vectors/canonicalization-vectors.json", packageRoot).pathname)}) as f:
    doc = json.load(f)

mismatches = []
for r in doc["rejection_vectors"]:
    try:
        canonicalize(r["input"])
        rejected = False
    except JcsError:
        rejected = True
    if rejected != r["rejected"]:
        mismatches.append(r["name"])

if mismatches:
    raise SystemExit("mismatches: " + ",".join(mismatches))
print("OK", len(doc["rejection_vectors"]))
`;
  const output = execFileSync("python3", ["-c", script], { encoding: "utf8" });
  assert.match(output, /^OK 3/);
});

// --- Synthetic count-split vector: recompute in JS from the raw input and
// confirm it matches the recorded expected output, the invariant, and the
// hash-stability demonstration.

test("caso sintético: invariante observed = eligible + excluded se cumple", async () => {
  const expected = JSON.parse(
    await readFile(new URL("test-vectors/synthetic-count-split.expected.json", packageRoot), "utf8"),
  );
  const em = expected.evidence_manifest;
  assert.equal(
    em.observed_through_observation_tip_count,
    em.eligible_through_resolution_snapshot_count + em.excluded_after_resolution_snapshot_count,
  );
  assert.equal(em.observed_through_observation_tip_count, 3);
  assert.equal(em.eligible_through_resolution_snapshot_count, 2);
  assert.equal(em.excluded_after_resolution_snapshot_count, 1);
});

test("caso sintético: recomputar desde el input en JavaScript reproduce exactamente el expected", async () => {
  const input = JSON.parse(
    await readFile(new URL("test-vectors/synthetic-count-split.input.json", packageRoot), "utf8"),
  );
  const expected = JSON.parse(
    await readFile(new URL("test-vectors/synthetic-count-split.expected.json", packageRoot), "utf8"),
  );

  const snapshotH = input.resolution_snapshot.height;
  const tipH = input.observation_tip.height;
  const candidates = input.observed_candidates;

  const eligible = candidates
    .filter((c) => c.canonical_position.block_height <= snapshotH)
    .toSorted(
      (a, b) =>
        a.canonical_position.block_height - b.canonical_position.block_height ||
        a.canonical_position.transaction_index - b.canonical_position.transaction_index ||
        a.canonical_position.inscription_index - b.canonical_position.inscription_index,
    );
  const excluded = candidates.filter(
    (c) => c.canonical_position.block_height > snapshotH && c.canonical_position.block_height <= tipH,
  );
  const selected = eligible.at(-1);

  assert.equal(selected.inscription_id, expected.resolution_result.selected_inscription_id);
  assert.equal(eligible.length, expected.resolution_result.eligible_through_resolution_snapshot_count);
  assert.equal(eligible.length, expected.evidence_manifest.eligible_through_resolution_snapshot_count);
  assert.equal(excluded.length, expected.evidence_manifest.excluded_after_resolution_snapshot_count);

  const rrHash = createHash("sha256")
    .update(canonicalizeToBytes(expected.resolution_result))
    .digest("hex");
  assert.equal(rrHash, expected.canonical_hashes.resolution_result);
});

test("caso sintético: una inscripción posterior al snapshot no cambia resolution_result pero sí evidence_manifest", async () => {
  const expected = JSON.parse(
    await readFile(new URL("test-vectors/synthetic-count-split.expected.json", packageRoot), "utf8"),
  );
  assert.equal(expected.stability_demonstration.identical, true);
  assert.equal(
    expected.stability_demonstration.resolution_result_canonical_sha256_with_excluded_candidate_known,
    expected.stability_demonstration.resolution_result_canonical_sha256_if_excluded_candidate_had_never_been_observed,
  );
  // But the manifest DOES register the excluded candidate:
  assert.equal(expected.evidence_manifest.excluded_after_resolution_snapshot_count, 1);
});

test("caso sintético no revela ningún ID real de 507999.bitmap o 7187.bitmap", async () => {
  const oracle = JSON.parse(await readFile(new URL("oracle.json", oracleDir), "utf8"));
  const realIds = new Set();
  for (const rr of Object.values(oracle.resolution_results)) {
    realIds.add(rr.original_inscription_id);
    realIds.add(rr.selected_inscription_id);
  }
  const input = await readFile(
    new URL("test-vectors/synthetic-count-split.input.json", packageRoot),
    "utf8",
  );
  const expectedRaw = await readFile(
    new URL("test-vectors/synthetic-count-split.expected.json", packageRoot),
    "utf8",
  );
  for (const id of realIds) {
    assert.equal(input.includes(id), false);
    assert.equal(expectedRaw.includes(id), false);
  }
});
