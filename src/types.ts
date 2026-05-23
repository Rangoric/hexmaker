export type TokenShape = "circle" | "square" | "hexagon";
export type TokenSize  = "sm" | "md" | "lg";

export interface TokenEntry {
	filePath: string;
	title: string;
	icon: string | undefined;
	hex: string;         // "x_y"
	map: string;
	visible: boolean;
	shape: TokenShape;
	size: TokenSize;
	color: string | undefined;   // fill color
	border: string | undefined;  // border/ring color
	tokenLink: string | undefined;    // proxy → original note path
	description: string | undefined;  // token-description frontmatter
}

export type PathLineStyle = "solid" | "dashed" | "dotted";
export type PathRouting   = "through" | "meander" | "edge";

export interface PathType {
	name: string;
	color: string;
	width: number;            // 1–10, direct SVG stroke-width
	lineStyle: PathLineStyle;
	routing: PathRouting;     // "through" = hex centers; "meander" = edge midpoints (curved); "edge" = along hex boundary lines
}

export interface PathChain {
	typeName: string;         // references PathType.name
	hexes: string[];          // "x_y" keys
}

export interface MapData {
	name: string;
	paletteName: string;
	gridSize: { cols: number; rows: number };
	gridOffset: { x: number; y: number };
	pathChains: PathChain[];
	showCoords?: boolean;        // undefined = true (backwards-compatible)
	showTerrainIcons?: boolean;  // undefined = true
	showIconOverrides?: boolean; // undefined = true
	showFactionOverlay?: boolean; // undefined = false (opt-in)
	showRegionOverlay?: boolean;  // undefined = false (opt-in)
	showGmLayer?: boolean;        // undefined = true (on by default)
	showTokens?: boolean;         // undefined = true (on by default)
}

export interface TerrainPalette {
	name: string;
	terrains: TerrainColor[];
}

export interface TerrainColor {
	name: string;
	color: string;
	icon?: string;
	iconColor?: string; // CSS colour to tint the icon; undefined = no tint (render as-is)
	category?: string;
}

export interface HexmakerPluginSettings {
	mySetting: string;
	worldFolder: string;
	hexFolder: string;
	townsFolder: string;
	dungeonsFolder: string;
	questsFolder: string;
	featuresFolder: string;
	iconsFolder: string;
	templatePath: string;
	hexGap: string;
	terrainPalettes: TerrainPalette[];
	maps: MapData[];
	zoomLevel: number;
	pathTypes: PathType[];
	hexOrientation: "pointy" | "flat";
	tablesFolder: string;
	factionsFolder: string;
	regionsFolder: string;
	defaultTableDice: number;
	hexEditorTerrainCollapsed: boolean;
	hexEditorFeaturesCollapsed: boolean;
	hexEditorNotesCollapsed: boolean;
	rollTableExcludedFolders: string[];
	encounterTableExcludedFolders: string[];
	defaultMap: string;
	workflowsFolder: string;
	hiddenIcons: string[];
	iconOrder: string[];
	setupComplete: boolean;
	setupDismissed: boolean;
}

export const LINK_SECTIONS = ["Towns", "Dungeons", "Features", "Quests", "Factions", "Encounters Table"] as const;
export type LinkSection = typeof LINK_SECTIONS[number];

export const TEXT_SECTIONS = [
	{ key: "description", label: "Description" },
	{ key: "landmark",    label: "Landmark" },
	{ key: "hidden",      label: "Hidden" },
	{ key: "secret",      label: "Secret" },
] as const;

/**
 * Session-only flags passed from HexMapView into HexEditorModal.
 * All fields are optional — modal defaults missing keys to false.
 * Add new session-layer flags here; no constructor signature changes needed.
 */
export interface HexEditorOptions {
	/** GM layer is active: force Notes open, highlight Hidden/Secret sections. */
	gmLayerActive?: boolean;
	/** Called when the user clicks a neighbour tile to navigate to an adjacent hex. */
	onNavigate?: (x: number, y: number) => void;
	/** Called when the modal closes (e.g. to clear the selected-hex highlight). */
	onModalClose?: () => void;
	/** Called when the user clicks the submap centre-dot to drill into another map. */
	onSwitchMap?: (mapName: string) => void;
}
