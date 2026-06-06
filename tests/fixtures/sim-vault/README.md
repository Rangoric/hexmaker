# sim-vault

Synthetic vault used by the e2e integration tests. Mirrors a realistic
Duckmage setup but with deterministic, small content so test assertions
are stable.

## Layout

```
sim-vault/
  hexes/
    the-coast/
      0_0.md, 1_0.md, 2_0.md, 0_1.md, 1_1.md, 2_1.md   ← 3×2 grid
  tables/
    forest-encounters.md      (d6, weighted)
    npc-names.md              (d20, plain list)
    treasure.md               (linkedFolder)
    treasure/
      gold pile.md
      silver ring.md
      cursed amulet.md
  workflows/
    npc-generator.md          (table + dice + template)
    templates/
      npc-template.md
  towns/
    Saltwatch.md
  dungeons/
    The Old Spire.md
  features/
    Standing Stone.md
  quests/
    Find the Wanderer.md
  factions/
    The Reach.md              (faction-color: #cd5c5c)
  regions/
    Coastlands.md             (region-color: #6e8eb1)
```

## Settings driven from this layout

The `MockHexmakerPlugin` (tests/helpers/simVault.ts) wires:
- `hexFolder: "hexes"`
- `tablesFolder: "tables"`
- `workflowsFolder: "workflows"`
- `townsFolder: "towns"`, `dungeonsFolder: "dungeons"`, etc.
- `regionsFolder: "regions"`, `factionsFolder: "factions"`
- One map `"the-coast"` with `gridSize: 3×2, gridOffset: 0,0` and the
  default terrain palette (including a duplicate-`"ocean"` entry so the
  palette-collision regression is exercised).

## Why fixed file contents

Real vaults change. Committed fixture files keep assertions deterministic and
let new contributors inspect exactly what each section/frontmatter looks like.
