#!/usr/bin/env node
/**
 * Builds the RESERVED oracle for Prueba B1 under the v0.2.1 contract —
 * writes DIRECTLY into the authorized private folder
 * (${BITMAPVERSE_PRIVATE_DIR}/bitmapverse/oracle/b1-v0.2.1/),
 * never staging secret content inside the repository at any point.
 *
 * Computed from the existing frozen fixtures (fixtures/507999.snapshot.json,
 * fixtures/7187.snapshot.json) via the UNMODIFIED JavaScript resolver
 * (src/resolvers/same-sat-latest-v01.mjs — imported, never edited). Same
 * real evidence as v0.2's oracle; only the output schema version changes.
 */
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { resolveSameSatLatestV01 } from "../../src/resolvers/same-sat-latest-v01.mjs";

const projectRoot = new URL("../../", import.meta.url);
function privateRoot() {
  const dir = process.env.BITMAPVERSE_PRIVATE_DIR;
  if (!dir) {
    throw new Error("BITMAPVERSE_PRIVATE_DIR environment variable is not set");
  }
  return `${dir}/bitmapverse/oracle/b1-v0.2.1`;
}

const CASES = [
  { fixturePath: "fixtures/507999.snapshot.json" },
  { fixturePath: "fixtures/7187.snapshot.json" },
];

function buildResolutionResultV021(nativeResult) {
  return {
    schema: "bitmapverse.resolution_result.v0.2.1",
    contract_version: "0.2.1",
    resolver: "same_sat_latest_v0.1",
    bitmap_discovery_profile: "bitmapverse.bitmap_discovery.v0.2.1",
    district: nativeResult.district,
    district_name: nativeResult.district_name,
    original_inscription_id: nativeResult.original_inscription_id,
    sat: nativeResult.sat,
    selected_inscription_id: nativeResult.selected_inscription_id,
    selected_content_sha256: nativeResult.selected_content_sha256,
    selected_position: { ...nativeResult.selected_position },
    resolution_snapshot: {
      height: nativeResult.snapshot_height,
      block_hash: nativeResult.snapshot_block_hash,
    },
    eligible_through_resolution_snapshot_count: nativeResult.candidate_count,
    status: "experimental",
  };
}

function buildCandidateSetV021(fixture, nativeResult) {
  const eligible = fixture.candidates
    .filter((c) => c.canonical_position.block_height <= fixture.snapshot_height)
    .toSorted(
      (a, b) =>
        a.canonical_position.block_height - b.canonical_position.block_height ||
        a.canonical_position.transaction_index - b.canonical_position.transaction_index ||
        a.canonical_position.inscription_index - b.canonical_position.inscription_index,
    );

  return {
    schema: "bitmapverse.candidate_set.v0.2.1",
    contract_version: "0.2.1",
    district: fixture.district,
    district_name: fixture.district_name,
    sat: fixture.sat,
    resolution_snapshot: {
      height: nativeResult.snapshot_height,
      block_hash: nativeResult.snapshot_block_hash,
    },
    candidates: eligible.map((c) => ({
      inscription_id: c.inscription_id,
      sat: c.sat,
      content_sha256: c.content_sha256,
      canonical_position: { ...c.canonical_position },
    })),
    candidate_count: eligible.length,
    status: "experimental",
  };
}

async function main() {
  await mkdir(privateRoot(), { recursive: true, mode: 0o700 });
  await chmod(privateRoot(), 0o700);

  const resolutionResults = {};
  const candidateSets = {};

  for (const { fixturePath } of CASES) {
    const fixture = JSON.parse(await readFile(new URL(fixturePath, projectRoot), "utf8"));
    const nativeResult = resolveSameSatLatestV01(fixture);

    const resolutionResultV021 = buildResolutionResultV021(nativeResult);
    const candidateSetV021 = buildCandidateSetV021(fixture, nativeResult);

    if (resolutionResultV021.eligible_through_resolution_snapshot_count !== candidateSetV021.candidate_count) {
      throw new Error(
        `oracle build: eligible count mismatch for ${fixture.district_name}: ` +
          `resolution_result says ${resolutionResultV021.eligible_through_resolution_snapshot_count}, ` +
          `candidate_set says ${candidateSetV021.candidate_count}`,
      );
    }

    resolutionResults[fixture.district_name] = resolutionResultV021;
    candidateSets[fixture.district_name] = candidateSetV021;
  }

  const oracle = {
    schema: "bitmapverse.b1.oracle.v0.2.1",
    resolution_results: resolutionResults,
    candidate_sets_through_resolution_snapshot: candidateSets,
  };

  const oraclePath = `${privateRoot()}/oracle.json`;
  await writeFile(oraclePath, JSON.stringify(oracle, null, 2) + "\n", "utf8");
  await chmod(oraclePath, 0o600);

  console.log(`wrote ${oraclePath} (mode 600)`);
  console.log(`districts: ${Object.keys(resolutionResults).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
