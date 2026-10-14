# Experiment #9 — first real Name resolution

## First real blocker

The repository had the canonical Name identity, the Ord direct-parent
authorization contract, and the frozen #8C-R FiF/LiL resolver, but no adapter
executed that pipeline against live public Parent/Child and Bitcoin-position
data; the existing discovery resolvers stopped at local fixtures.

## Minimal removal

`resolver.mjs` starts only with the Name string. It reads the tracked canonical
identity at `data/bitmapverse-name-identity.json`, discovers every child through Ord's paginated
`/r/children` surface, confirms the direct parent through `/r/parents`, reads
the exact child content through `/content`, obtains confirmed block position
from the already-used public Ord and mempool.space surfaces, and passes the
authorized numeric `.bitmap` candidates to the unchanged #8C-R resolver.

The child inscription ID and the Name-to-District answer are never resolver
inputs. No production application file imports this experiment.

## Commands

```sh
node --test experiments/experiment-9/resolver.test.mjs
node experiments/experiment-9/run-live.mjs bitmapverse.bitmap
```

## External dependencies

- `https://ordinals.com`: child enumeration, reciprocal parent evidence,
  inscription content, and inscription height.
- `https://mempool.space/api`: confirmed Bitcoin transaction status and the
  ordered transaction list for the containing block.
