const INSCRIPTION_ID = /^(?<txid>[0-9a-f]{64})i(?<index>0|[1-9][0-9]*)$/;

export function parseInscriptionId(inscriptionId) {
  const match = INSCRIPTION_ID.exec(inscriptionId);
  if (!match?.groups) {
    throw new TypeError(`invalid inscription id: ${inscriptionId}`);
  }

  const index = Number(match.groups.index);
  if (!Number.isSafeInteger(index)) {
    throw new RangeError(`inscription index is not a safe integer: ${match.groups.index}`);
  }

  return { txid: match.groups.txid, index };
}

function canonicalKey(candidate) {
  if (!Number.isSafeInteger(candidate.block_height) || candidate.block_height < 0) {
    throw new TypeError("block_height must be a non-negative safe integer");
  }
  if (!Number.isSafeInteger(candidate.transaction_index) || candidate.transaction_index < 0) {
    throw new TypeError("transaction_index must be a non-negative safe integer");
  }
  if (candidate.authorization !== "ord_direct_parent") {
    throw new TypeError("candidate is not authorized by the frozen #8A predicate");
  }

  const { txid, index } = parseInscriptionId(candidate.inscription_id);
  if (candidate.txid !== undefined && candidate.txid !== txid) {
    throw new TypeError("candidate txid does not match its inscription id");
  }

  return [candidate.block_height, candidate.transaction_index, index];
}

function compareKeys(a, b) {
  for (let position = 0; position < a.length; position += 1) {
    if (a[position] !== b[position]) return a[position] - b[position];
  }
  return 0;
}

export function orderAuthorizedCandidates(candidates) {
  const keyed = candidates.map((candidate) => ({ candidate, key: canonicalKey(candidate) }));
  keyed.sort((a, b) => compareKeys(a.key, b.key));

  for (let position = 1; position < keyed.length; position += 1) {
    if (compareKeys(keyed[position - 1].key, keyed[position].key) === 0) {
      throw new TypeError("duplicate canonical inscription position");
    }
  }

  return keyed.map(({ candidate }) => candidate);
}

export function selectCurrentBinding(candidates) {
  const ordered = orderAuthorizedCandidates(candidates);
  return ordered.at(-1) ?? null;
}
