import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
  { ignores: ["**/tests/**", "node_modules/", "*.mjs", "main.js", "dev/**"] },

  ...obsidianmd.configs.recommended,

  {
    files: ["**/*.{js,ts}"],

    languageOptions: {
      globals: {
        ...globals.browser,
        // Obsidian-injected globals for popout-window-aware code
        activeDocument: "readonly",
        activeWindow: "readonly",
      },
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
    },
    plugins: {
      obsidianmd, // Explicitly include the plugin
    },
    // You can add your own configuration to override or add rules
    rules: {
      "obsidianmd/sample-names": "off",
      "obsidianmd/ui/sentence-case": ["warn", { allowAutoFix: true }],
      // Allow console.warn/error for genuine error reporting; block debug console.log
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Enforce no-static-styles-assignment as an error so the local lint
      // breaks instead of waiting for the upstream obsidianmd reviewer bot
      // to catch it. The rule means: no direct `.style.foo = ...` and no
      // `setCssProps({ transform: ... })` for arbitrary CSS properties.
      // Set CSS custom properties (`--duckmage-...`) via setCssProps and
      // reference them from CSS rules instead.
      //
      // The other patterns the obsidianmd reviewer flags but that don't
      // have shipped rules in eslint-plugin-obsidianmd yet — `document` →
      // `activeDocument`, deprecated `setDynamicTooltip` — are documented
      // as conventions in CLAUDE.md and audited manually.
      "obsidianmd/no-static-styles-assignment": "error",
    },
  },
]);
