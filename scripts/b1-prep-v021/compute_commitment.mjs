#!/usr/bin/env node
/**
 * Generates a fresh cryptographically secure 32-byte nonce directly into
 * the private folder (idempotent: reuses an existing nonce.hex there
 * rather than silently minting a new one and breaking a previously
 * published commitment), and computes:
 *
 *   commitment = SHA-256(
 *     UTF8("bitmapverse:b1:oracle:v0.2.1")
 *     || 0x00
 *     || nonce_32_bytes
 *     || 0x00
 *     || JCS_v0.2.1(oracle.json)
 *   )
 *
 * This is the same domain-separated, documented construction used for
 * v0.2 (the user's instructions explicitly permit "la construcción
 * delimitada y documentada que defina inequívocamente el contrato" as an
 * alternative to the bare SHA-256(nonce || JCS(resolution_result)) form —
 * reusing the proven v0.2 construction, updated to the v0.2.1 domain tag
 * and covering the full oracle (both resolution_results AND
 * candidate_sets_through_resolution_snapshot for both districts, not just
 * a single resolution_result), is preferred here over inventing a new,
 * less-tested formula).
 *
 * Writes the nonce ONLY to the private folder. Writes the public
 * commitment (hash only — no nonce, no oracle content) to
 * blind/v0.2.1/ORACLE_COMMITMENT.txt.
 */
import { randomBytes, createHash } from "node:crypto";
import { readFile, writeFile, access, chmod } from "node:fs/promises";
import { canonicalizeToBytes } from "./jcs.mjs";

const DOMAIN = "bitmapverse:b1:oracle:v0.2.1";
function privateRoot() {
  const dir = process.env.BITMAPVERSE_PRIVATE_DIR;
  if (!dir) {
    throw new Error("BITMAPVERSE_PRIVATE_DIR environment variable is not set");
  }
  return `${dir}/bitmapverse/oracle/b1-v0.2.1`;
}
const commitmentPath = new URL("../../blind/v0.2.1/ORACLE_COMMITMENT.txt", import.meta.url);

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function getOrCreateNonce(noncePath) {
  if (await fileExists(noncePath)) {
    const hex = (await readFile(noncePath, "utf8")).trim();
    const bytes = Buffer.from(hex, "hex");
    if (bytes.length !== 32) {
      throw new Error(`existing nonce.hex does not decode to exactly 32 bytes (got ${bytes.length})`);
    }
    return { bytes, created: false };
  }
  const bytes = randomBytes(32);
  await writeFile(noncePath, bytes.toString("hex") + "\n", "utf8");
  await chmod(noncePath, 0o600);
  return { bytes, created: true };
}

async function main() {
  const root = privateRoot();
  const noncePath = `${root}/nonce.hex`;
  const oraclePath = `${root}/oracle.json`;
  const oracle = JSON.parse(await readFile(oraclePath, "utf8"));
  const { bytes: nonceBytes, created } = await getOrCreateNonce(noncePath);

  const domainBytes = Buffer.from(DOMAIN, "utf8");
  const zero = Buffer.from([0x00]);
  const oracleCanonicalBytes = canonicalizeToBytes(oracle);

  const commitmentInput = Buffer.concat([domainBytes, zero, nonceBytes, zero, oracleCanonicalBytes]);
  const commitment = createHash("sha256").update(commitmentInput).digest("hex");

  const commitmentText = `Reserved oracle commitment — Prueba B1 (bitmapverse.b1.oracle.v0.2.1)

Sucesor del compromiso v0.2. El compromiso v0.2 anterior no queda
invalidado por este documento (blind/v0.2/ORACLE_COMMITMENT.txt no fue
modificado); este es un compromiso independiente para un nonce, un
oráculo y un contrato distintos (v0.2.1).

commitment (SHA-256): ${commitment}
algorithm: SHA-256
domain: ${DOMAIN}
nonce_length_bytes: 32
canonicalization: "perfil JCS restringido" v0.2.1 (subconjunto documentado
  de RFC 8785; ver blind/v0.2.1/CANONICALIZATION.md para el alcance
  exacto y las diferencias frente a RFC 8785 completo).
commitment formula: SHA-256(UTF8(domain) || 0x00 || nonce_32_bytes || 0x00 || JCS(oracle.json))

Este compromiso fija el oráculo reservado (resolution_result.v0.2.1 y
candidate_set_through_resolution_snapshot.v0.2.1 para ambos Districts bajo
prueba) antes de recibir cualquier entrega independiente de Prueba B1. Ni
el contenido del oráculo, ni los datos de resolución/candidatos que
contiene, ni el nonce están incluidos en este paquete ni en el
repositorio. Viven exclusivamente en una carpeta privada fuera del
repositorio, con permisos restringidos (700 en directorios, 600 en
archivos), y deben permanecer no divulgados hasta que una entrega
independiente esté sellada.

Instrucciones de verificación (a seguir solamente después de sellar una
entrega B1): recomputar la fórmula de compromiso anterior usando el
oráculo y el nonce revelados, y confirmar que es igual al compromiso aquí
publicado. El procedimiento completo de revelación se conserva junto al
oráculo reservado, no en este paquete.
`;

  await writeFile(commitmentPath, commitmentText, "utf8");

  console.log(`nonce ${created ? "generated" : "reused existing"} (private, mode 600)`);
  console.log(`commitment: ${commitment}`);
  console.log(`written: ${commitmentPath.pathname}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
