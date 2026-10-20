import { createHash } from "node:crypto";

import {
  bindingId,
  p2trScriptPubKey,
  verifyBip322P2TR,
} from "../experiment-1/resolvers/resolver-js.mjs";

export const EXPERIMENT_22_PROFILE = Object.freeze({
  domain: "BITMAPVERSE EXPERIMENT 22 / DISTRICT-HOLDER AUTHORIZATION / v0.1\n",
  schema: "bitmapverse.authorization.event.v0.1",
  experiment: "bitmapverse.experiment-22.district-holder-authorization",
  scope: "bitmapverse-authorization",
  binding_id_scheme: "bitmapverse.la-puerta.v0.1",
  name_inscription_id: "9acf85a192845d64b55d20dcec6af4589cd28dff6f0ad19b73b219f2551a57cbi0",
  district_inscription_id: "7b7c15dc952cde069a371f4628c05ffe56e164bc272cfd9ef29cd231b6b3a9d1i0",
  reviewed_message_bytes: 1092,
  reviewed_message_sha256: "bfa6b84854419d3629373ecf66cf6869766c7c606dd279f991941d027e42f833",
});

const ZERO_HASH = "0".repeat(64);
const HEX64 = /^[0-9a-f]{64}$/;
const OUTPOINT = /^[0-9a-f]{64}:[0-9]+$/;

export class AuthorizationError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

function requireValue(condition, code, message) {
  if (!condition) throw new AuthorizationError(code, message);
}

function exactKeys(value, keys, label) {
  requireValue(value && typeof value === "object" && !Array.isArray(value), "INVALID_SHAPE", `${label} no es objeto`);
  requireValue(
    JSON.stringify(Object.keys(value).toSorted()) === JSON.stringify([...keys].toSorted()),
    "INVALID_SHAPE",
    `${label} contiene campos faltantes o desconocidos`,
  );
}

function canonicalPayload(event) {
  return {
    schema: event.schema,
    experiment: event.experiment,
    binding_id: event.binding_id,
    kind: event.kind,
    sequence: event.sequence,
    previous_event_hash: event.previous_event_hash,
    scope: event.scope,
    name_inscription_id: event.name_inscription_id,
    district_inscription_id: event.district_inscription_id,
    authority_snapshot: {
      height: event.authority_snapshot.height,
      block_hash: event.authority_snapshot.block_hash,
    },
    name_controller: {
      address: event.name_controller.address,
      script_pubkey: event.name_controller.script_pubkey,
    },
    district_controller: {
      address: event.district_controller.address,
      script_pubkey: event.district_controller.script_pubkey,
    },
  };
}

export function authorizationMessage(event) {
  return `${EXPERIMENT_22_PROFILE.domain}${JSON.stringify(canonicalPayload(event))}`;
}

export function messageSha256(message) {
  return createHash("sha256").update(message, "utf8").digest("hex");
}

function validateController(controller, role) {
  exactKeys(controller, ["address", "script_pubkey"], `${role}_controller`);
  requireValue(/^bc1p[0-9a-z]+$/.test(controller.address), "INVALID_CONTROLLER", `${role}: dirección P2TR inválida`);
  requireValue(/^[0-9a-f]+$/.test(controller.script_pubkey), "INVALID_CONTROLLER", `${role}: script inválido`);
  requireValue(
    p2trScriptPubKey(controller.address).toString("hex") === controller.script_pubkey,
    "INVALID_CONTROLLER",
    `${role}: dirección y script no coinciden`,
  );
}

