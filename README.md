# Bitmapverse

First experimental build of Bitmapverse: a discovery, resolution, verification, and navigation experience across Bitmap territories.

## Current status

Phase v0.1 implements `same_sat_latest_v0.1`, a private experimental portal between Freedeon and Organa, and the first Shadow Council of Signals.

It does not yet contain:

- a public MVE;
- a second blind implementation;
- a resolved link between `bitmapverse.bitmap` and a host District;
- Names.bitmap;
- universal portals;
- metadata interpretation;
- on-chain inscription.

## Initial evidence

- `507999.bitmap` → confirmed Freedeon reinscription.
- `7187.bitmap` → second Organa reinscription observed in the snapshot.
- Shared snapshot: block `959531`.
- Frozen Ord enumerations: 2 candidates for Freedeon and 3 for Organa, both with `more:false`.
- SHA-256 hash of each candidate's content.
- OPI code pinned by commit; response from a public instance not yet captured.

See [BITMAPVERSE_V01_CONTRACT.md](./BITMAPVERSE_V01_CONTRACT.md).

## Local MVE Candidate

The Freedeon ↔ Organa portal is organized into two levels designed for a
non-technical person:

- **Experience** (initial view): explains in plain language what
  Bitmapverse is, which territories participate, the Freedeon ↔ Organa
  route (with the option to reverse it), and what content was selected —
  without opening with hashes.
- **Verification** (opens from Experience): keeps all existing technical
  evidence — District, original inscription, selected inscription, sat,
  canonical position, hashes, snapshot, rule applied, links to Ord, and
  what evidence is still missing.

This makes it a **Local Minimum Verifiable Experience (MVE) Candidate**:
it is not yet a public MVE or a universal Bitmap standard, as the list
above also indicates.

## Local verification

```bash
npm install
npm run test:resolver
npm run test:signals
npm run test:blind
npm test
```

`npm test` runs thirteen resolver tests, six Shadow Council tests, four blind-package isolation tests, builds the application, and uses two rendering tests to verify that the portal shows both territories, the snapshot, the rule, and its epistemic limits.

The interface allows you to:

- inspect the selected evidence for `507999.bitmap` and `7187.bitmap`;
- reverse the portal's narrative direction;
- open the selected content in Ord;
- look up IDs, sat, canonical position, and integrity hashes;
- see the still-open absence of a captured OPI response.

## Shadow Council of Signals

The `portal-507999-7187-001` case file references both fixtures by SHA-256 and freezes one concrete question: whether the portal should now be promoted to a public MVE.

SCOUT, KEEPER, and VOID evaluate it separately. Their signals link to the case file's canonical hash, record observations and risks, and explicitly lack the authority to change state. The first run produces useful dissonance: explore, preserve with warnings, and do not promote yet.

The three names describe roles, not entities. They would only be Hypheons if they later existed as differentiated processes, with their own memory, boundaries, and responsibilities, still dependent on another entity.

The first reproducible run is preserved in `shadow/runs/portal-507999-7187-001.run.json`; its case-file hash corresponds to the canonical JSON serialization used by the evaluator.

This run demonstrates the Council's structural protocol, not autonomous deliberation: the three responses are defined deterministically in the code. SCOUT, KEEPER, and VOID do not yet investigate or reason as three independent Hypheons.

## Independent implementation

Proof A was carried out with an independent Python implementation. Its 31 tests passed, and the two selected inscription IDs matched the reserved oracle, whose prior SHA-256 commitment also matched. The audit is in `blind/audits/proof-a-001.md`, and the original submission was preserved in `bitmapverse-blind-submission-a-001.zip`.

The full protocol is documented in `BLIND_IMPLEMENTATION_PROTOCOL.md`. Proof A demonstrated the resolver's independence for these fixtures; reconstruction from Ord infrastructure will be a later, separate Proof B.

## Discipline

This implementation is an experimental internal convention. It is not presented as a universal Bitmap standard. Historical fixtures are not silently rewritten in response to a chain reorganization or new evidence.
