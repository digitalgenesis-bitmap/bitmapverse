import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const [submissionArgument] = process.argv.slice(2);
if (!submissionArgument) {
  throw new Error("Uso: node scripts/verify-blind-submission-v01.mjs <submission-dir>");
}

const project = resolve(import.meta.dirname, "..");
const submission = resolve(submissionArgument);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const load = (path) => readFile(path, "utf8");

const seal = JSON.parse(await load(resolve(submission, "SUBMISSION.json")));
const sealedFiles = {};
for (const [name, expected] of Object.entries(seal.files)) {
  const observed = sha256(await readFile(resolve(submission, name)));
  sealedFiles[name] = { expected, observed, match: expected === observed };
}

const commitmentText = await load(
  resolve(project, "blind/v0.1/ORACLE_COMMITMENT.txt"),
);
const commitment = commitmentText.match(/[0-9a-f]{64}/)?.[0];
const oracleRaw = await load(
  resolve(project, "oracle/reserved/same-sat-latest-v01.oracle.json"),
);
const oracleHash = sha256(oracleRaw);
const oracle = JSON.parse(oracleRaw);
const result = JSON.parse(await load(resolve(submission, "result.json")));

const comparisons = Object.fromEntries(
  Object.entries(oracle.results).map(([fixtureId, expected]) => {
    const observed = result[fixtureId]?.selected_inscription_id;
    return [fixtureId, { expected, observed, match: expected === observed }];
  }),
);

const report = {
  schema: "bitmapverse.blind_comparison.v0.1",
  package_id: seal.package_id,
  submission_closed_at: seal.closed_at,
  sealed_files: sealedFiles,
  all_sealed_files_match: Object.values(sealedFiles).every(({ match }) => match),
  oracle_commitment: commitment,
  oracle_actual_sha256: oracleHash,
  oracle_commitment_matches: commitment === oracleHash,
  comparisons,
  all_results_match: Object.values(comparisons).every(({ match }) => match),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (
  !report.all_sealed_files_match ||
  !report.oracle_commitment_matches ||
  !report.all_results_match
) {
  process.exitCode = 1;
}
