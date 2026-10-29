# Experiment 0 — Source Ledger

Observed on `2026-08-24`. All operations were read-only.

## Normative decision recorded before final result

On `2026-08-24`, while Experiment 0 remained `BLOCKED`, the original
two-complete-reconstruction PASS requirement was replaced by a
claim-level-independence requirement: reproducible primary reconstruction plus
provenance-separated independent verification of snapshot, decisive
inscriptions, decisive-prefix completeness, order, normalization and winner
selection. A single uncontrasted reconstruction remains insufficient; two full
independent OPI stacks remain valid but optional. The expected authority outputs
were not changed.

| Role | Source | Observation | Limitation |
|---|---|---|---|
| Snapshot identity | Blockstream public Bitcoin API | Height `959531` maps to `000000000000000000008d94f099ecc2e05da35160cabb2c3d6332db0130269e` | Independent operator, not a locally verified header chain |
| Candidate discovery | UniSat text search plus byte-exact Ord content checks | 1 result and 1 exact candidate for `freedeon.bitmap`; 4 substring matches but only 1 exact candidate for `bitmapverse.bitmap`; 1 result and 1 exact candidate for `937336.bitmap` | Search index is not a version-pinned OPI reconstruction |
| Ord inscription facts | `ordinals.com` recursive endpoints | IDs, numbers, heights, content types, contents, sats, outputs, satpoints and addresses | Server implementation/version was not exposed by the response |
| Independent location check | Ordinals Wallet public API | Matching inscription numbers, heights, content metadata, satpoints and addresses for the four authority inscriptions | No public SNS-by-name enumeration endpoint found |
| SNS operator attempt | OrdinalsBot documented OPI/SNS API | Anonymous calls returned HTTP 403 | API key or allow-list access is required |
| Existing evidence | `fixtures/507999.snapshot.json` | Frozen `507999.bitmap` original inscription, sat, candidates and selected state at the same snapshot | Does not establish SNS authority or Name-to-District binding |
| OPI semantics | Best in Slot OPI | Commit `da24fb6cf4c2ef3f99d030ea2ef18ba9099b0633` defines the SNS and Bitmap winner rules | Running a fully independent instance requires Bitcoin/Ord/PostgreSQL infrastructure |
| Pinned SNS source audit | Raw files from Best in Slot OPI commit `da24fb6c…` | `sns_index.py` SHA-256 `baec46bc375ae8a86447d9a148361cdd94d2e28d4b69d5693384e1ab45769c62`; `sns_api/api.js` SHA-256 `5c9d9a0a10e560956af4cf80f7b701d9063cb1ac5463528228e6a542133abfc7` | Fixes semantics and API shape, but is code evidence rather than an independently rebuilt index |
| Pinned SNS ingest order | `ord/db_reader/src/server.rs` plus `modules/sns_index/sns_index.py` at commit `da24fb6c…` | Blocks are consumed ascending; candidates within a block are sorted by `inscription_number` ascending; unique `name` insertion makes the first accepted normalized registration win | Requires the complete eligible inscription stream to reproduce a winner |
| Pinned SNS snapshot-route audit | `modules/sns_api/api.js` at commit `da24fb6c…` | `get_hash_of_all_activity` reads `request.params.block_height`, but its route contains no `:block_height` component | A query parameter does not select height under the pinned code; snapshot evidence needs an operator-specific corrected endpoint or direct database export |
| Independent OPI access retry | OrdinalsBot documented OPI/SNS API | HTTP `403` for both target lookups and `get_hash_of_all_activity` at height `959531` | Requires API key or allow-listed origin; no response body establishing winners or hashes was available |
| Alternative API access check | Best in Slot V3 API documentation | Documentation states all plans require an API key | No authorized key or pre-existing browser session was available; not counted as a reconstruction |
| Revised-criterion snapshot check | Ord recursive endpoint, Blockstream Esplora API, mempool.space Esplora API | All three mapped height `959531` to `000000000000000000008d94f099ecc2e05da35160cabb2c3d6332db0130269e` | Snapshot boundary independently corroborated |
| Decisive content check | Ord recursive inscription endpoint and Ordinals Wallet metadata/content endpoints | Both operators returned the same IDs, inscription numbers, genesis heights, MIME types and exact texts for the two Names and `937336.bitmap` | Decisive existence/content boundary independently corroborated |
| Raw Bitcoin transaction check | Blockstream and mempool.space raw-transaction endpoints | Both sources returned byte-identical reveal transactions for all three decisive inscriptions; SHA-256 values are recorded in `critical-claims-evidence.json` | Confirms separate Bitcoin provenance for the bytes consumed by inscription parsers |
| Inclusion and order fields | Blockstream and mempool.space transaction-status endpoints | Both matched each decisive transaction's confirmation height and block hash; Ord and Ordinals Wallet matched global inscription numbers | Establishes order for known rows, not absence of an unobserved earlier row |
| Clean-room replay | Local `verify-critical-claims.py` over frozen `critical-claims-evidence.json` | Reproduced both expected SNS IDs and the `937336.bitmap` ID on the observed stream; emitted global `BLOCKED` | Independent rule replay; fails closed because complete-prefix evidence is false |
| Alternative public SQL route | Dune public Ordinals/Sats Names dashboard | Public query was not runnable anonymously, displayed an incompatible-query warning and explicitly warned its decoding should not be used to check existing names | Rejected as completeness evidence |
| Legacy Sats Names route | Historical `api.sats.id` endpoints | Host did not resolve during repeated read-only checks | No evidence obtained |
| Alternative full index API | Hiro Ordinals API source/documentation | Deprecated deployment requires Ordhook/full database/PostgreSQL; inscription list filtering has no raw-content predicate | Would require a broad scan and is not an hours-scale completeness check |

