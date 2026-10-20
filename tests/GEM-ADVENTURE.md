# Gem Adventure checks

Run from the repository root:

```sh
node tests/gem-adventure.cjs
```

No test dependencies or installation are required. Tests execute the actual
inline game code and the vendored Matter.js engine at a fixed 60 Hz. DOM/canvas
and storage are isolated test doubles; no family save data is accessed.

The reachability test builds a graph of platform tops using actual simulated
walks, jumps and double jumps. Every gem must lie on a physically reachable
surface. Enemies are disabled only for this navigation test so that combat
does not obscure whether the geometry is reachable.

Other checks cover the six attacks, absorption, contact damage, independent
touch pointers, bidirectional portals, blade return hits, shield blocking,
summoning, victory, death, persistence and all hall links.

Browser QA additionally covers the hall entry, visible transformations,
collection and reload, restart confirmation, all world backgrounds, an empty
boss room, a complete water-form boss victory, and landscape viewport layouts.
Virtual viewport testing is not a substitute for a physical iPad touch test.