function validateEvent(event) {
  exactKeys(event, [
    "schema", "experiment", "binding_id", "kind", "sequence", "previous_event_hash", "scope",
    "name_inscription_id", "district_inscription_id", "authority_snapshot", "name_controller",
    "district_controller", "consents",
  ], "evento");
  exactKeys(event.authority_snapshot, ["height", "block_hash"], "authority_snapshot");
  exactKeys(event.consents, ["name", "district"], "consents");
  for (const role of ["name", "district"]) {
    exactKeys(event.consents[role], ["format", "signature"], `consents.${role}`);
    requireValue(event.consents[role].format === "bip322-simple", "INVALID_SIGNATURE_FORMAT", role);
    requireValue(
      typeof event.consents[role].signature === "string" && event.consents[role].signature.length > 0,
      "MISSING_SIGNATURE",
      role,
    );
  }

  requireValue(event.schema === EXPERIMENT_22_PROFILE.schema, "UNKNOWN_SCHEMA", String(event.schema));
  requireValue(event.experiment === EXPERIMENT_22_PROFILE.experiment, "WRONG_EXPERIMENT", String(event.experiment));
  requireValue(event.scope === EXPERIMENT_22_PROFILE.scope, "WRONG_SCOPE", String(event.scope));
  requireValue(event.kind === "CREATE", "WRONG_EVENT_KIND", String(event.kind));
  requireValue(event.sequence === 0, "WRONG_SEQUENCE", String(event.sequence));
  requireValue(event.previous_event_hash === ZERO_HASH, "WRONG_PREVIOUS_HASH", String(event.previous_event_hash));
  requireValue(
    event.name_inscription_id === EXPERIMENT_22_PROFILE.name_inscription_id,
    "WRONG_NAME_INSCRIPTION",
    String(event.name_inscription_id),
  );
  requireValue(
    event.district_inscription_id === EXPERIMENT_22_PROFILE.district_inscription_id,
    "WRONG_DISTRICT_INSCRIPTION",
    String(event.district_inscription_id),
  );
  requireValue(
    event.binding_id === bindingId(event.name_inscription_id, event.district_inscription_id),
    "BINDING_ID_MISMATCH",
    String(event.binding_id),
  );
  requireValue(Number.isSafeInteger(event.authority_snapshot.height) && event.authority_snapshot.height >= 0, "INVALID_SNAPSHOT", "altura");
  requireValue(HEX64.test(event.authority_snapshot.block_hash), "INVALID_SNAPSHOT", "block_hash");
  validateController(event.name_controller, "name");
  validateController(event.district_controller, "district");
}

function validateOwnershipEvidence(evidence, event) {
  exactKeys(evidence, ["tip", "inscriptions"], "ownership_evidence");
  exactKeys(evidence.tip, ["height", "block_hash"], "ownership_evidence.tip");
  requireValue(Number.isSafeInteger(evidence.tip.height), "INVALID_OWNERSHIP_EVIDENCE", "tip.height");
  requireValue(HEX64.test(evidence.tip.block_hash), "INVALID_OWNERSHIP_EVIDENCE", "tip.block_hash");
  requireValue(
    evidence.tip.height >= event.authority_snapshot.height,
    "STALE_OWNERSHIP_EVIDENCE",
    `${evidence.tip.height} < ${event.authority_snapshot.height}`,
  );
  requireValue(evidence.inscriptions && typeof evidence.inscriptions === "object", "INVALID_OWNERSHIP_EVIDENCE", "inscriptions");

  for (const role of ["name", "district"]) {
    const inscriptionId = event[`${role}_inscription_id`];
    const controller = event[`${role}_controller`];
    const current = evidence.inscriptions[inscriptionId];
    requireValue(current, "MISSING_OWNERSHIP_EVIDENCE", role);
    exactKeys(current, [
      "inscription_id", "output", "address", "script_pubkey", "confirmed", "confirmation_height", "spent",
    ], `ownership_evidence.${role}`);
    requireValue(current.inscription_id === inscriptionId, "OWNERSHIP_ID_MISMATCH", role);
    requireValue(OUTPOINT.test(current.output), "INVALID_OWNERSHIP_EVIDENCE", `${role}: output`);
    requireValue(current.confirmed === true, "UNCONFIRMED_OWNERSHIP", role);
    requireValue(current.spent === false, "SPENT_OWNERSHIP", role);
    requireValue(
      Number.isSafeInteger(current.confirmation_height) && current.confirmation_height <= evidence.tip.height,
      "INVALID_OWNERSHIP_EVIDENCE",
      `${role}: confirmation_height`,
    );
    requireValue(
      p2trScriptPubKey(current.address).toString("hex") === current.script_pubkey,
      "INVALID_OWNERSHIP_EVIDENCE",
      `${role}: dirección y script`,
    );
    requireValue(
      current.address === controller.address && current.script_pubkey === controller.script_pubkey,
      "OWNERSHIP_MISMATCH",
      role,
    );
  }
}

async function responseText(response, label) {
  requireValue(response?.ok === true, "OWNERSHIP_UNAVAILABLE", `${label}: HTTP ${response?.status ?? "unknown"}`);
  return response.text();
}

async function responseJson(response, label) {
  const text = await responseText(response, label);
  try {
    return JSON.parse(text);
  } catch {
    throw new AuthorizationError("OWNERSHIP_UNAVAILABLE", `${label}: JSON inválido`);
  }
}

