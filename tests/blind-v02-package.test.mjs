import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const packageRoot = new URL("../blind/v0.2/", import.meta.url);
const projectRoot = new URL("../", import.meta.url);
// v0.2's reserved oracle no longer lives in the repository (secrets were
// relocated to a private, permission-restricted folder outside the repo
// as part of hardening for v0.2.1 — see blind/PREDECESSOR_STATUS.md and
// tests/oracle-secrets-git-protection.test.mjs). This is the verified,
// byte-identical archived copy, not a re-derivation.
const oracleDir = process.env.BITMAPVERSE_PRIVATE_DIR
  ? new URL(`file://${process.env.BITMAPVERSE_PRIVATE_DIR}/bitmapverse/oracle/b1-v0.2.1/archived-v0.2/`)
  : null;
const zipPath = new URL("../bitmapverse-blind-v0.2.zip", import.meta.url);

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
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

test("el manifiesto enumera todos y solamente los archivos autorizados", async () => {
  const manifest = JSON.parse(await readFile(new URL("PACKAGE_MANIFEST.json", packageRoot), "utf8"));
  const observed = await collectFiles(packageRoot);
  const expected = [...Object.keys(manifest.files), "PACKAGE_MANIFEST.json"].sort();
  assert.deepEqual(observed, expected);
});

test("cada hash del manifiesto coincide con el archivo entregado", async () => {
  const manifest = JSON.parse(await readFile(new URL("PACKAGE_MANIFEST.json", packageRoot), "utf8"));
  for (const [path, expectedHash] of Object.entries(manifest.files)) {
    const actual = sha256(await readFile(new URL(path, packageRoot)));
    assert.equal(actual, expectedHash, path);
  }
});

test("el manifiesto se excluye explícitamente de su propio listado", async () => {
  const manifest = JSON.parse(await readFile(new URL("PACKAGE_MANIFEST.json", packageRoot), "utf8"));
  assert.equal("PACKAGE_MANIFEST.json" in manifest.files, false);
  assert.match(manifest.self_exclusion_note, /circularidad/);
});

// --- Leak scan: gather every real secret value from the real fixtures and
// the reserved oracle, then confirm none of them appear anywhere in the
// blind package or the assembled ZIP.

async function collectRealSecrets() {
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

  const oracle = JSON.parse(await readFile(new URL("oracle.json", oracleDir), "utf8"));
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

  const nonceHex = (await readFile(new URL("nonce.hex", oracleDir), "utf8")).trim();
  secrets.add(nonceHex);

  // resolution_snapshot.height/block_hash are explicitly PERMITTED content
  // per CONTRACT.md §10 ("Puede incluir: ... resolution_snapshot.block_hash").
  // One eligible candidate in each fixture sits exactly at snapshot height,
  // so its canonical_position.block_hash legitimately equals the snapshot's
  // own hash — that coincidence must not make the permitted snapshot hash
  // look like a leaked secret.
  for (const fixturePath of ["fixtures/507999.snapshot.json", "fixtures/7187.snapshot.json"]) {
    const fixture = JSON.parse(await readFile(new URL(fixturePath, projectRoot), "utf8"));
    secrets.delete(fixture.snapshot_block_hash);
  }

  // Drop values too short/generic to be meaningful leak signals (e.g. small
  // integers that could coincidentally appear in unrelated contexts like
  // block heights already legitimately public per CONTRACT.md §10).
  return [...secrets].filter((s) => s.length >= 16);
}

test("ningún ID, sat, hash de contenido o nonce reales aparece en el paquete ciego", async () => {
  const secrets = await collectRealSecrets();
  assert.ok(secrets.length > 10, "expected a non-trivial number of real secret values to scan for");

  const files = await collectFiles(packageRoot);
  for (const relative of files) {
    const content = await readFile(new URL(relative, packageRoot), "utf8");
    for (const secret of secrets) {
      assert.equal(
        content.includes(secret),
        false,
        `${relative} leaks a real secret value (${secret.slice(0, 12)}...)`,
      );
    }
  }
});

