import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validate } from "../scripts/b1-prep-v021/json-schema-lite.mjs";
import { canonicalize, canonicalizeToBytes, JcsError } from "../scripts/b1-prep-v021/jcs.mjs";

const packageRoot = new URL("../blind/v0.2.1/", import.meta.url);
// Real-oracle-dependent checks (schema validation against the actual
// private oracle, and the real-ID-leak scan) moved to
// tests/private-oracle-audit.test.mjs (npm run test:private-audit,
// local-only, never part of npm run test:all). Everything in this file
// now runs on schemas, test-vectors, and synthetic fixtures only.

async function loadSchema(name) {
  return JSON.parse(await readFile(new URL(name, packageRoot), "utf8"));
}

// A synthetic, schema-valid RESOLUTION_RESULT_SCHEMA v0.2.1 instance, used
// only as a baseline to mutate in the rejection tests below. No real
// oracle data — the schema's rejection behavior does not depend on the
// values being real.
function syntheticResolutionResult() {
  return {
    schema: "bitmapverse.resolution_result.v0.2.1",
    contract_version: "0.2.1",
    resolver: "same_sat_latest_v0.1",
    bitmap_discovery_profile: "bitmapverse.bitmap_discovery.v0.2.1",
    district: 1234567,
    district_name: "1234567.bitmap",
    original_inscription_id: `${"0".repeat(64)}i0`,
    sat: 1000000000,
    selected_inscription_id: `${"1".repeat(64)}i1`,
    selected_content_sha256: "2".repeat(64),
    selected_position: {
      block_height: 900000,
      block_hash: "3".repeat(64),
      transaction_id: "4".repeat(64),
      transaction_index: 0,
      inscription_index: 0,
    },
    resolution_snapshot: { height: 959531, block_hash: "5".repeat(64) },
    eligible_through_resolution_snapshot_count: 1,
    status: "experimental",
  };
}

// --- Schemas are well-formed and internally consistent.

test("los tres esquemas v0.2.1 son JSON válido con additionalProperties:false en el nivel superior", async () => {
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

// --- Schema rejects malformed instances.

test("RESOLUTION_RESULT_SCHEMA rechaza district_name con formato inválido", async () => {
  const schema = await loadSchema("RESOLUTION_RESULT_SCHEMA.json");
  const bad = { ...syntheticResolutionResult(), district_name: "not-a-district" };
  assert.equal(validate(schema, bad).valid, false);
});

test("RESOLUTION_RESULT_SCHEMA rechaza un campo obligatorio ausente", async () => {
  const schema = await loadSchema("RESOLUTION_RESULT_SCHEMA.json");
  const bad = syntheticResolutionResult();
  delete bad.eligible_through_resolution_snapshot_count;
  assert.equal(validate(schema, bad).valid, false);
});

test("RESOLUTION_RESULT_SCHEMA rechaza un entero fuera del rango seguro", async () => {
  const schema = await loadSchema("RESOLUTION_RESULT_SCHEMA.json");
  const bad = { ...syntheticResolutionResult(), sat: 9007199254740992 };
  assert.equal(validate(schema, bad).valid, false);
});

test("EVIDENCE_MANIFEST_SCHEMA exige evidencia registrada, no solo un booleano, para chain_ancestry_proof", async () => {
  const schema = await loadSchema("EVIDENCE_MANIFEST_SCHEMA.json");
  const bareBoolean = {
    schema: "bitmapverse.evidence_manifest.v0.2.1",
    contract_version: "0.2.1",
    resolution_snapshot: { height: 1, block_hash: "0".repeat(64) },
    observation_tip: { height: 2, block_hash: "1".repeat(64) },
    observed_through_observation_tip_count: 1,
    eligible_through_resolution_snapshot_count: 1,
    excluded_after_resolution_snapshot_count: 0,
    chain_ancestry_proof: { result: { ancestor: true } }, // missing method/operator/evidence_captured/evidence_sha256/limitations
    bitmap_discovery: { profile: "bitmapverse.bitmap_discovery.v0.2.1", implementation: "x", operator: null },
    sources: [],
    captured_artifacts: [],
    resolution_result_canonical_sha256: "0".repeat(64),
    candidate_set_canonical_sha256: "0".repeat(64),
  };
  const { valid, errors } = validate(schema, bareBoolean);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("chain_ancestry_proof")));
});

test("EVIDENCE_MANIFEST_SCHEMA exige al menos una fuente y un artefacto capturado", async () => {
  const schema = await loadSchema("EVIDENCE_MANIFEST_SCHEMA.json");
  const expected = JSON.parse(
    await readFile(new URL("test-vectors/synthetic-count-split.expected.json", packageRoot), "utf8"),
  );
  const bad = { ...expected.evidence_manifest, sources: [], captured_artifacts: [] };
  assert.equal(validate(schema, bad).valid, false);
  assert.equal(validate(schema, expected.evidence_manifest).valid, true);
});

