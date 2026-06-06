/**
 * Pure hex-geometry and path-math functions — no Obsidian or DOM dependencies.
 * Extracted from HexMapView.ts so the rendering class stays focused on UI.
 */

type Pt = { cx: number; cy: number };

const SQRT3 = Math.sqrt(3);

// ── Hex sizing ────────────────────────────────────────────────────────────────

/**
 * Compute the (width, height) of a single hex of the given radius and orientation.
 * Radius = distance from hex centre to any vertex.
 *
 * - Flat-top  hex:  width = 2R,         height = √3·R
 * - Pointy-top hex: width = √3·R,       height = 2R
 */
export function hexSize(
  hexRadius: number,
  orientation: "flat" | "pointy",
): { w: number; h: number } {
  return orientation === "flat"
    ? { w: 2 * hexRadius, h: SQRT3 * hexRadius }
    : { w: SQRT3 * hexRadius, h: 2 * hexRadius };
}

/**
 * Centre pixel of the hex at grid (col, row) when the grid's top-left corner is
 * pinned to (0, 0). Caller should add any padding by translating the result.
 *
 * - Flat-top:  column spacing = 1.5R,    row spacing = √3·R.  Shifted columns
 *              push the cell DOWN by half a hex height.
 * - Pointy-top: row spacing = 1.5R,      column spacing = √3·R.  Shifted rows
 *              push the cell RIGHT by half a hex width.
 *
 * `staggerOffset` controls which parity is the shifted one — "odd" (default)
 * means odd columns/rows are shifted; "even" inverts.
 */
export function hexCenter(
  col: number,
  row: number,
  orientation: "flat" | "pointy",
  hexRadius: number,
  staggerOffset: "odd" | "even" = "odd",
): Pt {
  const { w, h } = hexSize(hexRadius, orientation);
  const isShifted = (n: number) =>
    staggerOffset === "odd" ? n % 2 !== 0 : n % 2 === 0;

  if (orientation === "flat") {
    const cx = hexRadius + col * 1.5 * hexRadius;
    const cy = h / 2 + row * h + (isShifted(col) ? h / 2 : 0);
    return { cx, cy };
  }
  const cy = hexRadius + row * 1.5 * hexRadius;
  const cx = w / 2 + col * w + (isShifted(row) ? w / 2 : 0);
  return { cx, cy };
}

/**
 * The six vertices of a hex centred at (cx, cy), in clockwise order starting
 * from the rightmost vertex for flat-top (or upper-right for pointy-top).
 */
export function hexPolygonPoints(
  cx: number,
  cy: number,
  orientation: "flat" | "pointy",
  hexRadius: number,
): { x: number; y: number }[] {
  const vStart = orientation === "flat" ? 0 : Math.PI / 6;
  return Array.from({ length: 6 }, (_, i) => {
    const a = vStart + (i * Math.PI) / 3;
    return {
      x: cx + hexRadius * Math.cos(a),
      y: cy + hexRadius * Math.sin(a),
    };
  });
}

/**
 * Compute the pixel bounding box for an entire grid of hexes. Useful for
 * sizing a canvas to fit all hexes plus optional padding.
 */
export function gridBoundingBox(
  cols: number,
  rows: number,
  orientation: "flat" | "pointy",
  hexRadius: number,
  staggerOffset: "odd" | "even" = "odd",
): { width: number; height: number } {
  // Walk the four corners + one staggered cell to find the extent.
  // Cheaper than checking every cell since the grid is regular.
  let maxRight = 0;
  let maxBottom = 0;
  const check = (col: number, row: number) => {
    const c = hexCenter(col, row, orientation, hexRadius, staggerOffset);
    if (c.cx + hexRadius > maxRight) maxRight = c.cx + hexRadius;
    if (c.cy + hexRadius > maxBottom) maxBottom = c.cy + hexRadius;
  };
  check(cols - 1, rows - 1);
  // Also check the staggered-row/col extreme cell, which may protrude further.
  if (cols > 0 && rows > 0) {
    check(cols - 1, rows - 2 >= 0 ? rows - 2 : 0);
    check(cols - 2 >= 0 ? cols - 2 : 0, rows - 1);
  }
  return { width: Math.ceil(maxRight), height: Math.ceil(maxBottom) };
}

// ── Neighbor calculation ──────────────────────────────────────────────────────

