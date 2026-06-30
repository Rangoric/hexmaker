import { describe, it } from "node:test";
import expect from "expect";
import {
  hexSize,
  hexCenter,
  hexPolygonPoints,
  gridBoundingBox,
  offsetPolyline,
  computeLaneOffsets,
} from "../src/hex-map/hexGeometry";

const SQRT3 = Math.sqrt(3);
const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

describe("hexSize", () => {
  it("flat-top hex is 2R wide and √3·R tall", () => {
    const { w, h } = hexSize(10, "flat");
    expect(w).toBeCloseTo(20);
    expect(h).toBeCloseTo(10 * SQRT3);
  });

  it("pointy-top hex is √3·R wide and 2R tall", () => {
    const { w, h } = hexSize(10, "pointy");
    expect(w).toBeCloseTo(10 * SQRT3);
    expect(h).toBeCloseTo(20);
  });
});

describe("hexCenter — flat-top", () => {
  it("places (0,0) at (R, h/2)", () => {
    const c = hexCenter(0, 0, "flat", 10);
    expect(c.cx).toBeCloseTo(10);
    expect(c.cy).toBeCloseTo((10 * SQRT3) / 2);
  });

  it("advances col by 1.5R", () => {
    const a = hexCenter(0, 0, "flat", 10);
    const b = hexCenter(1, 0, "flat", 10);
    expect(b.cx - a.cx).toBeCloseTo(15);
  });

  it("advances row by √3·R for non-shifted columns", () => {
    const a = hexCenter(0, 0, "flat", 10);
    const b = hexCenter(0, 1, "flat", 10);
    expect(b.cy - a.cy).toBeCloseTo(10 * SQRT3);
  });

  it("shifts odd columns DOWN by h/2 under odd-stagger", () => {
    const even = hexCenter(0, 0, "flat", 10);
    const odd = hexCenter(1, 0, "flat", 10, "odd");
    expect(odd.cy - even.cy).toBeCloseTo((10 * SQRT3) / 2);
  });

  it("shifts even columns DOWN under even-stagger", () => {
    const even = hexCenter(0, 0, "flat", 10, "even");
    const odd = hexCenter(1, 0, "flat", 10, "even");
    // Now even cols are shifted: col 0 (even) is shifted by h/2, col 1 (odd) isn't
    expect(even.cy).toBeCloseTo((10 * SQRT3) / 2 + (10 * SQRT3) / 2);
    expect(odd.cy).toBeCloseTo((10 * SQRT3) / 2);
  });
});

describe("hexCenter — pointy-top", () => {
  it("places (0,0) at (w/2, R)", () => {
    const c = hexCenter(0, 0, "pointy", 10);
    expect(c.cx).toBeCloseTo((10 * SQRT3) / 2);
    expect(c.cy).toBeCloseTo(10);
  });

  it("advances col by √3·R", () => {
    const a = hexCenter(0, 0, "pointy", 10);
    const b = hexCenter(1, 0, "pointy", 10);
    expect(b.cx - a.cx).toBeCloseTo(10 * SQRT3);
  });

  it("advances row by 1.5R", () => {
    const a = hexCenter(0, 0, "pointy", 10);
    const b = hexCenter(0, 1, "pointy", 10);
    expect(b.cy - a.cy).toBeCloseTo(15);
  });

  it("shifts odd rows RIGHT by w/2 under odd-stagger", () => {
    const even = hexCenter(0, 0, "pointy", 10);
    const odd = hexCenter(0, 1, "pointy", 10, "odd");
    expect(odd.cx - even.cx).toBeCloseTo((10 * SQRT3) / 2);
  });
});

describe("hexPolygonPoints", () => {
  it("returns six vertices", () => {
    expect(hexPolygonPoints(0, 0, "flat", 10)).toHaveLength(6);
  });

  it("flat-top: first vertex is to the right of centre", () => {
    const pts = hexPolygonPoints(0, 0, "flat", 10);
    expect(pts[0].x).toBeCloseTo(10);
    expect(pts[0].y).toBeCloseTo(0);
  });

  it("pointy-top: first vertex is upper-right of centre", () => {
    const pts = hexPolygonPoints(0, 0, "pointy", 10);
    expect(pts[0].x).toBeCloseTo((10 * SQRT3) / 2);
    expect(pts[0].y).toBeCloseTo(5);
  });

  it("all six vertices lie on a circle of radius R around the centre", () => {
    const pts = hexPolygonPoints(100, 50, "flat", 25);
    for (const p of pts) {
      const dx = p.x - 100;
      const dy = p.y - 50;
      expect(close(Math.hypot(dx, dy), 25)).toBe(true);
    }
  });

  it("opposite vertices (i and i+3) are diametrically opposite", () => {
    const pts = hexPolygonPoints(0, 0, "flat", 10);
    for (let i = 0; i < 3; i++) {
      expect(pts[i].x + pts[i + 3].x).toBeCloseTo(0);
      expect(pts[i].y + pts[i + 3].y).toBeCloseTo(0);
    }
  });
});

describe("gridBoundingBox", () => {
  it("a single flat-top hex grid is at least (2R wide, √3·R tall)", () => {
    const { width, height } = gridBoundingBox(1, 1, "flat", 10);
    expect(width).toBeGreaterThanOrEqual(20);
    expect(height).toBeGreaterThanOrEqual(Math.ceil(10 * SQRT3));
  });

  it("scales sensibly for a 10×10 grid", () => {
    const { width, height } = gridBoundingBox(10, 10, "flat", 20);
    // Width should be roughly 2R + 9 * 1.5R = 2*20 + 9*30 = 310
    expect(width).toBeGreaterThan(300);
    expect(width).toBeLessThan(330);
    // Height should be roughly 10 * (√3·R) + h/2 stagger = 10 * 34.64 + 17.3 ≈ 364
    expect(height).toBeGreaterThan(330);
    expect(height).toBeLessThan(400);
  });
});

