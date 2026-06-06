/**
 * Markdown serialization helpers for the export pipeline.
 *
 * For Phase 1 this is intentionally minimal — most exporters generate clean
 * markdown directly from structured data, so the main job here is wikilink
 * handling for the MD output path.
 *
 * Phase 2 (book export with folder bundle) will need real link rewriting
 * (`[[Town]]` → `[text](town.md)`); save that complexity for then.
 */

export interface MdSerializeOptions {
  /**
   * What to do with `[[wikilinks]]`:
   * - `"preserve"`  — leave as-is (default; works in Obsidian, not elsewhere)
   * - `"to-bold"`   — strip to bold text (e.g. `[[Foo]]` → `**Foo**`)
   * - `"to-plain"`  — strip to plain text (e.g. `[[Foo|Bar]]` → `Bar`)
   */
  wikilinks?: "preserve" | "to-bold" | "to-plain";
}

export function serializeMarkdown(
  raw: string,
  opts: MdSerializeOptions = {},
): string {
  const mode = opts.wikilinks ?? "preserve";
  if (mode === "preserve") return raw;
  return rewriteWikilinks(raw, mode);
}

function rewriteWikilinks(
  raw: string,
  mode: "to-bold" | "to-plain",
): string {
  // Match `[[target]]` or `[[target|alias]]`. The alias (if present) is the
  // display text; otherwise the target itself is displayed (basename only).
  return raw.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_match: string, target: string, alias: string | undefined): string => {
      const display = (alias ?? basename(target)).trim();
      return mode === "to-bold" ? `**${display}**` : display;
    },
  );
}

function basename(target: string): string {
  const slashIdx = target.lastIndexOf("/");
  const name = slashIdx >= 0 ? target.slice(slashIdx + 1) : target;
  // Strip optional .md extension
  return name.replace(/\.md$/i, "");
}

/**
 * Strip a leading YAML frontmatter block (`---\n...\n---\n`) from a markdown
 * string. Returns the content untouched if no frontmatter is present.
 *
 * The frontmatter block must start at the very first character of the input —
 * we don't search beyond the start.
 */
export function stripFrontmatter(md: string): string {
  if (!md.startsWith("---")) return md;
  // The body group is optional so empty frontmatter (`---\n---`) also strips.
  const match = /^---\r?\n(?:[\s\S]*?\r?\n)?---\r?\n?/.exec(md);
  if (!match) return md;
  return md.slice(match[0].length).replace(/^\r?\n+/, "");
}