export function hexNeighbors(
  x: number,
  y: number,
  orientation: "flat" | "pointy",
  staggerOffset: "odd" | "even" = "odd",
): [number, number][] {
  // isShifted = true when the hex sits on the staggered (shifted) row/col.
  // Default "odd" stagger means odd cols (flat-top) or odd rows (pointy-top) are shifted.
  const isShifted = (n: number) =>
    staggerOffset === "odd" ? n % 2 !== 0 : n % 2 === 0;

  if (orientation === "flat") {
    return !isShifted(x)
      ? [
          [x, y - 1],
          [x, y + 1],
          [x + 1, y - 1],
          [x + 1, y],
          [x - 1, y - 1],
          [x - 1, y],
        ]
      : [
          [x, y - 1],
          [x, y + 1],
          [x + 1, y],
          [x + 1, y + 1],
          [x - 1, y],
          [x - 1, y + 1],
        ];
  }
  return !isShifted(y)
    ? [
        [x + 1, y],
        [x - 1, y],
        [x - 1, y - 1],
        [x, y - 1],
        [x - 1, y + 1],
        [x, y + 1],
      ]
    : [
        [x + 1, y],
        [x - 1, y],
        [x, y - 1],
        [x + 1, y - 1],
        [x, y + 1],
        [x + 1, y + 1],
      ];
}

// ── SVG path builders ─────────────────────────────────────────────────────────

