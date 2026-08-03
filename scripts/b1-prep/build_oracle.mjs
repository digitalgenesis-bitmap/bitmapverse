#!/usr/bin/env node
/**
 * Builds the RESERVED oracle for Prueba B1 — real resolution_result.v0.2
 * and candidate_set_through_resolution_snapshot.v0.2 for the two Districts
 * under test, computed from the existing frozen fixtures
 * (fixtures/507999.snapshot.json, fixtures/7187.snapshot.json) via the
 * UNMODIFIED JavaScript resolver (src/resolvers/same-sat-latest-v01.mjs —
 * imported, never edited).
 *
 * Output goes ONLY to oracle/reserved/b1-v0.2/oracle.json — never into
 * blind/v0.2/ (the package directory), never into a ZIP. This script is
 * tooling, not a deliverable; it does not ship inside the blind package.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolveSameSatLatestV01 } from "../../src/resolvers/same-sat-latest-v01.mjs";
import { canonicalizeToBytes } from "./jcs.mjs";

const projectRoot = new URL("../../", import.meta.url);
const oracleDir = new URL("../../oracle/reserved/b1-v0.2/", import.meta.url);

const CASES = [
  { fixturePath: "fixtures/507999.snapshot.json" },
  { fixturePath: "fixtures/7187.snapshot.json" },
];

function buildResolutionResultV02(nativeResult) {
  return {
    schema: "bitmapverse.resolution_result.v0.2",
    contract_version: "0.2.0",
    resolver: "same_sat_latest_v0.1",
    bitmap_discovery_profile: "bitmapverse.bitmap_discovery.v0.2",
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

function buildCandidateSetV02(fixture, nativeResult) {
  const eligible = fixture.candidates
    .filter((c) => c.canonical_position.block_height <= fixture.snapshot_height)
    .toSorted(
      (a, b) =>
        a.canonical_position.block_height - b.canonical_position.block_height ||
        a.canonical_position.transaction_index - b.canonical_position.transaction_index ||
        a.canonical_position.inscription_index - b.canonical_position.inscription_index,
    );

  return {
    schema: "bitmapverse.candidate_set.v0.2",
    contract_version: "0.2.0",
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
  await mkdir(oracleDir, { recursive: true });

  const resolutionResults = {};
  const candidateSets = {};

  for (const { fixturePath } of CASES) {
    const fixture = JSON.parse(await readFile(new URL(fixturePath, projectRoot), "utf8"));
    const nativeResult = resolveSameSatLatestV01(fixture);

    const resolutionResultV02 = buildResolutionResultV02(nativeResult);
    const candidateSetV02 = buildCandidateSetV02(fixture, nativeResult);

    // Sanity: the two objects must agree on the eligible count.
    if (resolutionResultV02.eligible_through_resolution_snapshot_count !== candidateSetV02.candidate_count) {
      throw new Error(
        `oracle build: eligible count mismatch for ${fixture.district_name}: ` +
          `resolution_result says ${resolutionResultV02.eligible_through_resolution_snapshot_count}, ` +
          `candidate_set says ${candidateSetV02.candidate_count}`,
      );
    }

    resolutionResults[fixture.district_name] = resolutionResultV02;
    candidateSets[fixture.district_name] = candidateSetV02;
  }

  const oracle = {
    schema: "bitmapverse.b1.oracle.v0.2",
    resolution_results: resolutionResults,
    candidate_sets_through_resolution_snapshot: candidateSets,
  };

  const oraclePath = new URL("oracle.json", oracleDir);
  await writeFile(oraclePath, JSON.stringify(oracle, null, 2) + "\n", "utf8");

  // Report canonical hashes to stdout only (for commitment computation by
  // a separate script) — never written into any file that could end up in
  // the blind package.
  const hashes = {};
  for (const districtName of Object.keys(resolutionResults)) {
    hashes[districtName] = {
      resolution_result_canonical_sha256: createHash("sha256")
        .update(canonicalizeToBytes(resolutionResults[districtName]))
        .digest("hex"),
      candidate_set_canonical_sha256: createHash("sha256")
        .update(canonicalizeToBytes(candidateSets[districtName]))
        .digest("hex"),
    };
  }

  console.log(`wrote ${oraclePath.pathname}`);
  console.log(JSON.stringify(hashes, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
