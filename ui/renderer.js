// Main rendering functions for folders, notes, editor, and breadcrumb

import { loadFs } from "../core/storage.js";
import { state, updateURL } from "../core/state.js";
import { ui } from "./components.js";
import { getFileTitle, isSoftDeleted, isFolderSoftDeleted, stripFirstHeading } from "../utils/file-utils.js";
import { formatPath, joinPath, normalizeFolderName } from "../utils/path-utils.js";
import { getResponsiveMode, updateResponsiveLayout } from "../utils/responsive.js";
import { getFolderViewMode, softDeleteFolder, restoreFolder, hardDeleteFolder, renameFolder, createFolder } from "../features/folders.js";
import { setupDragAndDrop } from "../features/drag-drop.js";
import { parseFrontmatter } from "../core/markdown.js";

function buildFolderTree(paths) {
  const tree = {};
  const isSearching = state.searchQuery || state.searchFilters.tags.length > 0 || state.searchFilters.categories.length > 0;
  
  paths.forEach((path) => {
    const parts = path.split("/");
    parts.pop();
    
    // Skip if any part of path is soft deleted and showDeleted is false
    if (!state.showDeleted) {
      const hasDeletedPart = parts.some(part => part.startsWith("~"));
      if (hasDeletedPart) return;
    }
    
    // Build full tree from root
    let node = tree;
    for (const part of parts) {
      if (part === ".noteel") return;
      if (!node[part]) {
        node[part] = {};
      }
      node = node[part];
    }
  });
  return tree;
}

// Count matching notes in a folder (recursively)
function countMatchingNotesInFolder(folderPath, files) {
  const prefix = folderPath ? `${folderPath}/` : "";
  let count = 0;
  
  Object.keys(files).forEach(path => {
    if (path.startsWith(prefix) && path.endsWith('.md')) {
      const note = files[path];
      const { frontmatter, content: bodyContent } = parseFrontmatter(note.content);
      
      // Check if note matches current search/filter criteria
      const query = state.searchQuery.toLowerCase();
      const title = frontmatter.title || getFileTitle(note.content, path);
      const titleMatch = title.toLowerCase().includes(query);
      const contentMatch = (bodyContent || note.content).toLowerCase().includes(query);
      
      let tagMatch = state.searchFilters.tags.length === 0;
      let categoryMatch = state.searchFilters.categories.length === 0;
      
      if (state.searchFilters.tags.length > 0) {
        tagMatch = state.searchFilters.tags.some(tag => frontmatter.tags.includes(tag));
      }
      
      if (state.searchFilters.categories.length > 0) {
        categoryMatch = state.searchFilters.categories.some(cat => frontmatter.categories.includes(cat));
      }
      
      const textMatch = query ? (titleMatch || contentMatch) : true;
      const isDeleted = isSoftDeleted(path);
      const shouldShow = state.showDeleted || !isDeleted;
      
      if (textMatch && tagMatch && categoryMatch && shouldShow) {
        count++;
      }
    }
  });
  
  return count;
}

function createFolderButton(label, path, showBannerFn, renderFoldersFn, renderBreadcrumbFn) {
  const fs = loadFs();
  const { files } = fs;
  
  // Check if we're in search/filter mode
  const isSearching = state.searchQuery || state.searchFilters.tags.length > 0 || state.searchFilters.categories.length > 0;
  
  // Count matching notes in this folder
  const matchCount = isSearching ? countMatchingNotesInFolder(path, files) : -1;
  
  // Hide folders with zero matches when searching
  if (isSearching && matchCount === 0) {
    return null;
  }
  
  const container = document.createElement("div");
  container.className = "folder-item";
  
  const button = document.createElement("button");
  button.textContent = label || "/";
  
  // Add match count badge
  if (isSearching && matchCount > 0) {
    button.textContent += ` (${matchCount})`;
  }
  
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
    const folderBtn = createFolderButton(folder, path, showBannerFn, renderFoldersFn, renderBreadcrumbFn);
    
    // Skip folders with no matches
    if (!folderBtn) {
      return;
    }
    
    item.appendChild(folderBtn);
    item.appendChild(renderFolderNode(node[folder], path, showBannerFn, renderFoldersFn, renderBreadcrumbFn));
    list.appendChild(item);
  });
  return list;
}

