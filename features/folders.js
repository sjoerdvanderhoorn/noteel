// Folder operations: create, rename, delete, soft delete, restore

import { loadFs, saveFs } from "../core/storage.js";
import { state, updateURL } from "../core/state.js";
import { isFolderSoftDeleted } from "../utils/file-utils.js";

export function softDeleteFolder(folderPath) {
  const fs = loadFs();
  const parts = folderPath.split("/");
  const folderName = parts.pop();
  const newFolderName = `~${folderName.replace(/^~+/, "")}`;
  const parentPath = parts.join("/");
  const newFolderPath = parentPath ? `${parentPath}/${newFolderName}` : newFolderName;
  
  // Rename all files in the folder
  const prefix = folderPath ? `${folderPath}/` : "";
  const newPrefix = newFolderPath ? `${newFolderPath}/` : "";
  
  Object.keys(fs.files).forEach(path => {
    if (path.startsWith(prefix)) {
      const relativePath = path.substring(prefix.length);
      const newPath = newPrefix + relativePath;
      fs.files[newPath] = fs.files[path];
      delete fs.files[path];
    }
  });
  
  saveFs(fs);
  
  // Update current folder if it was the deleted one
  if (state.currentFolder === folderPath) {
    state.currentFolder = newFolderPath;
  }
  
  // Update current file path if it was in the soft deleted folder
  if (state.currentFile && state.currentFile.startsWith(prefix)) {
    const relativePath = state.currentFile.substring(prefix.length);
    state.currentFile = newPrefix + relativePath;
  }
  
  updateURL();
}

export function restoreFolder(folderPath) {
  const fs = loadFs();
  const parts = folderPath.split("/");
  const folderName = parts.pop();
  const restoredName = folderName.replace(/^~+/, "");
  const parentPath = parts.join("/");
  const newFolderPath = parentPath ? `${parentPath}/${restoredName}` : restoredName;
  
  // Rename all files in the folder
  const prefix = folderPath ? `${folderPath}/` : "";
  const newPrefix = newFolderPath ? `${newFolderPath}/` : "";
  
  Object.keys(fs.files).forEach(path => {
    if (path.startsWith(prefix)) {
      const relativePath = path.substring(prefix.length);
      const newPath = newPrefix + relativePath;
      fs.files[newPath] = fs.files[path];
      delete fs.files[path];
    }
  });
  
  saveFs(fs);
  
  // Update current folder if it was the restored one
  if (state.currentFolder === folderPath) {
    state.currentFolder = newFolderPath;
  }
  
  // Update current file path if it was in the restored folder
  if (state.currentFile && state.currentFile.startsWith(prefix)) {
    const relativePath = state.currentFile.substring(prefix.length);
    state.currentFile = newPrefix + relativePath;
  }
  
  updateURL();
}

export function hardDeleteFolder(folderPath) {
  const fs = loadFs();
  const prefix = folderPath ? `${folderPath}/` : "";
  
  // Delete all files in the folder
  Object.keys(fs.files).forEach(path => {
    if (path.startsWith(prefix)) {
      delete fs.files[path];
    }
  });
  
  saveFs(fs);
  
  // Clear current folder/file if they were in the deleted folder
  if (state.currentFolder === folderPath || state.currentFolder.startsWith(prefix)) {
    state.currentFolder = "";
    state.currentFile = null;
    updateURL();
  }
}

export function getFolderViewMode(folder) {
  const fs = loadFs();
  const noteelPath = folder ? `${folder}/.noteel` : ".noteel";
  const config = fs.files[noteelPath];
  if (!config) {
    return "list";
  }
  try {
    const parsed = JSON.parse(config.content);
    return parsed.view || "list";
  } catch {
    return "list";
  }
}

export function setFolderViewMode(folder, viewMode) {
  const fs = loadFs();
  const noteelPath = folder ? `${folder}/.noteel` : ".noteel";
  const existing = fs.files[noteelPath];
  let config = { view: viewMode };
  
  if (existing) {
    try {
      config = JSON.parse(existing.content);
      config.view = viewMode;
    } catch {
      config = { view: viewMode };
    }
  }
  
  fs.files[noteelPath] = {
    content: JSON.stringify(config, null, 2),
    modified: Date.now()
  };
  saveFs(fs);
}

export function renameFolder(folderPath, newName) {
  const parts = folderPath.split("/");
  parts.pop();
  const parentPath = parts.join("/");
  const newFolderPath = parentPath ? `${parentPath}/${newName}` : newName;
  
  // Rename all files in the folder
  const fs = loadFs();
  const prefix = folderPath ? `${folderPath}/` : "";
  const newPrefix = newFolderPath ? `${newFolderPath}/` : "";
  
  // Check if target folder already exists
  const targetNoteelPath = `${newFolderPath}/.noteel`;
  const hasConflict = Object.keys(fs.files).some(p => p.startsWith(newPrefix) && p !== targetNoteelPath);
  if (hasConflict) {
    throw new Error("A folder with that name already exists.");
  }
  
  Object.keys(fs.files).forEach(filePath => {
    if (filePath.startsWith(prefix)) {
      const relativePath = filePath.substring(prefix.length);
      const newPath = newPrefix + relativePath;
      fs.files[newPath] = fs.files[filePath];
      delete fs.files[filePath];
    }
  });
  
  saveFs(fs);
  
  // Update current folder if it was the renamed one
  if (state.currentFolder === folderPath) {
    state.currentFolder = newFolderPath;
  }
  
  // Update current file path if it was in the renamed folder
  if (state.currentFile && state.currentFile.startsWith(prefix)) {
    const relativePath = state.currentFile.substring(prefix.length);
    state.currentFile = newPrefix + relativePath;
  }
  
  updateURL();
}

export function createFolder(folderPath, viewMode = "masonry") {
  const fs = loadFs();
  const noteelPath = `${folderPath}/.noteel`;
  if (fs.files[noteelPath]) {
    throw new Error("Folder already exists.");
  }
  fs.files[noteelPath] = {
    content: JSON.stringify({ view: viewMode }, null, 2),
    modified: Date.now()
  };
  saveFs(fs);
}
