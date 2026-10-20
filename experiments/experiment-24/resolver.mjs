import { createHash } from "node:crypto";

import {
  AuthorizationError,
  verifyExperiment22Authorization,
} from "../experiment-22/authorization-adapter.mjs";
import { resolveName } from "../experiment-9/resolver.mjs";

export const BINDING_CONFIGS = Object.freeze({
  "bitmapverse.bitmap": Object.freeze({
    name: "bitmapverse.bitmap",
    target: "937336.bitmap",
    artifact_url: "https://raw.githubusercontent.com/digitalgenesis-bitmap/bitmapverse/fed7fc1c0a49bcd3ef2b85292f33b910ef8ec61e/experiments/experiment-23/public-authorization-artifact.v0.1.json",
    scheme: "bitmapverse.la-puerta.v0.1",
    id: "edc5ae41b465f193cf22cdfad698de5b6c8c23d242b626c0d23c0ff0b4dc82ca",
    name_inscription_id: "9acf85a192845d64b55d20dcec6af4589cd28dff6f0ad19b73b219f2551a57cbi0",
    district_inscription_id: "7b7c15dc952cde069a371f4628c05ffe56e164bc272cfd9ef29cd231b6b3a9d1i0",
    message_bytes: 1092,
    message_sha256: "bfa6b84854419d3629373ecf66cf6869766c7c606dd279f991941d027e42f833",
    verification_profile: "experiment-22",
  }),
  "bitmapworld.bitmap": Object.freeze({
    name: "bitmapworld.bitmap",
    target: "937336.bitmap",
    artifact_url: "https://raw.githubusercontent.com/digitalgenesis-bitmap/bitmapverse/4572280d32babe49d4994791941bcdf0a0cc5fc9/experiments/experiment-26/bitmapworld.public-authorization-artifact.v0.1.json",
    scheme: "bitmapverse.la-puerta.v0.1",
    id: "fadf51c521a5f9c94e5303aa6d6826a689269371403d70da67dfaf7d04bf9dde",
    name_inscription_id: "f1aeada2eabe8e5ef2c0232bcfdcadf0f38d17ecbd45481ded0b4d35ab366545i0",
    district_inscription_id: "7b7c15dc952cde069a371f4628c05ffe56e164bc272cfd9ef29cd231b6b3a9d1i0",
    message_bytes: 1080,
    message_sha256: "3de168c726f012be3a96f40430f759fcd481d227cb07f750669f50911fec9d7f",
    verification_profile: "experiment-25",
  }),
  "bitmapmetaverse.bitmap": Object.freeze({
    name: "bitmapmetaverse.bitmap",
    target: "937336.bitmap",
    artifact_url: "https://raw.githubusercontent.com/digitalgenesis-bitmap/bitmapverse/4572280d32babe49d4994791941bcdf0a0cc5fc9/experiments/experiment-26/bitmapmetaverse.public-authorization-artifact.v0.1.json",
    scheme: "bitmapverse.la-puerta.v0.1",
    id: "9687364ecb3e6c93d8ab365ad334f8be6eb402b42921d561d4361cefeda18fa9",
    name_inscription_id: "868445efe742649fd9d885df257722226a9eb689c8da07441e87bc64af35afffi0",
    district_inscription_id: "7b7c15dc952cde069a371f4628c05ffe56e164bc272cfd9ef29cd231b6b3a9d1i0",
    message_bytes: 1080,
    message_sha256: "2e16880d1f06d8977779e8bbe9d8a5550518b10565c80cd12b4d9729129e7ba5",
    verification_profile: "experiment-25",
  }),
});

export const EXPERIMENT_24_BINDING = BINDING_CONFIGS["bitmapverse.bitmap"];
export const PUBLIC_ARTIFACT_URL = EXPERIMENT_24_BINDING.artifact_url;

const DEFAULT_ORD_INDEXER = "https://turbo.ordinalswallet.com";
const DEFAULT_BITCOIN_API = "https://blockstream.info/api";
const OUTPOINT = /^(?<txid>[0-9a-f]{64}):(?<vout>0|[1-9][0-9]*):(?<offset>0|[1-9][0-9]*)$/;
const HEX64 = /^[0-9a-f]{64}$/;
const BIP322 = /^(?:smp)?[A-Za-z0-9+/]+={0,2}$/;

