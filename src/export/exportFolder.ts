/**
 * Helpers for resolving and creating the export destination folder.
 */

import type { App } from "obsidian";
import { normalizeFolder } from "../utils";
import type HexmakerPlugin from "../HexmakerPlugin";

/**
 * Resolve the configured export folder, defaulting to `{worldFolder}/exports`
 * (or just `exports` if `worldFolder` is empty). Returns a normalized path
 * suitable for vault operations.
 */
export function resolveExportFolder(plugin: HexmakerPlugin): string {
  const configured = normalizeFolder(plugin.settings.exportFolder ?? "");
  if (configured) return configured;
  const world = normalizeFolder(plugin.settings.worldFolder ?? "");
  return world ? `${world}/exports` : "exports";
}

/**
 * Ensure the export folder (and any missing ancestors) exist. Idempotent.
 */
export async function ensureExportFolder(plugin: HexmakerPlugin): Promise<string> {
  const folder = resolveExportFolder(plugin);
  await ensureFolder(plugin.app, folder);
  return folder;
}

/** Create the folder if missing. Quietly tolerates concurrent creation. */
async function ensureFolder(app: App, path: string): Promise<void> {
  if (app.vault.getAbstractFileByPath(path)) return;
  try {
    await app.vault.createFolder(path);
  } catch {
    /* race: already exists */
  }
}
