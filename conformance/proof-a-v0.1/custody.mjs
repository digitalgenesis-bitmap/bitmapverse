/**
 * Honest custody-chain verification for every historical artifact this
 * package must not modify.
 *
 * The previous version of this check only asserted that a computed hash
 * was a 64-character string — true of literally any SHA-256 digest,
 * including one belonging to a file that had been silently altered. That
 * is not integrity verification; it is a no-op dressed up as one. This
 * module fixes that by comparing against a real, cited prior commitment
 * wherever one genuinely exists, and by saying so explicitly wherever one
 * doesn't — never inventing a comparison value to make a check "pass".
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const projectRoot = new URL("../../", import.meta.url);

async function sha256OfFile(url) {
  return createHash("sha256").update(await readFile(url)).digest("hex");
}

/**
 * Every entry with `expectedSha256` set carries a real prior commitment,
 * cited in `commitmentSource`. `blind/audits/proof-a-001.md` has none
 * anywhere in this repository — no manifest, no companion file, no prior
 * message records its hash — so it is listed with `expectedSha256: null`
 * and handled as a new baseline, per this correction's explicit
 * instruction not to invent history.
 */
async function buildArtifactTable() {
  const manifest = JSON.parse(
    await readFile(new URL("blind/v0.1/PACKAGE_MANIFEST.json", projectRoot), "utf8"),
  );

  const blindPackageEntries = Object.entries(manifest.files).map(([relativePath, expectedSha256]) => ({
    path: `blind/v0.1/${relativePath}`,
    expectedSha256,
    commitmentSource: "blind/v0.1/PACKAGE_MANIFEST.json (sealed inside the blind package itself)",
  }));

  return [
    {
      path: "bitmapverse-blind-submission-a-001.zip",
      expectedSha256: "e882577e231043a0556d22a8348e4d90f607ccee188250341c1415df64ed1de3",
      commitmentSource:
        'blind/audits/proof-a-001.md, "SHA-256 de la entrega preservada" (recorded at Prueba A close, 2026-07-31T15:44:40Z)',
    },
    {
      path: "bitmapverse-blind-v0.1.zip",
      expectedSha256: "20e2e66890a469e853487acb124e2e938c3a3bb303bd6d9439fa538af25ae0d4",
      commitmentSource: 'blind/audits/proof-a-001.md, "SHA-256 del paquete"',
    },
    ...blindPackageEntries,
    {
      path: "oracle/reserved/same-sat-latest-v01.oracle.json",
      expectedSha256: "2db6191f46954904e51e29daac4900d475cb5fac1d2159ec5b7bda8dd9879783",
      commitmentSource:
        "blind/v0.1/ORACLE_COMMITMENT.txt (published before the oracle was revealed), corroborated by blind/audits/proof-a-001.md",
    },
    {
      path: "blind/audits/proof-a-001.md",
      expectedSha256: null,
      commitmentSource: null,
      note:
        "Su integridad retrospectiva no puede demostrarse criptográficamente; se establece una línea base desde esta revisión.",
    },
  ];
}

export async function verifyCustodyChain() {
  const artifacts = await buildArtifactTable();
  const results = [];
  let allVerifiedMatch = true;

  for (const artifact of artifacts) {
    const actualSha256 = await sha256OfFile(new URL(artifact.path, projectRoot));
    if (artifact.expectedSha256 === null) {
      results.push({
        path: artifact.path,
        kind: "new_baseline",
        actual_sha256: actualSha256,
        commitment_source: null,
        note: artifact.note,
      });
      continue;
    }
    const matches = actualSha256 === artifact.expectedSha256;
    if (!matches) allVerifiedMatch = false;
    results.push({
      path: artifact.path,
      kind: "verified_against_prior_commitment",
      expected_sha256: artifact.expectedSha256,
      actual_sha256: actualSha256,
      matches,
      commitment_source: artifact.commitmentSource,
    });
  }

  return { allVerifiedMatch, results };
}
