import { App, TFile } from "obsidian";
import type { TokenEntry, TokenShape, TokenSize } from "./types";
import {
  type OverlayPatternKey,
  DEFAULT_OVERLAY_PATTERN_KEY,
  DEFAULT_OVERLAY_PATTERN_SCALE,
  DEFAULT_OVERLAY_PATTERN_OPACITY,
  normalizeOverlayPatternKey,
  normalizeOverlayPatternScale,
  normalizeOverlayPatternOpacity,
} from "./overlayPatterns";

export interface OverlayStyle {
  pattern: OverlayPatternKey;
  scale: number;
  opacity: number;
}

export const DEFAULT_OVERLAY_STYLE: OverlayStyle = {
  pattern: DEFAULT_OVERLAY_PATTERN_KEY,
  scale: DEFAULT_OVERLAY_PATTERN_SCALE,
  opacity: DEFAULT_OVERLAY_PATTERN_OPACITY,
};

export interface Frontmatter {
  [key: string]: string | string[] | boolean | undefined;
  terrain?: string;
  icon?: string;
  "gm-icon"?: string;
  tags?: string[];
  aliases?: string[];
  cssclass?: string;
  publish?: boolean;
  linkedFolder?: string;
  "roll-filter"?: boolean;
  "encounter-filter"?: boolean;
  "faction-color"?: string;
  "faction-pattern"?: string;
  "faction-pattern-scale"?: string;
  "faction-pattern-opacity"?: string;
  "region-color"?: string;
  "region-pattern"?: string;
  "region-pattern-scale"?: string;
  "region-pattern-opacity"?: string;
}

export function getFrontMatter(app: App, path: string) {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return null;
  const cache = app.metadataCache.getFileCache(file);
  const frontmatter = cache?.frontmatter as Frontmatter;
  return frontmatter;
}

export function getTerrainFromFile(app: App, path: string): string | null {
  const terrain = getFrontMatter(app, path)?.terrain;
  return typeof terrain === "string" ? terrain : null;
}

export async function setTerrainInFile(
  app: App,
  path: string,
  terrainKey: string | null,
): Promise<boolean> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return false;
  await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
    if (terrainKey === null) {
      delete fm["terrain"];
    } else {
      fm["terrain"] = terrainKey;
    }
  });
  return true;
}

export function getFactionColorFromFile(app: App, path: string): string | null {
  const color = getFrontMatter(app, path)?.["faction-color"];
  return typeof color === "string" ? color : null;
}

export async function setFactionColorInFile(
  app: App,
  path: string,
  color: string | null,
): Promise<boolean> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return false;
  await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
    if (color === null) {
      delete fm["faction-color"];
    } else {
      fm["faction-color"] = color;
    }
  });
  return true;
}

export function getFactionStyleFromFile(app: App, path: string): OverlayStyle {
  const fm = getFrontMatter(app, path);
  return {
    pattern: normalizeOverlayPatternKey(fm?.["faction-pattern"]),
    scale: normalizeOverlayPatternScale(fm?.["faction-pattern-scale"]),
    opacity: normalizeOverlayPatternOpacity(fm?.["faction-pattern-opacity"]),
  };
}

export async function setFactionStyleInFile(
  app: App,
  path: string,
  style: Partial<OverlayStyle>,
): Promise<boolean> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return false;
  await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
    if (style.pattern !== undefined) {
      if (style.pattern === DEFAULT_OVERLAY_PATTERN_KEY) delete fm["faction-pattern"];
      else fm["faction-pattern"] = style.pattern;
    }
    if (style.scale !== undefined) {
      if (style.scale === DEFAULT_OVERLAY_PATTERN_SCALE) delete fm["faction-pattern-scale"];
      else fm["faction-pattern-scale"] = String(style.scale);
    }
    if (style.opacity !== undefined) {
      if (style.opacity === DEFAULT_OVERLAY_PATTERN_OPACITY) delete fm["faction-pattern-opacity"];
      else fm["faction-pattern-opacity"] = String(style.opacity);
    }
  });
  return true;
}

export function getHexRegionFromFile(app: App, path: string): string | null {
  const region = getFrontMatter(app, path)?.["region"];
  return typeof region === "string" ? region : null;
}

export async function setHexRegionInFile(
  app: App,
  path: string,
  regionName: string | null,
): Promise<boolean> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return false;
  await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
    if (regionName === null) {
      delete fm["region"];
    } else {
      fm["region"] = regionName;
    }
  });
  return true;
}

export function getRegionColorFromFile(app: App, path: string): string | null {
  const color = getFrontMatter(app, path)?.["region-color"];
  return typeof color === "string" ? color : null;
}

export async function setRegionColorInFile(
  app: App,
  path: string,
  color: string | null,
): Promise<boolean> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return false;
  await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
    if (color === null) {
      delete fm["region-color"];
    } else {
      fm["region-color"] = color;
    }
  });
  return true;
}

export function getRegionStyleFromFile(app: App, path: string): OverlayStyle {
  const fm = getFrontMatter(app, path);
  return {
    pattern: normalizeOverlayPatternKey(fm?.["region-pattern"]),
    scale: normalizeOverlayPatternScale(fm?.["region-pattern-scale"]),
    opacity: normalizeOverlayPatternOpacity(fm?.["region-pattern-opacity"]),
  };
}