## Independently matching authority locations

| Object | Inscription ID | Snapshot controller address | Evidence status |
|---|---|---|---|
| `freedeon.bitmap` candidate winner | `54cddbef036061623679d1b7e608704da0268c83fb822430375782c62960f446i0` | `bc1pv40yl4jyne02pulahpdrl98d2x3z9yd7g3c9kzm4ktyz69mdwe2qhmmrqz` | Ord and Ordinals Wallet match; output unspent since genesis |
| `507999.bitmap` | `2505f63d9bf8aad28ddfc7b6dc49e0fa38a3196f7d159f29235585d3fd6958d0i0` | `bc1p6plt6l3ysqjesanxew6vgjkmvdlzrpg3f0f7g02yxtqnf9y9tw2szjj7ku` | Existing frozen fixture plus Ord and Ordinals Wallet match; current output created at height `959318` |
| `bitmapverse.bitmap` candidate winner | `9acf85a192845d64b55d20dcec6af4589cd28dff6f0ad19b73b219f2551a57cbi0` | `bc1p63hr0qrxdwwhygguukrt2fvtsx567d2ry5r9rum9w5wqv2yn5mtq8q0sze` | Ord and Ordinals Wallet match; output unspent since genesis |
| `937336.bitmap` candidate District | `7b7c15dc952cde069a371f4628c05ffe56e164bc272cfd9ef29cd231b6b3a9d1i0` | `bc1psphv4vlce9f37zqc7jt8w3gnynfxxh3zmjuvxpqv0vjs3t3mcdesyfk5tk` | Ord and Ordinals Wallet match; current output created at height `942807` |

These addresses identify output scripts, not natural persons. No signature was
requested, produced or inferred.

## Rejected substring matches for `bitmapverse.bitmap`

UniSat search returned three additional inscriptions because the queried text
appears as a substring. Direct Ord content reads show that none is an SNS
duplicate of `bitmapverse.bitmap`:

| Inscription number | Inscription ID | Exact content |
|---:|---|---|
| `113340646` | `c19850f4616ee878fc4e665e6293bb7d510f2d613ffee7c9a652cc9ef8477f78i0` | `arbitmapverse.bitmap` |
| `113340647` | `01368135c17f78b2d2fa456df77c1a5c63996926518d00c2e0c6514e69b9298bi0` | `xrbitmapverse.bitmap` |
| `113340648` | `66bb0d35d51b186092e1b73c6ffd6fd68c409d66602c94a721d10b86dd367192i0` | `vrbitmapverse.bitmap` |

They must not be counted as competing SNS candidates.

## Completeness caveat added by the pinned SNS parser audit

The rejected substring rows above are not duplicates under OPI normalization.
However, byte-exact search alone cannot enumerate the full OPI candidate set.
At the pinned commit the parser also accepts qualifying raw text that differs
in case or contains later whitespace-delimited text, and valid SNS JSON5
registration objects; it lowercases and selects the first whitespace token
before testing that the normalized value contains exactly one dot. A complete
independent completeness check must therefore cover all OPI-eligible plaintext
and JSON inscriptions through each decisive winner, not only inscriptions
whose raw bytes equal the two requested names.

## Revised-criterion execution verdict

Five boundaries now have direct or conditional checks with separated
provenance. The one unsatisfied result-changing premise is decisive-prefix
completeness. No accessible source provided a coverage-demonstrated enumeration
of every OPI-eligible plaintext/JSON5 form from protocol start through the
three proposed winners. Therefore the evidence supports neither a different
winner nor PASS: the correct result remains **BLOCKED**.
