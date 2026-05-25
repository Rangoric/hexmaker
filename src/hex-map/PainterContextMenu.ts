export interface PainterContextMenuOption {
  label: string;
  onClick: () => void;
}

/**
 * Lightweight right-click context menu for painter-type tools.
 * Shows "Switch" (if a picker exists for the tool) and "Exit tool" by default.
 * Subclass and override extraOptions() to inject additional tool-specific items.
 */
export class PainterContextMenu {
  private el: HTMLElement | null = null;
  private cleanupFns: Array<() => void> = [];

  constructor(
    private readonly onSwitch: (() => void) | null,
    private readonly onExit: () => void,
    private readonly switchLabel = "Switch",
  ) {}

  /** Subclasses may override to append tool-specific options after the base items. */
  protected extraOptions(): PainterContextMenuOption[] {
    return [];
  }

  open(x: number, y: number): void {
    this.close();

    const menu = document.createElement("div");
    menu.className = "duckmage-painter-ctx-menu";
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const opts: PainterContextMenuOption[] = [];
    if (this.onSwitch) opts.push({ label: this.switchLabel, onClick: this.onSwitch });
    opts.push({ label: "Exit tool", onClick: this.onExit });
    opts.push(...this.extraOptions());

    for (const opt of opts) {
      const item = document.createElement("div");
      item.className = "duckmage-painter-ctx-item";
      item.textContent = opt.label;
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.close();
        opt.onClick();
      });
      menu.appendChild(item);
    }

    document.body.appendChild(menu);
    this.el = menu;

    // Clamp to viewport after layout so the menu doesn't overflow the screen edge.
    requestAnimationFrame(() => {
      if (!this.el) return;
      const rect = this.el.getBoundingClientRect();
      if (rect.right > window.innerWidth)
        this.el.style.left = `${x - rect.width}px`;
      if (rect.bottom > window.innerHeight)
        this.el.style.top = `${y - rect.height}px`;
    });

    // Defer attaching close-listeners one tick so the current right-click's
    // mouseup doesn't immediately dismiss the menu.
    const timeoutId = window.setTimeout(() => {
      const onPointerDown = (e: PointerEvent) => {
        if (!this.el?.contains(e.target as Node)) this.close();
      };
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") this.close();
      };
      const onScroll = () => this.close();

      document.addEventListener("pointerdown", onPointerDown, { capture: true });
      document.addEventListener("keydown", onKeyDown, { capture: true });
      document.addEventListener("scroll", onScroll, { capture: true, passive: true });

      this.cleanupFns.push(
        () => document.removeEventListener("pointerdown", onPointerDown, { capture: true }),
        () => document.removeEventListener("keydown", onKeyDown, { capture: true }),
        () => document.removeEventListener("scroll", onScroll, { capture: true }),
      );
    }, 0);

    this.cleanupFns.push(() => window.clearTimeout(timeoutId));
  }

  close(): void {
    this.el?.remove();
    this.el = null;
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns = [];
  }
}
