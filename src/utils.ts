import type HexmakerPlugin from "./HexmakerPlugin";
import { normalizePath } from "obsidian";
import { BUNDLED_ICONS } from "./bundledIcons";

export function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[\s_]+/g, "-")
		.replace(/[^a-z0-9-]/g, "");
}

export function normalizeFolder(path: string): string {
	if (!path) return "";
	return normalizePath(path);
}

export function makeTableTemplate(dice: number, extraFrontmatter?: Record<string, string | boolean | number>, preamble?: string): string {
	const rows = "|  | 1 |";
	const extra = extraFrontmatter
		? Object.entries(extraFrontmatter).map(([k, v]) => `${k}: ${v}`).join("\n") + "\n"
		: "";
	const preambleBlock = preamble ? `\n${preamble}\n` : "";
	return `---\ndice: ${dice}\n${extra}---\n${preambleBlock}\n| Result | Weight |\n|--------|--------|\n${rows}\n`;
}

/**
 * Creates an icon element inside `parent`.
 * When `iconColor` is provided the icon is rendered as a CSS-masked div: the icon
 * shape is used as a mask and `iconColor` is the fill (ideal for monochrome icons).
 * Otherwise a plain <img> is used for full-colour rendering.
 */
export function createIconEl(
	parent: HTMLElement,
	src: string,
	alt: string,
	iconColor: string | undefined,
	cls: string,
): HTMLElement {
	if (iconColor) {
		const div = parent.createEl("div", { cls, title: alt });
		div.setCssProps({
			'mask-image': `url("${src}")`,
			'-webkit-mask-image': `url("${src}")`,
			'mask-size': 'contain',
			'-webkit-mask-size': 'contain',
			'mask-repeat': 'no-repeat',
			'-webkit-mask-repeat': 'no-repeat',
			'mask-position': 'center',
			'-webkit-mask-position': 'center',
			'background-color': iconColor,
		});
		return div;
	}
	const img = parent.createEl("img", { cls });
	img.src = src;
	img.alt = alt;
	return img;
}


export function getIconUrl(plugin: HexmakerPlugin, iconFilename: string): string {
	if (plugin.vaultIconsSet.has(iconFilename)) {
		const folder = normalizeFolder(plugin.settings.iconsFolder ?? "");
		return plugin.app.vault.adapter.getResourcePath(`${folder}/${iconFilename}`);
	}
	const bundled = BUNDLED_ICONS.get(iconFilename);
	if (bundled) return bundled;
	return plugin.app.vault.adapter.getResourcePath(`${plugin.manifest.dir}/icons/${iconFilename}`);
}
