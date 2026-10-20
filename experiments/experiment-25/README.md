# Experiment #25 — Multi-Name → one District authorization

Status: **CLOSED / ACCEPT LOCAL**.

The existing `bitmapverse.bitmap → 937336.bitmap` authorization remains
`ACCEPT` through Experiment #24. Two additional independent bindings were
verified locally with separate bilateral authorizations:

| Name | Binding ID | Message bytes | SHA-256 | Status |
|---|---|---:|---|---|
| `bitmapworld.bitmap` | `fadf51c521a5f9c94e5303aa6d6826a689269371403d70da67dfaf7d04bf9dde` | 1080 | `3de168c726f012be3a96f40430f759fcd481d227cb07f750669f50911fec9d7f` | `ACCEPT / LOCAL` |
| `bitmapmetaverse.bitmap` | `9687364ecb3e6c93d8ab365ad334f8be6eb402b42921d561d4361cefeda18fa9` | 1080 | `2e16880d1f06d8977779e8bbe9d8a5550518b10565c80cd12b4d9729129e7ba5` | `ACCEPT / LOCAL` |

Both messages use schema `bitmapverse.authorization.event.v0.1`, scope
`bitmapverse-authorization`, the existing binding ID scheme and the unchanged
BIP-322 Simple verification path. The exact strings are frozen in
`prepared-bindings.json`. Each message has a valid signature from its current
Name holder and a separate valid signature from the current District holder.

## Live ownership evidence

The final verification at Bitcoin tip 972232 used Ordinals Wallet for current
inscription location/holder and Mempool.space for Bitcoin tip, transaction,
script, confirmation and outspend evidence:

- `bitmapworld.bitmap` is held at
  `9893d5619a626a5a948b5ea3fd533bdf897e98dd73b5dbedf221c20e01b22465:1`
  by `bc1pupqk7jjtm7mucm9uvr2324c8jpm467ncgsy5zwe0g8szt906jk7s08k5jq`.
- `bitmapmetaverse.bitmap` is held at
  `a5009425c3ed020d5ebc3ca895fd484547d486cdc33e49518bd099352e184e38:1`
  by the same current Name holder.
- `937336.bitmap` is held at
  `75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818:15`
  by `bc1psphv4vlce9f37zqc7jt8w3gnynfxxh3zmjuvxpqv0vjs3t3mcdesyfk5tk`.

All three outputs were confirmed and unspent, and the live Name resolver
returned `937336.bitmap` for both new Names. Blockstream was attempted first but
timed out; the existing provider injection was used without changing any
acceptance condition. Exact inscription content had already been checked
through ordinals.com.

## Private evidence and reproducibility

The four signatures remain private and are not copied into this document:

- `outputs/experiment-25/bitmapworld.name.bip322`
- `outputs/experiment-25/bitmapworld.district.bip322`
- `outputs/experiment-25/bitmapmetaverse.name.bip322`
- `outputs/experiment-25/bitmapmetaverse.district.bip322`

`outputs/` is ignored by Git. Each signature file was written with mode `600`.
`verifier.mjs` reads those paths locally, checks both signatures against the
exact frozen message, resolves current holders/UTXO, and checks compatibility
with the existing Name resolver. `verify-live.mjs` runs that complete path.

Closure evidence:

- both new bilateral authorizations: `ACCEPT`;
- the existing Experiment #23/#24 binding: `ACCEPT`;
- three unique binding IDs coexist over one District;
- signature reuse across Names: `REJECT`;
- unavailable provider evidence: `UNAVAILABLE`;
- focused tests: 18/18 pass;
- no signature publication, portal integration, production change or deploy.

## First blocker after closure

An independent third party cannot recompute the two new `ACCEPT` results until
the four private signatures and their two frozen messages are made available in
public evidence artifacts. Publication has not been authorized. No new signing
or authorization rule is required.
