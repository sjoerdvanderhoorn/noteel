// Main rendering functions for folders, notes, editor, and breadcrumb

import { loadFs } from "../core/storage.js";
import { state, updateURL } from "../core/state.js";
import { ui } from "./components.js";
import { getFileTitle, isSoftDeleted, isFolderSoftDeleted, stripFirstHeading } from "../utils/file-utils.js";
import { formatPath, joinPath, normalizeFolderName } from "../utils/path-utils.js";
import { getResponsiveMode, updateResponsiveLayout } from "../utils/responsive.js";
import { getFolderViewMode, softDeleteFolder, restoreFolder, hardDeleteFolder, renameFolder, createFolder } from "../features/folders.js";
import { setupDragAndDrop } from "../features/drag-drop.js";

function buildFolderTree(paths) {
  const tree = {};
  paths.forEach((path) => {
    const parts = path.split("/");
    parts.pop();
    
    // Skip if any part of path is soft deleted and showDeleted is false
    if (!state.showDeleted) {
      const hasDeletedPart = parts.some(part => part.startsWith("~"));
      if (hasDeletedPart) return;
    }
    
    let node = tree;
    for (const part of parts) {
      // Skip .noteel folders
      if (part === ".noteel") {
        return;
      }
      if (!node[part]) {
        node[part] = {};
      }
      node = node[part];
    }
  });
  return tree;
}

function createFolderButton(label, path, showBannerFn, renderFoldersFn, renderBreadcrumbFn) {
  const container = document.createElement("div");
  container.className = "folder-item";
  
  const button = document.createElement("button");
  button.textContent = label || "/";
  button.className = path === state.currentFolder ? "active" : "";
  
  if (isFolderSoftDeleted(path)) {
    button.classList.add("deleted");
  }
  
  button.addEventListener("click", () => {
    state.currentFolder = path;
    state.currentFile = null;
    if (getResponsiveMode() === "phone") {
      state.phoneShowingList = true;
    }
    updateURL();
    // Note: renderAll will be called by the event handler in app.js
    window.dispatchEvent(new CustomEvent('folderChanged'));
  });
  
  container.appendChild(button);
  
  // Add dropdown menu for non-root folders
  if (path !== "") {
    const dropdown = document.createElement("div");
    dropdown.className = "folder-dropdown";
    
    const moreBtn = document.createElement("button");
    moreBtn.className = "folder-more-btn ghost";
    moreBtn.textContent = "\u22ee";
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("open");
    });
    
    const menu = document.createElement("div");
    menu.className = "folder-dropdown-menu";
    
    const isDeleted = isFolderSoftDeleted(path);
    
    // New folder button
    const newFolderBtn = document.createElement("button");
    newFolderBtn.textContent = "New folder";
    newFolderBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const name = normalizeFolderName(prompt("Folder name"));
      if (!name) {
        dropdown.classList.remove("open");
        return;
      }
      const folderPath = joinPath(path, name);
      try {
        createFolder(folderPath);
        renderFoldersFn();
        renderBreadcrumbFn();
        showBannerFn("Folder created.");
      } catch (error) {
        showBannerFn(error.message);
      }
      dropdown.classList.remove("open");
    });
    menu.appendChild(newFolderBtn);
    
    // Rename folder button
    const renameFolderBtn = document.createElement("button");
    renameFolderBtn.textContent = "Rename folder";
    renameFolderBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const newName = normalizeFolderName(prompt("New folder name", label));
      if (!newName) {
        dropdown.classList.remove("open");
        return;
      }
      
      try {
        renameFolder(path, newName);
        window.dispatchEvent(new CustomEvent('folderChanged'));
        showBannerFn("Folder renamed.");
      } catch (error) {
        showBannerFn(error.message);
      }
      dropdown.classList.remove("open");
    });
    menu.appendChild(renameFolderBtn);
    
    if (!isDeleted) {
      const softDeleteBtn = document.createElement("button");
      softDeleteBtn.textContent = "Soft delete";
      softDeleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        softDeleteFolder(path);
        window.dispatchEvent(new CustomEvent('folderChanged'));
        showBannerFn("Folder soft deleted.");
        dropdown.classList.remove("open");
      });
      menu.appendChild(softDeleteBtn);
    } else {
      const restoreBtn = document.createElement("button");
      restoreBtn.textContent = "Restore";
      restoreBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        restoreFolder(path);
        window.dispatchEvent(new CustomEvent('folderChanged'));
        showBannerFn("Folder restored.");
        dropdown.classList.remove("open");
      });
      menu.appendChild(restoreBtn);
    }
    
    const hardDeleteBtn = document.createElement("button");
    hardDeleteBtn.className = "danger";
    hardDeleteBtn.textContent = "Hard delete";
    hardDeleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm(`Permanently delete folder "${label}" and all its contents?`)) {
        hardDeleteFolder(path);
        window.dispatchEvent(new CustomEvent('folderChanged'));
        showBannerFn("Folder permanently deleted.");
      }
      dropdown.classList.remove("open");
    });
    menu.appendChild(hardDeleteBtn);
    
    dropdown.appendChild(moreBtn);
    dropdown.appendChild(menu);
    container.appendChild(dropdown);
  }
  
  return container;
}