describe("offsetPolyline", () => {
  it("returns the input unchanged when offset is 0", () => {
    const pts = [
      { cx: 0, cy: 0 },
      { cx: 10, cy: 0 },
    ];
    expect(offsetPolyline(pts, 0)).toBe(pts);
  });

  it("returns the input unchanged for fewer than 2 points", () => {
    const pts = [{ cx: 5, cy: 5 }];
    expect(offsetPolyline(pts, 4)).toBe(pts);
  });

  it("shifts a horizontal line perpendicular (downward in screen coords)", () => {
    // Tangent +x → perpendicular (-ty, tx) = (0, +1) → shifts +y.
    const out = offsetPolyline(
      [
        { cx: 0, cy: 0 },
        { cx: 10, cy: 0 },
        { cx: 20, cy: 0 },
      ],
      3,
    );
    out.forEach((p) => expect(close(p.cy, 3)).toBe(true));
    expect(close(out[0].cx, 0)).toBe(true);
    expect(close(out[2].cx, 20)).toBe(true);
  });

  it("puts opposite-direction chains on opposite sides for matching offsets", () => {
    const forward = [
      { cx: 0, cy: 0 },
      { cx: 10, cy: 0 },
    ];
    const backward = [
      { cx: 10, cy: 0 },
      { cx: 0, cy: 0 },
    ];
    // Same geometric route, stored reversed. With the SAME offset value the
    // canonicalised perpendicular must land them on the same physical side.
    const a = offsetPolyline(forward, 3);
    const b = offsetPolyline(backward, 3);
    a.forEach((p) => expect(close(p.cy, 3)).toBe(true));
    b.forEach((p) => expect(close(p.cy, 3)).toBe(true));
  });
});

describe("computeLaneOffsets", () => {
  it("returns all-zero for fewer than 2 chains", () => {
    expect(computeLaneOffsets([])).toEqual([]);
    expect(
      computeLaneOffsets([
        { hexes: ["0_0", "1_0"], width: 4, typeName: "river" },
      ]),
    ).toEqual([0]);
  });

  it("leaves non-overlapping chains at offset 0", () => {
    const out = computeLaneOffsets([
      { hexes: ["0_0", "1_0"], width: 4, typeName: "road" },
      { hexes: ["5_5", "6_5"], width: 4, typeName: "river" },
    ]);
    expect(out).toEqual([0, 0]);
  });

  it("splits two DIFFERENT-type chains sharing a segment into symmetric lanes", () => {
    const out = computeLaneOffsets([
      { hexes: ["0_0", "1_0", "2_0"], width: 4, typeName: "road" },
      { hexes: ["0_0", "1_0", "2_0"], width: 4, typeName: "river" },
    ]);
    // 2 distinct types, gap = maxWidth(4) + 2 = 6, mid = 0.5 → offsets -3, +3.
    expect(out).toEqual([-3, 3]);
  });

  it("MERGES same-type chains on the same route (no offset)", () => {
    const out = computeLaneOffsets([
      { hexes: ["0_0", "1_0", "2_0"], width: 4, typeName: "river" },
      { hexes: ["0_0", "1_0", "2_0"], width: 4, typeName: "river" },
    ]);
    // Single distinct type in the group → both stay centred so they overlap.
    expect(out).toEqual([0, 0]);
  });

  it("merges same-type but still offsets a different type sharing the route", () => {
    const out = computeLaneOffsets([
      { hexes: ["0_0", "1_0", "2_0"], width: 4, typeName: "river" },
      { hexes: ["0_0", "1_0", "2_0"], width: 4, typeName: "river" },
      { hexes: ["0_0", "1_0", "2_0"], width: 4, typeName: "road" },
    ]);
    // 2 distinct types (river lane 0, road lane 1), mid = 0.5, gap = 6.
    // Both rivers share the river lane → -3; the road → +3.
    expect(out).toEqual([-3, -3, 3]);
  });

  it("treats reversed hex order as the same route (shared segment)", () => {
    const out = computeLaneOffsets([
      { hexes: ["0_0", "1_0", "2_0"], width: 4, typeName: "road" },
      { hexes: ["2_0", "1_0", "0_0"], width: 4, typeName: "river" },
    ]);
    expect(out).toEqual([-3, 3]);
  });

  it("does not split chains that merely cross at a single hex", () => {
    const out = computeLaneOffsets([
      { hexes: ["0_0", "1_1"], width: 4, typeName: "road" },
      { hexes: ["1_1", "2_2"], width: 4, typeName: "river" },
    ]);
    // They share hex 1_1 but no common segment → no offset.
    expect(out).toEqual([0, 0]);
  });

  it("fans three distinct types sharing a route into three centred lanes", () => {
    const out = computeLaneOffsets([
      { hexes: ["0_0", "1_0", "2_0"], width: 4, typeName: "road" },
      { hexes: ["0_0", "1_0", "2_0"], width: 4, typeName: "river" },
      { hexes: ["0_0", "1_0", "2_0"], width: 4, typeName: "trail" },
    ]);
    // 3 distinct types, gap = 6, mid = 1 → lanes -6, 0, +6.
    expect(out).toEqual([-6, 0, 6]);
  });
});
