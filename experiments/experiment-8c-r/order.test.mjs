import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  orderAuthorizedCandidates,
  parseInscriptionId,
  selectCurrentBinding,
} from "./resolver.mjs";
import { reconstructInscriptions } from "./reconstruct-from-transaction.mjs";

const TX_A = "a".repeat(64);
const TX_B = "b".repeat(64);
const TX_CONTROL = "7b7c15dc952cde069a371f4628c05ffe56e164bc272cfd9ef29cd231b6b3a9d1";

function candidate(id, blockHeight, transactionIndex, inscriptionIndex, extra = {}) {
  return {
    id,
    block_height: blockHeight,
    transaction_index: transactionIndex,
    inscription_id: `${extra.txid ?? TX_A}i${inscriptionIndex}`,
    authorization: "ord_direct_parent",
    ...extra,
  };
}

test("A — different blocks are ordered by block_height", () => {
  const later = candidate("later", 101, 0, 0);
  const earlier = candidate("earlier", 100, 99, 9);
  assert.deepEqual(orderAuthorizedCandidates([later, earlier]).map(({ id }) => id), ["earlier", "later"]);
});

test("B — same block is ordered by transaction_index", () => {
  const later = candidate("later", 100, 8, 0, { inscription_number: 1 });
  const earlier = candidate("earlier", 100, 7, 0, { txid: TX_B, inscription_number: 999 });
  assert.deepEqual(orderAuthorizedCandidates([later, earlier]).map(({ id }) => id), ["earlier", "later"]);
});

test("C — same transaction is ordered by the inscription ID index", () => {
  const second = candidate("second", 100, 7, 1);
  const first = candidate("first", 100, 7, 0);
  assert.deepEqual(parseInscriptionId(first.inscription_id), { txid: TX_A, index: 0 });
  assert.deepEqual(orderAuthorizedCandidates([second, first]).map(({ id }) => id), ["first", "second"]);
});

test("D — inscription_number conflict cannot change canonical order", () => {
  const first = candidate("A", 100, 7, 0, { inscription_number: 900 });
  const second = candidate("B", 100, 7, 1, { inscription_number: 2 });
  assert.deepEqual(orderAuthorizedCandidates([second, first]).map(({ id }) => id), ["A", "B"]);
});

test("E — inscription_number may be absent", () => {
  const earlier = candidate("earlier", 100, 0, 0);
  const later = candidate("later", 101, 0, 0);
  assert.equal("inscription_number" in earlier, false);
  assert.deepEqual(orderAuthorizedCandidates([later, earlier]).map(({ id }) => id), ["earlier", "later"]);
});

test("F — existing #8C logical result is preserved where orders agree", () => {
  const first = candidate("first", 100, 0, 0, { inscription_number: 10 });
  const second = candidate("second", 101, 0, 0, { inscription_number: 11 });
  assert.deepEqual(orderAuthorizedCandidates([second, first]).map(({ id }) => id), ["first", "second"]);
});

test("G — LiL selects LAST in corrected FiF order", () => {
  const first = candidate("937336.bitmap", 937336, 130, 0, { txid: TX_CONTROL });
  const current = candidate("937337.bitmap", 937337, 2, 0, { txid: TX_B });
  assert.equal(selectCurrentBinding([current, first]).id, "937337.bitmap");
});

test("H — raw transaction witnesses reconstruct deterministic TXIDiN order without inscription_number", () => {
  const rawTransactionHex = readFileSync(
    new URL("./technology-removal-fixture.hex", import.meta.url),
    "utf8",
  ).trim();
  const { transaction, inscriptions } = reconstructInscriptions(rawTransactionHex);

  assert.equal(transaction.version, 2);
  assert.equal(transaction.inputs.length, 2);
  assert.equal(transaction.outputs.length, 1);
  assert.equal(transaction.locktime, 0);
  assert.deepEqual(
    inscriptions.map(({ input, offset, bodyHex, index }) => ({ input, offset, bodyHex, index })),
    [
      { input: 0, offset: 0, bodyHex: "41", index: 0 },
      { input: 0, offset: 1, bodyHex: "42", index: 1 },
      { input: 1, offset: 0, bodyHex: "43", index: 2 },
    ],
  );
  assert.deepEqual(
    inscriptions.map(({ inscriptionId }) => inscriptionId),
    [`${transaction.txid}i0`, `${transaction.txid}i1`, `${transaction.txid}i2`],
  );

  const candidates = inscriptions.map(({ inscriptionId }, index) => ({
    id: `envelope-${index}`,
    block_height: 100,
    transaction_index: 7,
    inscription_id: inscriptionId,
    authorization: "ord_direct_parent",
  }));
  const expected = ["envelope-0", "envelope-1", "envelope-2"];
  assert.deepEqual(orderAuthorizedCandidates([...candidates].reverse()).map(({ id }) => id), expected);

  const conflictingMetadata = candidates.map((value, index) => ({
    ...value,
    inscription_number: candidates.length - index,
  }));
  assert.deepEqual(
    orderAuthorizedCandidates([...conflictingMetadata].reverse()).map(({ id }) => id),
    expected,
  );
  assert.ok(candidates.every((value) => !("inscription_number" in value)));
  assert.deepEqual(orderAuthorizedCandidates([...candidates].reverse()).map(({ id }) => id), expected);
});
