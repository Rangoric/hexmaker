# Upstream Issues Tracker

Local planning mirror of open issues on the GitHub repo
(`sbuffkin/hexmaker` — this repo's `origin`). Snapshot taken **2026-06-29**.

This file is a planning aid, not the source of truth — GitHub is. Update the
**Status** line as work lands. duckmage is ahead of the public issue tracker, so
several requests are already shipped here.

Status legend: 🔴 not started · 🟡 partial / infra exists · 🟢 done in duckmage · 🔬 research-only

---

## #33 — Custom icons don't appear in terrain menu (forum report)  🟢 (2026-08-09)
> Worldographer assets dropped into the icons folder don't show up when
> creating a new terrain type (forum report by zeroth.law, 2026-07-28).

- **Done** (core): vault `create`/`delete`/`rename` events under the icons
  folder now trigger `loadAvailableIcons()` (`src/HexmakerPlugin.ts`), and
  `IconPickerModal` / `TerrainEntryEditorModal` rescan on open — OS-dropped
  files appear without a restart.
- **Open**: recursive subfolder scan (needs a nested-path → flat `icon:`
  frontmatter mapping decision); README docs for formats + flat-folder +
  inside-vault requirements.

## #32 — UX/UI bugs (AlebiCode batch)  🟢 (2026-08-09)
> Five bugs: coord view-filter no-op; move-to-new-window breaks drag;
> multi-window views never sync; no "Show paths" flag + inconsistent labels;
> PNG export ignores terrain icon tint.

- **Coord filter**: `.duckmage-hide-coords` targeted classes orphaned by the
  e74bc0d coord-label migration; now targets `.duckmage-coord-labels-layer`.
  Regression-guarded by `tests/overlayHideRules.test.ts` (asserts every
  OVERLAY_OPTIONS hide rule targets classes the source still creates).
- **Popout drag**: pan/paint mousemove/mouseup were bound to onOpen-time
  `activeDocument` and went stale after "Move to new window"; now bound
  per-drag to `contentEl.ownerDocument`. Undo/redo moved to a keymap
  `Scope` (popout-safe). Verified in `dev/issue32-fixes-check.html` +
  `dev/snapshot-issue32-fixes.mjs` (adoptNode reproduces the migration;
  control shows pre-fix strategy dying).
- **Multi-window sync**: `markStaleFromExternal()` flag set by
  `saveSettings` + hex-note metadata changes, consumed by a `renderGrid()`
  on `active-leaf-change` — stale views catch up on activation.
- **Show paths**: new `showPaths` MapData flag + overlay row; path
  polylines/endpoint dot tagged `duckmage-svg-path-line` so hiding them
  leaves GM icons + elevated override icons visible. Overlay labels
  normalised to "Show …".
- **PNG icon tint**: `tintedIcon()` in `src/export/mapPngRenderer.ts`
  (source-in composite = CSS mask-image equivalent), cached per
  (icon, colour); override icons stay untinted, matching on-screen.
- Verified: build + eslint + 380 tests green; 10/10 behavioural checks in
  the dev harness. Manual check still owed in real Obsidian: popout
  drag/undo + two-window stale sync.

## #30 — Draw road and river parallel  🟢 (2026-06-29)
> If a road and river follow the same path, they are drawn side by side rather
> than the latter covering the earlier one.

- **Done.** `computeLaneOffsets()` + `offsetPolyline()` in
  `src/hex-map/hexGeometry.ts`; wired into `renderPathOverlay()`
  (`src/hex-map/HexMapView.ts`) and the PNG exporter (`src/export/mapPngRenderer.ts`).
- Chains sharing a *segment* (adjacent-hex pair) are grouped via union-find and
  given symmetric perpendicular lane offsets (gap = widest stroke + 2px). Chains
  with no shared segment keep offset 0 → output pixel-identical to before.
  Perpendicular is direction-canonicalised so reversed chains still split apart.
- Tests in `tests/hexGeometry.test.ts` (offset math, segment grouping,
  single-hex-crossing exclusion, reversed-order routes).
- Verified: type-check + build + 361 tests + eslint all green.

## #29 — Hex flower generation  🔴
> Dynamically generate a map / "hex flower" so you can roll the "next hex".

- Procedural-generation feature. No infra yet. Larger design effort; the reporter
  themselves notes a richer palette may serve the same need.
- **Plan (deferred):** scope as an optional generator command. Revisit after the
  smaller items clear.

## #27 — Settlement/ruin icons + auto-icon on town create  🟡
> Where are the screenshot icons? + auto-place an icon (e.g. a black dot) when a
> town is created.

- Two parts: (a) **docs/help** — point users at the bundled icon set
  (`src/bundledIcons.ts`, plugin `icons/`); (b) **feature** — auto-stamp an icon
  override on a hex when a linked town/settlement is added. No auto-icon wiring
  found in `src/`.
- **Plan:** (a) is a quick `src/hex-map/help.md` / README note. (b) optional
  setting "auto-icon on settlement link" with a default dot icon.

## #24 — Tag-based structure (tags instead of hardcoded folders)  🔴
> Allow tags (e.g. `#Town`, `#Settlement`) as a content source instead of fixed
> folders, so existing vaults don't have to be reorganised.

- Today all link sources are folder-scoped (`townsFolder`, etc.). No tag-source
  path in `src/`.
- **Plan (larger):** add an optional per-section "source = folder | tag" mode.
  Touches every link picker + enumeration site. Significant; design note first.

## #23 — Image-based backgrounds  🟢 (zoom-drift fix 2026-06-29, needs Mac verify)
> An image layer under the hex map that zooms/pans with the grid.

- Implemented: bg image layer (`.duckmage-bg-image-layer`), `MapModal`,
  `newMapFields.ts` background fields, renders in export via `mapPngRenderer.ts`.
- **Mac zoom-drift bug (user-reported, not locally reproducible):** hex grid
  shifts off the bg image when zooming. Root cause in `bakeZoom()`
  (`HexMapView.ts`): grid is `em`/font-size driven, bg is `px`/transform driven;
  baking grows them through two separate arithmetic paths that only match under
  exact arithmetic. Device-pixel snapping of the em layout on fractional/Retina
  DPR (macOS) rounds differently than the smoothly-scaled bg → visible jump on
  zoom settle. No `navigator.platform`/`devicePixelRatio`/CSS-`zoom` code is
  involved — it's pure sub-pixel rounding divergence.
- **Fix:** `scheduleZoomBake()` now skips baking whenever a bg image is present
  (mirrors calibration-mode behaviour) — zoom stays a single composited viewport
  `scale()`, so grid + bg scale as one unit and can't drift on any DPR.
- **Action:** verify on a Mac/Retina display that the grid no longer slips on
  zoom; then close upstream.
- **Perf — opening a bg-image map is sluggish (under investigation):**
  Benchmarked the render path headlessly (`dev/bg-hex-recalc-bench.{html,mjs}`,
  chult's 63×61 = 3843 hexes). Findings:
  - Building the 3843 hex DOM nodes ≈ **27 ms/render**, present with **or
    without** a bg image — this is the dominant main-thread cost and is not
    bg-specific.
  - The old `:not([style*="background-color"])` empty-hex selector added
    **~4–6 ms/render**; switched to a `.duckmage-hex-painted` class selector
    (`setHexColor` helper) → overhead gone. ✅ landed.
  - `renderGrid()`'s `viewportEl.empty()` recreated the `<img>` every render,
    forcing image re-decode/re-raster. Now caches & re-attaches the layer
    (`bgLayerEl`/`bgLayerSrc`), skipped during calibration. ✅ landed.
  - Earlier paint hypothesis was **wrong** — the user clarified it stalls on
    *initial open*, not pan, and it's a regression.
- **ROOT CAUSE FOUND (regression) — `renderCoordLabelsLayer` layout thrash:**
  introduced in commit 10475fd (coord label layer). It read each hex's
  `offsetWidth/Left/Top` and *then created the label DOM inside the same loop* —
  every read after a write forces a full synchronous layout → **O(n²)**. At
  chult's 3843 hexes that's a **~21s** main-thread stall on open (the bg only
  amplifies ~1.1×; the real driver is hex count — chult is just the biggest map
  AND has a bg). Benchmarked with `dev/coord-label-thrash-bench.{html,mjs}`:
  thrash 20770ms → batched 105ms (**~198×**).
  - **Fix (landed):** split read phase from write phase — read all hex geometry
    into an array first, then create all labels. Matches the read-then-write
    pattern already used by `renderPathOverlay`/`renderFactionOverlay`.
  - **Guard (landed):** CLAUDE.md convention forbidding interleaved layout-read /
    DOM-write in per-hex loops + the committed benchmark as the reproducer.

## #20 — Mobile support  🔬
> Research feasibility of mobile.

- Research tracking issue. No commitment.
- **Plan:** audit pointer/hover assumptions and modal sizing; record findings.

## #12 — Exports and imports  🟡
> Map PNG/JPG export; random-table PDF export; palette/icon export as zip.

- Export subsystem exists: `src/export/` (PDF, PNG, HTML, md serializer; exporters
  for map+table, random table, single hex/note, workflow).
- **Gaps:** palette/icon **export-as-zip** and any **import** path not evident.
- **Plan:** confirm coverage vs the three asks; scope palette/icon bundle
  export + import separately.

## #10 — Space palette (+ more default palettes)  🟡
> Add a Space default palette; world/country palette maybe better as map-image link.

- Palette infra supports multiple named presets (`Limited`, `Expanded` in
  `src/constants.ts`); no `Space` preset yet.
- **Plan:** add a `SPACE_TERRAIN_PALETTE` preset + register it in
  `DEFAULT_SETTINGS.terrainPalettes`. Small, additive.

---

### Suggested order (low-hanging first)
1. **#30** road/river parallel — small, self-contained. (in progress)
2. **#10** Space palette — additive preset.
3. **#27a** icon help docs — doc-only.
4. **#23 / #12** verify-and-close / gap-scope existing features.
5. **#27b, #24, #29, #20** — larger design work, deferred.
