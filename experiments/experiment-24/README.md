# Experiment #24 — Public evidence in the local resolver

Original experiment status: **PASS / LOCAL**. Experiment #27 later integrated
this resolver into the portal and production.

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

## Experiment #27 production repair closure — 23 October 2026

The production Name-resolution path became unavailable when `ordinals.com`
returned HTTP 403 for the `/r/children` requests used by the Experiment #9
resolver. Authorization remained fail-closed and was not reported as current
`ACCEPT` while Name resolution was unavailable.

The repair changed only the selected-Name resolver's explicit `ordBase` from
`https://ordinals.com` to `https://0rdinals.com`. No authorization, ownership,
signature, or fail-closed rule changed.

- Repair commit: `f4981895ca96d89409333feb258d5681c0a70661`
- Cloudflare deployment: `ec039db1-6e21-455b-8b14-5fdefff84e51`
- Production verification date: 23 October 2026

Production verification confirmed:

| Selected Name | Destination | Authorization | Entry |
|---|---|---|---|
| `bitmapverse.bitmap` | `937336.bitmap` | `AUTHORIZED` | `ENTER 3D` |
| `bitmapworld.bitmap` | `937336.bitmap` | `AUTHORIZED` | `ENTER 3D` |
| `bitmapmetaverse.bitmap` | `937336.bitmap` | `AUTHORIZED` | `ENTER 3D` |

The remaining operational limitation is the selected-Name resolver's reliance
on a single external Ord provider.