test("EVIDENCE_MANIFEST_SCHEMA exige que una fuente paginada declare pagination.complete", async () => {
  const schema = await loadSchema("EVIDENCE_MANIFEST_SCHEMA.json");
  const expected = JSON.parse(
    await readFile(new URL("test-vectors/synthetic-count-split.expected.json", packageRoot), "utf8"),
  );
  const badSource = { ...expected.evidence_manifest.sources[0] };
  delete badSource.pagination;
  const bad = { ...expected.evidence_manifest, sources: [badSource] };
  assert.equal(validate(schema, bad).valid, false);
});

// --- Canonicalization vectors: JS matches its own recorded bytes/hashes,
// and Python (subprocess) produces byte-identical canonical output.

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
sys.path.insert(0, ${JSON.stringify(new URL("../scripts/b1-prep-v021", import.meta.url).pathname)})
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
  assert.match(output, /^OK 16/);
});

test("los vectores de rechazo (float, fuera de rango) se comportan igual en Python", () => {
  const script = `
import json, sys
sys.path.insert(0, ${JSON.stringify(new URL("../scripts/b1-prep-v021", import.meta.url).pathname)})
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

// --- v0.2.1-specific: isolated surrogates, -0, and UTF-16 key ordering.

test("sustitutos Unicode aislados se rechazan igual en JavaScript y Python", async () => {
  const doc = JSON.parse(
    await readFile(new URL("test-vectors/canonicalization-vectors.json", packageRoot), "utf8"),
  );
  for (const s of doc.surrogate_rejection_vectors) {
    const ch = String.fromCharCode(parseInt(s.code_point_hex, 16));
    assert.throws(() => canonicalize({ x: ch }), JcsError, s.name);
  }

  const script = `
import sys
sys.path.insert(0, ${JSON.stringify(new URL("../scripts/b1-prep-v021", import.meta.url).pathname)})
from jcs import canonicalize, JcsError
for hex_cp in ${JSON.stringify(
    (JSON.parse(
      await readFile(new URL("test-vectors/canonicalization-vectors.json", packageRoot), "utf8"),
    ).surrogate_rejection_vectors).map((s) => s.code_point_hex),
  )}:
    ch = chr(int(hex_cp, 16))
    try:
        canonicalize({"x": ch})
        raise SystemExit(f"{hex_cp} was NOT rejected")
    except JcsError:
        pass
print("OK")
`;
  const output = execFileSync("python3", ["-c", script], { encoding: "utf8" });
  assert.match(output, /^OK/);
});

test("-0 se rechaza explícitamente en JavaScript (no se normaliza a 0)", () => {
  assert.throws(() => canonicalize({ x: -0 }), JcsError);
  // A regular 0 must still be accepted and render as "0".
  assert.equal(canonicalize({ x: 0 }), '{"x":0}');
});

test("orden de claves por unidad de código UTF-16 coincide entre JavaScript y Python fuera del BMP", () => {
  const testObject = { "￿": "bmp_boundary_char", "\u{10000}": "first_astral_char" };
  const jsResult = canonicalize(testObject);
  // Pass the object through as JSON so Python source never has to embed a
  // raw \U escape inside a JS template literal (which mangled the
  // backslash in an earlier version of this test).
  const script = `
import json, sys
sys.path.insert(0, ${JSON.stringify(new URL("../scripts/b1-prep-v021", import.meta.url).pathname)})
from jcs import canonicalize
obj = json.loads(sys.stdin.read())
print(canonicalize(obj))
`;
  const pyResult = execFileSync("python3", ["-c", script], {
    encoding: "utf8",
    input: JSON.stringify(testObject),
  }).trim();
  assert.equal(jsResult, pyResult);
  // The astral character (U+10000) must sort FIRST — the opposite of
  // naive code-point order, and the entire point of this fix.
  assert.ok(jsResult.indexOf("first_astral_char") < jsResult.indexOf("bmp_boundary_char"));
});

// --- Synthetic count-split vector.

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

  const rrHash = createHash("sha256").update(canonicalizeToBytes(expected.resolution_result)).digest("hex");
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
  assert.equal(expected.evidence_manifest.excluded_after_resolution_snapshot_count, 1);
});

test("caso sintético declara paginación completa y al menos un artefacto capturado verificable", async () => {
  const expected = JSON.parse(
    await readFile(new URL("test-vectors/synthetic-count-split.expected.json", packageRoot), "utf8"),
  );
  const source = expected.evidence_manifest.sources[0];
  assert.equal(source.pagination.complete, true);
  assert.ok(expected.evidence_manifest.captured_artifacts.length >= 1);
  const artifact = expected.evidence_manifest.captured_artifacts[0];
  assert.match(artifact.sha256, /^[0-9a-f]{64}$/);
});

// The check that the synthetic vector doesn't leak real 507999.bitmap /
// 7187.bitmap inscription IDs requires reading the real oracle to know
// which IDs to check for — moved to tests/private-oracle-audit.test.mjs.