export function renderFolders(showBannerFn, renderBreadcrumbFn) {
  const { files } = loadFs();
  const paths = Object.keys(files);
  const isSearching = state.searchQuery || state.searchFilters.tags.length > 0 || state.searchFilters.categories.length > 0;
  
  // If searching, check if current folder has matches
  if (isSearching && state.currentFolder) {
    const currentFolderMatchCount = countMatchingNotesInFolder(state.currentFolder, files);
    if (currentFolderMatchCount === 0) {
      // Current folder has no matches, switch to root
      state.currentFolder = "";
      state.currentFile = null;
      updateURL();
    }
  }
  
  const tree = buildFolderTree(paths);

  ui.folderTree.innerHTML = "";
  
  // Always show root
  const rootButton = createFolderButton("/", "", showBannerFn, () => renderFolders(showBannerFn, renderBreadcrumbFn), renderBreadcrumbFn);
  if (rootButton) {
    ui.folderTree.appendChild(rootButton);
  }

  const list = renderFolderNode(tree, "", showBannerFn, () => renderFolders(showBannerFn, renderBreadcrumbFn), renderBreadcrumbFn);
  ui.folderTree.appendChild(list);
}

export function renderNotes(renderEditorFn) {
  const { files } = loadFs();
  const paths = Object.keys(files).filter((path) => path.endsWith(".md"));
  const folderPrefix = state.currentFolder ? `${state.currentFolder}/` : "";
  const isSearching = state.searchQuery || state.searchFilters.tags.length > 0 || state.searchFilters.categories.length > 0;

  let filtered;
  
  if (isSearching) {
    // When searching/filtering, show ALL matching notes from ALL folders
    const query = state.searchQuery.toLowerCase();
    
    filtered = paths.filter((path) => {
      const note = files[path];
      const { frontmatter, content: bodyContent } = parseFrontmatter(note.content);
      const title = frontmatter.title || getFileTitle(note.content, path);
      const titleMatch = title.toLowerCase().includes(query);
      const contentMatch = (bodyContent || note.content).toLowerCase().includes(query);
      
      // Tag/category filtering
      let tagMatch = state.searchFilters.tags.length === 0;
      let categoryMatch = state.searchFilters.categories.length === 0;
      
      if (state.searchFilters.tags.length > 0) {
        tagMatch = state.searchFilters.tags.some(tag => frontmatter.tags.includes(tag));
      }
      
      if (state.searchFilters.categories.length > 0) {
        categoryMatch = state.searchFilters.categories.some(cat => frontmatter.categories.includes(cat));
      }
      
      // Text search is optional when filters are active
      const textMatch = query ? (titleMatch || contentMatch) : true;
      
      return textMatch && tagMatch && categoryMatch;
    });
    
    if (!state.showDeleted) {
      filtered = filtered.filter((path) => !isSoftDeleted(path));
    }
  } else {
    // Normal browsing mode: show notes only from current folder (not subfolders)
    filtered = paths.filter((path) => path.startsWith(folderPrefix));
    filtered = filtered.filter((path) => !path.slice(folderPrefix.length).includes("/"));

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
    const { frontmatter, content: bodyContent } = parseFrontmatter(note.content);
    const card = document.createElement("div");
    card.className = "note-card";
    card.dataset.path = path;
    card.dataset.index = index;
    
    if (frontmatter.color) {
      card.style.borderLeftColor = frontmatter.color;
      card.setAttribute('data-color', frontmatter.color);
    }
    
    if (state.currentFile === path) {
      card.classList.add("active");
    }
    if (isSoftDeleted(path)) {
      card.classList.add("deleted");
    }

    const title = document.createElement("div");
    title.className = "note-title";
    const titleText = frontmatter.title || getFileTitle(note.content, path.split("/").pop());
    title.innerHTML = titleText;
    if (frontmatter.star) {
      title.innerHTML += '<span class="note-star">★</span>';
    }
    card.appendChild(title);
    
    // Add tags
    if (frontmatter.tags && frontmatter.tags.length > 0) {
      const tagsDiv = document.createElement("div");
      tagsDiv.className = "note-tags";
      frontmatter.tags.forEach(tag => {
        const tagSpan = document.createElement("span");
        tagSpan.className = "note-tag";
        tagSpan.textContent = tag;
        tagsDiv.appendChild(tagSpan);
      });
      card.appendChild(tagsDiv);
    }
    
    // Add categories
    if (frontmatter.categories && frontmatter.categories.length > 0) {
      const catsDiv = document.createElement("div");
      catsDiv.className = "note-categories";
      frontmatter.categories.forEach(cat => {
        const catSpan = document.createElement("span");
        catSpan.className = "note-category";
        catSpan.textContent = cat;
        catsDiv.appendChild(catSpan);
      });
      card.appendChild(catsDiv);
    }
    
    // Add preview text
    const contentWithoutHeading = stripFirstHeading(bodyContent || "");
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
    ui.noteTagsInput.value = "";
    ui.noteTagsInput.disabled = true;
    ui.noteCategoriesInput.value = "";
    ui.noteCategoriesInput.disabled = true;
    ui.noteStarBtn.classList.remove('starred');
    ui.noteStarBtn.disabled = true;
    ui.noteColorBtn.style.backgroundColor = "#3b82f6";
    ui.noteColorBtn.disabled = true;
    ui.noteColorInput.value = "#3b82f6";
    ui.softDeleteBtn.style.display = "none";
    ui.hardDeleteBtn.style.display = "none";
    ui.restoreBtn.style.display = "none";
    document.querySelector(".editor").style.display = "none";
    return;
  }

  document.querySelector(".editor").style.display = "";

  const note = files[state.currentFile];
  const { frontmatter, content: bodyContent } = parseFrontmatter(note.content);
  
  // Store frontmatter in state
  state.currentFrontmatter = frontmatter;
  
  const title = frontmatter.title || getFileTitle(note.content, "");
  const contentWithoutTitle = stripFirstHeading(bodyContent ?? "");
  
  ui.noteTitleInput.value = title;
  ui.noteTitleInput.disabled = false;
  
  // Set frontmatter fields
  ui.noteTagsInput.value = frontmatter.tags.join(", ");
  ui.noteTagsInput.disabled = false;
  ui.noteCategoriesInput.value = frontmatter.categories.join(", ");
  ui.noteCategoriesInput.disabled = false;
  
  // Set star button state
  if (frontmatter.star) {
    ui.noteStarBtn.classList.add('starred');
    ui.noteStarBtn.textContent = '★'; // Filled star
  } else {
    ui.noteStarBtn.classList.remove('starred');
    ui.noteStarBtn.textContent = '☆'; // Empty star
  }
  ui.noteStarBtn.disabled = false;
  
  // Set color button and input
  const color = frontmatter.color || "#3b82f6";
  ui.noteColorInput.value = color;
  ui.noteColorBtn.style.backgroundColor = color;
  ui.noteColorBtn.disabled = false;
  
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
  updateFilterDropdowns();
}

// Populate filter dropdowns with all available tags and categories
export function updateFilterDropdowns() {
  const { files } = loadFs();
  const allTags = new Set();
  const allCategories = new Set();
  
  Object.keys(files).forEach(path => {
    if (path.endsWith('.md')) {
      const { frontmatter } = parseFrontmatter(files[path].content);
      frontmatter.tags.forEach(tag => allTags.add(tag));
      frontmatter.categories.forEach(cat => allCategories.add(cat));
    }
  });
  
  // Update tag filter
  ui.tagFilter.innerHTML = '<option value="">All Tags</option>';
  Array.from(allTags).sort().forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = tag;
    if (state.searchFilters.tags.includes(tag)) {
      option.selected = true;
    }
    ui.tagFilter.appendChild(option);
  });
  
  // Update category filter
  ui.categoryFilter.innerHTML = '<option value="">All Categories</option>';
  Array.from(allCategories).sort().forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    if (state.searchFilters.categories.includes(cat)) {
      option.selected = true;
    }
    ui.categoryFilter.appendChild(option);
  });
}