/** Smooth bezier path through an ordered list of points — corners rounded via midpoints. */
export function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) {
    return `M ${pts[0].cx} ${pts[0].cy} L ${pts[1].cx} ${pts[1].cy}`;
  }
  const mx = (a: Pt, b: Pt) => (a.cx + b.cx) / 2;
  const my = (a: Pt, b: Pt) => (a.cy + b.cy) / 2;
  let d = `M ${pts[0].cx} ${pts[0].cy}`;
  d += ` L ${mx(pts[0], pts[1])} ${my(pts[0], pts[1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    d += ` Q ${pts[i].cx} ${pts[i].cy} ${mx(pts[i], pts[i + 1])} ${my(pts[i], pts[i + 1])}`;
  }
  d += ` L ${pts[pts.length - 1].cx} ${pts[pts.length - 1].cy}`;
  return d;
}

/** Sharp polyline path (straight segments between each point). */
export function sharpPath(pts: Pt[]): string {
  if (pts.length < 2) return "";
  return "M " + pts.map((p) => `${p.cx} ${p.cy}`).join(" L ");
}

// ── Chain routing helpers ─────────────────────────────────────────────────────

/**
 * "Meander" routing: smooth bezier curves through edge midpoints between hex centers.
 * Falls back to raw centers for chains shorter than 3 hexes.
 */
export function buildMeanderPts(
  hexes: string[],
  centerMap: Map<string, Pt>,
): Pt[] {
  const centers = hexes
    .map((k) => centerMap.get(k))
    .filter((p): p is Pt => !!p);
  if (centers.length < 3) return centers;
  const pts: Pt[] = [];
  for (let i = 0; i < centers.length - 1; i++)
    pts.push({
      cx: (centers[i].cx + centers[i + 1].cx) / 2,
      cy: (centers[i].cy + centers[i + 1].cy) / 2,
    });
  return pts;
}

/**
 * "Edge" routing: traces strictly along hex polygon boundary lines.
 *
 * Approach:
 *  1. For each hex in the chain, the 6 vertices are computed from that hex's own centre
 *     (not from the midpoint between two centres), so the path always lands on the actual
 *     hex outline regardless of the CSS gap between hexes.
 *  2. For each consecutive pair (Hi, Hi+1) the "edge index" on Hi's side is snapped from
 *     the pixel direction angle to the nearest of the 6 edge midpoint angles.
 *  3. A greedy look-ahead picks which of the two shared-edge vertices to use on each edge,
 *     minimising the cross-product (turn cost) — this keeps collinear chains on one side.
 *  4. For every internal hex the path traverses the *shorter arc* of that hex's boundary
 *     between the entry vertex (from the previous edge) and the exit vertex (for the next
 *     edge), including any intermediate polygon corner vertices.  This is the critical step
 *     that makes the path hug the actual hex edge lines rather than cutting diagonally.
 */
export function buildEdgePts(
  hexes: string[],
  centerMap: Map<string, Pt>,
  isFlat: boolean,
  hexRadius: number,
): Pt[] {
  const centers = hexes
    .map((k) => centerMap.get(k))
    .filter((p): p is Pt => !!p);
  if (centers.length < 2) return centers;
  const n = centers.length;
  const TAU = 2 * Math.PI;

  // Angle of vertex 0 for this orientation.
  // Flat-top  → vertices at 0°, 60°, 120°, 180°, 240°, 300°  (right, lower-right, …)
  // Pointy-top → vertices at 30°, 90°, 150°, 210°, 270°, 330° (upper-right, bottom, …)
  const vStart = isFlat ? 0 : Math.PI / 6;

  // The 6 vertices of a hex centred at C, clockwise from vStart.
  const hexVerts = (C: Pt): Pt[] =>
    Array.from({ length: 6 }, (_, i) => ({
      cx: C.cx + hexRadius * Math.cos(vStart + (i * Math.PI) / 3),
      cy: C.cy + hexRadius * Math.sin(vStart + (i * Math.PI) / 3),
    }));

  // Snap a direction angle θ to the nearest edge index (0–5).
  // Edge i spans vertex i → vertex (i+1)%6; its midpoint is at vStart + (i+0.5)×60°.
  const snapEdge = (theta: number): number => {
    let best = 0,
      bestD = Infinity;
    for (let i = 0; i < 6; i++) {
      const mid = vStart + (i + 0.5) * (Math.PI / 3);
      let d = (((theta - mid) % TAU) + TAU) % TAU;
      if (d > Math.PI) d = TAU - d;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  // Shorter arc from vertex index `from` to `to` on the 6-cycle, inclusive.
  const shortArc = (from: number, to: number): number[] => {
    if (from === to) return [from];
    const cw = (to - from + 6) % 6;
    const ccw = (from - to + 6) % 6;
    const out: number[] = [];
    if (cw <= ccw) {
      for (let k = 0; k <= cw; k++) out.push((from + k) % 6);
    } else {
      for (let k = 0; k <= ccw; k++) out.push((from - k + 6) % 6);
    }
    return out;
  };

  // For each edge i (between centers[i] and centers[i+1]):
  // edgeIdx[i] = which edge of centers[i]'s hex faces centers[i+1].
  const edgeIdx = centers.slice(0, -1).map((A, i) => {
    const B = centers[i + 1];
    return snapEdge(Math.atan2(B.cy - A.cy, B.cx - A.cx));
  });

  // choice[i] ∈ {0,1}: which of the two edge-i vertices to use on centers[i]'s side.
  //   0 → verts[edgeIdx[i]]         1 → verts[(edgeIdx[i]+1)%6]
  const choice: number[] = Array.from({ length: n - 1 }, () => 0);
  let prev: Pt = centers[0];
  for (let i = 0; i < n - 1; i++) {
    const vA = hexVerts(centers[i]);
    const Va = vA[edgeIdx[i]],
      Vb = vA[(edgeIdx[i] + 1) % 6];
    if (i < n - 2) {
      // Look-ahead: pick the vertex pair (this edge + next edge) with the lowest turn cost.
      const vB = hexVerts(centers[i + 1]);
      const VaN = vB[edgeIdx[i + 1]],
        VbN = vB[(edgeIdx[i + 1] + 1) % 6];
      const cost = (v: Pt, vn: Pt) =>
        Math.abs(
          (v.cx - prev.cx) * (vn.cy - v.cy) -
            (v.cy - prev.cy) * (vn.cx - v.cx),
        );
      let bestCost = Infinity,
        bestC = 0;
      for (const [v, ci] of [
        [Va, 0],
        [Vb, 1],
      ] as [Pt, number][]) {
        for (const vn of [VaN, VbN]) {
          const co = cost(v, vn);
          if (co < bestCost) {
            bestCost = co;
            bestC = ci;
          }
        }
      }
      choice[i] = bestC;
      prev = vA[(edgeIdx[i] + bestC) % 6];
    } else {
      // Last edge: pick the vertex closest to the previously chosen point.
      const dA = (Va.cx - prev.cx) ** 2 + (Va.cy - prev.cy) ** 2;
      const dB = (Vb.cx - prev.cx) ** 2 + (Vb.cy - prev.cy) ** 2;
      choice[i] = dA <= dB ? 0 : 1;
    }
  }

  // Build the result path.
  // For internal hex k the path traverses the shorter boundary arc from the "entry vertex"
  // (the vertex on hex k that matches the exit vertex chosen for edge k-1) to the "exit
  // vertex" (the chosen vertex for edge k).
  //
  // Entry vertex on hex k from edge k-1:
  //   If choice[k-1]=0, the vertex on centers[k-1] was edgeIdx[k-1].
  //   The matching vertex on hex k's side is (edgeIdx[k-1] + 4 - choice[k-1]) % 6.
  //   (The factor of 4 accounts for the ±30° / 180° flip between the two hex perspectives.)
  const result: Pt[] = [centers[0]];

  for (let k = 0; k < n; k++) {
    const verts = hexVerts(centers[k]);
    if (k === 0) {
      // First hex: just add the chosen exit vertex.
      result.push(verts[(edgeIdx[0] + choice[0]) % 6]);
    } else if (k === n - 1) {
      // Last hex: add entry vertex then the hex centre.
      const entryIdx = (edgeIdx[n - 2] + 4 - choice[n - 2]) % 6;
      result.push(verts[entryIdx]);
      result.push(centers[k]);
    } else {
      // Internal hex: traverse the shorter arc from entry to exit.
      const entryIdx = (edgeIdx[k - 1] + 4 - choice[k - 1]) % 6;
      const exitIdx = (edgeIdx[k] + choice[k]) % 6;
      const arc = shortArc(entryIdx, exitIdx);
      // arc[0] == entryIdx, which coincides (zero gap) with the last pushed point — skip it.
      for (let j = 1; j < arc.length; j++) result.push(verts[arc[j]]);
    }
  }

  return result;
}
