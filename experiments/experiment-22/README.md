# Experiment #22 — Bilateral authorization

Date: 19 October 2026  
Status: **ACCEPT / LOCAL**

## Meaning of ACCEPT

The local Experiment #22 verifier returned `ACCEPT`: the current holders of the
Name inscription and District inscription supplied valid BIP-322 Simple
signatures over the same frozen 1092-byte message, and the adapter matched both
signers to live on-chain ownership evidence.

This result means **bilateral authorization is verified locally**. It does not
mean the public portal consumes this authorization. Production integration and
deployment are both incomplete.

No signature value is stored in this repository.

## Verified binding

| Role | Human-readable value | Inscription ID | Current signer |
| --- | --- | --- | --- |
| Name | `bitmapverse.bitmap` | `9acf85a192845d64b55d20dcec6af4589cd28dff6f0ad19b73b219f2551a57cbi0` | `bc1p63hr0qrxdwwhygguukrt2fvtsx567d2ry5r9rum9w5wqv2yn5mtq8q0sze` |
| District | `937336.bitmap` | `7b7c15dc952cde069a371f4628c05ffe56e164bc272cfd9ef29cd231b6b3a9d1i0` | `bc1psphv4vlce9f37zqc7jt8w3gnynfxxh3zmjuvxpqv0vjs3t3mcdesyfk5tk` |

Binding:

```text
bitmapverse.bitmap → 937336.bitmap
```

Binding ID: `edc5ae41b465f193cf22cdfad698de5b6c8c23d242b626c0d23c0ff0b4dc82ca`  
Binding ID scheme: `bitmapverse.la-puerta.v0.1`

## Canonical authorization

- Domain: `BITMAPVERSE EXPERIMENT 22 / DISTRICT-HOLDER AUTHORIZATION / v0.1`
- Schema: `bitmapverse.authorization.event.v0.1`
- Scope: `bitmapverse-authorization`
- Encoding: UTF-8
- Length: 1092 bytes
- SHA-256: `bfa6b84854419d3629373ecf66cf6869766c7c606dd279f991941d027e42f833`
- Signatures: BIP-322 Simple, one from each current holder

## Verification method and acceptance criteria

The local bilateral page calls `verifyExperiment22Authorization()` from
`authorization-adapter.mjs`. The adapter reuses `verifyBip322P2TR()` from
Experiment #1 unchanged.

`ACCEPT` requires all of the following:

1. The supplied message is byte-for-byte the canonical Experiment #22 message.
2. Its length and SHA-256 are the frozen values above.
3. Both NAME and DISTRICT signatures are present and valid over those same bytes.
4. Live ownership evidence is available for both exact inscription IDs.
5. Both inscription outputs are confirmed and unspent.
6. Each signer address and script match the corresponding current on-chain holder.
7. Ownership evidence is not older than the authorization snapshot.

Missing signatures, wrong signers, changed IDs, changed message bytes, ownership
mismatch, stale evidence, or unavailable evidence produce `REJECT`. There is no
fallback to controller addresses declared inside the message.

Recorded result:

- NAME signature: `VALID`
- DISTRICT signature: `VALID`
- Current-holder match: `VALID` for both roles
- Output state: confirmed and unspent for both inscriptions
- Adapter result: `ACCEPT`

No block height, transaction detail, or signature value is recorded here beyond
the verified facts returned by the local flow.

## Reproduce locally

From the repository root:

```bash
node experiments/experiment-22/verifier/server.mjs
```

Open:

```text
http://127.0.0.1:8766/
```

Paste the locally held NAME signature and DISTRICT signature into their separate
fields, then select **Verify both signatures**. The successful result is:

```text
ACCEPT — both signatures are valid and both signers are the current on-chain holders.
```

The page sends the signatures only to the loopback server, does not log or store
them, and sends only public inscription identifiers to the external ownership
endpoints.

## Local signature custody

Keep both signatures outside the repository in a local encrypted container or
vault. Store each as a separate entry labelled with:

- role (`NAME` or `DISTRICT`);
- signer address;
- message SHA-256;
- BIP-322 format (`bip322-simple`).

Do not place either signature in source files, fixtures, screenshots, issue
trackers, commits, cloud-synced plain text, or public chat. Keep any backup
encrypted. Private keys and seed phrases are never required for later
verification.

## Completion boundary

- Bilateral authorization verified: **YES — LOCAL**
- Production resolver integration: **NO**
- Public portal consumption: **NO**
- Deployment: **NO**
- Publication of signatures: **NO**

## Next milestone

Recommended next experiment: **Experiment #23 — Production Integration Contract
Dry Run**.

The milestone should define, without deploying, how production obtains an
authorization artifact, validates it with the Experiment #22 adapter, and exposes
an auditable resolution status without weakening live ownership checks.

The first real blocker is the absence of an approved custody and ingestion path
for the two signatures. They currently remain private and outside the repository,
so production has no authorized source from which to obtain the complete
bilateral artifact. This policy decision must be resolved before production code
is changed.
