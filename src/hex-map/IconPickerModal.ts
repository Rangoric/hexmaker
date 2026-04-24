import { App, TFile, setIcon } from "obsidian";
import { HexmakerModal } from "../HexmakerModal";
import type HexmakerPlugin from "../HexmakerPlugin";
import { getIconUrl, normalizeFolder } from "../utils";

export class IconPickerModal extends HexmakerModal {
  private manageMode = false;

  constructor(
    app: App,
    private plugin: HexmakerPlugin,
    private onSelect: (iconName: string | null) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.addClass("duckmage-hex-editor");
    this.makeDraggable();
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    // ── Header ────────────────────────────────────────────────────────────
    const header = contentEl.createDiv({ cls: "duckmage-icon-picker-header" });
    header.createEl("h2", { text: "Paint icon" });
    const manageBtn = header.createEl("button", {
      cls: "duckmage-icon-manage-btn",
      text: this.manageMode ? "← pick icons" : "Manage icons",
    });
    manageBtn.addEventListener("click", () => {
      this.manageMode = !this.manageMode;
      this.render();
    });

    // ── Add section (manage mode only) ────────────────────────────────────
    if (this.manageMode) {
      this.renderAddSection(contentEl);
    }

    // ── Icon grid ─────────────────────────────────────────────────────────
    const section = contentEl.createDiv({ cls: "duckmage-editor-section" });
    const grid = section.createDiv({ cls: "duckmage-icon-picker" });

    const hidden = new Set(this.plugin.settings.hiddenIcons ?? []);

    if (!this.manageMode) {
      // Remove icon option
      const clearBtn = grid.createDiv({ cls: "duckmage-icon-option" });
      clearBtn.createDiv({
        cls: "duckmage-icon-preview duckmage-icon-preview-clear",
      });
      clearBtn.createSpan({ text: "Remove", cls: "duckmage-icon-option-name" });
      clearBtn.addEventListener("click", () => {
        this.onSelect(null);
        this.close();
      });
    }

    const icons = this.manageMode
      ? this.plugin.availableIcons
      : this.plugin.availableIcons.filter((i) => !hidden.has(i));

    for (const icon of icons) {
      const isHidden = hidden.has(icon);
      const label = icon
        .replace(/^bw-/, "")
        .replace(/\.(png|jpg|jpeg|gif|svg|webp)$/i, "")
        .replace(/-/g, " ");

      const btn = grid.createDiv({
        cls: `duckmage-icon-option${isHidden ? " duckmage-icon-hidden" : ""}`,
      });
      const preview = btn.createDiv({ cls: "duckmage-icon-preview" });
      const img = preview.createEl("img", { cls: "duckmage-icon-preview-img" });
      img.src = getIconUrl(this.plugin, icon);
      img.alt = label;
      btn.createSpan({ text: label, cls: "duckmage-icon-option-name" });

      if (this.manageMode) {
        const hideBtn = btn.createEl("button", {
          cls: "duckmage-icon-hide-btn",
          attr: { title: isHidden ? "Show icon" : "Hide icon" },
        });
        setIcon(hideBtn, isHidden ? "eye" : "eye-off");
        hideBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const list = this.plugin.settings.hiddenIcons ?? [];
          this.plugin.settings.hiddenIcons = isHidden
            ? list.filter((h) => h !== icon)
            : [...list, icon];
          void this.plugin.saveSettings().then(() => this.render());
        });
      } else {
        btn.addEventListener("click", () => {
          this.onSelect(icon);
          this.close();
        });
      }
    }
  }

  private renderAddSection(container: HTMLElement): void {
    const section = container.createDiv({ cls: "duckmage-icon-add-section" });
    const iconsFolder = normalizeFolder(this.plugin.settings.iconsFolder ?? "");

    if (!iconsFolder) {
      section.createEl("p", {
        text: "Set an icons folder in settings to upload custom icons.",
        cls: "duckmage-icon-add-warning",
      });
      return;
    }

    const dropZone = section.createDiv({ cls: "duckmage-icon-drop-zone" });
    dropZone.createSpan({
      text: "Drag & drop images here, or click to browse",
    });
    dropZone.createEl("br");
    dropZone.createEl("small", {
      text: "For best results, use 64–128 px square images (.png, .jpg, .gif, .svg, .webp)",
    });

    const statusEl = section.createEl("p", { cls: "duckmage-icon-add-status" });

    const handleFiles = async (fileList: FileList | File[]): Promise<void> => {
      const files = Array.from(fileList).filter((f) =>
        /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f.name),
      );
      if (!files.length) {
        statusEl.setText("No supported image files found.");
        return;
      }
      let added = 0;
      for (const file of files) {
        const targetPath = `${iconsFolder}/${file.name}`;
        const buffer = await file.arrayBuffer();
        const existing =
          this.plugin.app.vault.getAbstractFileByPath(targetPath);
        if (existing instanceof TFile) {
          await this.plugin.app.vault.modifyBinary(existing, buffer);
        } else {
          await this.plugin.app.vault.createBinary(targetPath, buffer);
        }
        added++;
      }
      this.plugin.loadAvailableIcons();
      statusEl.setText(`Added ${added} icon${added === 1 ? "" : "s"}.`);
      setTimeout(() => this.render(), 800);
    };

    // Hidden file input
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".png,.jpg,.jpeg,.gif,.svg,.webp";
    fileInput.multiple = true;
    fileInput.addEventListener("change", () => {
      void handleFiles(fileInput.files ?? []);
    });

    // Drag-and-drop
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.addClass("is-dragover");
    });
    dropZone.addEventListener("dragleave", () => {
      dropZone.removeClass("is-dragover");
    });
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.removeClass("is-dragover");
      void handleFiles(e.dataTransfer?.files ?? []);
    });

    // Click anywhere on drop zone to browse
    dropZone.addEventListener("click", () => fileInput.click());
  }
}
