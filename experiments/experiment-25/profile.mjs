import { createHash } from "node:crypto";

import { bindingId } from "../experiment-1/resolvers/resolver-js.mjs";

export const EXPERIMENT_25_PROFILE = Object.freeze({
  domain: "BITMAPVERSE EXPERIMENT 25 / MULTI-NAME ONE DISTRICT / v0.1\n",
  schema: "bitmapverse.authorization.event.v0.1",
  experiment: "bitmapverse.experiment-25.multi-name-one-district",
  scope: "bitmapverse-authorization",
  binding_id_scheme: "bitmapverse.la-puerta.v0.1",
  district: "937336.bitmap",
  district_inscription_id: "7b7c15dc952cde069a371f4628c05ffe56e164bc272cfd9ef29cd231b6b3a9d1i0",
  authority_snapshot: Object.freeze({
    height: 972201,
    block_hash: "00000000000000000001012191d18b637ef54d53a90d09be638b5c6f13378231",
  }),
  name_controller: Object.freeze({
    address: "bc1pupqk7jjtm7mucm9uvr2324c8jpm467ncgsy5zwe0g8szt906jk7s08k5jq",
    script_pubkey: "5120e0416f4a4bdfb7cc6cbc60d515570790775d7a784409413b2f41e02595fa95bd",
  }),
  district_controller: Object.freeze({
    address: "bc1psphv4vlce9f37zqc7jt8w3gnynfxxh3zmjuvxpqv0vjs3t3mcdesyfk5tk",
    script_pubkey: "5120806ecab3f8c9531f0818f49677451324d2635e22dcb8c3040c7b2508ae3bc373",
  }),
});

export const EXPERIMENT_25_NAMES = Object.freeze([
  Object.freeze({
    name: "bitmapworld.bitmap",
    inscription_id: "f1aeada2eabe8e5ef2c0232bcfdcadf0f38d17ecbd45481ded0b4d35ab366545i0",
  }),
  Object.freeze({
    name: "bitmapmetaverse.bitmap",
    inscription_id: "868445efe742649fd9d885df257722226a9eb689c8da07441e87bc64af35afffi0",
  }),
]);

export function buildPreparedBinding(nameProfile) {
  const event = {
    schema: EXPERIMENT_25_PROFILE.schema,
    experiment: EXPERIMENT_25_PROFILE.experiment,
    binding_id: bindingId(nameProfile.inscription_id, EXPERIMENT_25_PROFILE.district_inscription_id),
    kind: "CREATE",
    sequence: 0,
    previous_event_hash: "0".repeat(64),
    scope: EXPERIMENT_25_PROFILE.scope,
    name_inscription_id: nameProfile.inscription_id,
    district_inscription_id: EXPERIMENT_25_PROFILE.district_inscription_id,
    authority_snapshot: structuredClone(EXPERIMENT_25_PROFILE.authority_snapshot),
    name_controller: structuredClone(EXPERIMENT_25_PROFILE.name_controller),
    district_controller: structuredClone(EXPERIMENT_25_PROFILE.district_controller),
  };
  const message = `${EXPERIMENT_25_PROFILE.domain}${JSON.stringify(event)}`;
  return {
    name: nameProfile.name,
    district: EXPERIMENT_25_PROFILE.district,
    binding_id: event.binding_id,
    message,
    message_bytes: Buffer.byteLength(message, "utf8"),
    message_sha256: createHash("sha256").update(message, "utf8").digest("hex"),
    authorization: {
      status: "REJECT",
      code: "AUTHORIZATION_ABSENT",
      required_signatures: ["name", "district"],
    },
  };
}

export const PREPARED_BINDINGS = Object.freeze(EXPERIMENT_25_NAMES.map(buildPreparedBinding));