test("el paquete no referencia código, pruebas o resultados previos", async () => {
  // Citing blind/v0.1/CONTRACT.md by path (a public predecessor document,
  // not code or evidence) is legitimate meta-documentation for a
  // "sucesor contractual" and is intentionally NOT in this list — see
  // CONTRACT.md and BITMAP_DISCOVERY_PROFILE.md, which reference it by
  // name. What's forbidden is code, test, and reserved-evidence paths.
  const forbidden = [
    "src/resolvers",
    "resolver.py",
    "same-sat-latest-v01.test",
    "conformance/proof-a-v0.1",
    "bitmapverse-blind-submission-a-001",
    "shadow/runs",
    "oracle/reserved/same-sat-latest-v01.oracle",
    "oracle/reserved/b1-v0.2",
    "Freedeon",
    "Organa",
  ];
  const files = await collectFiles(packageRoot);
  for (const relative of files) {
    const content = await readFile(new URL(relative, packageRoot), "utf8");
    for (const fragment of forbidden) {
      assert.equal(content.includes(fragment), false, `${relative}: ${fragment}`);
    }
  }
});

test("el paquete no referencia fixtures reales por ruta", async () => {
  const forbidden = ["fixtures/507999.snapshot.json", "fixtures/7187.snapshot.json"];
  const files = await collectFiles(packageRoot);
  for (const relative of files) {
    const content = await readFile(new URL(relative, packageRoot), "utf8");
    for (const fragment of forbidden) {
      assert.equal(content.includes(fragment), false, `${relative}: ${fragment}`);
    }
  }
});

test("el paquete declara solamente los dos Districts bajo prueba, sin evidencia adicional", async () => {
  const contract = await readFile(new URL("CONTRACT.md", packageRoot), "utf8");
  assert.match(contract, /507999\.bitmap/);
  assert.match(contract, /7187\.bitmap/);
  // The shared resolution_snapshot height/hash are explicitly permitted
  // content (CONTRACT.md §10) — assert they're present, not absent.
  assert.match(contract, /959531/);
});

// --- ZIP assembly checks (only meaningful once the ZIP has been built).

test("el ZIP contiene solamente el material autorizado de blind/v0.2", async (t) => {
  let zipStat;
  try {
    zipStat = await import("node:fs/promises").then((fs) => fs.stat(zipPath));
  } catch {
    t.skip("bitmapverse-blind-v0.2.zip not built yet");
    return;
  }
  assert.ok(zipStat.isFile());

  const extractDir = await mkdtemp(join(tmpdir(), "bitmapverse-b1-v02-zipcheck-"));
  try {
    execFileSync("unzip", ["-o", "-q", zipPath.pathname, "-d", extractDir]);
    const manifest = JSON.parse(await readFile(new URL("PACKAGE_MANIFEST.json", packageRoot), "utf8"));
    // Matches bitmapverse-blind-v0.1.zip's own convention: entries are
    // rooted at "blind/v0.2/...", not just "v0.2/...".
    const expected = [...Object.keys(manifest.files), "PACKAGE_MANIFEST.json"]
      .map((p) => `blind/v0.2/${p}`)
      .sort();

    const extracted = await collectFiles(new URL(`file://${extractDir}/`));
    assert.deepEqual(extracted, expected);

    for (const [relative, expectedHash] of Object.entries(manifest.files)) {
      const actual = sha256(await readFile(join(extractDir, "blind", "v0.2", relative)));
      assert.equal(actual, expectedHash, relative);
    }
  } finally {
    await rm(extractDir, { recursive: true, force: true });
  }
});

test("nonce y oráculo nunca están dentro del ZIP", async (t) => {
  let zipStat;
  try {
    zipStat = await import("node:fs/promises").then((fs) => fs.stat(zipPath));
  } catch {
    t.skip("bitmapverse-blind-v0.2.zip not built yet");
    return;
  }
  assert.ok(zipStat.isFile());

  const listing = execFileSync("unzip", ["-l", zipPath.pathname], { encoding: "utf8" });
  assert.equal(listing.includes("nonce"), false);
  assert.equal(listing.includes("oracle.json"), false);
  assert.equal(listing.includes("REVEAL_INSTRUCTIONS"), false);
});
