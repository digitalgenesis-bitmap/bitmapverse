import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPERIMENT_22_PROFILE,
  authorizationMessage,
  messageSha256,
  verifyExperiment22Authorization,
} from "../authorization-adapter.mjs";
import {
  bindingId,
  eventMessage,
  resolveLaPuerta,
} from "../../experiment-1/resolvers/resolver-js.mjs";
import { controllerForSecret, signBip322 } from "../../experiment-1/tests/test-support.mjs";

const NAME_SECRET = 17n;
const DISTRICT_SECRET = 19n;
const WRONG_SECRET = 23n;
const SNAPSHOT = {
  height: 972169,
  block_hash: "00000000000000000000634ef8bc8d9e4d893a836896b62a3e9bab888dd8bbf7",
};

const reviewedControllers = {
  name: {
    address: "bc1p63hr0qrxdwwhygguukrt2fvtsx567d2ry5r9rum9w5wqv2yn5mtq8q0sze",
    script_pubkey: "5120d46e3780666b9d72211ce586b5258b81a9af3543250651f365751c062893a6d6",
  },
  district: {
    address: "bc1psphv4vlce9f37zqc7jt8w3gnynfxxh3zmjuvxpqv0vjs3t3mcdesyfk5tk",
    script_pubkey: "5120806ecab3f8c9531f0818f49677451324d2635e22dcb8c3040c7b2508ae3bc373",
  },
};

function unsignedEvent(controllers = reviewedControllers) {
  return {
    schema: EXPERIMENT_22_PROFILE.schema,
    experiment: EXPERIMENT_22_PROFILE.experiment,
    binding_id: bindingId(EXPERIMENT_22_PROFILE.name_inscription_id, EXPERIMENT_22_PROFILE.district_inscription_id),
    kind: "CREATE",
    sequence: 0,
    previous_event_hash: "0".repeat(64),
    scope: EXPERIMENT_22_PROFILE.scope,
    name_inscription_id: EXPERIMENT_22_PROFILE.name_inscription_id,
    district_inscription_id: EXPERIMENT_22_PROFILE.district_inscription_id,
    authority_snapshot: structuredClone(SNAPSHOT),
    name_controller: structuredClone(controllers.name),
    district_controller: structuredClone(controllers.district),
  };
}

function signedSyntheticEvent() {
  const controllers = {
    name: controllerForSecret(NAME_SECRET),
    district: controllerForSecret(DISTRICT_SECRET),
  };
  const event = unsignedEvent(controllers);
  const message = authorizationMessage(event);
  event.consents = {
    name: { format: "bip322-simple", signature: signBip322(NAME_SECRET, controllers.name.address, message) },
    district: { format: "bip322-simple", signature: signBip322(DISTRICT_SECRET, controllers.district.address, message) },
  };
  return { event, message };
}

function signedSyntheticExperiment1Event() {
  const nameController = controllerForSecret(NAME_SECRET);
  const districtController = controllerForSecret(DISTRICT_SECRET);
  const event = {
    schema: "bitmapverse.la_puerta.event.v0.1",
    experiment: "bitmapverse.experiment-1.la-puerta",
    binding_id: bindingId("a".repeat(64) + "i0", "b".repeat(64) + "i0"),
    kind: "CREATE",
    sequence: 0,
    previous_event_hash: "0".repeat(64),
    scope: "local-reversible-unpublished-disposable",
    name_inscription_id: "a".repeat(64) + "i0",
    district_inscription_id: "b".repeat(64) + "i0",
    authority_snapshot: structuredClone(SNAPSHOT),
    name_controller: nameController,
    district_controller: districtController,
  };
  const message = eventMessage(event);
  event.consents = {
    name: {
      format: "bip322-simple",
      signature: signBip322(NAME_SECRET, nameController.address, message),
    },
    district: {
      format: "bip322-simple",
      signature: signBip322(DISTRICT_SECRET, districtController.address, message),
    },
  };
  return event;
}

function evidenceFor(event, { tipHeight = SNAPSHOT.height, controllers } = {}) {
  const selected = controllers ?? {
    name: event.name_controller,
    district: event.district_controller,
  };
  return {
    tip: { height: tipHeight, block_hash: SNAPSHOT.block_hash },
    inscriptions: {
      [event.name_inscription_id]: {
        inscription_id: event.name_inscription_id,
        output: `${"1".repeat(64)}:1`,
        address: selected.name.address,
        script_pubkey: selected.name.script_pubkey,
        confirmed: true,
        confirmation_height: Math.min(971397, tipHeight),
        spent: false,
      },
      [event.district_inscription_id]: {
        inscription_id: event.district_inscription_id,
        output: `${"2".repeat(64)}:15`,
        address: selected.district.address,
        script_pubkey: selected.district.script_pubkey,
        confirmed: true,
        confirmation_height: Math.min(942807, tipHeight),
        spent: false,
      },
    },
  };
}

