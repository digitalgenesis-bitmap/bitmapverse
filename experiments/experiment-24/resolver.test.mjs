import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BINDING_CONFIGS,
  EXPERIMENT_24_BINDING,
  PUBLIC_ARTIFACT_URL,
  resolvePubliclyAuthorizedName,
} from "./resolver.mjs";

const artifactFiles = {
  "bitmapverse.bitmap": "../experiment-23/public-authorization-artifact.v0.1.json",
  "bitmapworld.bitmap": "../experiment-26/bitmapworld.public-authorization-artifact.v0.1.json",
  "bitmapmetaverse.bitmap": "../experiment-26/bitmapmetaverse.public-authorization-artifact.v0.1.json",
};
const artifacts = Object.fromEntries(await Promise.all(Object.entries(artifactFiles).map(async ([name, file]) => [
  name,
  JSON.parse(await readFile(new URL(file, import.meta.url), "utf8")),
])));
const events = Object.fromEntries(Object.entries(artifacts).map(([name, artifact]) => [
  name,
  JSON.parse(artifact.message.text.slice(artifact.message.text.indexOf("\n") + 1)),
]));

const TIP = 972400;
const TIP_HASH = "0".repeat(63) + "1";
const names = Object.keys(BINDING_CONFIGS);

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function currentOwnership(name) {
  const config = BINDING_CONFIGS[name];
  const event = events[name];
  const nameTxid = String(names.indexOf(name) + 1).repeat(64);
  return {
    [config.name_inscription_id]: {
      satpoint: `${nameTxid}:1:0`,
      address: event.name_controller.address,
      script: event.name_controller.script_pubkey,
      height: event.authority_snapshot.height,
    },
    [config.district_inscription_id]: {
      satpoint: `${"4".repeat(64)}:15:0`,
      address: event.district_controller.address,
      script: event.district_controller.script_pubkey,
      height: 942807,
    },
  };
}

function fixtures(name, {
  artifactValue = artifacts[name],
  missingArtifact = false,
  wrongHolder = false,
  unavailable = false,
} = {}) {
  const config = BINDING_CONFIGS[name];
  const event = events[name];
  const current = currentOwnership(name);
  return async (url) => {
    const target = String(url);
    if (target === config.artifact_url) {
      return missingArtifact ? json({ error: "not found" }, 404) : json(artifactValue);
    }
    if (target.endsWith("/blocks/tip/height")) {
      if (unavailable) throw new Error("network down");
      return new Response(String(TIP));
    }
    if (target.endsWith(`/block-height/${TIP}`)) return new Response(TIP_HASH);
    for (const [id, evidence] of Object.entries(current)) {
      const useWrongHolder = wrongHolder && id === config.name_inscription_id;
      const address = useWrongHolder ? event.district_controller.address : evidence.address;
      const script = useWrongHolder ? event.district_controller.script_pubkey : evidence.script;
      if (target.endsWith(`/inscription/${id}`)) {
        return json({ id, satpoint: evidence.satpoint, address });
      }
      const [txid, voutText] = evidence.satpoint.split(":");
      const vout = Number(voutText);
      if (target.endsWith(`/tx/${txid}`)) {
        const outputs = Array.from({ length: vout + 1 }, () => ({}));
        outputs[vout] = { scriptpubkey_address: address, scriptpubkey: script };
        return json({ txid, status: { confirmed: true, block_height: evidence.height }, vout: outputs });
      }
      if (target.endsWith(`/tx/${txid}/outspend/${vout}`)) return json({ spent: false });
    }
    throw new Error(`unexpected URL ${target}`);
  };
}

function nameResolverFor(name) {
  const config = BINDING_CONFIGS[name];
  return async () => ({
    parent_inscription_id: config.name_inscription_id,
    resolved_target: config.target,
  });
}

for (const name of names) {
  test(`${name} ACCEPTS its real public signatures with controlled current ownership evidence`, async () => {
    const config = BINDING_CONFIGS[name];
    const result = await resolvePubliclyAuthorizedName(name, {
      fetchImpl: fixtures(name),
      nameResolver: nameResolverFor(name),
    });
    assert.equal(result.status, "ACCEPT");
    assert.equal(result.code, "AUTHORIZED_BINDING");
    assert.equal(result.binding.target, "937336.bitmap");
    assert.equal(result.binding.id, config.id);
    assert.equal(result.artifact.url, config.artifact_url);
    assert.equal(result.artifact.message_bytes, config.message_bytes);
    assert.equal(result.artifact.message_sha256, config.message_sha256);
    assert.equal(result.artifact.name_signature, "VALID");
    assert.equal(result.artifact.district_signature, "VALID");
  });
}

