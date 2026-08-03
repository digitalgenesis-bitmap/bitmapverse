import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  evaluateShadowRoleV01,
  runShadowCouncilV01,
  validateSignalCaseV01,
} from "../src/signals/shadow-council-v01.mjs";

const caseUrl = new URL(
  "../shadow/cases/portal-507999-7187-001.json",
  import.meta.url,
);

async function loadCaseAndEvidence() {
  const signalCase = JSON.parse(await readFile(caseUrl, "utf8"));
  const evidenceByPath = {};

  for (const reference of Object.values(signalCase.evidence)) {
    evidenceByPath[reference.fixture] = await readFile(
      new URL(`../${reference.fixture}`, import.meta.url),
      "utf8",
    );
  }

  return { signalCase, evidenceByPath };
}

test("el expediente enlaza exactamente ambos fixtures congelados", async () => {
  const { signalCase, evidenceByPath } = await loadCaseAndEvidence();
  const { origin, destination } = validateSignalCaseV01(
    signalCase,
    evidenceByPath,
  );

  assert.equal(origin.district, 507999);
  assert.equal(destination.district, 7187);
  assert.equal(origin.snapshot_height, signalCase.snapshot.height);
  assert.equal(destination.snapshot_block_hash, signalCase.snapshot.block_hash);
});

test("rechaza un fixture modificado después de formar el expediente", async () => {
  const { signalCase, evidenceByPath } = await loadCaseAndEvidence();
  evidenceByPath[signalCase.evidence.origin.fixture] += " ";

  assert.throws(
    () => validateSignalCaseV01(signalCase, evidenceByPath),
    /hash de .* no coincide/i,
  );
});

test("SCOUT, KEEPER y VOID producen señales independientes y diferenciadas", async () => {
  const { signalCase, evidenceByPath } = await loadCaseAndEvidence();
  const run = runShadowCouncilV01(signalCase, evidenceByPath);

  assert.deepEqual(
    run.signals.map(({ role }) => role),
    ["SCOUT", "KEEPER", "VOID"],
  );
  assert.deepEqual(
    run.signals.map(({ recommendation }) => recommendation),
    ["continue_experiment", "preserve_with_warnings", "do_not_promote"],
  );
  assert.equal(new Set(run.signals.map(({ case_canonical_sha256 }) => case_canonical_sha256)).size, 1);
  assert.equal(
    run.case_canonical_sha256,
    createHash("sha256").update(JSON.stringify(signalCase)).digest("hex"),
  );
});

test("ninguna señal autoriza transiciones ni modifica estado", async () => {
  const { signalCase, evidenceByPath } = await loadCaseAndEvidence();
  const run = runShadowCouncilV01(signalCase, evidenceByPath);

  assert.equal(run.transition.authorized, false);
  assert.equal(run.transition.state_mutated, false);
  for (const signal of run.signals) {
    assert.equal(signal.authority, "none");
    assert.equal(signal.authorizes_transition, false);
    assert.equal(signal.mutates_state, false);
  }
});

test("rechaza cualquier intento de otorgar autoridad al Consejo", async () => {
  const { signalCase, evidenceByPath } = await loadCaseAndEvidence();
  signalCase.limits.may_authorize_transition = true;

  assert.throws(
    () => evaluateShadowRoleV01("SCOUT", signalCase, evidenceByPath),
    /no puede recibir autoridad/i,
  );
});

test("la ejecución histórica guardada se reproduce byte por byte", async () => {
  const { signalCase, evidenceByPath } = await loadCaseAndEvidence();
  const recorded = JSON.parse(
    await readFile(
      new URL(
        "../shadow/runs/portal-507999-7187-001.run.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );

  assert.deepEqual(runShadowCouncilV01(signalCase, evidenceByPath), recorded);
});