class EvidenceUnavailable extends Error {
  constructor(code, message) {
    super(message);
    this.name = "EvidenceUnavailable";
    this.code = code;
  }
}

class ArtifactRejected extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ArtifactRejected";
    this.code = code;
  }
}

function exactKeys(value, expected) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).toSorted()) === JSON.stringify([...expected].toSorted());
}

function requireArtifact(condition, code, message) {
  if (!condition) throw new ArtifactRejected(code, message);
}

function reject(code, reason) {
  return { status: "REJECT", code, reason };
}

function unavailable(code, reason) {
  return { status: "UNAVAILABLE", code, reason };
}

async function fetchChecked(fetchImpl, url, label, { timeoutMs, artifact = false } = {}) {
  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw new EvidenceUnavailable("EVIDENCE_UNAVAILABLE", `${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (response?.ok === true) return response;
  const status = response?.status ?? "unknown";
  if (artifact && status === 404) throw new ArtifactRejected("AUTHORIZATION_ABSENT", `${label}: HTTP 404`);
  if (status === 429 || status >= 500 || status === "unknown") {
    throw new EvidenceUnavailable("EVIDENCE_UNAVAILABLE", `${label}: HTTP ${status}`);
  }
  throw new ArtifactRejected(artifact ? "AUTHORIZATION_UNAVAILABLE" : "INVALID_OWNERSHIP_EVIDENCE", `${label}: HTTP ${status}`);
}

async function fetchJson(fetchImpl, url, label, options) {
  const response = await fetchChecked(fetchImpl, url, label, options);
  try {
    return await response.json();
  } catch {
    throw new EvidenceUnavailable("EVIDENCE_UNAVAILABLE", `${label}: JSON inválido`);
  }
}

async function fetchText(fetchImpl, url, label, options) {
  const response = await fetchChecked(fetchImpl, url, label, options);
  return response.text();
}

function assertArtifactShape(artifact, config) {
  requireArtifact(exactKeys(artifact, ["schema", "binding", "message", "signatures"]), "STRICT_SCHEMA_FAILURE", "artifact");
  requireArtifact(exactKeys(artifact.binding, ["scheme", "id", "name_inscription_id", "district_inscription_id"]), "STRICT_SCHEMA_FAILURE", "binding");
  requireArtifact(exactKeys(artifact.message, ["encoding", "line_endings", "terminal_newline", "bytes", "sha256", "text"]), "STRICT_SCHEMA_FAILURE", "message");
  requireArtifact(exactKeys(artifact.signatures, ["name", "district"]), "STRICT_SCHEMA_FAILURE", "signatures");
  for (const role of ["name", "district"]) {
    const consent = artifact.signatures[role];
    requireArtifact(exactKeys(consent, ["format", "signature"]), "STRICT_SCHEMA_FAILURE", `signatures.${role}`);
    requireArtifact(consent.format === "bip322-simple", "STRICT_SCHEMA_FAILURE", `${role}: formato`);
    requireArtifact(
      typeof consent.signature === "string" && consent.signature.length >= 4 && consent.signature.length <= 4096 && BIP322.test(consent.signature),
      "INVALID_SIGNATURE_ENCODING",
      role,
    );
  }
  requireArtifact(artifact.schema === "bitmapverse.public-authorization-artifact.v0.1", "STRICT_SCHEMA_FAILURE", "schema");
  requireArtifact(
    JSON.stringify(artifact.binding) === JSON.stringify({
      scheme: config.scheme,
      id: config.id,
      name_inscription_id: config.name_inscription_id,
      district_inscription_id: config.district_inscription_id,
    }),
    "BINDING_MISMATCH",
    "binding",
  );
}

function parseCanonicalMessage(artifact, config) {
  const message = artifact.message.text;
  const bytes = Buffer.byteLength(message, "utf8");
  const sha256 = createHash("sha256").update(message, "utf8").digest("hex");
  requireArtifact(
    artifact.message.encoding === "utf-8"
      && artifact.message.line_endings === "LF"
      && artifact.message.terminal_newline === false
      && artifact.message.bytes === config.message_bytes
      && artifact.message.sha256 === config.message_sha256
      && bytes === config.message_bytes
      && sha256 === config.message_sha256
      && !message.includes("\r")
      && !message.endsWith("\n")
      && message.split("\n").length === 2,
    "MESSAGE_INTEGRITY_FAILURE",
    "mensaje canónico",
  );
  let event;
  try {
    event = JSON.parse(message.slice(message.indexOf("\n") + 1));
  } catch {
    throw new ArtifactRejected("MESSAGE_PARSE_FAILURE", "payload JSON inválido");
  }
  return { message, event, bytes, sha256 };
}

export async function resolveIndependentOwnership({
  inscriptionIds,
  fetchImpl = globalThis.fetch,
  ordIndexer = DEFAULT_ORD_INDEXER,
  bitcoinApi = DEFAULT_BITCOIN_API,
  timeoutMs = 15_000,
}) {
  if (typeof fetchImpl !== "function") throw new EvidenceUnavailable("EVIDENCE_UNAVAILABLE", "fetch no disponible");
  const tipHeight = Number(await fetchText(fetchImpl, `${bitcoinApi}/blocks/tip/height`, "Bitcoin tip height", { timeoutMs }));
  if (!Number.isSafeInteger(tipHeight)) throw new EvidenceUnavailable("EVIDENCE_UNAVAILABLE", "Bitcoin tip height inválido");
  const tipHash = (await fetchText(fetchImpl, `${bitcoinApi}/block-height/${tipHeight}`, "Bitcoin tip hash", { timeoutMs })).trim();
  if (!HEX64.test(tipHash)) throw new EvidenceUnavailable("EVIDENCE_UNAVAILABLE", "Bitcoin tip hash inválido");

  const inscriptions = {};
  for (const inscriptionId of inscriptionIds) {
    const metadata = await fetchJson(fetchImpl, `${ordIndexer}/inscription/${inscriptionId}`, `Ord inscription ${inscriptionId}`, { timeoutMs });
    if (metadata?.id !== inscriptionId) throw new AuthorizationError("OWNERSHIP_ID_MISMATCH", inscriptionId);
    const parsed = OUTPOINT.exec(String(metadata.satpoint));
    if (!parsed?.groups) throw new AuthorizationError("INVALID_OWNERSHIP_EVIDENCE", `${inscriptionId}: satpoint`);
    const { txid, vout: voutText } = parsed.groups;
    const vout = Number(voutText);
    const [transaction, outspend] = await Promise.all([
      fetchJson(fetchImpl, `${bitcoinApi}/tx/${txid}`, `Bitcoin transaction ${txid}`, { timeoutMs }),
      fetchJson(fetchImpl, `${bitcoinApi}/tx/${txid}/outspend/${vout}`, `Bitcoin outspend ${txid}:${vout}`, { timeoutMs }),
    ]);
    const output = transaction?.vout?.[vout];
    if (transaction?.txid !== txid || !output) throw new AuthorizationError("INVALID_OWNERSHIP_EVIDENCE", `${inscriptionId}: output`);
    if (metadata.address !== output.scriptpubkey_address) throw new AuthorizationError("OWNERSHIP_SOURCE_MISMATCH", inscriptionId);
    inscriptions[inscriptionId] = {
      inscription_id: inscriptionId,
      output: `${txid}:${vout}`,
      address: output.scriptpubkey_address,
      script_pubkey: output.scriptpubkey,
      confirmed: transaction.status?.confirmed === true,
      confirmation_height: transaction.status?.block_height,
      spent: outspend?.spent,
    };
  }
  return { tip: { height: tipHeight, block_hash: tipHash }, inscriptions };
}

export async function resolvePubliclyAuthorizedName(name, options = {}) {
  const config = BINDING_CONFIGS[name];
  if (!config) return reject("NAME_NOT_AUTHORIZED", name);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (typeof fetchImpl !== "function") return unavailable("EVIDENCE_UNAVAILABLE", "fetch no disponible");

  try {
    const artifactUrl = options.artifactUrl ?? config.artifact_url;
    const artifact = await fetchJson(
      fetchImpl,
      artifactUrl,
      "public authorization artifact",
      { timeoutMs, artifact: true },
    );
    assertArtifactShape(artifact, config);
    const { message, event, bytes, sha256 } = parseCanonicalMessage(artifact, config);

    let ownershipEvidence;
    let resolution;
    if (config.verification_profile === "experiment-22") {
      const verification = await verifyExperiment22Authorization({
        ...event,
        consents: structuredClone(artifact.signatures),
      }, {
        message,
        ownershipResolver: async ({ inscriptionIds }) => {
          ownershipEvidence = await resolveIndependentOwnership({
            inscriptionIds,
            fetchImpl,
            ordIndexer: options.ordIndexer ?? DEFAULT_ORD_INDEXER,
            bitcoinApi: options.bitcoinApi ?? DEFAULT_BITCOIN_API,
            timeoutMs,
          });
          return ownershipEvidence;
        },
      });
      if (verification.result !== "ACCEPT") {
        if (verification.code === "OWNERSHIP_UNAVAILABLE") return unavailable("EVIDENCE_UNAVAILABLE", verification.reason);
        return reject(verification.code, verification.reason);
      }
    } else {
      try {
        ownershipEvidence = await resolveIndependentOwnership({
          inscriptionIds: [config.name_inscription_id, config.district_inscription_id],
          fetchImpl,
          ordIndexer: options.ordIndexer ?? DEFAULT_ORD_INDEXER,
          bitcoinApi: options.bitcoinApi ?? DEFAULT_BITCOIN_API,
          timeoutMs,
        });
      } catch (error) {
        if (error instanceof EvidenceUnavailable) throw error;
        if (error instanceof AuthorizationError) return reject(error.code, error.message);
        throw error;
      }
    }

    const nameResolver = options.nameResolver ?? resolveName;
    try {
      resolution = await nameResolver(name, options.nameResolverOptions ?? {});
    } catch (error) {
      return unavailable("NAME_RESOLUTION_UNAVAILABLE", error instanceof Error ? error.message : String(error));
    }
    if (
      resolution?.parent_inscription_id !== config.name_inscription_id
      || resolution?.resolved_target !== config.target
    ) return reject("BINDING_TARGET_MISMATCH", "el resolver de Name no coincide con la autorización pública");

    if (config.verification_profile === "experiment-25") {
      const { verifyPreparedAuthorization } = await import("../experiment-25/verifier.mjs");
      const verification = verifyPreparedAuthorization({
        name,
        district: config.target,
        binding_id: config.id,
        message,
        message_bytes: bytes,
        message_sha256: sha256,
        authorization: {
          status: "REJECT",
          code: "AUTHORIZATION_ABSENT",
          required_signatures: ["name", "district"],
        },
      }, {
        signatures: {
          name: artifact.signatures.name.signature,
          district: artifact.signatures.district.signature,
        },
        ownershipEvidence,
        resolution,
      });
      if (verification.status !== "ACCEPT") return reject(verification.code, verification.reason);
    }

    return {
      status: "ACCEPT",
      code: "AUTHORIZED_BINDING",
      binding: {
        name,
        target: resolution.resolved_target,
        id: config.id,
        name_inscription_id: config.name_inscription_id,
        district_inscription_id: config.district_inscription_id,
      },
      artifact: {
        url: artifactUrl,
        schema_valid: true,
        message_bytes: bytes,
        message_sha256: sha256,
        name_signature: "VALID",
        district_signature: "VALID",
      },
      ownership: ownershipEvidence,
      resolution,
    };
  } catch (error) {
    if (error instanceof EvidenceUnavailable) return unavailable(error.code, error.message);
    if (error instanceof ArtifactRejected) return reject(error.code, error.message);
    return unavailable("VERIFICATION_UNAVAILABLE", error instanceof Error ? error.message : String(error));
  }
}
