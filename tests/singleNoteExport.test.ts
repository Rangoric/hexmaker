import { describe, it } from "node:test";
import expect from "expect";
import { ensureLeadingTitle } from "../src/export/exporters/singleNote";

describe("ensureLeadingTitle", () => {
  it("returns content unchanged when it already starts with an H1", () => {
    const raw = "# Bandit Camp\n\nA hidden hideout.";
    expect(ensureLeadingTitle(raw, "Bandit Camp")).toBe(raw);
  });

  it("prepends '# {basename}' when the note has no H1", () => {
    const raw = "## Layout\n\nThree rooms.";
    expect(ensureLeadingTitle(raw, "Bandit Camp")).toBe(
      "# Bandit Camp\n\n## Layout\n\nThree rooms.",
    );
  });

  it("strips frontmatter before checking for H1", () => {
    const raw = "---\ntags: [hideout]\n---\n\n# Bandit Camp\n\nA hidden hideout.";
    expect(ensureLeadingTitle(raw, "Bandit Camp")).toBe(
      "# Bandit Camp\n\nA hidden hideout.",
    );
  });

  it("prepends title when frontmatter is followed by non-H1 content", () => {
    const raw = "---\ntags: [hideout]\n---\n\nA hidden hideout.";
    expect(ensureLeadingTitle(raw, "Bandit Camp")).toBe(
      "# Bandit Camp\n\nA hidden hideout.",
    );
  });

  it("collapses leading whitespace before the first content line", () => {
    const raw = "\n\n\n## Layout\n\nDetails.";
    expect(ensureLeadingTitle(raw, "Bandit Camp")).toBe(
      "# Bandit Camp\n\n## Layout\n\nDetails.",
    );
  });

  it("returns just the title for an empty note", () => {
    expect(ensureLeadingTitle("", "Empty Note")).toBe("# Empty Note");
  });

  it("returns just the title when the note is only frontmatter", () => {
    expect(ensureLeadingTitle("---\ntags: []\n---\n", "Empty Note")).toBe(
      "# Empty Note",
    );
  });

  it("doesn't prepend when content uses '#title' without a space (real H1 requires a space)", () => {
    // A line like "#tag" is a tag, not a heading. We should still prepend a title.
    const raw = "#mytag\n\nSome content.";
    expect(ensureLeadingTitle(raw, "Note")).toBe(
      "# Note\n\n#mytag\n\nSome content.",
    );
  });
});