export async function setRegionStyleInFile(
  app: App,
  path: string,
  style: Partial<OverlayStyle>,
): Promise<boolean> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return false;
  await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
    if (style.pattern !== undefined) {
      if (style.pattern === DEFAULT_OVERLAY_PATTERN_KEY) delete fm["region-pattern"];
      else fm["region-pattern"] = style.pattern;
    }
    if (style.scale !== undefined) {
      if (style.scale === DEFAULT_OVERLAY_PATTERN_SCALE) delete fm["region-pattern-scale"];
      else fm["region-pattern-scale"] = String(style.scale);
    }
    if (style.opacity !== undefined) {
      if (style.opacity === DEFAULT_OVERLAY_PATTERN_OPACITY) delete fm["region-pattern-opacity"];
      else fm["region-pattern-opacity"] = String(style.opacity);
    }
  });
  return true;
}

export function getIconOverrideFromFile(app: App, path: string): string | null {
  const icon = getFrontMatter(app, path)?.icon;
  return typeof icon === "string" ? icon : null;
}

export async function setIconOverrideInFile(
  app: App,
  path: string,
  icon: string | null,
): Promise<boolean> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return false;
  await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
    if (icon === null) {
      delete fm["icon"];
    } else {
      fm["icon"] = icon;
    }
  });
  return true;
}

export function getGmIconFromFile(app: App, path: string): string | null {
  const icon = getFrontMatter(app, path)?.["gm-icon"];
  return typeof icon === "string" ? icon : null;
}

export async function setGmIconInFile(
  app: App,
  path: string,
  icon: string | null,
): Promise<boolean> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return false;
  await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
    if (icon === null) {
      delete fm["gm-icon"];
    } else {
      fm["gm-icon"] = icon;
    }
  });
  return true;
}

// ── Token helpers ─────────────────────────────────────────────────────────────

const VALID_SHAPES: TokenShape[] = ["circle", "square", "hexagon"];
const VALID_SIZES:  TokenSize[]  = ["sm", "md", "lg"];

export function getTokenDataFromCache(app: App, file: TFile): TokenEntry | null {
  const cache = app.metadataCache.getFileCache(file);
  const fm = cache?.frontmatter as Frontmatter | undefined;
  if (!fm?.["token"]) return null;
  const rawShape = fm["token-shape"] as string | undefined;
  const rawSize  = fm["token-size"]  as string | undefined;
  const tokenLink = typeof fm["token-link"] === "string" ? fm["token-link"] : undefined;

  // Resolve display title from the linked note if this is a proxy
  let title = file.basename;
  if (tokenLink) {
    const linked = app.vault.getAbstractFileByPath(tokenLink);
    if (linked instanceof TFile) title = linked.basename;
  }

  return {
    filePath: file.path,
    title,
    tokenLink,
    icon: typeof fm["token-icon"] === "string" ? fm["token-icon"] : undefined,
    hex: typeof fm["token-hex"] === "string" ? fm["token-hex"] : "",
    map: typeof fm["token-map"] === "string" ? fm["token-map"] : "",
    visible: fm["token-visible"] !== false,
    shape: VALID_SHAPES.includes(rawShape as TokenShape)
      ? (rawShape as TokenShape)
      : "circle",
    size: VALID_SIZES.includes(rawSize as TokenSize)
      ? (rawSize as TokenSize)
      : "md",
    color: typeof fm["token-color"] === "string" ? fm["token-color"] : undefined,
    border: typeof fm["token-border"] === "string" ? fm["token-border"] : undefined,
    description: typeof fm["token-description"] === "string" ? fm["token-description"] : undefined,
  };
}

export async function setTokenHex(
  app: App,
  path: string,
  hex: string,
  map: string,
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return;
  await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
    fm["token-hex"] = hex;
    fm["token-map"] = map;
  });
}

export async function setTokenVisible(
  app: App,
  path: string,
  visible: boolean,
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return;
  await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
    fm["token-visible"] = visible;
  });
}

export async function removeTokenFrontmatter(
  app: App,
  path: string,
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return;
  await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
    delete fm["token"];
    delete fm["token-icon"];
    delete fm["token-hex"];
    delete fm["token-map"];
    delete fm["token-visible"];
    delete fm["token-shape"];
    delete fm["token-size"];
    delete fm["token-color"];
    delete fm["token-border"];
    delete fm["token-link"];
    delete fm["token-description"];
  });
}

export async function applyTokenFrontmatter(
  app: App,
  path: string,
  data: {
    icon?: string;
    hex?: string;
    map?: string;
    visible?: boolean;
    shape?: TokenShape;
    size?: TokenSize;
    color?: string;
    border?: string;
    tokenLink?: string;
    description?: string;
  },
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return;
  await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
    fm["token"] = true;
    if (data.icon !== undefined) {
      if (data.icon) fm["token-icon"] = data.icon;
      else delete fm["token-icon"];
    }
    if (data.hex !== undefined) fm["token-hex"] = data.hex;
    if (data.map !== undefined) fm["token-map"] = data.map;
    if (data.visible !== undefined) fm["token-visible"] = data.visible;
    if (data.shape !== undefined) fm["token-shape"] = data.shape;
    if (data.size !== undefined) fm["token-size"] = data.size;
    if (data.color !== undefined) {
      if (data.color) fm["token-color"] = data.color; else delete fm["token-color"];
    }
    if (data.border !== undefined) {
      if (data.border) fm["token-border"] = data.border; else delete fm["token-border"];
    }
    if (data.tokenLink !== undefined) fm["token-link"] = data.tokenLink;
    if (data.description !== undefined) {
      if (data.description) fm["token-description"] = data.description;
      else delete fm["token-description"];
    }
  });
}

export function getSubmapFromFile(app: App, path: string): string | undefined {
  const val = getFrontMatter(app, path)?.["duckmage-submap"];
  return typeof val === "string" ? val : undefined;
}

export async function setSubmapInFile(
  app: App,
  path: string,
  mapName: string | null,
): Promise<boolean> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return false;
  await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
    if (mapName === null) delete fm["duckmage-submap"];
    else fm["duckmage-submap"] = mapName;
  });
  return true;
}
