import { TFile } from "obsidian";

export interface FileNode {
  type: "file";
  file: TFile;
}
export interface FolderNode {
  type: "folder";
  name: string;
  path: string;
  children: TreeNode[];
}
export type TreeNode = FileNode | FolderNode;

/**
 * Build a sorted folder tree from a flat list of files.
 * `prefix` is the vault-relative folder path prefix (e.g. "world/tables/") —
 * it is stripped before building relative folder paths.
 * `extraFolderPaths` is an optional list of vault-relative folder paths to
 * include even when they contain no files (so empty folders appear in the tree).
 * Folders sort before files; each group is sorted alphabetically.
 */
export function buildTree(
  files: TFile[],
  prefix: string,
  extraFolderPaths: string[] = [],
): TreeNode[] {
  const root: FolderNode = {
    type: "folder",
    name: "",
    path: "",
    children: [],
  };

  const ensureFolder = (rel: string) => {
    const parts = rel.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const folderName = parts[i];
      const folderPath = parts.slice(0, i + 1).join("/");
      let child = current.children.find(
        (c): c is FolderNode => c.type === "folder" && c.name === folderName,
      );
      if (!child) {
        child = {
          type: "folder",
          name: folderName,
          path: folderPath,
          children: [],
        };
        current.children.push(child);
      }
      current = child;
    }
    return current;
  };

  // Ensure all known vault folders are present (including empty ones)
  for (const folderPath of extraFolderPaths) {
    const rel = prefix ? folderPath.slice(prefix.length) : folderPath;
    if (rel) ensureFolder(rel);
  }

  for (const file of files) {
    const rel = prefix ? file.path.slice(prefix.length) : file.path;
    const parts = rel.split("/");
    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      const folderPath = parts.slice(0, i + 1).join("/");
      let child = current.children.find(
        (c): c is FolderNode => c.type === "folder" && c.name === folderName,
      );
      if (!child) {
        child = {
          type: "folder",
          name: folderName,
          path: folderPath,
          children: [],
        };
        current.children.push(child);
      }
      current = child;
    }
    current.children.push({ type: "file", file });
  }

  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      const aName = a.type === "folder" ? a.name : a.file.basename;
      const bName = b.type === "folder" ? b.name : b.file.basename;
      return aName.localeCompare(bName);
    });
    for (const node of nodes) {
      if (node.type === "folder") sortChildren(node.children);
    }
  };
  sortChildren(root.children);

  return root.children;
}

export interface RenderFolderTreeOpts {
  collapsedFolders: Set<string>;
  /** Prefix prepended to folder paths when keying into `collapsedFolders`. */
  keyPrefix?: string;
  activeFile?: TFile | null;
  forceExpanded?: boolean;
  /** CSS class for file items. Defaults to `"duckmage-rt-list-item"`. */
  itemCls?: string;
  onFileClick: (file: TFile) => void;
  /**
   * Called after the folder header is built (arrow + name spans added).
   * Use to attach badges, drag-drop, or context menus.
   * `folderEl` is the outer wrapper; `header` is the clickable title row.
   */
  decorateFolder?: (header: HTMLElement, folderEl: HTMLElement, node: FolderNode) => void;
  /** Called after the file item is built. Use to attach extra event listeners. */
  decorateFile?: (item: HTMLElement, file: TFile) => void;
}

/**
 * Shared recursive folder-tree renderer.
 * Handles the collapse/expand toggle internally; callers inject extras via callbacks.
 */
export function renderFolderTree(
  container: HTMLElement,
  nodes: TreeNode[],
  opts: RenderFolderTreeOpts,
): void {
  const {
    collapsedFolders,
    keyPrefix = "",
    activeFile,
    forceExpanded = false,
    itemCls = "duckmage-rt-list-item",
    onFileClick,
    decorateFolder,
    decorateFile,
  } = opts;

  for (const node of nodes) {
    if (node.type === "folder") {
      const key = keyPrefix + node.path;
      const isCollapsed = !forceExpanded && collapsedFolders.has(key);

      const folderEl = container.createDiv({ cls: "duckmage-rt-folder" });
      const folderHeader = folderEl.createDiv({ cls: "duckmage-rt-folder-header" });
      const arrow = folderHeader.createSpan({
        cls: "duckmage-rt-folder-arrow",
        text: isCollapsed ? "▶" : "▼",
      });
      folderHeader.createSpan({ cls: "duckmage-rt-folder-name", text: node.name });
      decorateFolder?.(folderHeader, folderEl, node);

      const childrenEl = folderEl.createDiv({ cls: "duckmage-rt-folder-children" });
      if (isCollapsed) childrenEl.hide();
      renderFolderTree(childrenEl, node.children, opts);

      folderHeader.addEventListener("click", () => {
        const nowCollapsed = !collapsedFolders.has(key);
        if (nowCollapsed) {
          collapsedFolders.add(key);
          childrenEl.hide();
          arrow.textContent = "▶";
        } else {
          collapsedFolders.delete(key);
          childrenEl.show();
          arrow.textContent = "▼";
        }
      });
    } else {
      const item = container.createDiv({ cls: itemCls });
      if (activeFile && node.file === activeFile) item.addClass("is-active");
      item.setText(node.file.basename);
      item.title = node.file.path;
      item.addEventListener("click", () => onFileClick(node.file));
      decorateFile?.(item, node.file);
    }
  }
}
