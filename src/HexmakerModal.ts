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
}
