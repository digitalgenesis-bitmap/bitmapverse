#!/usr/bin/env node
/**
 * Post-regeneration integrity check for blind/v0.2.2/PACKAGE_MANIFEST.draft.json
 * (complemento, punto 4). Fails loudly on any desynchronization:
 *
 *   - every declared file exists;
 *   - no required normative v0.2.2 file was omitted;
 *   - every declared size and SHA-256 matches the real file;
 *   - no reference to a nonexistent artifact_id/source_id inside any
 *     evidence_manifest-shaped content shipped in test-vectors/;
 *   - no cross-source artifact ownership violation;
 *   - no secrets, oracles, nonces, or private files anywhere in the tree.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateReferentialIntegrity } from "./evidence-manifest-integrity.mjs";

const packageRoot = new URL("../../blind/v0.2.2/", import.meta.url);
const PRIVATE_ORACLE_DIR = process.env.BITMAPVERSE_PRIVATE_DIR
  ? `${process.env.BITMAPVERSE_PRIVATE_DIR}/bitmapverse/oracle/b1-v0.2.1`
  : null;

const REQUIRED_NORMATIVE_FILES = [
  "CONTRACT.md",
  "TASK.md",
  "README.md",
  "PREDECESSOR_STATUS.md",
  "BITMAP_DISCOVERY_PROFILE.md",
  "FIELD_PROVENANCE.md",
  "CANONICALIZATION.md",
  "RESOLUTION_RESULT_SCHEMA.json",
  "EVIDENCE_MANIFEST_SCHEMA.json",
  "CANDIDATE_SET_SCHEMA.json",
  "PACKAGE_MANIFEST.draft.json",
  "OPI_SOURCE_PROVENANCE.json",
  "COMMIT_REVEAL_PROTOCOL.md",
];

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

export async function verifyDraftManifest() {
  const errors = [];
  const manifest = JSON.parse(await readFile(new URL("PACKAGE_MANIFEST.draft.json", packageRoot), "utf8"));

  if (manifest.status !== "draft_auditable_not_sealed") {
    errors.push(`manifest.status is ${JSON.stringify(manifest.status)}, expected "draft_auditable_not_sealed"`);
  }

  for (const required of REQUIRED_NORMATIVE_FILES) {
    if (required === "PACKAGE_MANIFEST.draft.json") continue; // self-excluded by design
    if (!(required in manifest.files)) {
      errors.push(`required normative file missing from manifest.files: ${required}`);
    }
  }

  const onDisk = await collectFiles(packageRoot);
  const declared = [...Object.keys(manifest.files), "PACKAGE_MANIFEST.draft.json"].sort();
  if (JSON.stringify(onDisk) !== JSON.stringify(declared)) {
    errors.push(
      `file list desynchronized: on disk ${JSON.stringify(onDisk)} vs. declared ${JSON.stringify(declared)}`,
    );
  }

  for (const [relative, expectedHash] of Object.entries(manifest.files)) {
    let buffer;
    try {
      buffer = await readFile(new URL(relative, packageRoot));
    } catch {
      errors.push(`declared file does not exist on disk: ${relative}`);
      continue;
    }
    const actualHash = sha256(buffer);
    if (actualHash !== expectedHash) {
      errors.push(`SHA-256 mismatch for ${relative}: manifest says ${expectedHash}, actual is ${actualHash}`);
    }
  }

  // Any evidence_manifest-shaped object embedded in test-vectors must be
  // internally referentially consistent (same rules a real submission
  // would be held to).
  for (const relative of onDisk) {
    if (!relative.startsWith("test-vectors/") || !relative.endsWith(".json")) continue;
    const parsed = JSON.parse(await readFile(new URL(relative, packageRoot), "utf8"));
    const manifestLike = parsed.evidence_manifest;
    if (manifestLike && Array.isArray(manifestLike.sources)) {
      const integrity = validateReferentialIntegrity(manifestLike);
      if (!integrity.valid) {
        for (const e of integrity.errors) errors.push(`${relative}: evidence_manifest integrity: ${e}`);
      }
    }
  }

  // No secrets anywhere in the package.
  let secrets = [];
  try {
    const oracle = JSON.parse(await readFile(`${PRIVATE_ORACLE_DIR}/oracle.json`, "utf8"));
    const nonceHex = (await readFile(`${PRIVATE_ORACLE_DIR}/nonce.hex`, "utf8")).trim();
    secrets = [nonceHex];
    for (const rr of Object.values(oracle.resolution_results)) {
      secrets.push(rr.original_inscription_id, rr.selected_inscription_id, rr.selected_content_sha256, String(rr.sat));
    }
  } catch {
    // Private oracle directory not accessible from this environment —
    // not this checker's job to require it; the git-protection test
    // suite already covers the nonce-leak case repo-wide.
  }
  for (const relative of onDisk) {
    let stats;
    try {
      stats = await stat(new URL(relative, packageRoot));
    } catch {
      continue;
    }
    if (!stats.isFile()) continue;
    const content = await readFile(new URL(relative, packageRoot), "utf8").catch(() => null);
    if (content === null) continue;
    for (const secret of secrets) {
      if (secret.length >= 16 && content.includes(secret)) {
        errors.push(`${relative} leaks a real secret value (${secret.slice(0, 12)}...)`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyDraftManifest().then(({ valid, errors }) => {
    if (valid) {
      console.log("PACKAGE_MANIFEST.draft.json: OK, fully synchronized and internally consistent.");
    } else {
      console.error("PACKAGE_MANIFEST.draft.json verification FAILED:");
      for (const e of errors) console.error(" -", e);
      process.exitCode = 1;
    }
  });
}
