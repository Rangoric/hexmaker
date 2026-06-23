import { App, Modal } from "obsidian";

/** Base class for all Hexmaker modals. Provides shared behaviour. */
export class HexmakerModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	/** Make this modal draggable by its title-bar area. Safe to call multiple times. */
	protected makeDraggable(): void {
		const modalEl = this.modalEl;
		if (modalEl.dataset.draggable) return;
		modalEl.dataset.draggable = "1";
		modalEl.addClass("duckmage-editor-modal-drag");

		// position: fixed so the containing block is the viewport rather than
		// the nearest transform/filter/will-change ancestor. Other plugins or
		// themes can establish a containing block on a `.modal-container` ancestor
		// (issue #26 — a third-party plugin re-rooted position:absolute away from
		// the viewport, landing the modal partway off-screen).
		modalEl.setCssProps({ position: 'fixed', margin: '0' });

		const doc = modalEl.ownerDocument;
		const win = doc.defaultView ?? window;

		// Clamp the centered position so the modal can never open off-screen,
		// even if a transformed ancestor still establishes a containing block
		// for fixed positioning.
		const PADDING = 8;
		const centerInViewport = () => {
			const r = modalEl.getBoundingClientRect();
			const maxLeft = Math.max(PADDING, win.innerWidth - r.width - PADDING);
			const maxTop = Math.max(PADDING, win.innerHeight - r.height - PADDING);
			const left = Math.min(Math.max((win.innerWidth - r.width) / 2, PADDING), maxLeft);
			const top = Math.min(Math.max((win.innerHeight - r.height) / 2, PADDING), maxTop);
			modalEl.setCssProps({ left: `${left}px`, top: `${top}px` });
		};
		win.requestAnimationFrame(centerInViewport);

		modalEl.addEventListener("mousedown", (e: MouseEvent) => {
			const modalContent = modalEl.querySelector<HTMLElement>(".modal-content");
			if (modalContent && e.clientY >= modalContent.getBoundingClientRect().top) return;
			if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;

			e.preventDefault();
			const r = modalEl.getBoundingClientRect();
			modalEl.setCssProps({ left: `${r.left}px`, top: `${r.top}px` });
			const sx = e.clientX, sy = e.clientY;
			const ox = r.left, oy = r.top;
			const onMove = (ev: MouseEvent) => {
				modalEl.setCssProps({ left: `${ox + ev.clientX - sx}px`, top: `${oy + ev.clientY - sy}px` });
			};
			const onUp = () => {
				doc.removeEventListener("mousemove", onMove);
				doc.removeEventListener("mouseup", onUp);
			};
			doc.addEventListener("mousemove", onMove);
			doc.addEventListener("mouseup", onUp);
		});
	}

	/**
	 * Anchor a combo dropdown to its trigger as a viewport-`fixed` element.
	 *
	 * The dropdown markup lives inside the modal's scrolling `.modal-content`.
	 * Positioning it `absolute` there means an `overflow` ancestor clips it, so
	 * the old code switched `.modal-content` to `overflow: visible` while open —
	 * which forces a scrolled container's `scrollTop` back to 0 and snaps the
	 * whole modal to the top on the first interaction (issue #31). A `fixed`
	 * dropdown resolves its containing block to the viewport (no modal ancestor
	 * has a transform), so it escapes every `overflow` clip WITHOUT touching the
	 * scroll container — the scroll position is never disturbed.
	 *
	 * Returns `{ reposition, detach }`: call `reposition()` after the dropdown's
	 * contents change (filter typing flips its height), and `detach()` from the
	 * close path to remove the scroll/resize listeners.
	 */
	protected anchorDropdown(
		anchorEl: HTMLElement,
		dropdownEl: HTMLElement,
	): { reposition: () => void; detach: () => void } {
		const win = anchorEl.ownerDocument.defaultView ?? window;
		const GAP = 2;
		const PADDING = 8;
		const reposition = () => {
			const r = anchorEl.getBoundingClientRect();
			const below = win.innerHeight - r.bottom;
			const above = r.top;
			const dh = dropdownEl.offsetHeight;
			// Prefer dropping below; flip above only when there isn't room below
			// AND there's more room above.
			const flip = dh > below && above > below;
			const top = flip
				? Math.max(PADDING, r.top - GAP - dh)
				: r.bottom + GAP;
			dropdownEl.setCssProps({
				left: `${r.left}px`,
				top: `${top}px`,
				width: `${r.width}px`,
			});
		};
		reposition();
		const scrollPane = anchorEl.closest<HTMLElement>(".modal-content");
		scrollPane?.addEventListener("scroll", reposition, { passive: true });
		win.addEventListener("resize", reposition);
		return {
			reposition,
			detach: () => {
				scrollPane?.removeEventListener("scroll", reposition);
				win.removeEventListener("resize", reposition);
			},
		};
	}
}
