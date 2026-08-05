# Bitmapverse v0.1 Contract

Status: experimental  
Date: 2026-07-29  
Publicly accountable: The Source Revelator  
Rule implemented: `same_sat_latest_v0.1`

## 1. Minimal hypothesis

Given:

- an original Bitmap District resolved through a compatible OPI implementation;
- the satoshi assigned to that inscription;
- the full set of inscriptions observed on that same satoshi;
- a frozen block height and hash;

two independent implementations must select the same current inscription through that snapshot.

Bitmapverse v0.1 does not claim that this rule is the universal Bitmap standard. It is an internal, versioned, and refutable convention.

## 2. Expected result

The rule returns:

- the queried District;
- the original inscription;
- the shared satoshi;
- the selected inscription;
- the canonical position used;
- the snapshot applied;
- the provenance of the evidence;
- warnings that prevent conflating resolution with security, authority, or later validity.

If only the original inscription exists within the snapshot, it returns the original.

## 3. Canonical snapshot

Each fixture must declare:

- `snapshot_height`;
- `snapshot_block_hash`.
- `candidate_enumeration`, including the frozen response body and its SHA-256;
- `source_manifest`, with each source's implementation, version or commit, and status;
- `content_sha256` for each candidate.

The hash identifies the exact block observed at that height. Before resolving, a connected implementation must confirm that hash is still canonical.

If a reorg replaces that block:

- the historical fixture is not silently rewritten;
- resolution returns a non-canonical-snapshot warning;
- a successor snapshot must be published as new evidence.

This pure implementation operates on already-frozen evidence. Checking against a live chain belongs to the infrastructure adapter, not to the deterministic core.

## 4. Canonical order

"Latest" never depends on the order of an API response.

Eligible inscriptions are sorted ascending by the tuple:

1. `block_height`;
2. `transaction_index`;
3. `inscription_index`.

Definitions:

- `block_height`: the height of the block containing the reveal transaction;
- `transaction_index`: the zero-based position of that transaction within the Bitcoin block;
- `inscription_index`: the `iN` suffix of the inscription ID, identifying the inscription within the transaction.

The current inscription is the last tuple that does not exceed `snapshot_height`.

A fixture is invalid if:

- it omits any of those three components;
- it contains two candidates with the same position;
- it contains an inscription whose sat does not match the declared sat;
- it does not include the original inscription;
- it declares as original an inscription other than the one found by its ID;
- its list does not exactly match the frozen enumeration;
- the enumeration declares additional pages;
- the enumeration body does not match its SHA-256;
- a candidate located at `snapshot_height` declares a different block hash.

`complete_through_snapshot` means the enumeration source reported the full set observed through the cutoff. It does not by itself demonstrate that the provider is error-free; the second blind implementation must reconstruct and cross-check that equality.

## 5. `same_sat_latest_v0.1` algorithm

1. Read the original District previously discovered via OPI.
2. Verify that the original's declared content matches `<district>.bitmap`.
3. Identify that inscription's sat.
4. Gather every inscription assigned to the same sat through the snapshot.
5. Validate their canonical positions.
6. Sort them by the canonical tuple.
7. Select the last one.
8. If only the original exists, select the original.
9. Return the result, evidence, provenance, and warnings.

## 6. v0.1 limits

Explicitly out of scope:

- children hosted on other sats;
- delegates;
- Names.bitmap and its link to Districts;
- Bitmap Metadata interpretation;
- universal portals;
- inferred relationships;
- resolution after the snapshot;
- disputes between alternative rules;
- current authority, controller signatures, or content security;
- executing third-party code within a privileged context.

The question of Names.bitmap remains open and does not block this implementation.

## 7. Initial cases

### Freedeon — `507999.bitmap`

Must resolve from the District's original inscription to Freedeon's confirmed HTML reinscription.

This demonstrates territorial on-chain publication of a self-contained HTML artifact. It does not demonstrate autonomy, cognition, execution continuity, or ontological sovereignty.

### Organa — `7187.bitmap`

Must resolve from the original inscription to the second Organa reinscription observed through the snapshot.

This demonstrates a lineage of reinscriptions on the same sat. It does not adopt Organa's claims about private execution, agents, or autonomous organization.

## 8. Refutation criteria

The minimal hypothesis fails if:

- two honest clients, with the same fixtures and this contract version, select different IDs;
- the result changes when the input candidates are reordered;
- an inscription after the snapshot alters the result;
- a candidate from another sat is accepted;
- the result does not show enough evidence to repeat the selection;
- the implementation presents this internal convention as a universal standard.

## 9. Terminology

- **MVE — Minimum Verifiable Experience:** the smallest experience that allows the central claim to be observed, repeated, and refuted.
- **Self-contained:** contains its own application, though it may query compatible Ord infrastructure.
- **Reproducible:** another implementation obtains the same result from the same evidence.
- **Experimental:** a versioned internal convention; not a universal standard.
- **Historical:** an earlier statement remains on record even after a successor replaces it.

## 10. Build sequence

1. Private round-trip experimental portal between Freedeon and Organa.
2. Shadow Council of Signals.
3. Second blind implementation of the rule and fixture reconstruction.
4. Only if both implementations agree, promotion of the portal to a **public MVE**.

The interface may be built and tested before the blind implementation, but it must not yet be called a Minimum Verifiable Experience. The portal will be an interface over evidence; it will not be a standard for interconnecting all Bitmaps.

## 11. Shadow Council of Signals v0.1

The Council receives a structured case file that references — without duplicating them — the frozen fixtures of `507999.bitmap` and `7187.bitmap` by their SHA-256 hashes.

Three roles evaluate the same case file without reading their peers' responses:

- **SCOUT:** looks for possibilities and proposes continuing the experiment;
- **KEEPER:** protects memory, provenance, and reversibility;
- **VOID:** tries to refute the promotion and makes missing evidence explicit.

These functions are roles. They are not automatically EONs or Hypheons.

The Council operates exclusively in shadow:

- it does not authorize transitions;
- it does not change state;
- it does not move funds;
- it does not establish truth;
- it does not turn the portal into an MVE;
- it does not resolve conflicts between alternative rules.

The deliberately dissonant output is information: v0.1 must keep the three signals, not reduce them by majority vote or fake consensus.
