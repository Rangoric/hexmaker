import { App, Setting } from "obsidian";
import { HexmakerModal } from "../HexmakerModal";
import type HexmakerPlugin from "../HexmakerPlugin";

export class SubmapPickerModal extends HexmakerModal {
  constructor(
    app: App,
    private plugin: HexmakerPlugin,
    private current: string | undefined,
    private onLink: (mapName: string) => void,
    private onUnlink: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("duckmage-hex-editor");
    this.makeDraggable();

    contentEl.createEl("h2", { text: "Link submap" });

    const maps = this.plugin.settings.maps;
    if (maps.length === 0) {
      contentEl.createEl("p", {
        text: "No maps found. Create a map first.",
        cls: "duckmage-maplinkmodal-empty",
      });
      contentEl.createEl("button", { text: "Cancel" })
        .addEventListener("click", () => this.close());
      return;
    }

    let selectedMap = this.current ?? maps[0].name;
    let mapInput!: HTMLInputElement;

    // ── Map combo ─────────────────────────────────────────────────────────
    const mapLabel = contentEl.createDiv({ cls: "setting-item" });
    mapLabel.createDiv({ cls: "setting-item-info" }).createDiv({
      cls: "setting-item-name",
      text: "Map",
    });

    const controlEl = mapLabel.createDiv({ cls: "setting-item-control" });
    const comboWrap = controlEl.createDiv({ cls: "duckmage-link-combo" });
    mapInput = comboWrap.createEl("input", {
      type: "text",
      cls: "duckmage-link-combo-input",
      attr: { placeholder: "Filter maps…" },
    });
    // Start blank — selectedMap is just the fallback for the Link action
    mapInput.value = "";

    comboWrap.createEl("button", {
      text: "▾",
      cls: "duckmage-link-combo-arrow",
      attr: { title: "Show all" },
    }).addEventListener("mousedown", (e) => {
      e.preventDefault();
      if (dropdown.isShown()) closeDropdown();
      else openDropdown(mapInput.value);
    });

    const dropdown = comboWrap.createDiv({ cls: "duckmage-link-combo-dropdown" });
    dropdown.hide();

    let isOpen = false;

    const populateDropdown = (query: string) => {
      dropdown.empty();
      const q = query.trim().toLowerCase();
      const matches = maps.filter((m) => !q || m.name.toLowerCase().includes(q));
      if (matches.length === 0) {
        dropdown.createDiv({ cls: "duckmage-link-combo-empty", text: "No matching maps" });
        return;
      }
      for (const m of matches) {
        const item = dropdown.createDiv({ cls: "duckmage-link-combo-item" });
        item.textContent = m.name;
        item.addEventListener("mousedown", (e) => {
          e.preventDefault();
          selectedMap = m.name;
          mapInput.value = m.name;
          closeDropdown();
        });
      }
    };

    const scrollPane = comboWrap.closest<HTMLElement>(".modal-content");

    const openDropdown = (query: string) => {
      isOpen = true;
      populateDropdown(query);
      scrollPane?.addClass("duckmage-combo-open");
      dropdown.show();
    };

    const closeDropdown = () => {
      isOpen = false;
      dropdown.hide();
      scrollPane?.removeClass("duckmage-combo-open");
    };

    mapInput.addEventListener("focus", () => openDropdown(""));
    mapInput.addEventListener("blur", () => setTimeout(() => closeDropdown(), 150));
    mapInput.addEventListener("input", () => {
      if (!isOpen) openDropdown(mapInput.value);
      else populateDropdown(mapInput.value);
    });
    mapInput.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDropdown();
    });

    // ── Current submap indicator ──────────────────────────────────────────
    if (this.current) {
      new Setting(contentEl)
        .setName("Current")
        .setDesc(this.current);
    }

    // ── Buttons ───────────────────────────────────────────────────────────
    const btnRow = contentEl.createDiv({ cls: "duckmage-token-modal-buttons" });

    if (this.current) {
      btnRow.createEl("button", { text: "Remove link", cls: "mod-warning" })
        .addEventListener("click", () => { this.close(); this.onUnlink(); });
    }

    btnRow.createEl("button", { text: "Link", cls: "mod-cta" })
      .addEventListener("click", () => {
        const map = mapInput.value.trim() || selectedMap;
        this.close();
        this.onLink(map);
      });

    btnRow.createEl("button", { text: "Cancel" })
      .addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
