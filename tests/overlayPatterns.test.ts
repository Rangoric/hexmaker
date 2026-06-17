import { describe, it } from "node:test";
import expect from "expect";
import {
  OVERLAY_PATTERN_KEYS,
  OVERLAY_PATTERN_LABELS,
  DEFAULT_OVERLAY_PATTERN_KEY,
  DEFAULT_OVERLAY_PATTERN_SCALE,
  DEFAULT_OVERLAY_PATTERN_OPACITY,
  MIN_PATTERN_SCALE,
  MAX_PATTERN_SCALE,
  MIN_PATTERN_OPACITY,
  MAX_PATTERN_OPACITY,
  isOverlayPatternKey,
  normalizeOverlayPatternKey,
  normalizeOverlayPatternScale,
  normalizeOverlayPatternOpacity,
  colorToIdToken,
} from "../src/overlayPatterns";

describe("OVERLAY_PATTERN_LABELS", () => {
  it("has a label for every pattern key", () => {
    for (const key of OVERLAY_PATTERN_KEYS) {
      expect(OVERLAY_PATTERN_LABELS[key]).toBeTruthy();
      expect(typeof OVERLAY_PATTERN_LABELS[key]).toBe("string");
    }
  });

  it("includes the starter set (10 patterns)", () => {
    expect(OVERLAY_PATTERN_KEYS.length).toBe(10);
    expect(OVERLAY_PATTERN_KEYS).toContain("solid");
    expect(OVERLAY_PATTERN_KEYS).toContain("stripes-right");
    expect(OVERLAY_PATTERN_KEYS).toContain("stripes-left");
    expect(OVERLAY_PATTERN_KEYS).toContain("crosshatch");
    expect(OVERLAY_PATTERN_KEYS).toContain("polka");
    expect(OVERLAY_PATTERN_KEYS).toContain("grid");
    expect(OVERLAY_PATTERN_KEYS).toContain("zigzag");
    expect(OVERLAY_PATTERN_KEYS).toContain("triangles");
    expect(OVERLAY_PATTERN_KEYS).toContain("scales");
    expect(OVERLAY_PATTERN_KEYS).toContain("checker");
  });
});

describe("isOverlayPatternKey", () => {
  it("accepts every key in the list", () => {
    for (const key of OVERLAY_PATTERN_KEYS) {
      expect(isOverlayPatternKey(key)).toBe(true);
    }
  });

  it("rejects unknown strings, non-strings, null, undefined", () => {
    expect(isOverlayPatternKey("not-a-pattern")).toBe(false);
    expect(isOverlayPatternKey("")).toBe(false);
    expect(isOverlayPatternKey(null)).toBe(false);
    expect(isOverlayPatternKey(undefined)).toBe(false);
    expect(isOverlayPatternKey(42)).toBe(false);
    expect(isOverlayPatternKey({})).toBe(false);
  });
});

describe("normalizeOverlayPatternKey", () => {
  it("returns valid keys unchanged", () => {
    expect(normalizeOverlayPatternKey("polka")).toBe("polka");
    expect(normalizeOverlayPatternKey("solid")).toBe("solid");
  });

  it("falls back to default for invalid input", () => {
    expect(normalizeOverlayPatternKey("bogus")).toBe(DEFAULT_OVERLAY_PATTERN_KEY);
    expect(normalizeOverlayPatternKey(undefined)).toBe(DEFAULT_OVERLAY_PATTERN_KEY);
    expect(normalizeOverlayPatternKey(null)).toBe(DEFAULT_OVERLAY_PATTERN_KEY);
    expect(normalizeOverlayPatternKey(123)).toBe(DEFAULT_OVERLAY_PATTERN_KEY);
  });
});

describe("normalizeOverlayPatternScale", () => {
  it("accepts in-range numbers", () => {
    expect(normalizeOverlayPatternScale(16)).toBe(16);
    expect(normalizeOverlayPatternScale(MIN_PATTERN_SCALE)).toBe(MIN_PATTERN_SCALE);
    expect(normalizeOverlayPatternScale(MAX_PATTERN_SCALE)).toBe(MAX_PATTERN_SCALE);
  });

  it("clamps out-of-range values", () => {
    expect(normalizeOverlayPatternScale(0)).toBe(MIN_PATTERN_SCALE);
    expect(normalizeOverlayPatternScale(1000)).toBe(MAX_PATTERN_SCALE);
    expect(normalizeOverlayPatternScale(-5)).toBe(MIN_PATTERN_SCALE);
  });

  it("parses strings", () => {
    expect(normalizeOverlayPatternScale("24")).toBe(24);
    expect(normalizeOverlayPatternScale("24.5")).toBe(24.5);
  });

  it("falls back to default for invalid input", () => {
    expect(normalizeOverlayPatternScale("nope")).toBe(DEFAULT_OVERLAY_PATTERN_SCALE);
    expect(normalizeOverlayPatternScale(undefined)).toBe(DEFAULT_OVERLAY_PATTERN_SCALE);
    expect(normalizeOverlayPatternScale(null)).toBe(DEFAULT_OVERLAY_PATTERN_SCALE);
    expect(normalizeOverlayPatternScale(NaN)).toBe(DEFAULT_OVERLAY_PATTERN_SCALE);
  });
});

describe("normalizeOverlayPatternOpacity", () => {
  it("accepts in-range numbers", () => {
    expect(normalizeOverlayPatternOpacity(0.5)).toBe(0.5);
    expect(normalizeOverlayPatternOpacity(MIN_PATTERN_OPACITY)).toBe(MIN_PATTERN_OPACITY);
    expect(normalizeOverlayPatternOpacity(MAX_PATTERN_OPACITY)).toBe(MAX_PATTERN_OPACITY);
  });

  it("clamps out-of-range values", () => {
    expect(normalizeOverlayPatternOpacity(0)).toBe(MIN_PATTERN_OPACITY);
    expect(normalizeOverlayPatternOpacity(2)).toBe(MAX_PATTERN_OPACITY);
    expect(normalizeOverlayPatternOpacity(-1)).toBe(MIN_PATTERN_OPACITY);
  });

  it("parses strings", () => {
    expect(normalizeOverlayPatternOpacity("0.3")).toBe(0.3);
  });

  it("falls back to default for invalid input", () => {
    expect(normalizeOverlayPatternOpacity("nope")).toBe(DEFAULT_OVERLAY_PATTERN_OPACITY);
    expect(normalizeOverlayPatternOpacity(undefined)).toBe(DEFAULT_OVERLAY_PATTERN_OPACITY);
  });
});

describe("colorToIdToken", () => {
  it("strips non-alphanumeric characters", () => {
    expect(colorToIdToken("#ff0099")).toBe("ff0099");
    expect(colorToIdToken("rgb(10, 20, 30)")).toBe("rgb102030");
    expect(colorToIdToken("red")).toBe("red");
  });

  it("returns empty string for purely punctuation input", () => {
    expect(colorToIdToken("---")).toBe("");
  });
});