function renderFolderNode(node, basePath, showBannerFn, renderFoldersFn, renderBreadcrumbFn) {
  const list = document.createElement("ul");
  Object.keys(node).forEach((folder) => {
    const path = basePath ? `${basePath}/${folder}` : folder;
    const item = document.createElement("li");
    item.appendChild(createFolderButton(folder, path, showBannerFn, renderFoldersFn, renderBreadcrumbFn));
    item.appendChild(renderFolderNode(node[folder], path, showBannerFn, renderFoldersFn, renderBreadcrumbFn));
    list.appendChild(item);
  });
  return list;
}

export function renderFolders(showBannerFn, renderBreadcrumbFn) {
  const { files } = loadFs();
  const paths = Object.keys(files);
  const tree = buildFolderTree(paths);

  ui.folderTree.innerHTML = "";
  const rootButton = createFolderButton("/", "", showBannerFn, () => renderFolders(showBannerFn, renderBreadcrumbFn), renderBreadcrumbFn);
  ui.folderTree.appendChild(rootButton);

  const list = renderFolderNode(tree, "", showBannerFn, () => renderFolders(showBannerFn, renderBreadcrumbFn), renderBreadcrumbFn);
  ui.folderTree.appendChild(list);
}

export function renderNotes(renderEditorFn) {
  const { files } = loadFs();
  const paths = Object.keys(files).filter((path) => path.endsWith(".md"));
  const folderPrefix = state.currentFolder ? `${state.currentFolder}/` : "";

  let filtered = paths.filter((path) => path.startsWith(folderPrefix));
  filtered = filtered.filter((path) => !path.slice(folderPrefix.length).includes("/"));

  if (!state.showDeleted) {
    filtered = filtered.filter((path) => !isSoftDeleted(path));
  }

  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    filtered = paths.filter((path) => {
      const note = files[path];
      const title = getFileTitle(note.content, path).toLowerCase();
      return title.includes(query) || note.content.toLowerCase().includes(query);
    });
    if (!state.showDeleted) {
      filtered = filtered.filter((path) => !isSoftDeleted(path));
    }
  }

  // Update view mode based on folder config
  state.viewMode = getFolderViewMode(state.currentFolder);
  
  // Auto-open index.md in list view if it exists and nothing is selected
  const mode = getResponsiveMode();
  if (state.viewMode === "list" && !state.currentFile && mode === "desktop") {
    const indexPath = state.currentFolder ? `${state.currentFolder}/index.md` : "index.md";
    if (files[indexPath]) {
      state.currentFile = indexPath;
    }
  }
  
  // Update layout class for masonry mode
  const layout = document.querySelector(".layout");
  if (state.viewMode === "masonry") {
    if (state.currentFile) {
      layout.classList.remove("masonry-mode");
      layout.classList.add("masonry-editing");
      ui.closeEditorBtn.style.display = "block";
    } else {
      layout.classList.add("masonry-mode");
      layout.classList.remove("masonry-editing");
      ui.closeEditorBtn.style.display = "none";
    }
  } else {
    layout.classList.remove("masonry-mode");
    layout.classList.remove("masonry-editing");
    ui.closeEditorBtn.style.display = "none";
  }
  
  // Update view toggle button
  if (ui.viewToggleBtn) {
    ui.viewToggleBtn.textContent = state.viewMode === "masonry" ? "☰" : "⊞";
    ui.viewToggleBtn.title = state.viewMode === "masonry" ? "Switch to list view" : "Switch to grid view";
  }
  
  ui.noteList.innerHTML = "";
  
  if (state.viewMode === "masonry") {
    ui.noteList.classList.add("masonry");
  } else {
    ui.noteList.classList.remove("masonry");
  }

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-message";
    empty.textContent = state.searchQuery ? "No search results." : "No notes here yet.";
    ui.noteList.appendChild(empty);
    return;
  }

  // Get custom order from .noteel file
  const fs = loadFs();
  const noteelPath = state.currentFolder ? `${state.currentFolder}/.noteel` : ".noteel";
  let customOrder = [];
  if (fs.files[noteelPath]) {
    try {
      const config = JSON.parse(fs.files[noteelPath].content);
      customOrder = config.order || [];
    } catch {
      customOrder = [];
    }
  }
  
  // Sort notes
  if (customOrder.length > 0 && !state.searchQuery) {
    filtered.sort((a, b) => {
      const aName = a.split("/").pop();
      const bName = b.split("/").pop();
      const aIdx = customOrder.indexOf(aName);
      const bIdx = customOrder.indexOf(bName);
      
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return aName.localeCompare(bName);
    });
  } else {
    filtered.sort();
  }

  filtered.forEach((path, index) => {
    const note = files[path];
    const card = document.createElement("div");
    card.className = "note-card";
    card.dataset.path = path;
    card.dataset.index = index;
    
    if (state.currentFile === path) {
      card.classList.add("active");
    }
    if (isSoftDeleted(path)) {
      card.classList.add("deleted");
    }

    const title = document.createElement("div");
    title.className = "note-title";
    const titleText = getFileTitle(note.content, path.split("/").pop());
    title.textContent = titleText;
    card.appendChild(title);
    
    // Add preview text
    const contentWithoutHeading = stripFirstHeading(note.content || "");
    const lines = contentWithoutHeading.split("\n").filter(line => line.trim());
    
    if (lines.length > 0) {
      const preview = document.createElement("div");
      preview.className = "note-preview";
      const lineCount = state.viewMode === "masonry" ? 6 : 2;
      const maxLength = state.viewMode === "masonry" ? 300 : 120;
      const previewText = lines.slice(0, lineCount).join(" ").substring(0, maxLength);
      preview.textContent = previewText;
      card.appendChild(preview);
      
      if (state.viewMode === "masonry" && (lines.length > lineCount || contentWithoutHeading.length > maxLength)) {
        const ellipsis = document.createElement("div");
        ellipsis.className = "note-ellipsis";
        ellipsis.textContent = "...";
        card.appendChild(ellipsis);
      }
    }
    
    card.addEventListener("click", () => {
      state.currentFile = path;
      updateURL();
      renderEditorFn();
      renderNotes(renderEditorFn);
      updateResponsiveLayout();
    });
    
    // Setup drag and drop
    setupDragAndDrop(card, path, filtered, () => renderNotes(renderEditorFn));
    
    ui.noteList.appendChild(card);
  });
}

