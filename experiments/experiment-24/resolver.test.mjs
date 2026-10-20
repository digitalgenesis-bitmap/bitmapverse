import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  EXPERIMENT_24_BINDING,
  PUBLIC_ARTIFACT_URL,
  resolvePubliclyAuthorizedName,
} from "./resolver.mjs";

const artifact = JSON.parse(await readFile(
  new URL("../experiment-23/public-authorization-artifact.v0.1.json", import.meta.url),
  "utf8",
));
const event = JSON.parse(artifact.message.text.slice(artifact.message.text.indexOf("\n") + 1));
const TIP = 972200;
const TIP_HASH = "0".repeat(63) + "1";
const current = {
  [EXPERIMENT_24_BINDING.name_inscription_id]: {
    satpoint: "62b1268600254cf9717350a21c3f02b37f195965bd68732a1a8081339847b1b3:1:0",
    address: event.name_controller.address,
    script: event.name_controller.script_pubkey,
    height: 971397,
  },
  [EXPERIMENT_24_BINDING.district_inscription_id]: {
    satpoint: "75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818:15:0",
    address: event.district_controller.address,
    script: event.district_controller.script_pubkey,
    height: 942807,
  },
};

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function fixtures({ artifactValue = artifact, missingArtifact = false, wrongHolder = false, unavailable = false } = {}) {
  return async (url) => {
    const target = String(url);
    if (target === PUBLIC_ARTIFACT_URL) return missingArtifact ? json({ error: "not found" }, 404) : json(artifactValue);
    if (target.endsWith("/blocks/tip/height")) {
      if (unavailable) throw new Error("network down");
      return new Response(String(TIP));
    }
    if (target.endsWith(`/block-height/${TIP}`)) return new Response(TIP_HASH);
    for (const [id, evidence] of Object.entries(current)) {
      if (target.endsWith(`/inscription/${id}`)) {
        const address = wrongHolder && id === EXPERIMENT_24_BINDING.name_inscription_id
          ? event.district_controller.address
          : evidence.address;
        return json({ id, satpoint: evidence.satpoint, address });
      }
      const [txid, voutText] = evidence.satpoint.split(":");
      const vout = Number(voutText);
      if (target.endsWith(`/tx/${txid}`)) {
        const address = wrongHolder && id === EXPERIMENT_24_BINDING.name_inscription_id
          ? event.district_controller.address
          : evidence.address;
        const script = wrongHolder && id === EXPERIMENT_24_BINDING.name_inscription_id
          ? event.district_controller.script_pubkey
          : evidence.script;
        const outputs = Array.from({ length: vout + 1 }, () => ({}));
        outputs[vout] = { scriptpubkey_address: address, scriptpubkey: script };
        return json({ txid, status: { confirmed: true, block_height: evidence.height }, vout: outputs });
      }
      if (target.endsWith(`/tx/${txid}/outspend/${vout}`)) return json({ spent: false });
    }
    throw new Error(`unexpected URL ${target}`);
  };
}

const nameResolver = async () => ({
  parent_inscription_id: EXPERIMENT_24_BINDING.name_inscription_id,
  resolved_target: EXPERIMENT_24_BINDING.target,
});

test("valid public bilateral authorization accepts only the reviewed binding", async () => {
  const result = await resolvePubliclyAuthorizedName(EXPERIMENT_24_BINDING.name, {
    fetchImpl: fixtures(),
    nameResolver,
  });
  assert.equal(result.status, "ACCEPT");
  assert.equal(result.code, "AUTHORIZED_BINDING");
  assert.equal(result.binding.target, "937336.bitmap");
  assert.equal(result.artifact.name_signature, "VALID");
  assert.equal(result.artifact.district_signature, "VALID");
});

test("an invalid signature is REJECT, not UNAVAILABLE", async () => {
  const modified = structuredClone(artifact);
  const signature = modified.signatures.name.signature;
  modified.signatures.name.signature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
  const result = await resolvePubliclyAuthorizedName(EXPERIMENT_24_BINDING.name, {
    fetchImpl: fixtures({ artifactValue: modified }),
    nameResolver,
  });
  assert.equal(result.status, "REJECT");
  assert.equal(result.code, "INVALID_NAME_SIGNATURE");
});

test("an absent public authorization is REJECT", async () => {
  const result = await resolvePubliclyAuthorizedName(EXPERIMENT_24_BINDING.name, {
    fetchImpl: fixtures({ missingArtifact: true }),
    nameResolver,
  });
  assert.deepEqual(result, {
    status: "REJECT",
    code: "AUTHORIZATION_ABSENT",
    reason: "public authorization artifact: HTTP 404",
  });
});

test("a current holder different from the signed controller is REJECT", async () => {
  const result = await resolvePubliclyAuthorizedName(EXPERIMENT_24_BINDING.name, {
    fetchImpl: fixtures({ wrongHolder: true }),
    nameResolver,
  });
  assert.equal(result.status, "REJECT");
  assert.equal(result.code, "OWNERSHIP_MISMATCH");
});

test("temporarily unverifiable live evidence is UNAVAILABLE", async () => {
  const result = await resolvePubliclyAuthorizedName(EXPERIMENT_24_BINDING.name, {
    fetchImpl: fixtures({ unavailable: true }),
    nameResolver,
  });
  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(result.code, "EVIDENCE_UNAVAILABLE");
});

test("no other Name enters the Experiment #24 scope", async () => {
  const result = await resolvePubliclyAuthorizedName("bitmapworld.bitmap", {
    fetchImpl: fixtures(),
    nameResolver,
  });
  assert.equal(result.status, "REJECT");
  assert.equal(result.code, "NAME_NOT_AUTHORIZED");
});
