# Experiment #29 — Frozen Historical District Ownership Evidence

Date: 29 October 2026
Status: **PASS / LOCAL / OFFLINE** — awaiting human review before freeze.

Classification of the only positive result:

```text
HISTORICAL / ARCHIVED_INDEXER_LOCATION / BITCOIN_CORROBORATED
```

## Question

Who controlled `937336.bitmap` (inscription
`7b7c15dc952cde069a371f4628c05ffe56e164bc272cfd9ef29cd231b6b3a9d1i0`) at the
authority snapshot signed in Experiment #23: height **972169**, block hash
`00000000000000000000634ef8bc8d9e4d893a836896b62a3e9bab888dd8bbf7`?

## Answer (as evaluated from frozen evidence)

`bc1psphv4vlce9f37zqc7jt8w3gnynfxxh3zmjuvxpqv0vjs3t3mcdesyfk5tk`, controlling
output `75918e8617c3dfa078e23781475dd50089bf042878dc9f540017c89bbb836818:15`
(330 sats, script `5120806e…3bc373`).

## Reasoning chain

1. **Bitcoin (two providers, byte-identical):** the transaction is confirmed at
   height 942807; output 15 was unspent at capture tip 973731; the block hash at
   972169 equals the signed snapshot.
2. **Independent parse:** the raw transaction recomputes to the expected txid,
   and output 15's script derives to the controller address (bech32m encoder
   cross-checked against the unchanged Experiment #1 `p2trScriptPubKey`).
3. **Unspent window:** created at 942807 and unspent at 973731 ⇒ unspent
   throughout 942807–973731, which contains 972169.
4. **Archived location (Experiment #0, two indexers):** at snapshot 959531,
   Ord and Ordinals Wallet placed the District at satpoint `75918e86…:15:0`,
   address `bc1psphv…`, output created at 942807.
5. A sat cannot leave an unspent output, so the sat observed in `:15` at 959531
   was still there at 972169.

## Files

```text
experiments/experiment-29/
  ownership-evaluator.mjs          evaluateHistoricalOwnership(), loadFrozenEvidence()
  ownership-evaluator.test.mjs     offline tests
  README.md
  evidence/bitcoin-capture/        10 raw API responses, byte-exact as captured
  evidence/experiment-0-archive/   byte-exact copies of experiment-0/experiment.json and SOURCE_LEDGER.md
```

The evaluator pins the SHA-256 of all 12 evidence files. The originals in
`experiments/experiment-0/` and `~/exp29-capture/` were not modified.

## Evidence

Captured from the user's Mac on 2026-10-29, around 19:57–19:58 UTC (file
modification times), with unauthenticated public GET requests to the
mempool.space and blockstream.info Esplora APIs.

| Evidence (per provider) | SHA-256 (identical for both) |
| --- | --- |
| `block-height_972169` | `4f53f288b1838d9cff521de3bfdf968e138d509091cff48a6f774c755c183f3a` |
| `blocks_tip_height` | `a46c6c26085206d3393d8ae76103a6a640b579d2887b775ef5d2bd750c00a737` |
| `tx_…_hex` | `f62c812a8fcc685ed657d3096bb70e6ccbf0b1b3381b284d978e270ba3ef2efa` |
| `tx_…_outspend_15` | `fe90f0c1e4023e0cd38fd6d2132c1382dd614fed61e6aebf05d19c52a8e65a1b` |
| `tx_…_status` | `35388c57b31d8d1b1166075b82c89b2e30b5ed5660edb00e9837db2068d93ba2` |

| Archived Experiment #0 file | SHA-256 |
| --- | --- |
| `experiment.json` (observed 2026-08-24, snapshot 959531) | `07ec99d5da476d74112e26b9dcf5f1df014a3d41a66fe816ba0bfb3832e1d848` |
| `SOURCE_LEDGER.md` | `11adab8ba5dc0613862ee02addbdd3f42af9c906a53e05e5487a80aa8491f933` |

## Fail-closed checks

Any failure returns `REJECT` with a code and a `null` classification:
`MISSING_EVIDENCE`, `UNEXPECTED_EVIDENCE`, `HASH_MISMATCH`, `MALFORMED_EVIDENCE`,
`PROVIDER_DISAGREEMENT`, `SNAPSHOT_HASH_MISMATCH`, `UNCONFIRMED_OUTPUT`,
`CREATED_AFTER_SNAPSHOT`, `TIP_NOT_AFTER_SNAPSHOT`, `OUTPUT_SPENT_AT_CAPTURE`,
`TXID_MISMATCH`, `NOT_P2TR_OUTPUT`, `CONTROLLER_MISMATCH`,
`ARCHIVED_RECORD_INVALID`, `ARCHIVED_LOCATION_MISMATCH`,
`ARCHIVED_PROVENANCE_MISSING`, `OBSERVATION_OUTSIDE_UNSPENT_WINDOW`.

A spent output is rejected rather than evaluated, because no spend height was captured.

```sh
node --test experiments/experiment-29/ownership-evaluator.test.mjs
```

## Limitations

- The inscription-to-output link is an **archived two-indexer observation**
  (Ord, Ordinals Wallet). It is not a Bitcoin fact, and no raw indexer
  responses exist for it.
- **No sat-flow reconstruction.** This is not independently reconstructed
  ordinal ownership.
- **No full-node validation.** Bitcoin facts come from two third-party Esplora
  operators; headers, proof-of-work and merkle inclusion were not verified.
- **Historical only.** It says nothing about control after the capture tip.
- **Not delegated building authority.** The Experiment #23 District signature
  is a Name-binding signature over a different message; it is not a build
  grant. Experiment #28 is unchanged and still accepts only `TEST_KEY_FIXTURE`.
- No economic or block-clock contractual functionality.