export async function resolveLiveOwnership({
  inscriptionIds,
  fetchImpl = globalThis.fetch,
  ordBaseUrl = "https://ordinals.com",
  bitcoinBaseUrl = "https://mempool.space/api",
}) {
  requireValue(typeof fetchImpl === "function", "OWNERSHIP_UNAVAILABLE", "fetch no disponible");
  try {
    const tipHeightText = await responseText(await fetchImpl(`${bitcoinBaseUrl}/blocks/tip/height`), "tip height");
    const tipHeight = Number(tipHeightText);
    requireValue(Number.isSafeInteger(tipHeight), "OWNERSHIP_UNAVAILABLE", "tip height inválido");
    const tipHash = (await responseText(await fetchImpl(`${bitcoinBaseUrl}/block-height/${tipHeight}`), "tip hash")).trim();
    requireValue(HEX64.test(tipHash), "OWNERSHIP_UNAVAILABLE", "tip hash inválido");

    const inscriptions = {};
    for (const inscriptionId of inscriptionIds) {
      const metadata = await responseJson(
        await fetchImpl(`${ordBaseUrl}/r/inscription/${inscriptionId}`),
        `inscription ${inscriptionId}`,
      );
      requireValue(metadata.id === inscriptionId, "OWNERSHIP_ID_MISMATCH", inscriptionId);
      requireValue(OUTPOINT.test(metadata.output), "INVALID_OWNERSHIP_EVIDENCE", `${inscriptionId}: output`);
      const separator = metadata.output.lastIndexOf(":");
      const txid = metadata.output.slice(0, separator);
      const vout = Number(metadata.output.slice(separator + 1));
      const [transaction, outspend] = await Promise.all([
        responseJson(await fetchImpl(`${bitcoinBaseUrl}/tx/${txid}`), `transaction ${txid}`),
        responseJson(await fetchImpl(`${bitcoinBaseUrl}/tx/${txid}/outspend/${vout}`), `outspend ${metadata.output}`),
      ]);
      const output = transaction?.vout?.[vout];
      requireValue(transaction?.txid === txid && output, "INVALID_OWNERSHIP_EVIDENCE", `${inscriptionId}: transaction output`);
      requireValue(metadata.address === output.scriptpubkey_address, "OWNERSHIP_MISMATCH", `${inscriptionId}: indexer/Bitcoin`);
      inscriptions[inscriptionId] = {
        inscription_id: inscriptionId,
        output: metadata.output,
        address: output.scriptpubkey_address,
        script_pubkey: output.scriptpubkey,
        confirmed: transaction.status?.confirmed === true,
        confirmation_height: transaction.status?.block_height,
        spent: outspend?.spent,
      };
    }
    return { tip: { height: tipHeight, block_hash: tipHash }, inscriptions };
  } catch (error) {
    if (error instanceof AuthorizationError) throw error;
    throw new AuthorizationError("OWNERSHIP_UNAVAILABLE", error instanceof Error ? error.message : String(error));
  }
}

export async function verifyExperiment22Authorization(event, {
  message,
  ownershipResolver = resolveLiveOwnership,
} = {}) {
  try {
    validateEvent(event);
    const canonicalMessage = authorizationMessage(event);
    requireValue(typeof message === "string" && message === canonicalMessage, "MESSAGE_MISMATCH", "bytes no canónicos");

    let evidence;
    try {
      evidence = await ownershipResolver({
        inscriptionIds: [event.name_inscription_id, event.district_inscription_id],
        snapshot: event.authority_snapshot,
      });
    } catch (error) {
      if (error instanceof AuthorizationError) throw error;
      throw new AuthorizationError("OWNERSHIP_UNAVAILABLE", error instanceof Error ? error.message : String(error));
    }
    validateOwnershipEvidence(evidence, event);

    requireValue(
      verifyBip322P2TR(event.name_controller.address, message, event.consents.name.signature),
      "INVALID_NAME_SIGNATURE",
      "firma BIP-322 inválida",
    );
    requireValue(
      verifyBip322P2TR(event.district_controller.address, message, event.consents.district.signature),
      "INVALID_DISTRICT_SIGNATURE",
      "firma BIP-322 inválida",
    );

    return {
      result: "ACCEPT",
      schema: EXPERIMENT_22_PROFILE.schema,
      binding_id_scheme: EXPERIMENT_22_PROFILE.binding_id_scheme,
      binding_id: event.binding_id,
      message_bytes: Buffer.byteLength(message, "utf8"),
      message_sha256: messageSha256(message),
      ownership_tip: evidence.tip,
    };
  } catch (error) {
    return {
      result: "REJECT",
      code: error instanceof AuthorizationError ? error.code : "VERIFICATION_ERROR",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
