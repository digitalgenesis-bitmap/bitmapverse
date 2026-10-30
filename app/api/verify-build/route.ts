/// <reference types="vite/client" />
// Experiment #32 — server-only permission decision for one 3D object.
//
// Runs the unchanged Experiment #31 evaluator (Experiment #29 historical evidence,
// Experiment #30 issuer authority, Experiment #28 permission policy) over the frozen
// evidence bundled into this server route at build time. The browser receives only
// ALLOW or DENY plus non-sensitive metadata; never evidence, signatures or internals.
//
// Scope: a historical local demonstration at captured Bitcoin height 973822,
// not a live authorization at the current height.

import { EXPERIMENT_28_PROFILE, grantMessage } from "../../../experiments/experiment-28/permission-verifier.mjs";
import { evaluateRealBuild } from "../../../experiments/experiment-31/real-build-evaluator.mjs";
import h0 from "../../../experiments/experiment-29/evidence/bitcoin-capture/mempool.space.block-height_972169?raw";
import h1 from "../../../experiments/experiment-29/evidence/bitcoin-capture/mempool.space.blocks_tip_height?raw";
import h2 from "../../../experiments/experiment-29/evidence/bitcoin-capture/mempool.space.tx_75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818_hex?raw";
import h3 from "../../../experiments/experiment-29/evidence/bitcoin-capture/mempool.space.tx_75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818_outspend_15?raw";
import h4 from "../../../experiments/experiment-29/evidence/bitcoin-capture/mempool.space.tx_75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818_status?raw";
import h5 from "../../../experiments/experiment-29/evidence/bitcoin-capture/blockstream.info.block-height_972169?raw";
import h6 from "../../../experiments/experiment-29/evidence/bitcoin-capture/blockstream.info.blocks_tip_height?raw";
import h7 from "../../../experiments/experiment-29/evidence/bitcoin-capture/blockstream.info.tx_75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818_hex?raw";
import h8 from "../../../experiments/experiment-29/evidence/bitcoin-capture/blockstream.info.tx_75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818_outspend_15?raw";
import h9 from "../../../experiments/experiment-29/evidence/bitcoin-capture/blockstream.info.tx_75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818_status?raw";
import h10 from "../../../experiments/experiment-29/evidence/experiment-0-archive/experiment.json?raw";
import h11 from "../../../experiments/experiment-29/evidence/experiment-0-archive/SOURCE_LEDGER.md?raw";
import c0 from "../../../experiments/experiment-31/evidence/bitcoin-capture/mempool.space.blocks_tip_height?raw";
import c1 from "../../../experiments/experiment-31/evidence/bitcoin-capture/mempool.space.blocks_tip_hash?raw";
import c2 from "../../../experiments/experiment-31/evidence/bitcoin-capture/mempool.space.tx_75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818_outspend_15?raw";
import c3 from "../../../experiments/experiment-31/evidence/bitcoin-capture/blockstream.info.blocks_tip_height?raw";
import c4 from "../../../experiments/experiment-31/evidence/bitcoin-capture/blockstream.info.blocks_tip_hash?raw";
import c5 from "../../../experiments/experiment-31/evidence/bitcoin-capture/blockstream.info.tx_75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818_outspend_15?raw";

const EXP29_EVIDENCE: Record<string, string> = {
  "bitcoin-capture/mempool.space.block-height_972169": h0,
  "bitcoin-capture/mempool.space.blocks_tip_height": h1,
  "bitcoin-capture/mempool.space.tx_75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818_hex": h2,
  "bitcoin-capture/mempool.space.tx_75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818_outspend_15": h3,
  "bitcoin-capture/mempool.space.tx_75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818_status": h4,
  "bitcoin-capture/blockstream.info.block-height_972169": h5,
  "bitcoin-capture/blockstream.info.blocks_tip_height": h6,
  "bitcoin-capture/blockstream.info.tx_75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818_hex": h7,
  "bitcoin-capture/blockstream.info.tx_75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818_outspend_15": h8,
  "bitcoin-capture/blockstream.info.tx_75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818_status": h9,
  "experiment-0-archive/experiment.json": h10,
  "experiment-0-archive/SOURCE_LEDGER.md": h11,
};

