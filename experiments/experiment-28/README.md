# Experiment #28 — Delegated Build Permission (local, test-key)

Date: 29 October 2026
Status: **PASS / LOCAL / TEST_KEY_FIXTURE** — awaiting human review before freeze.

Principle: *Own the District. Authorize the World. Keep the Sovereignty.*

## What this experiment shows

A District holder can grant one external builder a scope-limited, expiring,
locally revocable permission to build one object in `937336.bitmap`, verified
with BIP-322 Simple, **without transferring District ownership and without
touching any Name binding**.

Every result — `ALLOW` and `DENY` — carries two labels:

- `authority_mode: "TEST_KEY_FIXTURE"` — the District holder in this experiment is
  a deterministic test key backed by fixture ownership evidence. It is **not** the
  real holder of `937336.bitmap` and the evidence is **not** live ownership.
- `revocation: "LOCAL_ONLY"` — revocation is an explicit local input. It is **not**
  interoperable or on-chain revocation.

## Files

- `permission-verifier.mjs` — `authorizeBuild(request, grant, { ownershipEvidence, revocationState })`
- `permission-verifier.test.mjs` — focused tests
- `README.md` — this document

Reused unchanged from Experiment #1: `verifyBip322P2TR`, `p2trScriptPubKey`
(`resolvers/resolver-js.mjs`) and the test-only helpers `controllerForSecret`,
`signBip322` (`tests/test-support.mjs`). No existing file was modified.

## Grant message

Domain-separated, two lines, no `\r`, no trailing newline, fixed key order
rebuilt by `canonicalGrantPayload()`:

```text
BITMAPVERSE DELEGATED PERMISSIONS / BUILD GRANT / v0.1
{"schema":"bitmapverse.permission.grant.v0.1","district":"937336.bitmap",
 "district_inscription_id":"7b7c15dc952cde069a371f4628c05ffe56e164bc272cfd9ef29cd231b6b3a9d1i0",
 "authority_snapshot":{"height":…,"block_hash":"…"},
 "grantor":{"address":"bc1p…","script_pubkey":"5120…"},
 "grantee":{"address":"bc1p…","script_pubkey":"5120…"},
 "action":"build","object_id":"…","expires_at_height":…,"nonce":"…"}
```

(Shown wrapped; the signed payload is one line.) One BIP-322 Simple signature by
the grantor. `permission_id = SHA-256(message bytes)`. The domain prefix differs
from Experiments #1, #22 and #25, so their signatures cannot be replayed as grants.

`object_id` is an opaque identifier. It is not a renderer or 3D scene reference.

## Decision order (fail closed)

1. Grant absent → `NO_PERMISSION`
2. Request or grant shape, domain, schema or non-canonical bytes → `INVALID_REQUEST` / `MESSAGE_MISMATCH`
3. District, inscription, action, object or builder differ → `WRONG_SCOPE`
4. `evaluation_height < snapshot` → `NOT_YET_VALID`; `evaluation_height >= expires_at_height` → `EXPIRED`
5. Revocation state missing → `REVOCATION_STATE_UNAVAILABLE`; malformed → `REVOCATION_STATE_INVALID`; listed → `REVOKED`
6. Ownership evidence missing, malformed, not labelled `TEST_KEY_FIXTURE`, not at the
   exact `evaluation_height`, unconfirmed, spent, or holder ≠ grantor → `OWNERSHIP_*` / `UNSUPPORTED_EVIDENCE_SOURCE`
7. BIP-322 signature not valid for the grantor → `INVALID_SIGNATURE`
8. Otherwise `ALLOW` / `DELEGATED_BUILD_PERMITTED`

No clock is read: expiry is evaluated against the explicit `evaluation_height`.

Local revocation state:

```json
{"schema":"bitmapverse.permission.revocations.local.v0.1",
 "district":"937336.bitmap",
 "revoked":["<permission_id>", "..."]}
```

`revoked` must contain lowercase hex64 values, strictly ascending (sorted, unique).

## Test fixture

| Item | Value |
|---|---|
| District | `937336.bitmap` (real inscription ID, fixture holder) |
| Grantor | test secret `29n` → `bc1pc3x393cxtkqjazk09rtuhvvljqg7ek0flhegrv8x5w67slfzuldszpsn5l` |
| Builder | test secret `31n` → `bc1pdgj9hakudxzsfjy6yr8aa4sg2v2jk62nxmpgqcakr3juh5nfu66qx9yy87` |
| Object | `test-object-001` |
| Snapshot / expiry | synthetic height 972300 / 972400 (exclusive) |
| Grant bytes | 839 |
| `permission_id` | `970367af64de0fa4108815dfdfa249cbcfe4b848aec8e30c4a0a5ee168dc6b6d` |

Heights and block hashes are synthetic and describe no real Bitcoin block.

## Results

| Case | Result | Code |
|---|---|---|
| No permission | DENY | `NO_PERMISSION` |
| Valid permission | ALLOW | `DELEGATED_BUILD_PERMITTED` |
| Revoked permission | DENY | `REVOKED` |
| Expired permission (at 972400; 972399 still ALLOW) | DENY | `EXPIRED` |
| Invalid signature (signed by builder key) | DENY | `INVALID_SIGNATURE` |
| Wrong District (`937337.bitmap`) | DENY | `WRONG_SCOPE` |
| Wrong object (`test-object-002`) | DENY | `WRONG_SCOPE` |

Additional condition checks: missing revocation state, seven malformed revocation
states, evidence-height mismatch and non-fixture evidence all return `DENY`.

```sh
node --test experiments/experiment-28/permission-verifier.test.mjs
```

12/12 pass, run with networking disabled. Experiment #22/#25 regression: 19/19 pass.

## Boundaries

- Real District-holder authorization: **NO** (test keys only)
- Live ownership evidence: **NO** (fixture only)
- Interoperable / on-chain revocation: **NO** (`LOCAL_ONLY`)
- Builder-signed action (proof the request comes from the builder): **NO**
- Renderer integration, portal, deployment, signatures published: **NO**

`ALLOW` means a valid, unexpired, unrevoked grant exists for this builder,
object and District at the evaluation height. It does not prove who sent the request.
