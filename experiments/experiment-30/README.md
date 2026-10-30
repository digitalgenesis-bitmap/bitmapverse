# Experiment #30 — Snapshot-Bound Issuer Authority Gate

Date: 30 October 2026
Status: **PASS / LOCAL / OFFLINE** — awaiting human review before freeze.

Principle: *Own the District. Authorize the World. Keep the Sovereignty.*

## Question

Was the signer of a delegated build grant (Experiment #28 format) the holder of
`937336.bitmap` at the grant's `authority_snapshot`?

It answers only that question. Every result carries:

```text
current_ownership: false          (no claim about who holds the District now)
build_permission_decided: false   (scope, expiry, revocation and builder stay with Experiment #28)
operational_permission: false     (nothing is permitted operationally)
```

## Interface

```js
verifyIssuerAuthority(grant, { mode, exp29Evidence? | fixture? }) → Promise<result>
```

- `grant`: `{ message, signature }` in the Experiment #28 grant format.
- `mode: "EXP29_FROZEN"`: the gate runs Experiment #29's
  `evaluateHistoricalOwnership` on its committed frozen evidence. The only
  authority it accepts is the Experiment #29 holder at 972169. An optional
  `exp29Evidence` can only replace the raw evidence bytes, which Experiment #29
  still checks against its pinned hashes; a caller cannot supply a holder.
- `mode: "TEST_KEY_FIXTURE"`: a local fixture
  `{ source: "TEST_KEY_FIXTURE", district_inscription_id, authority_snapshot, holder }`.
  A fixture may not present the real historical holder.

## Outcomes

| Result | When | Classification |
| --- | --- | --- |
| `ISSUER_WAS_HISTORICAL_HOLDER_AT_SNAPSHOT` | `EXP29_FROZEN`, all checks pass | Experiment #29's `HISTORICAL / ARCHIVED_INDEXER_LOCATION / BITCOIN_CORROBORATED` |
| `FIXTURE_ISSUER_MATCH` | `TEST_KEY_FIXTURE`, all checks pass | `TEST_KEY_FIXTURE` |
| `DENY` + code | anything else | `null` |

**`ISSUER_WAS_HISTORICAL_HOLDER_AT_SNAPSHOT` is unreachable today.** It
requires a BIP-322 signature by `bc1psphv4vlce9f37zqc7jt8w3gnynfxxh3zmjuvxpqv0vjs3t3mcdesyfk5tk`
over a canonical grant with `authority_snapshot` `{972169, …dd8bbf7}`. No such
signature exists, and none was created. It is not simulated anywhere.

## Checks (fail closed, in order)

1. Options: known mode, and only that mode's inputs (`UNKNOWN_MODE`, `INVALID_OPTIONS`, `AMBIGUOUS_AUTHORITY_INPUT`).
2. Canonical grant: shape, Experiment #28 domain, two lines, exact key set,
   bytes equal to Experiment #28 `grantMessage()`, schema, snapshot and grantor
   controller well-formed (`NO_GRANT`, `MALFORMED_GRANT`, `MESSAGE_MISMATCH`).
3. Grant scope: `937336.bitmap` and inscription `7b7c15dc…a9d1i0` (`WRONG_SCOPE`).
4. Authority source: Experiment #29 must return `HISTORICAL_HOLDER` with its exact
   classification, or the fixture must be well-formed and not claim the real holder
   (`AUTHORITY_EVIDENCE_REJECTED`, `MISSING_AUTHORITY_EVIDENCE`, `INVALID_FIXTURE`,
   `FIXTURE_CLAIMS_REAL_HOLDER`); the authority's District and inscription must match (`WRONG_SCOPE`).
5. Snapshot: grant height and block hash equal the authority snapshot (`SNAPSHOT_NOT_COVERED`).
6. Issuer: grantor address and script equal the authority holder
   (`ISSUER_NOT_HISTORICAL_HOLDER` or `ISSUER_NOT_FIXTURE_HOLDER`).
7. Signature: BIP-322 valid for the grantor over the exact bytes (`INVALID_SIGNATURE`).

The authority source is evaluated before the snapshot comparison so that
evidence failures are reported first. Both modes share the same checks; only
the authority source and labels differ.

## Reuse (unchanged)

- Experiment #1: `verifyBip322P2TR`, `p2trScriptPubKey`; tests use `controllerForSecret`, `signBip322`.
- Experiment #28: `EXPERIMENT_28_PROFILE`, `canonicalGrantPayload`, `grantMessage`, `permissionId`.
- Experiment #29: `EXPERIMENT_29_PROFILE`, `evaluateHistoricalOwnership`, `loadFrozenEvidence`.

No Experiment #28 permission policy (scope of action, object, builder, expiry,
revocation) is reimplemented or reinterpreted.

## Tests

```sh
node --test experiments/experiment-30/issuer-authority-gate.test.mjs
```

Covers: test-key grantor denied against real evidence; real holder with a test-key
signature denied; snapshot height and hash mismatch; Experiment #23 signature replay
(as a message, and attached to a real-holder grant); tampered, missing and absent
Experiment #29 evidence; wrong District and inscription; fixture match; other
fixture key and forged fixture signature; malformed grants; mode and evidence
separation; fixture integrity; claim flags and label separation on every observed
result; byte-identity of the reused frozen implementations.

## Limitations

- Historical issuer authority only. Ownership after the snapshot is not assessed,
  so a District transfer after 972169 is invisible to this gate.
- Real-mode authority inherits Experiment #29's limits: archived two-indexer
  location, provider-corroborated Bitcoin facts, no sat-flow reconstruction, no
  full-node validation.
- The real positive outcome is untested by construction (no real signature).
  The shared code path is exercised through `TEST_KEY_FIXTURE`.
- Not a build permission and not a production authorization system. No wallet,
  no new signatures, no economic settlement.
