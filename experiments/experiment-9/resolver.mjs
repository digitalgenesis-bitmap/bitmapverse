import { readFile } from "node:fs/promises";

import { selectCurrentBinding } from "../experiment-8c-r/resolver.mjs";

const INSCRIPTION_ID = /^(?<txid>[0-9a-f]{64})i(?<index>0|[1-9][0-9]*)$/;
const DISTRICT = /^[0-9]+\.bitmap$/;
const defaultNameIdentityUrl = () => new URL("../../data/bitmapverse-name-identity.json", import.meta.url);
const DEFAULT_ORD_BASE = "https://ordinals.com";
const DEFAULT_MEMPOOL_BASE = "https://mempool.space/api";

function requireValue(condition, message) {
  if (!condition) throw new Error(`Experiment #9: ${message}`);
}

async function responseJson(fetchImpl, url) {
  const response = await fetchImpl(url);
  requireValue(response.ok, `${url} returned HTTP ${response.status}`);
  return response.json();
}

async function responseText(fetchImpl, url) {
  const response = await fetchImpl(url);
  requireValue(response.ok, `${url} returned HTTP ${response.status}`);
  return response.text();
}

export function canonicalParentForName(name, nameIdentity) {
  const identities = [nameIdentity, nameIdentity?.additional_identity]
    .filter((identity) => identity?.name === name);
  requireValue(identities.length === 1, `canonical identity source has ${identities.length} matches for ${name}`);
  const parent = identities[0].canonical_inscription_id;
  requireValue(INSCRIPTION_ID.test(parent), `canonical parent for ${name} is not a valid inscription ID`);
  return parent;
}

async function enumerateChildren(parent, fetchImpl, ordBase) {
  const ids = [];
  for (let page = 0; ; page += 1) {
    const result = await responseJson(fetchImpl, `${ordBase}/r/children/${parent}/${page}`);
    requireValue(result.page === page, `unexpected children page ${result.page}`);
    requireValue(Array.isArray(result.ids), `children page ${page} has no ids array`);
    requireValue(result.ids.every((id) => INSCRIPTION_ID.test(id)), `children page ${page} has an invalid ID`);
    ids.push(...result.ids);
    requireValue(result.more === true || result.more === false, `children page ${page} has invalid more flag`);
    if (!result.more) break;
  }
  requireValue(new Set(ids).size === ids.length, "children endpoint returned a duplicate ID");
  return ids;
}

async function validateDirectParent(child, parent, fetchImpl, ordBase) {
  const ids = [];
  for (let page = 0; ; page += 1) {
    const result = await responseJson(fetchImpl, `${ordBase}/r/parents/${child}/${page}`);
    requireValue(Array.isArray(result.ids), `parents page ${page} for ${child} has no ids array`);
    ids.push(...result.ids);
    requireValue(result.more === true || result.more === false, `parents page ${page} for ${child} has invalid more flag`);
    if (!result.more) break;
  }
  requireValue(ids.includes(parent), `${child} does not confirm ${parent} as a direct parent`);
}

async function canonicalPosition(child, fetchImpl, ordBase, mempoolBase, blockTxids) {
  const parsed = INSCRIPTION_ID.exec(child);
  requireValue(parsed?.groups, `invalid child inscription ID ${child}`);
  const { txid } = parsed.groups;

  const [inscription, transaction] = await Promise.all([
    responseJson(fetchImpl, `${ordBase}/r/inscription/${child}`),
    responseJson(fetchImpl, `${mempoolBase}/tx/${txid}`),
  ]);
  requireValue(inscription.id === child, `Ord metadata ID mismatch for ${child}`);
  requireValue(transaction.txid === txid, `Bitcoin transaction ID mismatch for ${child}`);
  requireValue(transaction.status?.confirmed === true, `${child} is not confirmed`);
  requireValue(
    inscription.height === transaction.status.block_height,
    `Ord and Bitcoin height mismatch for ${child}`,
  );
  const blockHash = transaction.status.block_hash;
  requireValue(typeof blockHash === "string", `missing block hash for ${child}`);

  let txids = blockTxids.get(blockHash);
  if (!txids) {
    txids = await responseJson(fetchImpl, `${mempoolBase}/block/${blockHash}/txids`);
    requireValue(Array.isArray(txids), `block ${blockHash} has no transaction list`);
    blockTxids.set(blockHash, txids);
  }
  const transactionIndex = txids.indexOf(txid);
  requireValue(transactionIndex >= 0, `${txid} is absent from block ${blockHash}`);

  return {
    block_height: transaction.status.block_height,
    block_hash: blockHash,
    transaction_index: transactionIndex,
    txid,
  };
}

export async function resolveName(name, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  requireValue(typeof fetchImpl === "function", "fetch implementation is unavailable");
  const ordBase = options.ordBase ?? DEFAULT_ORD_BASE;
  const mempoolBase = options.mempoolBase ?? DEFAULT_MEMPOOL_BASE;
  const nameIdentity = options.nameIdentity
    ?? JSON.parse(await readFile(options.nameIdentityUrl ?? defaultNameIdentityUrl(), "utf8"));

  const parent = canonicalParentForName(name, nameIdentity);
  const discoveredChildren = await enumerateChildren(parent, fetchImpl, ordBase);
  const candidates = [];
  const blockTxids = new Map();

  for (const child of discoveredChildren) {
    await validateDirectParent(child, parent, fetchImpl, ordBase);
    const content = await responseText(fetchImpl, `${ordBase}/content/${child}`);
    if (!DISTRICT.test(content)) continue;
    const position = await canonicalPosition(child, fetchImpl, ordBase, mempoolBase, blockTxids);
    candidates.push({
      inscription_id: child,
      content,
      authorization: "ord_direct_parent",
      ...position,
    });
  }

  const selected = selectCurrentBinding(candidates);
  requireValue(selected !== null, `no authorized numeric .bitmap child was discovered for ${name}`);

  return {
    input: name,
    parent_inscription_id: parent,
    discovery_mechanism: "ordinals.com /r/children pagination + reciprocal /r/parents validation",
    discovered_child_count: discoveredChildren.length,
    qualifying_authorized_child_count: candidates.length,
    authorized_candidates: candidates,
    precedence: {
      rule: "FiF(block_height, transaction_index, inscription_id index); LiL selects LAST",
      selected_key: [
        selected.block_height,
        selected.transaction_index,
        Number(INSCRIPTION_ID.exec(selected.inscription_id).groups.index),
      ],
    },
    selected_child_inscription_id: selected.inscription_id,
    resolved_target: selected.content,
    external_dependencies: ["https://ordinals.com", "https://mempool.space/api"],
  };
}
