import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  EXPERIMENT_25_NAMES,
  EXPERIMENT_25_PROFILE,
  PREPARED_BINDINGS,
} from "./profile.mjs";
import {
  verifyExperiment25,
  verifyPreparedAuthorization,
} from "./verifier.mjs";

const publicArtifactDefinitions = [
  {
    key: "bitmapworld",
    file: "../experiment-26/bitmapworld.public-authorization-artifact.v0.1.json",
    file_sha256: "fed112fe3a02cfde8294be2463b91ab111b9957471a9c1b77cf8ade314e2e642",
  },
  {
    key: "bitmapmetaverse",
    file: "../experiment-26/bitmapmetaverse.public-authorization-artifact.v0.1.json",
    file_sha256: "5bcb7dd8a4ddac29096cf76412efe5c507ba860cdb600c47008c0aa9d0e7fe51",
  },
];
const publicArtifacts = Object.fromEntries(await Promise.all(publicArtifactDefinitions.map(async (definition) => {
  const text = await readFile(new URL(definition.file, import.meta.url), "utf8");
  return [definition.key, {
    ...definition,
    actual_file_sha256: createHash("sha256").update(text, "utf8").digest("hex"),
    artifact: JSON.parse(text),
  }];
})));
const signatures = Object.fromEntries(Object.entries(publicArtifacts).map(([key, { artifact }]) => [
  key,
  {
    name: artifact.signatures.name.signature,
    district: artifact.signatures.district.signature,
  },
]));
const events = Object.fromEntries(PREPARED_BINDINGS.map((prepared) => [
  prepared.name,
  JSON.parse(prepared.message.slice(prepared.message.indexOf("\n") + 1)),
]));

function ownership() {
  const inscriptions = {};
  for (const { name, inscription_id } of EXPERIMENT_25_NAMES) {
    const event = events[name];
    inscriptions[inscription_id] = {
      inscription_id,
      output: `${(name === "bitmapworld.bitmap" ? "1" : "2").repeat(64)}:1`,
      address: event.name_controller.address,
      script_pubkey: event.name_controller.script_pubkey,
      confirmed: true,
      confirmation_height: EXPERIMENT_25_PROFILE.authority_snapshot.height,
      spent: false,
    };
  }
  inscriptions[EXPERIMENT_25_PROFILE.district_inscription_id] = {
    inscription_id: EXPERIMENT_25_PROFILE.district_inscription_id,
    output: `${"3".repeat(64)}:15`,
    address: EXPERIMENT_25_PROFILE.district_controller.address,
    script_pubkey: EXPERIMENT_25_PROFILE.district_controller.script_pubkey,
    confirmed: true,
    confirmation_height: 942807,
    spent: false,
  };
  return {
    tip: { height: EXPERIMENT_25_PROFILE.authority_snapshot.height, block_hash: "4".repeat(64) },
    inscriptions,
  };
}

const nameResolver = async (name) => ({
  parent_inscription_id: events[name].name_inscription_id,
  resolved_target: "937336.bitmap",
});

test("both real bilateral signatures independently ACCEPT", async () => {
  for (const prepared of PREPARED_BINDINGS) {
    const key = prepared.name === "bitmapworld.bitmap" ? "bitmapworld" : "bitmapmetaverse";
    const record = publicArtifacts[key];
    assert.equal(record.actual_file_sha256, record.file_sha256);
    assert.deepEqual(Object.keys(record.artifact), ["schema", "binding", "message", "signatures"]);
    assert.equal(record.artifact.schema, "bitmapverse.public-authorization-artifact.v0.1");
    assert.deepEqual(record.artifact.binding, {
      scheme: EXPERIMENT_25_PROFILE.binding_id_scheme,
      id: prepared.binding_id,
      name_inscription_id: events[prepared.name].name_inscription_id,
      district_inscription_id: EXPERIMENT_25_PROFILE.district_inscription_id,
    });
    assert.deepEqual(record.artifact.message, {
      encoding: "utf-8",
      line_endings: "LF",
      terminal_newline: false,
      bytes: prepared.message_bytes,
      sha256: prepared.message_sha256,
      text: prepared.message,
    });
    assert.equal(record.artifact.signatures.name.format, "bip322-simple");
    assert.equal(record.artifact.signatures.district.format, "bip322-simple");
  }
  const result = await verifyExperiment25({
    signatures,
    ownershipResolver: async () => ownership(),
    nameResolver,
  });
  assert.equal(result.status, "ACCEPT");
  assert.equal(result.binding_count, 2);
  assert.equal(result.unique_binding_ids, 2);
  assert.equal(result.shared_district, true);
  assert.deepEqual(result.bindings.map(({ name_signature, district_signature }) => [name_signature, district_signature]), [
    ["VALID", "VALID"],
    ["VALID", "VALID"],
  ]);
});

test("one authorization cannot be relabeled onto the other Name", () => {
  const result = verifyPreparedAuthorization(PREPARED_BINDINGS[1], {
    signatures: signatures.bitmapworld,
    ownershipEvidence: ownership(),
    resolution: {
      parent_inscription_id: events["bitmapmetaverse.bitmap"].name_inscription_id,
      resolved_target: "937336.bitmap",
    },
  });
  assert.equal(result.status, "REJECT");
  assert.equal(result.code, "INVALID_NAME_SIGNATURE");
});

test("missing or modified signatures REJECT", () => {
  const base = PREPARED_BINDINGS[0];
  const resolution = {
    parent_inscription_id: events[base.name].name_inscription_id,
    resolved_target: "937336.bitmap",
  };
  assert.equal(verifyPreparedAuthorization(base, {
    signatures: { name: "", district: signatures.bitmapworld.district },
    ownershipEvidence: ownership(),
    resolution,
  }).code, "AUTHORIZATION_ABSENT");
  const changed = `${signatures.bitmapworld.name[0] === "A" ? "B" : "A"}${signatures.bitmapworld.name.slice(1)}`;
  assert.equal(verifyPreparedAuthorization(base, {
    signatures: { name: changed, district: signatures.bitmapworld.district },
    ownershipEvidence: ownership(),
    resolution,
  }).code, "INVALID_NAME_SIGNATURE");
});

test("a current holder mismatch REJECTS", () => {
  const evidence = ownership();
  evidence.inscriptions[EXPERIMENT_25_NAMES[0].inscription_id].address = EXPERIMENT_25_PROFILE.district_controller.address;
  const result = verifyPreparedAuthorization(PREPARED_BINDINGS[0], {
    signatures: signatures.bitmapworld,
    ownershipEvidence: evidence,
    resolution: {
      parent_inscription_id: EXPERIMENT_25_NAMES[0].inscription_id,
      resolved_target: "937336.bitmap",
    },
  });
  assert.equal(result.status, "REJECT");
  assert.equal(result.code, "OWNERSHIP_MISMATCH");
});

test("temporarily unavailable ownership is UNAVAILABLE", async () => {
  const result = await verifyExperiment25({
    signatures,
    ownershipResolver: async () => { throw new Error("provider timeout"); },
    nameResolver,
  });
  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(result.code, "OWNERSHIP_EVIDENCE_UNAVAILABLE");
});
