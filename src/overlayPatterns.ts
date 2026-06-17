/**
 * Overlay pattern definitions for faction & region overlays.
 *
 * Each pattern key maps to:
 *   - an SVG <pattern> element (for on-screen render in HexMapView)
 *   - a CanvasPattern (for PNG export in mapPngRenderer)
 *
 * The "solid" key represents the legacy flat-color fill; both builders return
 * null for it and the caller falls back to a flat color.
 */

export const OVERLAY_PATTERN_KEYS = [
  "solid",
  "stripes-right",
  "stripes-left",
  "crosshatch",
  "polka",
  "grid",
  "zigzag",
  "triangles",
  "scales",
  "checker",
] as const;

export type OverlayPatternKey = typeof OVERLAY_PATTERN_KEYS[number];

export const OVERLAY_PATTERN_LABELS: Record<OverlayPatternKey, string> = {
  "solid": "Solid",
  "stripes-right": "Diagonal stripes ↗",
  "stripes-left": "Diagonal stripes ↖",
  "crosshatch": "Crosshatch",
  "polka": "Polka dots",
  "grid": "Grid",
  "zigzag": "Zigzag",
  "triangles": "Triangles",
  "scales": "Scales",
  "checker": "Checker",
};

export const DEFAULT_OVERLAY_PATTERN_KEY: OverlayPatternKey = "solid";
export const DEFAULT_OVERLAY_PATTERN_SCALE = 16;
export const DEFAULT_OVERLAY_PATTERN_OPACITY = 0.45;
export const DEFAULT_OVERLAY_OUTLINE_WIDTH = 1.5;

export const MIN_PATTERN_SCALE = 8;
export const MAX_PATTERN_SCALE = 48;
export const MIN_PATTERN_OPACITY = 0.05;
export const MAX_PATTERN_OPACITY = 1.0;
export const MIN_OUTLINE_WIDTH = 0;
export const MAX_OUTLINE_WIDTH = 20;

export function isOverlayPatternKey(v: unknown): v is OverlayPatternKey {
  return (
    typeof v === "string" &&
    (OVERLAY_PATTERN_KEYS as readonly string[]).includes(v)
  );
}

export function normalizeOverlayPatternKey(v: unknown): OverlayPatternKey {
  return isOverlayPatternKey(v) ? v : DEFAULT_OVERLAY_PATTERN_KEY;
}

export function normalizeOverlayPatternScale(v: unknown): number {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
        ? parseFloat(v)
        : NaN;
  if (!Number.isFinite(n)) return DEFAULT_OVERLAY_PATTERN_SCALE;
  return Math.min(MAX_PATTERN_SCALE, Math.max(MIN_PATTERN_SCALE, n));
}

export function normalizeOverlayPatternOpacity(v: unknown): number {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
        ? parseFloat(v)
        : NaN;
  if (!Number.isFinite(n)) return DEFAULT_OVERLAY_PATTERN_OPACITY;
  return Math.min(MAX_PATTERN_OPACITY, Math.max(MIN_PATTERN_OPACITY, n));
}

