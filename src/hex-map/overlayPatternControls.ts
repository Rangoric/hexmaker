import { Setting } from "obsidian";
import {
  type OverlayPatternKey,
  OVERLAY_PATTERN_KEYS,
  OVERLAY_PATTERN_LABELS,
  MIN_PATTERN_SCALE,
  MAX_PATTERN_SCALE,
  MIN_PATTERN_OPACITY,
  MAX_PATTERN_OPACITY,
  buildSvgPattern,
} from "../overlayPatterns";
import type { OverlayStyle } from "../frontmatter";

const SVG_NS = "http://www.w3.org/2000/svg";
const PREVIEW_W = 120;
const PREVIEW_H = 36;

/**
 * Add a pattern dropdown + scale + opacity sliders + live preview to `containerEl`.
 * Returns the live state object; callers read this on Save and write to frontmatter.
 */
export function addOverlayPatternControls(
  containerEl: HTMLElement,
  initial: OverlayStyle,
  getColor: () => string,
): { state: OverlayStyle; refreshPreview: () => void } {
  const state: OverlayStyle = { ...initial };

  // ── Live preview ──────────────────────────────────────────────────────────
  const previewWrap = containerEl.createDiv({ cls: "duckmage-pattern-preview-wrap" });
  previewWrap.createSpan({
    text: "Preview",
    cls: "duckmage-pattern-preview-label",
  });
  const previewSvg = document.createElementNS(SVG_NS, "svg");
  previewSvg.setAttribute("width", String(PREVIEW_W));
  previewSvg.setAttribute("height", String(PREVIEW_H));
  previewSvg.classList.add("duckmage-pattern-preview-svg");
  previewWrap.appendChild(previewSvg);

  const refreshPreview = () => {
    previewSvg.replaceChildren();
    const color = getColor();
    if (state.pattern === "solid") {
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", "0");
      rect.setAttribute("y", "0");
      rect.setAttribute("width", String(PREVIEW_W));
      rect.setAttribute("height", String(PREVIEW_H));
      rect.setAttribute("fill", color);
      rect.setAttribute("opacity", String(state.opacity));
      previewSvg.appendChild(rect);
      return;
    }
    const defs = document.createElementNS(SVG_NS, "defs");
    const id = `dm-preview-${Math.random().toString(36).slice(2, 9)}`;
    const pat = buildSvgPattern(document, {
      id,
      pattern: state.pattern,
      color,
      scale: state.scale,
    });
    if (pat) defs.appendChild(pat);
    previewSvg.appendChild(defs);
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", String(PREVIEW_W));
    bg.setAttribute("height", String(PREVIEW_H));
    bg.setAttribute("fill", `url(#${id})`);
    bg.setAttribute("opacity", String(state.opacity));
    previewSvg.appendChild(bg);
  };

  refreshPreview();

  // ── Pattern dropdown ──────────────────────────────────────────────────────
  new Setting(containerEl).setName("Pattern").addDropdown((dd) => {
    for (const key of OVERLAY_PATTERN_KEYS) {
      dd.addOption(key, OVERLAY_PATTERN_LABELS[key]);
    }
    dd.setValue(state.pattern).onChange((v) => {
      state.pattern = v as OverlayPatternKey;
      refreshPreview();
    });
  });

  // ── Scale slider ──────────────────────────────────────────────────────────
  new Setting(containerEl).setName("Pattern scale").addSlider((sl) =>
    sl
      .setLimits(MIN_PATTERN_SCALE, MAX_PATTERN_SCALE, 1)
      .setValue(state.scale)
      .setDynamicTooltip()
      .onChange((v) => {
        state.scale = v;
        refreshPreview();
      }),
  );

  // ── Opacity slider ────────────────────────────────────────────────────────
  new Setting(containerEl).setName("Opacity").addSlider((sl) =>
    sl
      .setLimits(MIN_PATTERN_OPACITY, MAX_PATTERN_OPACITY, 0.05)
      .setValue(state.opacity)
      .setDynamicTooltip()
      .onChange((v) => {
        state.opacity = v;
        refreshPreview();
      }),
  );

  return { state, refreshPreview };
}