export function renderEditor() {
  const { files } = loadFs();
  if (!state.currentFile || !files[state.currentFile]) {
    if (state.editorInstance) {
      state.editorInstance.commands.setContent("");
      state.editorInstance.setEditable(false);
    }
    ui.noteTitleInput.value = "";
    ui.noteTitleInput.disabled = true;
    ui.softDeleteBtn.style.display = "none";
    ui.hardDeleteBtn.style.display = "none";
    ui.restoreBtn.style.display = "none";
    document.querySelector(".editor").style.display = "none";
    return;
  }

  document.querySelector(".editor").style.display = "";

  const note = files[state.currentFile];
  const title = getFileTitle(note.content, "Untitled");
  const contentWithoutTitle = stripFirstHeading(note.content ?? "");
  
  ui.noteTitleInput.value = title;
  ui.noteTitleInput.disabled = false;
  
  if (state.editorInstance) {
    state.editorInstance.setEditable(true);
    // Use TipTap's markdown parsing to set the editor content
    const json = state.editorInstance.markdown?.parse(contentWithoutTitle);
    if (json) {
      state.editorInstance.commands.setContent(json);
    } else {
      // Fallback if markdown parsing fails
      state.editorInstance.commands.setContent(contentWithoutTitle || "", { contentType: 'markdown' });
    }
    
    // Render preview
    ui.preview.innerHTML = state.editorInstance.getHTML();
  }

  const deleted = isSoftDeleted(state.currentFile);
  
  if (deleted) {
    ui.softDeleteBtn.style.display = "none";
    ui.restoreBtn.style.display = "block";
  } else {
    ui.softDeleteBtn.style.display = "block";
    ui.restoreBtn.style.display = "none";
  }
  ui.hardDeleteBtn.style.display = "block";
}

export function renderBreadcrumb() {
  ui.breadcrumb.textContent = formatPath(state.currentFolder);
}

export function renderAll(renderEditorFn, showBannerFn, renderBreadcrumbFn) {
  renderFolders(showBannerFn, renderBreadcrumbFn);
  renderBreadcrumbFn();
  renderNotes(renderEditorFn);
  renderEditorFn();
  updateResponsiveLayout();
}