test("the original Experiment #24 exports remain compatible", () => {
  assert.equal(EXPERIMENT_24_BINDING, BINDING_CONFIGS["bitmapverse.bitmap"]);
  assert.equal(PUBLIC_ARTIFACT_URL, BINDING_CONFIGS["bitmapverse.bitmap"].artifact_url);
});

test("an invalid signature is REJECT, not UNAVAILABLE", async () => {
  const name = "bitmapworld.bitmap";
  const modified = structuredClone(artifacts[name]);
  const signature = modified.signatures.name.signature;
  modified.signatures.name.signature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
  const result = await resolvePubliclyAuthorizedName(name, {
    fetchImpl: fixtures(name, { artifactValue: modified }),
    nameResolver: nameResolverFor(name),
  });
  assert.equal(result.status, "REJECT");
  assert.equal(result.code, "INVALID_NAME_SIGNATURE");
});

test("a crossed public artifact is REJECT", async () => {
  const name = "bitmapworld.bitmap";
  const result = await resolvePubliclyAuthorizedName(name, {
    fetchImpl: fixtures(name, { artifactValue: artifacts["bitmapmetaverse.bitmap"] }),
    nameResolver: nameResolverFor(name),
  });
  assert.equal(result.status, "REJECT");
  assert.equal(result.code, "BINDING_MISMATCH");
});

test("an incorrect binding identifier is REJECT", async () => {
  const name = "bitmapworld.bitmap";
  const modified = structuredClone(artifacts[name]);
  modified.binding.id = "0".repeat(64);
  const result = await resolvePubliclyAuthorizedName(name, {
    fetchImpl: fixtures(name, { artifactValue: modified }),
    nameResolver: nameResolverFor(name),
  });
  assert.equal(result.status, "REJECT");
  assert.equal(result.code, "BINDING_MISMATCH");
});

test("an altered canonical message is REJECT", async () => {
  const name = "bitmapmetaverse.bitmap";
  const modified = structuredClone(artifacts[name]);
  modified.message.text += " ";
  const result = await resolvePubliclyAuthorizedName(name, {
    fetchImpl: fixtures(name, { artifactValue: modified }),
    nameResolver: nameResolverFor(name),
  });
  assert.equal(result.status, "REJECT");
  assert.equal(result.code, "MESSAGE_INTEGRITY_FAILURE");
});

test("an absent public authorization is REJECT", async () => {
  const name = "bitmapverse.bitmap";
  const result = await resolvePubliclyAuthorizedName(name, {
    fetchImpl: fixtures(name, { missingArtifact: true }),
    nameResolver: nameResolverFor(name),
  });
  assert.deepEqual(result, {
    status: "REJECT",
    code: "AUTHORIZATION_ABSENT",
    reason: "public authorization artifact: HTTP 404",
  });
});

test("a current holder different from the signed controller is REJECT", async () => {
  const name = "bitmapmetaverse.bitmap";
  const result = await resolvePubliclyAuthorizedName(name, {
    fetchImpl: fixtures(name, { wrongHolder: true }),
    nameResolver: nameResolverFor(name),
  });
  assert.equal(result.status, "REJECT");
  assert.equal(result.code, "OWNERSHIP_MISMATCH");
});

test("temporarily unverifiable public evidence is UNAVAILABLE", async () => {
  const name = "bitmapworld.bitmap";
  const result = await resolvePubliclyAuthorizedName(name, {
    fetchImpl: fixtures(name, { unavailable: true }),
    nameResolver: nameResolverFor(name),
  });
  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(result.code, "EVIDENCE_UNAVAILABLE");
});

test("an unknown Name remains outside the configured scope", async () => {
  const result = await resolvePubliclyAuthorizedName("unknown.bitmap", {
    fetchImpl: fixtures("bitmapverse.bitmap"),
    nameResolver: nameResolverFor("bitmapverse.bitmap"),
  });
  assert.equal(result.status, "REJECT");
  assert.equal(result.code, "NAME_NOT_AUTHORIZED");
});
