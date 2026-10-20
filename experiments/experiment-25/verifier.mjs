import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { verifyBip322P2TR } from "../experiment-1/resolvers/resolver-js.mjs";
import { resolveName } from "../experiment-9/resolver.mjs";
import { resolveIndependentOwnership } from "../experiment-24/resolver.mjs";
import {
  EXPERIMENT_25_NAMES,
  EXPERIMENT_25_PROFILE,
  PREPARED_BINDINGS,
  buildPreparedBinding,
} from "./profile.mjs";

const PRIVATE_SIGNATURE_DIRECTORY = new URL("../../outputs/experiment-25/", import.meta.url);

function reject(code, reason, name) {
  return { status: "REJECT", code, reason, name };
}

function exactSignature(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 4096 && !/\s/.test(value);
}

function expectedPrepared(name) {
  const profile = EXPERIMENT_25_NAMES.find((candidate) => candidate.name === name);
  return profile ? buildPreparedBinding(profile) : null;
}

export function verifyPreparedAuthorization(prepared, {
  signatures,
  ownershipEvidence,
  resolution,
} = {}) {
  const expected = expectedPrepared(prepared?.name);
  if (!expected || JSON.stringify(prepared) !== JSON.stringify(expected)) {
    return reject("MESSAGE_PROFILE_MISMATCH", "el binding preparado no coincide con el perfil congelado", prepared?.name);
  }
  const messageBytes = Buffer.byteLength(prepared.message, "utf8");
  const messageSha256 = createHash("sha256").update(prepared.message, "utf8").digest("hex");
  if (
    messageBytes !== prepared.message_bytes
    || messageSha256 !== prepared.message_sha256
    || prepared.message.includes("\r")
    || prepared.message.endsWith("\n")
    || prepared.message.split("\n").length !== 2
  ) return reject("MESSAGE_INTEGRITY_FAILURE", "bytes, hash o line endings inválidos", prepared.name);

  if (!exactSignature(signatures?.name) || !exactSignature(signatures?.district)) {
    return reject("AUTHORIZATION_ABSENT", "se requieren ambas firmas BIP-322", prepared.name);
  }

  let event;
  try {
    event = JSON.parse(prepared.message.slice(prepared.message.indexOf("\n") + 1));
  } catch {
    return reject("MESSAGE_PARSE_FAILURE", "payload JSON inválido", prepared.name);
  }
  const nameOwnership = ownershipEvidence?.inscriptions?.[event.name_inscription_id];
  const districtOwnership = ownershipEvidence?.inscriptions?.[event.district_inscription_id];
  if (!nameOwnership || !districtOwnership || !ownershipEvidence?.tip) {
    return reject("MISSING_OWNERSHIP_EVIDENCE", "falta evidencia de uno o ambos titulares", prepared.name);
  }
  if (!Number.isSafeInteger(ownershipEvidence.tip.height) || ownershipEvidence.tip.height < event.authority_snapshot.height) {
    return reject("STALE_OWNERSHIP_EVIDENCE", "la evidencia es anterior al snapshot firmado", prepared.name);
  }
  for (const [role, current] of [["name", nameOwnership], ["district", districtOwnership]]) {
    const controller = event[`${role}_controller`];
    if (current.confirmed !== true) return reject("UNCONFIRMED_OWNERSHIP", role, prepared.name);
    if (current.spent !== false) return reject("SPENT_OWNERSHIP", role, prepared.name);
    if (current.address !== controller.address || current.script_pubkey !== controller.script_pubkey) {
      return reject("OWNERSHIP_MISMATCH", role, prepared.name);
    }
  }
  if (!verifyBip322P2TR(nameOwnership.address, prepared.message, signatures.name)) {
    return reject("INVALID_NAME_SIGNATURE", "firma BIP-322 inválida", prepared.name);
  }
  if (!verifyBip322P2TR(districtOwnership.address, prepared.message, signatures.district)) {
    return reject("INVALID_DISTRICT_SIGNATURE", "firma BIP-322 inválida", prepared.name);
  }
  if (
    resolution?.parent_inscription_id !== event.name_inscription_id
    || resolution?.resolved_target !== EXPERIMENT_25_PROFILE.district
  ) return reject("RESOLVER_MISMATCH", "el resolver de Name no coincide con el binding firmado", prepared.name);

  return {
    status: "ACCEPT",
    code: "AUTHORIZED_BINDING",
    name: prepared.name,
    district: prepared.district,
    binding_id: prepared.binding_id,
    message_bytes: messageBytes,
    message_sha256: messageSha256,
    name_signature: "VALID",
    district_signature: "VALID",
    name_holder: nameOwnership.address,
    district_holder: districtOwnership.address,
    name_output: nameOwnership.output,
    district_output: districtOwnership.output,
    outputs_confirmed_unspent: true,
    resolver_compatible: true,
  };
}

export async function readPrivateSignatures() {
  const result = {};
  for (const binding of ["bitmapworld", "bitmapmetaverse"]) {
    result[binding] = {
      name: (await readFile(new URL(`${binding}.name.bip322`, PRIVATE_SIGNATURE_DIRECTORY), "utf8")).trim(),
      district: (await readFile(new URL(`${binding}.district.bip322`, PRIVATE_SIGNATURE_DIRECTORY), "utf8")).trim(),
    };
  }
  return result;
}

export async function verifyExperiment25({
  signatures,
  ownershipResolver = resolveIndependentOwnership,
  nameResolver = resolveName,
} = {}) {
  let ownershipEvidence;
  try {
    ownershipEvidence = await ownershipResolver({
      inscriptionIds: [
        ...EXPERIMENT_25_NAMES.map(({ inscription_id }) => inscription_id),
        EXPERIMENT_25_PROFILE.district_inscription_id,
      ],
    });
  } catch (error) {
    return {
      status: "UNAVAILABLE",
      code: "OWNERSHIP_EVIDENCE_UNAVAILABLE",
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  const results = [];
  for (const prepared of PREPARED_BINDINGS) {
    let resolution;
    try {
      resolution = await nameResolver(prepared.name);
    } catch (error) {
      return {
        status: "UNAVAILABLE",
        code: "NAME_RESOLUTION_UNAVAILABLE",
        name: prepared.name,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
    const key = prepared.name === "bitmapworld.bitmap" ? "bitmapworld" : "bitmapmetaverse";
    results.push(verifyPreparedAuthorization(prepared, {
      signatures: signatures?.[key],
      ownershipEvidence,
      resolution,
    }));
  }
  const rejected = results.find(({ status }) => status !== "ACCEPT");
  if (rejected) return { status: "REJECT", code: rejected.code, bindings: results };
  return {
    status: "ACCEPT",
    code: "MULTI_NAME_ONE_DISTRICT_AUTHORIZED",
    ownership_tip: ownershipEvidence.tip,
    binding_count: results.length,
    unique_binding_ids: new Set(results.map(({ binding_id }) => binding_id)).size,
    shared_district: results.every(({ district }) => district === EXPERIMENT_25_PROFILE.district),
    bindings: results,
  };
}
