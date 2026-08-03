#!/usr/bin/env node
/**
 * Generates a cryptographically secure 32-byte nonce (if one doesn't
 * already exist — this script is idempotent so re-running it after the
 * oracle changes doesn't silently mint a new nonce and break a
 * previously-published commitment) and computes:
 *
 *   commitment = SHA-256(
 *     UTF8("bitmapverse:b1:oracle:v0.2")
 *     || 0x00
 *     || nonce_32_bytes
 *     || 0x00
 *     || JCS(oracle.json)
 *   )
 *
 * Writes the nonce ONLY to oracle/reserved/b1-v0.2/nonce.hex. Writes the
 * public commitment (hash only — no nonce, no oracle content) to
 * blind/v0.2/ORACLE_COMMITMENT.txt.
 */
import { randomBytes, createHash } from "node:crypto";
import { readFile, writeFile, access } from "node:fs/promises";
import { canonicalizeToBytes } from "./jcs.mjs";

const DOMAIN = "bitmapverse:b1:oracle:v0.2";
const oracleDir = new URL("../../oracle/reserved/b1-v0.2/", import.meta.url);
const noncePath = new URL("nonce.hex", oracleDir);
const oraclePath = new URL("oracle.json", oracleDir);
const commitmentPath = new URL("../../blind/v0.2/ORACLE_COMMITMENT.txt", import.meta.url);

async function fileExists(url) {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

async function getOrCreateNonce() {
  if (await fileExists(noncePath)) {
    const hex = (await readFile(noncePath, "utf8")).trim();
    const bytes = Buffer.from(hex, "hex");
    if (bytes.length !== 32) {
      throw new Error(`existing nonce.hex does not decode to exactly 32 bytes (got ${bytes.length})`);
    }
    return { bytes, hex, created: false };
  }
  const bytes = randomBytes(32);
  const hex = bytes.toString("hex");
  await writeFile(noncePath, hex + "\n", "utf8");
  return { bytes, hex, created: true };
}

async function main() {
  const oracle = JSON.parse(await readFile(oraclePath, "utf8"));
  const { bytes: nonceBytes, created } = await getOrCreateNonce();

  const domainBytes = Buffer.from(DOMAIN, "utf8");
  const zero = Buffer.from([0x00]);
  const oracleCanonicalBytes = canonicalizeToBytes(oracle);

  const commitmentInput = Buffer.concat([domainBytes, zero, nonceBytes, zero, oracleCanonicalBytes]);
  const commitment = createHash("sha256").update(commitmentInput).digest("hex");

  const commitmentText = `Reserved oracle commitment — Prueba B1 (bitmapverse.b1.oracle.v0.2)

commitment (SHA-256): ${commitment}
algorithm: SHA-256
domain: ${DOMAIN}
nonce_length_bytes: 32
canonicalization: RFC 8785 (JCS) — see blind/v0.2/CANONICALIZATION.md for
  scope and the honesty note about offline verification.
commitment formula: SHA-256(UTF8(domain) || 0x00 || nonce_32_bytes || 0x00 || JCS(oracle.json))

This commitment fixes the reserved oracle (resolution_result.v0.2 and
candidate_set_through_resolution_snapshot.v0.2 for both Districts under
test) before any independent Prueba B1 submission is received. Neither
the oracle contents, the resolution/candidate data they contain, nor the
nonce are included in this package. They must remain undisclosed until an
independent submission is sealed.

Verification instructions (to be followed only after a B1 submission is
sealed): recompute the commitment formula above using the revealed
oracle contents and nonce, and confirm it equals the commitment published
here. Full reveal procedure is kept alongside the reserved oracle itself,
not in this package.
`;

  await writeFile(commitmentPath, commitmentText, "utf8");

  console.log(`nonce ${created ? "generated" : "reused existing"}: oracle/reserved/b1-v0.2/nonce.hex`);
  console.log(`commitment: ${commitment}`);
  console.log(`written: ${commitmentPath.pathname}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
