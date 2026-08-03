import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const packageRoot = new URL("../blind/v0.2.1/", import.meta.url);
const projectRoot = new URL("../", import.meta.url);
// Secrets live entirely outside the repository now (see task: proteger y
// rotar secretos) — this is the one authorized private path, never a
// path inside the repo.
const PRIVATE_ORACLE_DIR = process.env.BITMAPVERSE_PRIVATE_DIR
  ? `${process.env.BITMAPVERSE_PRIVATE_DIR}/bitmapverse/oracle/b1-v0.2.1`
  : null;
const zipPath = new URL("../bitmapverse-blind-v0.2.1.zip", import.meta.url);

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

// --- Leak scan, scoped narrowly to the blind package. Real inscription
// IDs/sats/content hashes for 507999.bitmap and 7187.bitmap are already
// legitimately public elsewhere in this repository (Prueba A revealed
// them — fixtures/*.json, blind/v0.1/fixtures/*, conformance reports).
// Scanning the whole repo for them would flag dozens of already-verified
// historical files as "leaking" facts that were never secret. What DOES
// matter here: the blind/v0.2.1 PACKAGE itself — what an implementer
// actually receives — must never reference them, regardless of whether
// they're public elsewhere. See tests/oracle-secrets-git-protection.test.mjs
// for the genuinely repo-wide check (the nonce, which has no legitimate
// reason to appear anywhere but the private folder).

async function collectRealSecretsForPackageScan() {
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

  // resolution_snapshot.height/block_hash are explicitly PERMITTED
  // content (CONTRACT.md §14). One eligible candidate in each fixture
  // sits exactly at snapshot height, so its canonical_position.block_hash
  // legitimately equals the snapshot's own hash.
  for (const fixturePath of ["fixtures/507999.snapshot.json", "fixtures/7187.snapshot.json"]) {
    const fixture = JSON.parse(await readFile(new URL(fixturePath, projectRoot), "utf8"));
    secrets.delete(fixture.snapshot_block_hash);
  }

  return [...secrets].filter((s) => s.length >= 16);
}

test("ningún ID, sat, hash de contenido o nonce reales aparece en el paquete ciego v0.2.1", async () => {
  const secrets = await collectRealSecretsForPackageScan();
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

test("el paquete no referencia código, pruebas, herramientas o resultados previos", async () => {
  // Citing blind/v0.1/CONTRACT.md or blind/v0.2/* by path (public
  // predecessor documents, not code or evidence) is legitimate
  // meta-documentation for a "sucesor contractual" and intentionally NOT
  // in this list. Nor is a bare "oracle/reserved/" mention forbidden —
  // that directory holds no v0.2.1 secret anymore (all moved outside the
  // repo; see task: proteger y rotar secretos), and the path itself is
  // already public in .gitignore as the security control being
  // described, not a pointer to anything sensitive. What IS forbidden:
  // code, test, tooling, and the specific historical reserved-evidence
  // paths that used to (or still do, for Prueba A) hold real secrets.
  const forbidden = [
    "src/resolvers",
    "resolver.py",
    "same-sat-latest-v01.test",
    "conformance/proof-a-v0.1",
    "bitmapverse-blind-submission-a-001",
    "shadow/runs",
    "oracle/reserved/same-sat-latest-v01.oracle",
    "scripts/b1-prep",
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
  assert.match(contract, /959531/);
});

test("el paquete es autosuficiente: CONTRACT.md define el algoritmo sin depender normativamente de v0.1 o v0.2", async () => {
  const contract = await readFile(new URL("CONTRACT.md", packageRoot), "utf8");
  // Positive requirement: the algorithm sections must actually be present
  // inline, not just referenced.
  assert.match(contract, /## 1\. Descubrimiento de la inscripción fundacional/);
  assert.match(contract, /## 5\. Orden canónico/);
  assert.match(contract, /## 6\. Selección/);
  assert.match(contract, /## 7\. Fallback a la original/);
  // v0.1 may be cited only as non-normative historical antecedent, never
  // as "ver v0.1 para la regla" — the actual rule text for §1-§7 must not
  // point back at v0.1's contract for substance.
  const algorithmSection = contract.slice(
    contract.indexOf("## 1. Descubrimiento"),
    contract.indexOf("## 8. Validaciones"),
  );
  assert.equal(algorithmSection.includes("blind/v0.1"), false);
});

// --- ZIP assembly checks.

test("el ZIP contiene solamente el material autorizado de blind/v0.2.1", async (t) => {
  let zipStat;
  try {
    zipStat = await import("node:fs/promises").then((fs) => fs.stat(zipPath));
  } catch {
    t.skip("bitmapverse-blind-v0.2.1.zip not built yet");
    return;
  }
  assert.ok(zipStat.isFile());

  const extractDir = await mkdtemp(join(tmpdir(), "bitmapverse-b1-v021-zipcheck-"));
  try {
    execFileSync("unzip", ["-o", "-q", zipPath.pathname, "-d", extractDir]);
    const manifest = JSON.parse(await readFile(new URL("PACKAGE_MANIFEST.json", packageRoot), "utf8"));
    const expected = [...Object.keys(manifest.files), "PACKAGE_MANIFEST.json"]
      .map((p) => `blind/v0.2.1/${p}`)
      .sort();

    const extracted = await collectFiles(new URL(`file://${extractDir}/`));
    assert.deepEqual(extracted, expected);

    for (const [relative, expectedHash] of Object.entries(manifest.files)) {
      const actual = sha256(await readFile(join(extractDir, "blind", "v0.2.1", relative)));
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
    t.skip("bitmapverse-blind-v0.2.1.zip not built yet");
    return;
  }
  assert.ok(zipStat.isFile());

  const listing = execFileSync("unzip", ["-l", zipPath.pathname], { encoding: "utf8" });
  assert.equal(listing.includes("nonce"), false);
  assert.equal(listing.includes("oracle.json"), false);
  assert.equal(listing.includes("REVEAL_INSTRUCTIONS"), false);
});
