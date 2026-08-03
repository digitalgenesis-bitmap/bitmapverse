import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyDraftManifest } from "../scripts/b1-prep-v022/verify-draft-manifest.mjs";

test("PACKAGE_MANIFEST.draft.json is fully synchronized with the files on disk", async () => {
  const { valid, errors } = await verifyDraftManifest();
  assert.deepEqual(errors, []);
  assert.equal(valid, true);
});
