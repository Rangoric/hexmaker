import { App, Notice, TFolder } from "obsidian";
import { HexmakerModal } from "../HexmakerModal";
import type HexmakerPlugin from "../HexmakerPlugin";
import type { HexMapView } from "./HexMapView";
import { normalizeFolder } from "../utils";

export class MapModal extends HexmakerModal {
  constructor(
    app: App,
    private plugin: HexmakerPlugin,
    private view: HexMapView,
    private onChanged: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Maps");
    this.makeDraggable();
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("duckmage-region-modal");

    // Switch map list
    contentEl.createEl("h4", { text: "Switch map" });
    const list = contentEl.createEl("ul", { cls: "duckmage-region-list" });
    for (const map of this.plugin.settings.maps) {
      const li = list.createEl("li", {
        cls:
          "duckmage-region-item" +
          (map.name === this.view.activeMapName ? " is-active" : ""),
      });
      li.createSpan({ text: map.name });
      li.createSpan({
        cls: "duckmage-region-palette-badge",
        text: map.paletteName,
      });
      li.addEventListener("click", () => {
        this.view.activeMapName = map.name;
        this.onChanged();
        this.close();
      });
    }

    // Rename current map
    contentEl.createEl("h4", { text: "Rename current map" });
    const renameRow = contentEl.createDiv({ cls: "duckmage-region-row" });
    const renameInput = renameRow.createEl("input", {
      type: "text",
      value: this.view.activeMapName,
    });
    const renameBtn = renameRow.createEl("button", {
      text: "Rename",
      cls: "mod-cta",
    });
    renameBtn.addEventListener(
      "click",
      () =>
        void this.renameMap(
          renameInput.value.trim(),
          renameBtn,
          renameInput,
        ),
    );
    renameInput.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter")
        void this.renameMap(
          renameInput.value.trim(),
          renameBtn,
          renameInput,
        );
    });

    // Create new map
    contentEl.createEl("h4", { text: "New map" });
    const createRow = contentEl.createDiv({ cls: "duckmage-region-row" });
    const nameInput = createRow.createEl("input", {
      type: "text",
      placeholder: "map-name",
    });
    const colsInput = createRow.createEl("input", {
      type: "number",
      value: "20",
    });
    colsInput.setCssProps({ width: "55px" });
    const rowsInput = createRow.createEl("input", {
      type: "number",
      value: "16",
    });
    rowsInput.setCssProps({ width: "55px" });

    const paletteSelect = createRow.createEl("select");
    for (const pal of this.plugin.settings.terrainPalettes) {
      paletteSelect.createEl("option", { value: pal.name, text: pal.name });
    }

    const createBtn = createRow.createEl("button", {
      text: "Create",
      cls: "mod-cta",
    });
    createBtn.addEventListener(
      "click",
      () =>
        void this.createMap(
          nameInput.value.trim(),
          Number(colsInput.value) || 20,
          Number(rowsInput.value) || 16,
          paletteSelect.value,
          createBtn,
          nameInput,
          colsInput,
          rowsInput,
          paletteSelect,
        ),
    );
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  private async renameMap(
    raw: string,
    btn: HTMLButtonElement,
    input: HTMLInputElement,
  ): Promise<void> {
    const newName = this.slugify(raw);
    if (!newName || newName === this.view.activeMapName) return;
    if (this.plugin.settings.maps.some((r) => r.name === newName)) {
      new Notice(`Map "${newName}" already exists.`);
      return;
    }
    btn.setText("Renaming…");
    btn.disabled = true;
    input.disabled = true;
    const hexFolder = normalizeFolder(this.plugin.settings.hexFolder);
    const oldPath = hexFolder
      ? `${hexFolder}/${this.view.activeMapName}`
      : this.view.activeMapName;
    const newPath = hexFolder ? `${hexFolder}/${newName}` : newName;
    const oldFolder = this.app.vault.getAbstractFileByPath(oldPath);
    if (oldFolder instanceof TFolder) {
      try {
        await this.app.fileManager.renameFile(oldFolder, newPath);
      } catch (e) {
        new Notice(
          `Rename failed: ${e instanceof Error ? e.message : String(e)}`,
        );
        btn.setText("Rename");
        btn.disabled = false;
        input.disabled = false;
        return;
      }
    }
    const map = this.plugin.getMap(this.view.activeMapName);
    if (map) map.name = newName;
    if (this.plugin.settings.defaultMap === this.view.activeMapName) {
      this.plugin.settings.defaultMap = newName;
    }
    this.view.activeMapName = newName;
    await this.plugin.saveSettings();
    this.onChanged();
    this.render();
  }

  private async createMap(
    raw: string,
    cols: number,
    rows: number,
    paletteName: string,
    btn: HTMLButtonElement,
    ...inputs: (HTMLInputElement | HTMLSelectElement)[]
  ): Promise<void> {
    const name = this.slugify(raw);
    if (!name) {
      new Notice("Enter a map name.");
      return;
    }
    if (this.plugin.settings.maps.some((r) => r.name === name)) {
      new Notice(`Map "${name}" already exists.`);
      return;
    }

    btn.setText(`Generating 0 / ${cols * rows}…`);
    btn.disabled = true;
    for (const input of inputs) input.disabled = true;

    const hexFolder = normalizeFolder(this.plugin.settings.hexFolder);
    const folderPath = hexFolder ? `${hexFolder}/${name}` : name;
    if (!this.app.vault.getAbstractFileByPath(folderPath)) {
      try {
        await this.app.vault.createFolder(folderPath);
      } catch {
        /* exists */
      }
    }
    this.plugin.settings.maps.push({
      name,
      paletteName,
      gridSize: { cols, rows },
      gridOffset: { x: 0, y: 0 },
      pathChains: [],
    });
    this.view.activeMapName = name;
    await this.plugin.saveSettings();
    this.onChanged();

    const xs = Array.from({ length: cols }, (_, i) => i);
    const ys = Array.from({ length: rows }, (_, i) => i);
    const total = cols * rows;
    let created;
    const created_ = await this.plugin.generateHexNotes(
      name,
      xs,
      ys,
      (done) => {
        created = done;
        btn.setText(`Generating ${done} / ${total}…`);
      },
    );
    created = created_;
    if (created > 0)
      new Notice(
        `Hexmaker: generated ${created} hex note${created !== 1 ? "s" : ""} for "${name}".`,
      );
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
