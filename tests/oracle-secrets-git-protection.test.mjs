import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

function git(args) {
  return execFileSync("git", args, { cwd: projectRoot.pathname, encoding: "utf8" });
}

test(".gitignore excludes /oracle/reserved/", async () => {
  const gitignore = await readFile(new URL(".gitignore", projectRoot), "utf8");
  assert.match(gitignore, /^\/oracle\/reserved\/$/m);
});

test("git does not track any file under oracle/reserved/ (does not rely on .gitignore alone)", () => {
  // git ls-files only reports what's in the index — this holds even for a
  // file that predates .gitignore, so this is a real tracked-state check,
  // not just a re-statement of the ignore rule.
  const tracked = git(["ls-files", "oracle/reserved"]).trim();
  assert.equal(tracked, "", `git is tracking file(s) under oracle/reserved/:\n${tracked}`);
});

test("git would ignore new files placed under oracle/reserved/", () => {
  // Sanity-check the .gitignore rule actually takes effect, not just that
  // it's textually present. Uses the real, currently-present Prueba A
  // oracle file (already on disk, never staged) as the probe path.
  let exitCode = 0;
  try {
    git(["check-ignore", "-q", "oracle/reserved/same-sat-latest-v01.oracle.json"]);
  } catch (error) {
    exitCode = error.status;
  }
  assert.equal(exitCode, 0, "expected oracle/reserved/* to be reported as git-ignored");
});

test("oracle/reserved/b1-v0.2/ no longer exists in the repository tree", async () => {
  let entries;
  try {
    entries = await readdir(new URL("oracle/reserved/", projectRoot));
  } catch {
    entries = [];
  }
  assert.equal(entries.includes("b1-v0.2"), false);
});

test("the v0.2.1 nonce never leaks into any tracked-or-trackable repo file", async () => {
  // The nonce is the one value in the reserved oracle that is genuinely,
  // uniquely secret: a fresh random 32 bytes with no legitimate reason to
  // exist anywhere but the private folder. This is a real repo-wide scan,
  // not scoped to blind/v0.2.1/ — if this ever fires, .gitignore alone
  // did not prevent a leak; something *wrote* the nonce into a tracked
  // file, which is exactly the risk this guards against.
  //
  // Deliberately NOT scanning repo-wide for the oracle's inscription
  // IDs/sats/content hashes here: those describe 507999.bitmap and
  // 7187.bitmap, the same two Districts Prueba A already resolved and
  // published (fixtures/507999.snapshot.json, blind/v0.1/fixtures/*,
  // conformance/proof-a-v0.1/report.json, tests/same-sat-latest-v01.test.mjs,
  // blind/audits/proof-a-001.md — all legitimately, historically public
  // well before this task). Scanning the whole repo for those values
  // would flag dozens of already-verified historical files as "leaking"
  // facts that were never secret to begin with. The meaningful check for
  // those values is narrower and scoped: does blind/v0.2.1/ itself (the
  // new blind package) reference them? That's covered by
  // tests/blind-v021-package.test.mjs, mirroring the same check already
  // proven for blind/v0.2/.
  const PRIVATE_ROOT = process.env.BITMAPVERSE_PRIVATE_DIR
    ? `${process.env.BITMAPVERSE_PRIVATE_DIR}/bitmapverse/oracle/b1-v0.2.1`
    : null;
  const nonceHex = (await readFile(`${PRIVATE_ROOT}/nonce.hex`, "utf8")).trim();
  assert.match(nonceHex, /^[0-9a-f]{64}$/);

  // "Files git would track" = respects .gitignore automatically.
  const candidateFiles = git(["ls-files", "--others", "--cached", "--exclude-standard"])
    .split("\n")
    .filter(Boolean);

  const offenders = [];
  for (const relative of candidateFiles) {
    let content;
    try {
      content = await readFile(new URL(relative, projectRoot), "utf8");
    } catch {
      continue; // binary or unreadable — not a text leak vector
    }
    if (content.includes(nonceHex)) {
      offenders.push(relative);
    }
  }
  assert.deepEqual(offenders, []);
});
