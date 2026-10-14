import assert from "node:assert/strict";
import test from "node:test";

import { resolveName } from "./resolver.mjs";

const parent = `${"a".repeat(64)}i0`;
const earlier = `${"b".repeat(64)}i0`;
const later = `${"c".repeat(64)}i1`;
const unrelatedParent = `${"d".repeat(64)}i0`;
const ordBase = "https://ord.test";
const mempoolBase = "https://bitcoin.test";
const nameIdentity = {
  name: "example.bitmap",
  canonical_inscription_id: parent,
};

function routeFetch(routes, requests) {
  return async (url) => {
    requests.push(url);
    const value = routes[url];
    if (value === undefined) return new Response("missing mock route", { status: 404 });
    if (typeof value === "string") return new Response(value, { status: 200 });
    return Response.json(value);
  };
}

function metadata(id, height) {
  return { id, height };
}

function transaction(id, height, blockHash) {
  return {
    txid: id.slice(0, 64),
    status: { confirmed: true, block_height: height, block_hash: blockHash },
  };
}

test("discovers children from the canonical parent and applies frozen FiF/LiL precedence", async () => {
  const requests = [];
  const earlierBlock = "1".repeat(64);
  const laterBlock = "2".repeat(64);
  const routes = {
    [`${ordBase}/r/children/${parent}/0`]: { ids: [later, earlier], more: false, page: 0 },
    [`${ordBase}/r/parents/${earlier}/0`]: { ids: [parent], more: false, page_index: 0 },
    [`${ordBase}/r/parents/${later}/0`]: { ids: [parent], more: false, page_index: 0 },
    [`${ordBase}/content/${earlier}`]: "100.bitmap",
    [`${ordBase}/content/${later}`]: "200.bitmap",
    [`${ordBase}/r/inscription/${earlier}`]: metadata(earlier, 100),
    [`${ordBase}/r/inscription/${later}`]: metadata(later, 101),
    [`${mempoolBase}/tx/${earlier.slice(0, 64)}`]: transaction(earlier, 100, earlierBlock),
    [`${mempoolBase}/tx/${later.slice(0, 64)}`]: transaction(later, 101, laterBlock),
    [`${mempoolBase}/block/${earlierBlock}/txids`]: ["e".repeat(64), earlier.slice(0, 64)],
    [`${mempoolBase}/block/${laterBlock}/txids`]: [later.slice(0, 64)],
  };

  const result = await resolveName("example.bitmap", {
    nameIdentity,
    fetchImpl: routeFetch(routes, requests),
    ordBase,
    mempoolBase,
  });

  assert.equal(requests[0], `${ordBase}/r/children/${parent}/0`);
  assert.equal(result.parent_inscription_id, parent);
  assert.deepEqual(result.authorized_candidates.map(({ inscription_id }) => inscription_id), [later, earlier]);
  assert.equal(result.selected_child_inscription_id, later);
  assert.equal(result.resolved_target, "200.bitmap");
  assert.deepEqual(result.precedence.selected_key, [101, 0, 1]);
});

test("fails closed when reciprocal parent evidence does not authorize a discovered child", async () => {
  const requests = [];
  const routes = {
    [`${ordBase}/r/children/${parent}/0`]: { ids: [earlier], more: false, page: 0 },
    [`${ordBase}/r/parents/${earlier}/0`]: { ids: [unrelatedParent], more: false, page_index: 0 },
  };

  await assert.rejects(
    resolveName("example.bitmap", {
      nameIdentity,
      fetchImpl: routeFetch(routes, requests),
      ordBase,
      mempoolBase,
    }),
    /does not confirm .* as a direct parent/,
  );
});

test("ignores an authorized child whose exact content is not a numeric .bitmap target", async () => {
  const requests = [];
  const routes = {
    [`${ordBase}/r/children/${parent}/0`]: { ids: [earlier], more: false, page: 0 },
    [`${ordBase}/r/parents/${earlier}/0`]: { ids: [parent], more: false, page_index: 0 },
    [`${ordBase}/content/${earlier}`]: "not-a-district",
  };

  await assert.rejects(
    resolveName("example.bitmap", {
      nameIdentity,
      fetchImpl: routeFetch(routes, requests),
      ordBase,
      mempoolBase,
    }),
    /no authorized numeric \.bitmap child/,
  );
  assert.equal(requests.some((url) => url.startsWith(mempoolBase)), false);
});
