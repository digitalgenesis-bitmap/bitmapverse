# Independent implementation protocol — Bitmapverse v0.1

Date: 2026-07-31  
Status: package prepared; independent implementation not yet executed.

## Epistemological correction

SCOUT, KEEPER, and VOID are currently predefined deterministic functions. The run performed demonstrates structural separation, authority limits, and reproducibility of the Shadow Council of Signals protocol.

It does not demonstrate autonomous intelligent deliberation or the existence of three Hypheons.

## Separation of responsibilities

| Artifact | Responsibility |
|---|---|
| Blind contract | Defines the normative rule to be reimplemented. |
| Case | Defines the snapshot, the allowed files, and the limits of the experiment. |
| Sanitized fixtures | Provide frozen evidence without labeling the result. |
| Oracle commitment | Demonstrates that the oracle was fixed before delivery. |
| Reserved oracle | Allows comparing results only after closing. |

The case file is not a single source of total truth. Each artifact carries a bounded responsibility.

## Proof A — resolver independence

The independent instance receives only `bitmapverse-blind-v0.1.zip`.

It must:

1. verify the manifest;
2. implement the contract in Python using only the standard library;
3. create its own tests;
4. record ambiguities before knowing the oracle;
5. produce results for both fixtures;
6. seal the hashes of its submission in `SUBMISSION.json`.

Only afterward is `oracle/reserved/same-sat-latest-v01.oracle.json` revealed and the output compared.

The oracle file is not encrypted. Its secrecy depends on giving the instance only the isolated ZIP. The public SHA-256 inside the package prevents silently changing the oracle after delivery.

## Proof B — reconstruction independence

This is a separate, later experiment. The second party must query Ord-compatible infrastructure and reconstruct the fixtures without receiving the enumerations prepared by the first implementation.

Passing Proof A does not authorize claiming that the evidence was independently reconstructed.

## Comparison outcomes

- Full match: the contract was precise enough for these cases.
- Divergence due to ambiguity: fix the contract and repeat with a new version.
- Divergence due to implementation error: keep the original submission and publish a successor; never rewrite it.

None of these outcomes turns the rule into a universal Bitmap standard.

## Package integrity

- File: `bitmapverse-blind-v0.1.zip`
- SHA-256: `20e2e66890a469e853487acb124e2e938c3a3bb303bd6d9439fa538af25ae0d4`

The hash must be updated if the ZIP is regenerated after the package changes.
