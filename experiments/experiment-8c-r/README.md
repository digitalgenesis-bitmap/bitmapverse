# Experiment #8C-R — canonical order only

## Scope

This is a standalone experimental resolver. It is not imported by the
BITMAPVERSE application and does not change WORLD parcel ordering.

It consumes candidates already accepted by the frozen #8A direct-parent
authorization predicate. The frozen #8B result establishes why ordering is
needed: more than one authorized child can exist.

## Evidence and technical term

Ord's public inscription specification calls the final component the **index**
of the new inscription in its reveal transaction. It is the zero-based `N` in
the inscription ID `TXIDiN`.

The same specification defines how that index is reconstructed: a parser walks
the transaction inputs consecutively and finds all inscription envelopes in
their encounter order. Thus the index is derived from the raw reveal
transaction plus the public envelope-parsing rules. It is not an inscription
number and does not require an indexer's global numbering state.

Primary rule:

- https://github.com/ordinals/ord/blob/03c9b87b14fe1e2c38191b860a08988345ec4e5f/docs/src/inscriptions.md#inscription-ids
- https://github.com/ordinals/ord/blob/03c9b87b14fe1e2c38191b860a08988345ec4e5f/src/inscriptions/envelope.rs

## Frozen rule

FiF is the ascending lexicographic order:

1. Bitcoin block height;
2. zero-based transaction index in that block;
3. zero-based inscription index in the reveal transaction (`N` in `TXIDiN`).

LiL is unchanged: the current authorized binding is the LAST candidate in FiF
order.

`inscription_number` is not read by the resolver and is not part of the
canonical precedence key. It may remain external metadata.

## Technology removal

An independent implementation retaining the Bitcoin blockchain and the public
Ord envelope rules can reconstruct all three key components. The third is
obtained by parsing inputs consecutively and numbering encountered inscription
envelopes from zero. Consequently removal of ordinals.com, OPI, third-party
APIs, and stored inscription numbers does not change the order.

The executable Technology Removal fixture starts from a synthetic 208-byte
serialized SegWit transaction, not from preassigned inscription IDs. Its two
ordered inputs contain three witness tapscript envelopes. The experimental
parser deserializes the transaction, extracts the tapscripts, walks their
instructions in the pinned Ord order, computes the transaction ID, and derives
`i0`, `i1`, and `i2` from encounter order before passing them to the resolver.

`reconstruct-from-transaction.mjs` is deliberately limited to the Bitcoin
CompactSize and script-push forms exercised by this fixture. It is evidence for
this ordering path, not a general replacement for the Ord parser.

## Controls

The known `937336.bitmap` control is represented by block height `937336`,
transaction index `130`, and inscription ID
`7b7c15dc952cde069a371f4628c05ffe56e164bc272cfd9ef29cd231b6b3a9d1i0`.
The final zero is therefore the Ord-defined inscription index in that reveal
transaction; it is not a satpoint offset, input index, output index, or global
inscription number.
