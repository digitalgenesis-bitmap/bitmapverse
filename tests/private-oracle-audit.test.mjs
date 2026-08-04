// LOCAL-ONLY — npm run test:private-audit
//
// This suite is the ONLY place in this repository that reads the real,
// private reserved oracle and nonce. It exists to keep those reads out of
// the default suite (npm run test:all / npm test), which must stay
// reproducible on a clean clone and safe to run in CI.
//
// Rules this file follows:
//   - read-only: every private path is opened with readFile, never
//     written to;
//   - never prints nonce, oracle, or preimage contents — assertion
//     messages below never include any part of a secret value, not even
//     a truncated prefix;
//   - never copies private files into the repository;
//   - if the authorized private material is unavailable (e.g. running on
//     a machine other than The Source Revelator's own), every test in
//     this file skips with one concise, identical reason instead of
//     throwing a pile of ENOENT stack traces.
//
// Do not add this file, or any private-material read, to test:all,
// test, or any script that a clean clone / CI run would execute.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { before, test } from "node:test";

import { validate as validateV02 } from "../scripts/b1-prep/json-schema-lite.mjs";
import { validate as validateV021 } from "../scripts/b1-prep-v021/json-schema-lite.mjs";

const projectRoot = new URL("../", import.meta.url);
const BITMAPVERSE_PRIVATE_DIR = process.env.BITMAPVERSE_PRIVATE_DIR;
const PRIVATE_ORACLE_DIR = BITMAPVERSE_PRIVATE_DIR
  ? `${BITMAPVERSE_PRIVATE_DIR}/bitmapverse/oracle/b1-v0.2.1`
  : null;
const V02_ORACLE_DIR = PRIVATE_ORACLE_DIR ? `${PRIVATE_ORACLE_DIR}/archived-v0.2` : null;

let privateMaterialAvailable = true;
let unavailableReason = "";

before(async () => {
  if (!BITMAPVERSE_PRIVATE_DIR) {
    privateMaterialAvailable = false;
    unavailableReason =
      "BITMAPVERSE_PRIVATE_DIR environment variable is not set. " +
      "This command is local-only for The Source Revelator's own machine.";
    return;
  }
  try {
    await readFile(`${PRIVATE_ORACLE_DIR}/oracle.json`, "utf8");
    await readFile(`${PRIVATE_ORACLE_DIR}/nonce.hex`, "utf8");
    await readFile(`${V02_ORACLE_DIR}/oracle.json`, "utf8");
  } catch (error) {
    privateMaterialAvailable = false;
    unavailableReason =
      `Private oracle material not found under ${PRIVATE_ORACLE_DIR}. ` +
      "This command is local-only for The Source Revelator's own machine " +
      `(underlying error: ${error.code ?? error.message}).`;
  }
});

function skipIfUnavailable(t) {
  if (!privateMaterialAvailable) {
    t.skip(unavailableReason);
    return true;
  }
  return false;
}

async function collectFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(new URL(`${entry.name}/`, directory), `${relative}/`)));
    } else {
      files.push(relative);
    }
  }
  return files.sort();
}

function assertNoSecretLeak(content, secrets, relative) {
  for (const secret of secrets) {
    assert.equal(
      content.includes(secret),
      false,
      `${relative} leaks a real secret value (redacted — see tests/private-oracle-audit.test.mjs)`,
    );
  }
}

// =====================================================================
// Repo-wide nonce leak-scan (moved from tests/oracle-secrets-git-protection.test.mjs)
// =====================================================================