export function normalizeOverlayOutlineWidth(v: unknown): number {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
        ? parseFloat(v)
        : NaN;
  if (!Number.isFinite(n)) return DEFAULT_OVERLAY_OUTLINE_WIDTH;
  return Math.min(MAX_OUTLINE_WIDTH, Math.max(MIN_OUTLINE_WIDTH, n));
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Build an SVG <pattern> element for the given key/color/scale.
 * Returns null for "solid" — caller falls back to a flat color fill.
 */
export function buildSvgPattern(
  doc: Document,
  opts: {
    id: string;
    pattern: OverlayPatternKey;
    color: string;
    scale: number;
  },
): SVGPatternElement | null {
  const { id, pattern, color, scale } = opts;
  if (pattern === "solid") return null;
  const s = scale;
  const pat = doc.createElementNS(SVG_NS, "pattern");
  pat.setAttribute("id", id);
  pat.setAttribute("patternUnits", "userSpaceOnUse");
  pat.setAttribute("width", String(s));
  pat.setAttribute("height", String(s));

  const appendRect = (x: number, y: number, w: number, h: number) => {
    const r = doc.createElementNS(SVG_NS, "rect");
    r.setAttribute("x", String(x));
    r.setAttribute("y", String(y));
    r.setAttribute("width", String(w));
    r.setAttribute("height", String(h));
    r.setAttribute("fill", color);
    pat.appendChild(r);
  };

  const appendLine = (
    x1: number, y1: number, x2: number, y2: number, w: number,
  ) => {
    const ln = doc.createElementNS(SVG_NS, "line");
    ln.setAttribute("x1", String(x1));
    ln.setAttribute("y1", String(y1));
    ln.setAttribute("x2", String(x2));
    ln.setAttribute("y2", String(y2));
    ln.setAttribute("stroke", color);
    ln.setAttribute("stroke-width", String(w));
    pat.appendChild(ln);
  };

  const appendArcStroke = (d: string, w: number) => {
    const p = doc.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", color);
    p.setAttribute("stroke-width", String(w));
    pat.appendChild(p);
  };

  switch (pattern) {
    case "stripes-right": {
      // Vertical stripe in the unit cell, rotated 45° → ↗ diagonal
      pat.setAttribute("patternTransform", "rotate(45)");
      appendRect(0, 0, s * 0.35, s);
      break;
    }
    case "stripes-left": {
      pat.setAttribute("patternTransform", "rotate(-45)");
      appendRect(0, 0, s * 0.35, s);
      break;
    }
    case "crosshatch": {
      const w = Math.max(1, s * 0.12);
      appendLine(0, 0, s, s, w);
      appendLine(s, 0, 0, s, w);
      break;
    }
    case "polka": {
      const circ = doc.createElementNS(SVG_NS, "circle");
      circ.setAttribute("cx", String(s / 2));
      circ.setAttribute("cy", String(s / 2));
      circ.setAttribute("r", String(s * 0.25));
      circ.setAttribute("fill", color);
      pat.appendChild(circ);
      break;
    }
    case "grid": {
      const w = Math.max(1, s * 0.1);
      // Draw two edges of the unit cell; tiling produces a full grid
      appendLine(0, 0, s, 0, w);
      appendLine(0, 0, 0, s, w);
      break;
    }
    case "zigzag": {
      const w = Math.max(1, s * 0.12);
      const poly = doc.createElementNS(SVG_NS, "polyline");
      poly.setAttribute(
        "points",
        `0,${s * 0.75} ${s * 0.5},${s * 0.25} ${s},${s * 0.75}`,
      );
      poly.setAttribute("fill", "none");
      poly.setAttribute("stroke", color);
      poly.setAttribute("stroke-width", String(w));
      pat.appendChild(poly);
      break;
    }
    case "triangles": {
      // Two triangles meeting at the cell midpoint, mirrored vertically
      const tri1 = doc.createElementNS(SVG_NS, "polygon");
      tri1.setAttribute("points", `0,${s} ${s},${s} ${s / 2},${s / 2}`);
      tri1.setAttribute("fill", color);
      pat.appendChild(tri1);
      const tri2 = doc.createElementNS(SVG_NS, "polygon");
      tri2.setAttribute("points", `0,0 ${s},0 ${s / 2},${s / 2}`);
      tri2.setAttribute("fill", color);
      pat.appendChild(tri2);
      break;
    }
    case "scales": {
      // Half-arc at the bottom of the cell, plus a top arc shifted half a cell
      // horizontally. Tile produces an overlapping fish-scale texture.
      const w = Math.max(1, s * 0.1);
      appendArcStroke(`M0,${s} A${s / 2},${s / 2} 0 0 1 ${s},${s}`, w);
      appendArcStroke(`M${-s / 2},${s / 2} A${s / 2},${s / 2} 0 0 1 ${s / 2},${s / 2}`, w);
      appendArcStroke(`M${s / 2},${s / 2} A${s / 2},${s / 2} 0 0 1 ${(3 * s) / 2},${s / 2}`, w);
      break;
    }
    case "checker": {
      appendRect(0, 0, s / 2, s / 2);
      appendRect(s / 2, s / 2, s / 2, s / 2);
      break;
    }
  }

  return pat;
}

/**
 * Draw a single pattern tile into a 2D canvas context, filling [0,0,scale,scale].
 * No-op for "solid". The context must already be set up — this function sets
 * fillStyle/strokeStyle/lineWidth as needed.
 *
 * Works with both CanvasRenderingContext2D and OffscreenCanvasRenderingContext2D
 * since the API surface used here is identical.
 */
export function drawPatternTile(
  c: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  opts: {
    pattern: OverlayPatternKey;
    color: string;
    scale: number;
  },
): void {
  const { pattern, color, scale } = opts;
  if (pattern === "solid") return;
  const s = scale;

  c.fillStyle = color;
  c.strokeStyle = color;

  switch (pattern) {
    case "stripes-right":
    case "stripes-left": {
      const w = Math.max(1, s * 0.35);
      c.save();
      c.translate(s / 2, s / 2);
      c.rotate(pattern === "stripes-right" ? Math.PI / 4 : -Math.PI / 4);
      c.translate(-s / 2, -s / 2);
      // A vertical stripe wide enough to cover the rotated tile
      c.fillRect(-s, -s, w + 2 * s, 3 * s);
      // Note: overdraw the rotated stripe so adjacent tiles seam cleanly
      c.restore();
      break;
    }
    case "crosshatch": {
      c.lineWidth = Math.max(1, s * 0.12);
      c.beginPath();
      c.moveTo(0, 0); c.lineTo(s, s);
      c.moveTo(s, 0); c.lineTo(0, s);
      c.stroke();
      break;
    }
    case "polka": {
      c.beginPath();
      c.arc(s / 2, s / 2, s * 0.25, 0, 2 * Math.PI);
      c.fill();
      break;
    }
    case "grid": {
      c.lineWidth = Math.max(1, s * 0.1);
      c.beginPath();
      c.moveTo(0, 0); c.lineTo(s, 0);
      c.moveTo(0, 0); c.lineTo(0, s);
      c.stroke();
      break;
    }
    case "zigzag": {
      c.lineWidth = Math.max(1, s * 0.12);
      c.beginPath();
      c.moveTo(0, s * 0.75);
      c.lineTo(s * 0.5, s * 0.25);
      c.lineTo(s, s * 0.75);
      c.stroke();
      break;
    }
    case "triangles": {
      c.beginPath();
      c.moveTo(0, s); c.lineTo(s, s); c.lineTo(s / 2, s / 2); c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(0, 0); c.lineTo(s, 0); c.lineTo(s / 2, s / 2); c.closePath();
      c.fill();
      break;
    }
    case "scales": {
      c.lineWidth = Math.max(1, s * 0.1);
      c.beginPath();
      c.arc(s / 2, s, s / 2, Math.PI, 2 * Math.PI);
      c.stroke();
      c.beginPath();
      c.arc(0, s / 2, s / 2, Math.PI, 2 * Math.PI);
      c.stroke();
      c.beginPath();
      c.arc(s, s / 2, s / 2, Math.PI, 2 * Math.PI);
      c.stroke();
      break;
    }
    case "checker": {
      c.fillRect(0, 0, s / 2, s / 2);
      c.fillRect(s / 2, s / 2, s / 2, s / 2);
      break;
    }
  }
}

/** Slugify a color string into a stable id-safe token (for SVG pattern ids). */
export function colorToIdToken(color: string): string {
  return color.replace(/[^a-zA-Z0-9]/g, "");
}
