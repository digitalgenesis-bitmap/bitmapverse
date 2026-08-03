/**
 * Referential-integrity validator for evidence_manifest.v0.2.2 — the
 * rules declared in EVIDENCE_MANIFEST_SCHEMA.json's
 * x_referential_integrity_rules, which JSON Schema (2020-12) cannot
 * express without non-standard extensions ($data, if/then on a sibling
 * field). Covers: source_id/artifact_id uniqueness and bidirectional
 * ownership, non-captured-source invariants (including the required
 * `limitations`), chain_ancestry_proof's reference into sources[] +
 * captured_artifacts[] (no parallel provenance system), and
 * implementation_identity per role.
 */
import { isValidArtifactId } from "./artifact-addressing.mjs";
import { validateImplementationIdentity } from "./implementation-identity.mjs";

export function validateReferentialIntegrity(evidenceManifest) {
  const errors = [];
  const sources = evidenceManifest.sources ?? [];
  const artifacts = evidenceManifest.captured_artifacts ?? [];

  const sourceIds = new Set();
  const sourceById = new Map();
  for (const source of sources) {
    if (sourceIds.has(source.source_id)) {
      errors.push(`duplicate source_id: ${source.source_id}`);
    }
    sourceIds.add(source.source_id);
    sourceById.set(source.source_id, source);
  }

  const artifactIds = new Set();
  const artifactOwner = new Map(); // artifact_id -> source_id it claims
  for (const artifact of artifacts) {
    if (!isValidArtifactId(artifact.artifact_id)) {
      errors.push(`malformed artifact_id: ${JSON.stringify(artifact.artifact_id)}`);
    }
    if (artifactIds.has(artifact.artifact_id)) {
      errors.push(`duplicate artifact_id: ${artifact.artifact_id}`);
    }
    artifactIds.add(artifact.artifact_id);
    artifactOwner.set(artifact.artifact_id, artifact.source_id);

    if (!sourceIds.has(artifact.source_id)) {
      errors.push(
        `captured_artifacts[${artifact.artifact_id}].source_id references nonexistent source: ${artifact.source_id}`,
      );
    }
  }

  const claimedBy = new Map(); // artifact_id -> [source_ids that list it]
  for (const source of sources) {
    const identityCheck = validateImplementationIdentity(source.role, source.implementation_identity ?? {});
    for (const e of identityCheck.errors) {
      errors.push(`source ${source.source_id}: ${e}`);
    }

    if (source.capture_status !== "captured") {
      if ((source.artifact_ids ?? []).length > 0) {
        errors.push(`source ${source.source_id}: artifact_ids must be empty when capture_status is not "captured"`);
      }
      if (source.pagination?.complete !== false) {
        errors.push(`source ${source.source_id}: pagination.complete must be false when capture_status is not "captured"`);
      }
      if ((source.pagination?.pages ?? []).length > 0) {
        errors.push(`source ${source.source_id}: pagination.pages must be empty when capture_status is not "captured"`);
      }
      if ((source.limitations ?? []).length === 0) {
        errors.push(`source ${source.source_id}: limitations must be non-empty when capture_status is not "captured"`);
      }
      continue;
    }

    for (const artifactId of source.artifact_ids ?? []) {
      if (!artifactIds.has(artifactId)) {
        errors.push(`source ${source.source_id} references nonexistent artifact_id: ${artifactId}`);
        continue;
      }
      if (artifactOwner.get(artifactId) !== source.source_id) {
        errors.push(
          `source ${source.source_id} lists artifact ${artifactId}, but that artifact declares source_id ${artifactOwner.get(artifactId)} (bidirectional mismatch)`,
        );
      }
      if (!claimedBy.has(artifactId)) claimedBy.set(artifactId, []);
      claimedBy.get(artifactId).push(source.source_id);
    }

    const pagination = source.pagination ?? { complete: false, page_count: 0, pages: [] };
    if (pagination.complete !== true) {
      errors.push(`source ${source.source_id}: capture_status is "captured" but pagination.complete is not true`);
    }
    if (pagination.page_count !== (pagination.pages ?? []).length) {
      errors.push(`source ${source.source_id}: pagination.page_count does not match pagination.pages length`);
    }
    for (const page of pagination.pages ?? []) {
      if (!artifactIds.has(page.artifact_id)) {
        errors.push(`source ${source.source_id}, page ${page.page_index}: references nonexistent artifact_id ${page.artifact_id}`);
        continue;
      }
      if (!(source.artifact_ids ?? []).includes(page.artifact_id)) {
        errors.push(
          `source ${source.source_id}, page ${page.page_index}: artifact_id ${page.artifact_id} not listed in this source's artifact_ids`,
        );
      }
    }
  }

  for (const [artifactId, owningSourceIds] of claimedBy) {
    if (owningSourceIds.length > 1) {
      errors.push(`artifact ${artifactId} is claimed by more than one source: ${owningSourceIds.join(", ")}`);
    }
  }

  // chain_ancestry_proof: must reference an existing source with
  // role === "chain_ancestry", and every artifact_id it cites must exist
  // and belong to that exact source — no separate evidence fields, no
  // second provenance system running in parallel to sources[]/
  // captured_artifacts[].
  const proof = evidenceManifest.chain_ancestry_proof;
  if (proof) {
    const referencedSource = sourceById.get(proof.source_id);
    if (!referencedSource) {
      errors.push(`chain_ancestry_proof.source_id references nonexistent source: ${proof.source_id}`);
    } else if (referencedSource.role !== "chain_ancestry") {
      errors.push(
        `chain_ancestry_proof.source_id ${proof.source_id} refers to a source with role ${JSON.stringify(referencedSource.role)}, expected "chain_ancestry"`,
      );
    }
    for (const artifactId of proof.artifact_ids ?? []) {
      if (!artifactIds.has(artifactId)) {
        errors.push(`chain_ancestry_proof references nonexistent artifact_id: ${artifactId}`);
        continue;
      }
      if (artifactOwner.get(artifactId) !== proof.source_id) {
        errors.push(
          `chain_ancestry_proof artifact ${artifactId} belongs to source ${artifactOwner.get(artifactId)}, not ${proof.source_id}`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