test("the v0.2.1 nonce never leaks into any tracked-or-trackable repo file", async (t) => {
  if (skipIfUnavailable(t)) return;

  const nonceHex = (await readFile(`${PRIVATE_ORACLE_DIR}/nonce.hex`, "utf8")).trim();
  assert.match(nonceHex, /^[0-9a-f]{64}$/);

  const candidateFiles = execFileSync(
    "git",
    ["ls-files", "--others", "--cached", "--exclude-standard"],
    { cwd: projectRoot.pathname, encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean);

  const offenders = [];
  for (const relative of candidateFiles) {
    let content;
    try {
      content = await readFile(new URL(relative, projectRoot), "utf8");
    } catch {
      continue; // binary or unreadable — not a text leak vector
    }
    if (content.includes(nonceHex)) {
      offenders.push(relative);
    }
  }
  assert.deepEqual(offenders, []);
});

// =====================================================================
// v0.2 — real oracle vs. shipped schemas (moved from tests/blind-v02-contract.test.mjs)
// =====================================================================

test("v0.2: the real reserved oracle validates against the shipped schemas", async (t) => {
  if (skipIfUnavailable(t)) return;

  const packageRoot = new URL("../blind/v0.2/", import.meta.url);
  const rrSchema = JSON.parse(await readFile(new URL("RESOLUTION_RESULT_SCHEMA.json", packageRoot), "utf8"));
  const csSchema = JSON.parse(await readFile(new URL("CANDIDATE_SET_SCHEMA.json", packageRoot), "utf8"));
  const oracle = JSON.parse(await readFile(`${V02_ORACLE_DIR}/oracle.json`, "utf8"));

  for (const rr of Object.values(oracle.resolution_results)) {
    const { valid, errors } = validateV02(rrSchema, rr);
    assert.equal(valid, true, errors.join("; "));
  }
  for (const cs of Object.values(oracle.candidate_sets_through_resolution_snapshot)) {
    const { valid, errors } = validateV02(csSchema, cs);
    assert.equal(valid, true, errors.join("; "));
  }
});

test("v0.2: resolution_result and candidate_set agree on the eligible count in the real oracle", async (t) => {
  if (skipIfUnavailable(t)) return;

  const oracle = JSON.parse(await readFile(`${V02_ORACLE_DIR}/oracle.json`, "utf8"));
  for (const districtName of Object.keys(oracle.resolution_results)) {
    const rr = oracle.resolution_results[districtName];
    const cs = oracle.candidate_sets_through_resolution_snapshot[districtName];
    assert.equal(rr.eligible_through_resolution_snapshot_count, cs.candidate_count, districtName);
    assert.equal(cs.candidates.length, cs.candidate_count, districtName);
  }
});

test("v0.2: the synthetic count-split vector does not leak a real 507999.bitmap or 7187.bitmap inscription ID", async (t) => {
  if (skipIfUnavailable(t)) return;

  const packageRoot = new URL("../blind/v0.2/", import.meta.url);
  const oracle = JSON.parse(await readFile(`${V02_ORACLE_DIR}/oracle.json`, "utf8"));
  const realIds = new Set();
  for (const rr of Object.values(oracle.resolution_results)) {
    realIds.add(rr.original_inscription_id);
    realIds.add(rr.selected_inscription_id);
  }
  const input = await readFile(new URL("test-vectors/synthetic-count-split.input.json", packageRoot), "utf8");
  const expectedRaw = await readFile(
    new URL("test-vectors/synthetic-count-split.expected.json", packageRoot),
    "utf8",
  );
  for (const id of realIds) {
    assert.equal(input.includes(id), false);
    assert.equal(expectedRaw.includes(id), false);
  }
});

// =====================================================================
// v0.2 package — real-secret leak scan (moved from tests/blind-v02-package.test.mjs)
// =====================================================================

async function collectRealSecretsV02() {
  const secrets = new Set();

  for (const fixturePath of ["fixtures/507999.snapshot.json", "fixtures/7187.snapshot.json"]) {
    const fixture = JSON.parse(await readFile(new URL(fixturePath, projectRoot), "utf8"));
    secrets.add(fixture.original_inscription_id);
    secrets.add(String(fixture.sat));
    for (const candidate of fixture.candidates) {
      secrets.add(candidate.inscription_id);
      secrets.add(String(candidate.sat));
      secrets.add(candidate.content_sha256);
      secrets.add(candidate.canonical_position.transaction_id);
      secrets.add(candidate.canonical_position.block_hash);
    }
  }

  const oracle = JSON.parse(await readFile(`${V02_ORACLE_DIR}/oracle.json`, "utf8"));
  for (const rr of Object.values(oracle.resolution_results)) {
    secrets.add(rr.original_inscription_id);
    secrets.add(rr.selected_inscription_id);
    secrets.add(rr.selected_content_sha256);
    secrets.add(String(rr.sat));
    secrets.add(rr.selected_position.transaction_id);
  }
  for (const cs of Object.values(oracle.candidate_sets_through_resolution_snapshot)) {
    for (const c of cs.candidates) {
      secrets.add(c.inscription_id);
      secrets.add(c.content_sha256);
      secrets.add(c.canonical_position.transaction_id);
    }
  }

  const nonceHex = (await readFile(`${V02_ORACLE_DIR}/nonce.hex`, "utf8")).trim();
  secrets.add(nonceHex);

  // resolution_snapshot.height/block_hash are explicitly PERMITTED content
  // (blind/v0.2/CONTRACT.md §10). Drop the coincidental overlap and any
  // value too short/generic to be a meaningful leak signal.
  for (const fixturePath of ["fixtures/507999.snapshot.json", "fixtures/7187.snapshot.json"]) {
    const fixture = JSON.parse(await readFile(new URL(fixturePath, projectRoot), "utf8"));
    secrets.delete(fixture.snapshot_block_hash);
  }
  return [...secrets].filter((s) => s.length >= 16);
}

test("v0.2 package: no real ID, sat, content hash, or nonce appears in the blind package", async (t) => {
  if (skipIfUnavailable(t)) return;

  const packageRoot = new URL("../blind/v0.2/", import.meta.url);
  const secrets = await collectRealSecretsV02();
  assert.ok(secrets.length > 10, "expected a non-trivial number of real secret values to scan for");

  const files = await collectFiles(packageRoot);
  for (const relative of files) {
    const content = await readFile(new URL(relative, packageRoot), "utf8");
    assertNoSecretLeak(content, secrets, relative);
  }
});

// =====================================================================
// v0.2.1 — real oracle vs. shipped schemas (moved from tests/blind-v021-contract.test.mjs)
// =====================================================================

test("v0.2.1: the real reserved oracle validates against the shipped schemas", async (t) => {
  if (skipIfUnavailable(t)) return;

  const packageRoot = new URL("../blind/v0.2.1/", import.meta.url);
  const rrSchema = JSON.parse(await readFile(new URL("RESOLUTION_RESULT_SCHEMA.json", packageRoot), "utf8"));
  const csSchema = JSON.parse(await readFile(new URL("CANDIDATE_SET_SCHEMA.json", packageRoot), "utf8"));
  const oracle = JSON.parse(await readFile(`${PRIVATE_ORACLE_DIR}/oracle.json`, "utf8"));

  for (const rr of Object.values(oracle.resolution_results)) {
    const { valid, errors } = validateV021(rrSchema, rr);
    assert.equal(valid, true, errors.join("; "));
  }
  for (const cs of Object.values(oracle.candidate_sets_through_resolution_snapshot)) {
    const { valid, errors } = validateV021(csSchema, cs);
    assert.equal(valid, true, errors.join("; "));
  }
});

test("v0.2.1: resolution_result and candidate_set agree on the eligible count in the real oracle", async (t) => {
  if (skipIfUnavailable(t)) return;

  const oracle = JSON.parse(await readFile(`${PRIVATE_ORACLE_DIR}/oracle.json`, "utf8"));
  for (const districtName of Object.keys(oracle.resolution_results)) {
    const rr = oracle.resolution_results[districtName];
    const cs = oracle.candidate_sets_through_resolution_snapshot[districtName];
    assert.equal(rr.eligible_through_resolution_snapshot_count, cs.candidate_count, districtName);
    assert.equal(cs.candidates.length, cs.candidate_count, districtName);
  }
});

test("v0.2.1: the synthetic count-split vector does not leak a real 507999.bitmap or 7187.bitmap inscription ID", async (t) => {
  if (skipIfUnavailable(t)) return;

  const packageRoot = new URL("../blind/v0.2.1/", import.meta.url);
  const oracle = JSON.parse(await readFile(`${PRIVATE_ORACLE_DIR}/oracle.json`, "utf8"));
  const realIds = new Set();
  for (const rr of Object.values(oracle.resolution_results)) {
    realIds.add(rr.original_inscription_id);
    realIds.add(rr.selected_inscription_id);
  }
  const input = await readFile(new URL("test-vectors/synthetic-count-split.input.json", packageRoot), "utf8");
  const expectedRaw = await readFile(
    new URL("test-vectors/synthetic-count-split.expected.json", packageRoot),
    "utf8",
  );
  for (const id of realIds) {
    assert.equal(input.includes(id), false);
    assert.equal(expectedRaw.includes(id), false);
  }
});

// =====================================================================
// v0.2.1 package — real-secret leak scan (moved from tests/blind-v021-package.test.mjs)
// =====================================================================

async function collectRealSecretsV021() {
  const secrets = new Set();

  for (const fixturePath of ["fixtures/507999.snapshot.json", "fixtures/7187.snapshot.json"]) {
    const fixture = JSON.parse(await readFile(new URL(fixturePath, projectRoot), "utf8"));
    secrets.add(fixture.original_inscription_id);
    secrets.add(String(fixture.sat));
    for (const candidate of fixture.candidates) {
      secrets.add(candidate.inscription_id);
      secrets.add(String(candidate.sat));
      secrets.add(candidate.content_sha256);
      secrets.add(candidate.canonical_position.transaction_id);
    }
  }

  const oracle = JSON.parse(await readFile(`${PRIVATE_ORACLE_DIR}/oracle.json`, "utf8"));
  for (const rr of Object.values(oracle.resolution_results)) {
    secrets.add(rr.original_inscription_id);
    secrets.add(rr.selected_inscription_id);
    secrets.add(rr.selected_content_sha256);
    secrets.add(String(rr.sat));
    secrets.add(rr.selected_position.transaction_id);
  }
  for (const cs of Object.values(oracle.candidate_sets_through_resolution_snapshot)) {
    for (const c of cs.candidates) {
      secrets.add(c.inscription_id);
      secrets.add(c.content_sha256);
      secrets.add(c.canonical_position.transaction_id);
    }
  }

  const nonceHex = (await readFile(`${PRIVATE_ORACLE_DIR}/nonce.hex`, "utf8")).trim();
  secrets.add(nonceHex);

  for (const fixturePath of ["fixtures/507999.snapshot.json", "fixtures/7187.snapshot.json"]) {
    const fixture = JSON.parse(await readFile(new URL(fixturePath, projectRoot), "utf8"));
    secrets.delete(fixture.snapshot_block_hash); // explicitly permitted (CONTRACT.md §14)
  }
  return [...secrets].filter((s) => s.length >= 16);
}

test("v0.2.1 package: no real ID, sat, content hash, or nonce appears in the blind package", async (t) => {
  if (skipIfUnavailable(t)) return;

  const packageRoot = new URL("../blind/v0.2.1/", import.meta.url);
  const secrets = await collectRealSecretsV021();
  assert.ok(secrets.length > 10, "expected a non-trivial number of real secret values to scan for");

  const files = await collectFiles(packageRoot);
  for (const relative of files) {
    const content = await readFile(new URL(relative, packageRoot), "utf8");
    assertNoSecretLeak(content, secrets, relative);
  }
});

// =====================================================================
// v0.2.2 draft package — real-secret leak scan (moved from tests/blind-v022-package.test.mjs)
// v0.2.2 has no oracle/nonce of its own; the draft reuses the v0.2.1 pair.
// =====================================================================

async function collectRealSecretsV022() {
  const secrets = new Set();
  for (const fixturePath of ["fixtures/507999.snapshot.json", "fixtures/7187.snapshot.json"]) {
    const fixture = JSON.parse(await readFile(new URL(fixturePath, projectRoot), "utf8"));
    secrets.add(fixture.original_inscription_id);
    secrets.add(String(fixture.sat));
    for (const candidate of fixture.candidates) {
      secrets.add(candidate.inscription_id);
      secrets.add(String(candidate.sat));
      secrets.add(candidate.content_sha256);
      secrets.add(candidate.canonical_position.transaction_id);
    }
  }

  const oracle = JSON.parse(await readFile(`${PRIVATE_ORACLE_DIR}/oracle.json`, "utf8"));
  for (const rr of Object.values(oracle.resolution_results)) {
    secrets.add(rr.original_inscription_id);
    secrets.add(rr.selected_inscription_id);
    secrets.add(rr.selected_content_sha256);
    secrets.add(String(rr.sat));
    secrets.add(rr.selected_position.transaction_id);
  }
  for (const cs of Object.values(oracle.candidate_sets_through_resolution_snapshot)) {
    for (const c of cs.candidates) {
      secrets.add(c.inscription_id);
      secrets.add(c.content_sha256);
      secrets.add(c.canonical_position.transaction_id);
    }
  }

  const nonceHex = (await readFile(`${PRIVATE_ORACLE_DIR}/nonce.hex`, "utf8")).trim();
  secrets.add(nonceHex);

  for (const fixturePath of ["fixtures/507999.snapshot.json", "fixtures/7187.snapshot.json"]) {
    const fixture = JSON.parse(await readFile(new URL(fixturePath, projectRoot), "utf8"));
    secrets.delete(fixture.snapshot_block_hash); // explicitly permitted (CONTRACT.md §17)
  }
  return [...secrets].filter((s) => s.length >= 16);
}

test("v0.2.2 draft package: no real ID, sat, content hash, or nonce appears in the draft package", async (t) => {
  if (skipIfUnavailable(t)) return;

  const packageRoot = new URL("../blind/v0.2.2/", import.meta.url);
  const secrets = await collectRealSecretsV022();
  assert.ok(secrets.length > 10);

  const files = await collectFiles(packageRoot);
  for (const relative of files) {
    const content = await readFile(new URL(relative, packageRoot), "utf8");
    assertNoSecretLeak(content, secrets, relative);
  }
});