const CAPTURE: Record<string, string> = {
  "bitcoin-capture/mempool.space.blocks_tip_height": c0,
  "bitcoin-capture/mempool.space.blocks_tip_hash": c1,
  "bitcoin-capture/mempool.space.tx_75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818_outspend_15": c2,
  "bitcoin-capture/blockstream.info.blocks_tip_height": c3,
  "bitcoin-capture/blockstream.info.blocks_tip_hash": c4,
  "bitcoin-capture/blockstream.info.tx_75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818_outspend_15": c5,
};

const DISTRICT = "937336.bitmap";
const OBJECT_ID = "inert-test-object-001";
const BUILDER = "bc1pv40yl4jyne02pulahpdrl98d2x3z9yd7g3c9kzm4ktyz69mdwe2qhmmrqz";
const EVALUATION_HEIGHT = 973822;

// The real grant signed by the owner wallet (UniSat, BIP-322 Simple), verified in Experiments #30 and #31.
const GRANT = {
  message: grantMessage({
    schema: EXPERIMENT_28_PROFILE.schema,
    district: DISTRICT,
    district_inscription_id: EXPERIMENT_28_PROFILE.district_inscription_id,
    authority_snapshot: { height: 972169, block_hash: "00000000000000000000634ef8bc8d9e4d893a836896b62a3e9bab888dd8bbf7" },
    grantor: {
      address: "bc1psphv4vlce9f37zqc7jt8w3gnynfxxh3zmjuvxpqv0vjs3t3mcdesyfk5tk",
      script_pubkey: "5120806ecab3f8c9531f0818f49677451324d2635e22dcb8c3040c7b2508ae3bc373",
    },
    grantee: {
      address: BUILDER,
      script_pubkey: "5120655e4fd6449e5ea0f3fdb85a3f94ed51a22291be44705b0b75b2c82d176d7654",
    },
    action: "build",
    object_id: OBJECT_ID,
    expires_at_height: 976201,
    nonce: "cf87497d4c3ceac199fe773fb05dd6dd0c1d9b400cd89f364418c943d4cb9cfc",
  }),
  signature: "AUBTQqumuDdg50A1TuQFfi0Hw4oEH2PA2SG5BtALOzQ5mD7+AANZkPMcs2LLY4hsrEFRx8yxFw3q6gtNGJji8m4A",
};

const REVOCATION_STATE = {
  schema: EXPERIMENT_28_PROFILE.revocation_schema,
  district: DISTRICT,
  revoked: [] as string[],
};

const toBytes = (files: Record<string, string>) =>
  Object.fromEntries(Object.entries(files).map(([path, text]) => [path, Buffer.from(text, "utf8")]));

// Query parameters are request inputs only; the decision is always computed here.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const objectId = params.get("object") ?? OBJECT_ID;
  const builder = params.get("builder") ?? BUILDER;

  let result: "ALLOW" | "DENY" = "DENY";
  try {
    const decision = await evaluateRealBuild(
      { district: DISTRICT, object_id: objectId, builder_address: builder, evaluation_height: EVALUATION_HEIGHT },
      GRANT,
      { revocationState: REVOCATION_STATE, capture: toBytes(CAPTURE), exp29Evidence: toBytes(EXP29_EVIDENCE) },
    );
    if (decision.result === "ALLOW") result = "ALLOW";
  } catch {
    result = "DENY";
  }

  return Response.json(
    {
      result,
      district: DISTRICT,
      object_id: objectId,
      evaluation_height: EVALUATION_HEIGHT,
      scope: "HISTORICAL_LOCAL_DEMONSTRATION",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