const resolverWith = (evidence) => async () => structuredClone(evidence);

test("el mensaje revisado mantiene exactamente 1092 bytes y su SHA-256 congelado", () => {
  const event = unsignedEvent();
  const message = authorizationMessage(event);
  assert.equal(Buffer.byteLength(message, "utf8"), EXPERIMENT_22_PROFILE.reviewed_message_bytes);
  assert.equal(messageSha256(message), EXPERIMENT_22_PROFILE.reviewed_message_sha256);
  assert.equal(event.binding_id, "edc5ae41b465f193cf22cdfad698de5b6c8c23d242b626c0d23c0ff0b4dc82ca");
  assert.equal(EXPERIMENT_22_PROFILE.binding_id_scheme, "bitmapverse.la-puerta.v0.1");
});

test("firmas bilaterales sintéticas y ownership coincidente producen ACCEPT", async () => {
  const { event, message } = signedSyntheticEvent();
  const result = await verifyExperiment22Authorization(event, {
    message,
    ownershipResolver: resolverWith(evidenceFor(event)),
  });
  assert.equal(result.result, "ACCEPT");
  assert.equal(result.binding_id_scheme, "bitmapverse.la-puerta.v0.1");
});

test("falta cualquiera de las dos firmas: REJECT", async () => {
  for (const role of ["name", "district"]) {
    const { event, message } = signedSyntheticEvent();
    event.consents[role].signature = "";
    const result = await verifyExperiment22Authorization(event, {
      message,
      ownershipResolver: resolverWith(evidenceFor(event)),
    });
    assert.equal(result.result, "REJECT");
    assert.equal(result.code, "MISSING_SIGNATURE");
  }
});

test("firma de un signer incorrecto: REJECT", async () => {
  const { event, message } = signedSyntheticEvent();
  event.consents.district.signature = signBip322(WRONG_SECRET, controllerForSecret(WRONG_SECRET).address, message);
  const result = await verifyExperiment22Authorization(event, {
    message,
    ownershipResolver: resolverWith(evidenceFor(event)),
  });
  assert.equal(result.result, "REJECT");
  assert.equal(result.code, "INVALID_DISTRICT_SIGNATURE");
});

test("Name o District ID incorrecto: REJECT", async () => {
  for (const field of ["name_inscription_id", "district_inscription_id"]) {
    const { event, message } = signedSyntheticEvent();
    event[field] = `${(field === "name_inscription_id" ? "3" : "4").repeat(64)}i0`;
    const result = await verifyExperiment22Authorization(event, {
      message,
      ownershipResolver: resolverWith(evidenceFor(event)),
    });
    assert.equal(result.result, "REJECT");
    assert.match(result.code, /^WRONG_(NAME|DISTRICT)_INSCRIPTION$/);
  }
});

test("un solo byte modificado en el mensaje: REJECT", async () => {
  const { event, message } = signedSyntheticEvent();
  const result = await verifyExperiment22Authorization(event, {
    message: `${message} `,
    ownershipResolver: resolverWith(evidenceFor(event)),
  });
  assert.equal(result.result, "REJECT");
  assert.equal(result.code, "MESSAGE_MISMATCH");
});

test("ownership que no coincide con el signer: REJECT sin fallback", async () => {
  const { event, message } = signedSyntheticEvent();
  const wrongControllers = {
    name: event.name_controller,
    district: controllerForSecret(WRONG_SECRET),
  };
  const result = await verifyExperiment22Authorization(event, {
    message,
    ownershipResolver: resolverWith(evidenceFor(event, { controllers: wrongControllers })),
  });
  assert.equal(result.result, "REJECT");
  assert.equal(result.code, "OWNERSHIP_MISMATCH");
});

test("evidencia stale: REJECT", async () => {
  const { event, message } = signedSyntheticEvent();
  const result = await verifyExperiment22Authorization(event, {
    message,
    ownershipResolver: resolverWith(evidenceFor(event, { tipHeight: SNAPSHOT.height - 1 })),
  });
  assert.equal(result.result, "REJECT");
  assert.equal(result.code, "STALE_OWNERSHIP_EVIDENCE");
});

test("ownership no disponible: REJECT", async () => {
  const { event, message } = signedSyntheticEvent();
  const result = await verifyExperiment22Authorization(event, {
    message,
    ownershipResolver: async () => { throw new Error("offline"); },
  });
  assert.equal(result.result, "REJECT");
  assert.equal(result.code, "OWNERSHIP_UNAVAILABLE");
});

test("Experiment #1 regression passes with deterministic synthetic signatures", () => {
  assert.equal(resolveLaPuerta([signedSyntheticExperiment1Event()]).status, "ACTIVE");
});
