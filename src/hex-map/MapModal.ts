import { App, Notice, TFolder } from "obsidian";
import { HexmakerModal } from "../HexmakerModal";
import type HexmakerPlugin from "../HexmakerPlugin";
import type { HexMapView } from "./HexMapView";
import { normalizeFolder, slugify, getIconUrl, createIconEl } from "../utils";
import { renderNewMapFields } from "./newMapFields";
import { getSubmapFromFile, setSubmapInFile } from "../frontmatter";

export class MapModal extends HexmakerModal {
  private confirmingDelete: string | null = null;

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
    const canDelete = this.plugin.settings.maps.length > 1;
    for (const map of this.plugin.settings.maps) {
      const isActive = map.name === this.view.activeMapName;
      const isConfirming = this.confirmingDelete === map.name;

      const li = list.createEl("li", {
        cls:
          "duckmage-region-item duckmage-map-list-item" +
          (isActive ? " is-active" : ""),
      });

      if (isConfirming) {
        li.addClass("duckmage-map-item-confirming");
        li.createSpan({
          cls: "duckmage-map-delete-warning",
          text: `Delete "${map.name}"? This will trash all its hex notes.`,
        });
        const confirmBtn = li.createEl("button", {
          text: "Delete",
          cls: "mod-warning duckmage-map-confirm-btn",
        });
        confirmBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          void this.deleteMap(map.name);
        });
        const cancelBtn = li.createEl("button", {
          text: "Cancel",
          cls: "duckmage-map-cancel-btn",
        });
        cancelBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.confirmingDelete = null;
          this.render();
        });
      } else {
        // Terrain color swatch (if a terrain type is configured for this map)
        const terrainEntry = map.terrainType
          ? this.plugin.getMapPalette(map.name).find((t) => t.name === map.terrainType)
          : undefined;
        const swatch = li.createSpan({ cls: "duckmage-map-terrain-swatch" });
        if (terrainEntry?.color) {
          swatch.style.backgroundColor = terrainEntry.color;
          swatch.addClass("duckmage-map-terrain-swatch--set");
        }

        const nameSpan = li.createSpan({ text: map.name, cls: "duckmage-map-list-name" });
        nameSpan.addEventListener("click", () => {
          this.view.activeMapName = map.name;
          this.onChanged();
          this.close();
        });
        li.createSpan({
          cls: "duckmage-region-palette-badge",
          text: map.paletteName,
        });
        if (canDelete) {
          const deleteBtn = li.createEl("button", {
            text: "✕",
            cls: "duckmage-map-delete-btn",
          });
          deleteBtn.setAttribute("aria-label", "Delete map");
          deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.confirmingDelete = map.name;
            this.render();
          });
        }
      }
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

    // Terrain type for current map (sets submap center dot color)
    contentEl.createEl("h4", { text: "Map terrain theme" });
    const currentMap = this.plugin.getMap(this.view.activeMapName);
    const terrainPalette = this.plugin.getMapPalette(this.view.activeMapName);
    const terrainGrid = contentEl.createDiv({ cls: "duckmage-terrain-picker" });

    // "None" clear tile — always first
    const clearTile = terrainGrid.createDiv({
      cls: "duckmage-terrain-option duckmage-terrain-option-clear" +
        (!currentMap?.terrainType ? " is-selected" : ""),
    });
    clearTile.createDiv({ cls: "duckmage-terrain-preview duckmage-terrain-preview-clear" });
    clearTile.createSpan({ text: "None", cls: "duckmage-terrain-option-name" });
    clearTile.addEventListener("click", () => {
      const map = this.plugin.getMap(this.view.activeMapName);
      if (map) { map.terrainType = undefined; void this.plugin.saveSettings().then(() => this.render()); }
    });

    for (const t of terrainPalette) {
      const tile = terrainGrid.createDiv({
        cls: "duckmage-terrain-option" + (currentMap?.terrainType === t.name ? " is-selected" : ""),
      });
      const preview = tile.createDiv({ cls: "duckmage-terrain-preview" });
      preview.setCssProps({ "background-color": t.color });
      if (t.icon) {
        createIconEl(preview, getIconUrl(this.plugin, t.icon), t.name, t.iconColor, "duckmage-terrain-preview-icon");
      }
      tile.createSpan({ text: t.name, cls: "duckmage-terrain-option-name" });
      tile.addEventListener("click", () => {
        const map = this.plugin.getMap(this.view.activeMapName);
        if (map) { map.terrainType = t.name; void this.plugin.saveSettings().then(() => this.render()); }
      });
    }

    // Create new map
    contentEl.createEl("h4", { text: "New map" });
    const { nameInput, colsInput, rowsInput, paletteSelect } =
      renderNewMapFields(contentEl, this.plugin);
    const createBtn = nameInput
      .closest<HTMLElement>(".duckmage-region-row")!
      .createEl("button", { text: "Create", cls: "mod-cta" });
    const allInputs: (HTMLInputElement | HTMLSelectElement)[] = [
      nameInput, colsInput, rowsInput, paletteSelect,
    ];
    createBtn.addEventListener("click", () =>
      void this.handleCreate(
        nameInput.value.trim(),
        Number(colsInput.value) || 20,
        Number(rowsInput.value) || 16,
        paletteSelect.value,
        createBtn,
        allInputs,
      ),
    );
  }

  private async deleteMap(name: string): Promise<void> {
    const hexFolder = normalizeFolder(this.plugin.settings.hexFolder);
    const folderPath = hexFolder ? `${hexFolder}/${name}` : name;
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (folder instanceof TFolder) {
      try {
        await this.app.fileManager.trashFile(folder);
      } catch (e) {
        new Notice(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
        this.confirmingDelete = null;
        this.render();
        return;
      }
    }

    this.plugin.settings.maps = this.plugin.settings.maps.filter(
      (m) => m.name !== name,
    );

    if (this.plugin.settings.defaultMap === name) {
      this.plugin.settings.defaultMap =
        this.plugin.settings.maps[0]?.name ?? "";
    }

    if (this.view.activeMapName === name) {
      this.view.activeMapName = this.plugin.settings.maps[0]?.name ?? "";
    }

    // Clear duckmage-submap references pointing at the deleted map
    const submapRefs = this.app.vault.getMarkdownFiles().filter(
      (f) => getSubmapFromFile(this.app, f.path) === name,
    );
    await Promise.all(submapRefs.map((f) => setSubmapInFile(this.app, f.path, null)));

    this.confirmingDelete = null;
    await this.plugin.saveSettings();
    this.onChanged();
    this.render();
    new Notice(`Map "${name}" deleted.`);
  }

  private async renameMap(
    raw: string,
    btn: HTMLButtonElement,
    input: HTMLInputElement,
  ): Promise<void> {
    const newName = slugify(raw);
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
    const oldName = this.view.activeMapName;
    const map = this.plugin.getMap(oldName);
    if (map) map.name = newName;
    if (this.plugin.settings.defaultMap === oldName) {
      this.plugin.settings.defaultMap = newName;
    }
    this.view.activeMapName = newName;
    await this.plugin.updateSubmapReferences(oldName, newName);
    await this.plugin.saveSettings();
    this.onChanged();
    this.render();
  }

  private async handleCreate(
    raw: string,
    cols: number,
    rows: number,
    paletteName: string,
    btn: HTMLButtonElement,
    inputs: (HTMLInputElement | HTMLSelectElement)[],
  ): Promise<void> {
    btn.setText(`Generating…`);
    btn.disabled = true;
    for (const input of inputs) input.disabled = true;

    const result = await this.plugin.createNewMap(
      raw, cols, rows, paletteName,
      (done, total) => btn.setText(`Generating ${done} / ${total}…`),
    );

    if ("error" in result) {
      new Notice(result.error);
      btn.setText("Create");
      btn.disabled = false;
      for (const input of inputs) input.disabled = false;
      return;
    }

    this.view.activeMapName = result.name;
    this.onChanged();
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
