import { setIcon } from "obsidian";
import type HexmakerPlugin from "../HexmakerPlugin";
import type { MapData } from "../types";

// ── Abstract base ────────────────────────────────────────────────────────────

export abstract class HexSidePanel {
  protected panelEl: HTMLDivElement;
  private toggleBtn: HTMLButtonElement;
  private _isOpen = false;
  /** Called just before this panel opens — used for mutual exclusion. */
  public onBeforeOpen?: () => void;

  constructor(
    container: HTMLElement,
    iconName: string,
    rightOffset: number,
    title: string,
  ) {
    this.toggleBtn = container.createEl("button", {
      cls: "duckmage-panel-toggle-btn",
      attr: { title },
    });
    this.toggleBtn.style.right = `${rightOffset}px`;
    setIcon(this.toggleBtn, iconName);
    this.toggleBtn.addEventListener("click", () => this.toggle());

    this.panelEl = container.createDiv({ cls: "duckmage-side-panel" });
    this.panelEl.style.right = `${rightOffset - 4}px`;
    this.panelEl.hide();
    // Subclasses must call this.buildPanel(this.panelEl) after super() returns,
    // once their own fields are initialised.
  }

  protected abstract buildPanel(panel: HTMLDivElement): void;

  toggle(): void {
    if (this._isOpen) this.close();
    else this.open();
  }

  open(): void {
    this.onBeforeOpen?.();
    this._isOpen = true;
    this.panelEl.show();
    this.toggleBtn.addClass("is-active");
  }

  close(): void {
    this._isOpen = false;
    this.panelEl.hide();
    this.toggleBtn.removeClass("is-active");
  }

  get isOpen(): boolean {
    return this._isOpen;
  }
}

// ── Drawing tool panel ───────────────────────────────────────────────────────

/** Callback signature the view passes in to build the drawing toolbar content. */
export type DrawingToolbarBuilder = (panel: HTMLDivElement) => void;

export class DrawingToolPanel extends HexSidePanel {
  private builder: DrawingToolbarBuilder;

  constructor(container: HTMLElement, builder: DrawingToolbarBuilder) {
    super(container, "pencil", 8, "Drawing tools");
    this.builder = builder;
    this.buildPanel(this.panelEl);
  }

  protected buildPanel(panel: HTMLDivElement): void {
    this.builder(panel);
  }
}

// ── Overlay panel ────────────────────────────────────────────────────────────

export type OverlayKey = "showCoords" | "showTerrainIcons" | "showIconOverrides";

interface OverlayOption {
  key: OverlayKey;
  label: string;
  cssClass: string;
}

const OVERLAY_OPTIONS: OverlayOption[] = [
  { key: "showCoords",        label: "Show coordinates",   cssClass: "duckmage-hide-coords" },
  { key: "showTerrainIcons",  label: "Show terrain icons", cssClass: "duckmage-hide-terrain-icons" },
  { key: "showIconOverrides", label: "Show icon overrides",cssClass: "duckmage-hide-icon-overrides" },
];

export class OverlayPanel extends HexSidePanel {
  private plugin: HexmakerPlugin;
  private getViewportEl: () => HTMLElement | null;
  private getActiveMap: () => MapData;
  private onFactionOverlayChange: (show: boolean) => void;
  private checkboxes = new Map<OverlayKey, HTMLInputElement>();
  private factionOverlayCb: HTMLInputElement | null = null;

  constructor(
    container: HTMLElement,
    plugin: HexmakerPlugin,
    getViewportEl: () => HTMLElement | null,
    getActiveMap: () => MapData,
    onFactionOverlayChange: (show: boolean) => void,
  ) {
    super(container, "layers", 44, "Map overlays");
    this.plugin = plugin;
    this.getViewportEl = getViewportEl;
    this.getActiveMap = getActiveMap;
    this.onFactionOverlayChange = onFactionOverlayChange;
    this.buildPanel(this.panelEl);
  }

  protected buildPanel(panel: HTMLDivElement): void {
    for (const opt of OVERLAY_OPTIONS) {
      const row = panel.createDiv({ cls: "duckmage-overlay-row" });

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = true; // default — refreshed in syncToRegion()
      row.appendChild(cb);
      this.checkboxes.set(opt.key, cb);

      const label = row.createSpan({ text: opt.label, cls: "duckmage-overlay-label" });

      const apply = () => {
        const region = this.getActiveMap();
        region[opt.key] = cb.checked;
        void this.plugin.saveSettings();
        this.applyClass(opt, cb.checked);
      };

      cb.addEventListener("change", apply);
      label.addEventListener("click", () => {
        cb.checked = !cb.checked;
        apply();
      });
    }

    // Faction overlay — triggers a re-render rather than a CSS class toggle
    const factionRow = panel.createDiv({ cls: "duckmage-overlay-row" });
    const factionCb = document.createElement("input");
    factionCb.type = "checkbox";
    factionCb.checked = false; // default — refreshed in syncToRegion()
    factionRow.appendChild(factionCb);
    this.factionOverlayCb = factionCb;

    const factionLabel = factionRow.createSpan({
      text: "Faction overlay",
      cls: "duckmage-overlay-label",
    });

    const applyFaction = () => {
      const map = this.getActiveMap();
      map.showFactionOverlay = factionCb.checked;
      void this.plugin.saveSettings();
      this.onFactionOverlayChange(factionCb.checked);
    };

    factionCb.addEventListener("change", applyFaction);
    factionLabel.addEventListener("click", () => {
      factionCb.checked = !factionCb.checked;
      applyFaction();
    });
  }

  /** Read the current map's saved state and apply it to the viewport + checkboxes. */
  syncToRegion(): void {
    const map = this.getActiveMap();
    for (const opt of OVERLAY_OPTIONS) {
      // undefined → true (backwards compat)
      const value = map[opt.key];
      const show = value === undefined ? true : Boolean(value);
      const cb = this.checkboxes.get(opt.key);
      if (cb) cb.checked = show;
      this.applyClass(opt, show);
    }
    // Faction overlay — undefined → false (opt-in)
    if (this.factionOverlayCb) {
      const show = map.showFactionOverlay ?? false;
      this.factionOverlayCb.checked = show;
      this.onFactionOverlayChange(show);
    }
  }

  private applyClass(opt: OverlayOption, show: boolean): void {
    const vp = this.getViewportEl();
    if (!vp) return;
    if (show) {
      vp.removeClass(opt.cssClass);
    } else {
      vp.addClass(opt.cssClass);
    }
  }
}
