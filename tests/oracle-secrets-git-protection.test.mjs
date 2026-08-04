// Public, CI-safe checks only. The nonce leak-scan that requires reading
// the real private nonce moved to tests/private-oracle-audit.test.mjs
// (npm run test:private-audit, local-only, not part of npm run test:all).
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

// The repo-wide nonce leak-scan requires reading the real private nonce
// (a fresh random 32 bytes with no legitimate reason to exist anywhere but
// the private folder). That real-secret read must not happen as part of
// the default, CI-safe suite — see tests/private-oracle-audit.test.mjs
// (npm run test:private-audit, local-only) for that check.
