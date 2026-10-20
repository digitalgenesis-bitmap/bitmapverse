# Experiment #24 — Public evidence in the local resolver

Status: **PASS / LOCAL**. It is not imported by the portal or production.

The live verification accepted the binding with both BIP-322 signatures valid,
both current holders matching, and both Bitcoin outputs confirmed and unspent.

The experiment recognizes exactly one authorization:

- Name: `bitmapverse.bitmap`
- Name inscription: `9acf85a192845d64b55d20dcec6af4589cd28dff6f0ad19b73b219f2551a57cbi0`
- District: `937336.bitmap`
- District inscription: `7b7c15dc952cde069a371f4628c05ffe56e164bc272cfd9ef29cd231b6b3a9d1i0`
- Public artifact: commit-pinned Experiment #23 JSON at `fed7fc1c0a49bcd3ef2b85292f33b910ef8ec61e`

`resolver.mjs` downloads that immutable artifact, validates its strict shape and
1092-byte canonical message, reuses the Experiment #22 bilateral BIP-322
verifier, resolves current inscription holders through Ordinals Wallet, and
checks the underlying Bitcoin outputs through Blockstream. Only after those
checks pass does it call the existing Experiment #9 Name resolver and require
the same Name parent and `937336.bitmap` target.

Invalid or contradictory evidence returns `REJECT`. Network failures, provider
failures, timeouts, or otherwise unverifiable live evidence return
`UNAVAILABLE`. Neither state falls back to unsigned Name resolution.

Run focused tests:

```sh
node --test experiments/experiment-24/resolver.test.mjs
```

Run the live proof:

```sh
node experiments/experiment-24/verify-live.mjs
```
