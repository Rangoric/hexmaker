---
description: Run ESLint on the duckmage plugin and fix all issues
allowed-tools: Bash(npm:*), Read, Edit, Grep
---

Current directory: !`pwd`

Run the linter for the duckmage Obsidian plugin:

```
cd /mnt/c/Users/markr/Documents/KB/journal/.obsidian/plugins/duckmage-plugin && npm run lint 2>&1
```

Report the results clearly:
- If there are **no issues**, confirm the plugin is lint-clean.
- If there are **errors or warnings**, list each one with file, line, rule name, and a brief description.

Then fix every issue using the guidance below, edit the affected files directly, and re-run lint to confirm zero issues remain.

---

## Fix guidance (update this section as new patterns are encountered)

### `@typescript-eslint/no-unsafe-argument` / `no-unsafe-call` / `no-unsafe-member-access`
Caused by casting to `any` and then using the result. Typically appears when accessing undocumented Obsidian API events (e.g., `"editor-menu"`).

**Fix**: Replace the `any` cast with a typed local interface that precisely describes the call, then cast through `unknown`:
```typescript
interface WorkspaceWithEditorMenu {
  on(name: "editor-menu", callback: (menu: Menu, editor: Editor) => void): EventRef;
}
this.registerEvent(
  (this.app.workspace as unknown as WorkspaceWithEditorMenu).on("editor-menu", (menu, editor) => { ... })
);
```
This removes `any` entirely; `unknown as SomeInterface` is fully type-safe.

### `@typescript-eslint/no-unnecessary-type-assertion`
A cast (`as T`) where TypeScript already knows the value has type `T`.

**Common cause — `createEl` with a specific tag**: Obsidian's `createEl<K>(tag: K, ...)` returns `HTMLElementTagNameMap[K]`, so `createEl("input", ...)` already returns `HTMLInputElement`. Any subsequent `as HTMLInputElement` cast is redundant.

**Common cause — ambient types not imported**: Using `as DomElementInfo` inline causes ESLint's `no-undef` to fire because the ambient type isn't an explicit import. Drop the cast entirely — `{ type: "checkbox" }` is assignable to `DomElementInfo` without a cast.

**Fix**: Delete the redundant cast. If the type isn't narrow enough, use `as unknown as T` (two-step) rather than a direct `as T` — but prefer removing the cast entirely.

### `obsidianmd/ui/sentence-case`
UI text must use sentence case: only the first word and proper nouns are capitalised.

**Fix A — change the text** (preferred for ordinary strings):
- Leading symbol counts as first token, so the following word is lowercase:
  - `"← Pick icons"` → `"← pick icons"`
  - `"↩ Map mode"` → `"↩ map mode"`
- Parenthetical range notation: `"(A → Z)"` → `"(a → z)"`
- Mid-sentence acronyms (e.g. "Remove GM icon"): the rule flags consecutive capitals that are not the first word. Reword to move the acronym to the front, avoid it, or use the full term in lowercase: `"Remove icon"` or `"GM icon: remove"`.

**Fix B — eslint-disable** for intentional special-case UI text that would look wrong if sentence-cased:
- Short abbreviation labels: `"wt ↑"`, `"a→z"`, `"z→a"` — these are symbols/abbreviations, not sentences
- Settings path references with proper nouns: `'Set … in Settings → "Icons folder" …'`
- The linter flags the **line containing the string literal**, not the `createEl(` call line. For multi-line object args, place the disable comment on the line directly before the `text:` or `attr:` property, inside the object literal:
  ```typescript
  entriesHeadingRow.createEl("button", {
    // eslint-disable-next-line obsidianmd/ui/sentence-case
    text: "wt ↑",
    ...
  });
  ```
- For single-line `setText` calls or `.title =` assignments, the disable goes on the line before as usual

### `@typescript-eslint/no-floating-promises`
An async call whose returned Promise is not awaited or handled.

**Fix**: Prefix with `void` to explicitly discard, or `await` inside an async context:
```typescript
void this.plugin.saveSettings();
// or
await this.plugin.saveSettings();
```

### `@typescript-eslint/no-misused-promises`
Passing an async function where a sync one is expected (e.g., event listeners).

**Fix**: Wrap in a void IIFE:
```typescript
el.addEventListener("click", () => { void (async () => { ... })(); });
```

### `@typescript-eslint/restrict-template-expressions`
Using a non-string value inside a template literal without explicit conversion.

**Fix**: Convert explicitly: `${String(value)}` or `${value ?? ""}`.

---

After fixing all issues, run `/rebuild` to confirm the build and tests still pass.
