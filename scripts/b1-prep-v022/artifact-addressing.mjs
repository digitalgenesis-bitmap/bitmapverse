/**
 * Content-addressed artifact identity and on-disk verification for
 * evidence_manifest.v0.2.2's captured_artifacts[].
 *
 * artifact_id = "sha256:<64-hex-lowercase>" — the hash IS the identity.
 * There is no separate path field to declare or to diverge from it: the
 * derived location is always artifacts/sha256/<hex> (without the
 * "sha256:" prefix), relative to wherever an implementer's submission
 * root is.
 */
import { lstat, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export class ArtifactAddressingError extends Error {}

const ARTIFACT_ID_PATTERN = /^sha256:[0-9a-f]{64}$/;

/**
 * Strict format check. Rejects uppercase, wrong length, wrong prefix,
 * '/', '\\', '..', and any character outside [0-9a-f] in the hash part —
 * all by construction of the single anchored regex, not by a list of ad
 * hoc checks that could individually be forgotten.
 */
export function isValidArtifactId(artifactId) {
  return typeof artifactId === "string" && ARTIFACT_ID_PATTERN.test(artifactId);
}

/**
 * Extracts the bare 64-hex-char hash from a valid artifact_id. Throws on
 * an invalid artifact_id rather than silently returning something
 * unusable.
 */
export function hashOfArtifactId(artifactId) {
  if (!isValidArtifactId(artifactId)) {
    throw new ArtifactAddressingError(`invalid artifact_id: ${JSON.stringify(artifactId)}`);
  }
  return artifactId.slice("sha256:".length);
}

/**
 * Derives the expected on-disk relative path for an artifact_id:
 * artifacts/sha256/<hex>. Never accepts or returns any other path form —
 * there is no "declared path" input to this function on purpose.
 */
export function artifactPathFor(artifactId) {
  return path.posix.join("artifacts", "sha256", hashOfArtifactId(artifactId));
}

/**
 * Verifies a real file on disk against its artifact_id and declared
 * size_bytes:
 *   - artifact_id has the exact required format;
 *   - the resolved path stays inside artifactsRoot/sha256/ (no escape);
 *   - the path is a regular file, never a symlink;
 *   - the file's real SHA-256 matches the hash encoded in artifact_id;
 *   - the file's real size matches size_bytes from the manifest.
 *
 * `artifactsRoot` is the directory that itself contains `sha256/` (i.e.
 * the parent of `artifacts/sha256/<hex>`, typically an implementer's
 * submission root). Returns {valid, errors}.
 */
export async function verifyArtifactOnDisk(artifactId, sizeBytes, artifactsRoot) {
  const errors = [];

  if (!isValidArtifactId(artifactId)) {
    return { valid: false, errors: [`invalid artifact_id format: ${JSON.stringify(artifactId)}`] };
  }

  const hex = hashOfArtifactId(artifactId);
  const expectedRelative = artifactPathFor(artifactId);
  const resolvedRoot = path.resolve(artifactsRoot);
  const resolvedPath = path.resolve(resolvedRoot, expectedRelative);

  // Containment check: the resolved path must stay inside
  // <root>/artifacts/sha256/ — catches any theoretical path escape even
  // though artifactPathFor() itself cannot produce one from a valid
  // artifact_id (defense in depth, not reliance on the regex alone).
  const expectedDir = path.resolve(resolvedRoot, "artifacts", "sha256");
  if (!resolvedPath.startsWith(expectedDir + path.sep) && resolvedPath !== path.join(expectedDir, hex)) {
    errors.push(`resolved path escapes artifacts/sha256/: ${resolvedPath}`);
    return { valid: false, errors };
  }

  let stats;
  try {
    stats = await lstat(resolvedPath);
  } catch {
    errors.push(`no file at expected path: ${expectedRelative}`);
    return { valid: false, errors };
  }

  if (stats.isSymbolicLink()) {
    errors.push(`artifact path is a symbolic link, not a regular file: ${expectedRelative}`);
    return { valid: false, errors };
  }
  if (!stats.isFile()) {
    errors.push(`artifact path is not a regular file: ${expectedRelative}`);
    return { valid: false, errors };
  }

  const buffer = await readFile(resolvedPath);
  const actualHash = createHash("sha256").update(buffer).digest("hex");
  if (actualHash !== hex) {
    errors.push(`content SHA-256 (${actualHash}) does not match artifact_id hash (${hex})`);
  }
  if (buffer.length !== sizeBytes) {
    errors.push(`actual file size (${buffer.length}) does not match declared size_bytes (${sizeBytes})`);
  }

  return { valid: errors.length === 0, errors };
}
