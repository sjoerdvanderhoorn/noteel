// Note operations: create, delete, rename, and manage notes

import { loadFs, saveFs } from "../core/storage.js";
import { state, updateURL } from "../core/state.js";
import { getFileTitle, generateFilenameFromTitle } from "../utils/file-utils.js";
import { scheduleCloudSync } from "./sync.js";

export function addNote(path, content = "") {
  const fs = loadFs();
  fs.files[path] = { content, modified: Date.now() };
  saveFs(fs);
  state.modifiedFiles.add(path);
  scheduleCloudSync();
}

export function removeNote(path) {
  const fs = loadFs();
  delete fs.files[path];
  saveFs(fs);
  state.modifiedFiles.add(path); // Track deletion
  scheduleCloudSync();
}

export function renameNote(oldPath, newPath) {
  const fs = loadFs();
  if (fs.files[newPath]) {
    throw new Error("A note with that name already exists.");
  }
  fs.files[newPath] = fs.files[oldPath];
  delete fs.files[oldPath];
  saveFs(fs);
  state.modifiedFiles.add(oldPath); // Track old file
  state.modifiedFiles.add(newPath); // Track new file
  scheduleCloudSync();
}

export function getNextNoteNumber() {
  const fs = loadFs();
  const folderPrefix = state.currentFolder ? `${state.currentFolder}/` : "";
  const paths = Object.keys(fs.files).filter((path) => 
    path.startsWith(folderPrefix) && 
    path.endsWith(".md") &&
    !path.slice(folderPrefix.length).includes("/")
  );
  
  let maxNum = 0;
  paths.forEach(path => {
    const content = fs.files[path].content || "";
    const title = getFileTitle(content, "");
    const match = title.match(/^Note #(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });
  
  return maxNum + 1;
}

export function softDeleteNote(path) {
  const parts = path.split("/");
  const name = parts.pop();
  const newName = `~${name.replace(/^~+/, "")}`;
  const newPath = parts.length ? `${parts.join("/")}/${newName}` : newName;
  renameNote(path, newPath);
  state.currentFile = newPath;
  updateURL();
}

export function restoreNote(path) {
  const parts = path.split("/");
  const name = parts.pop();
  const restored = name.replace(/^~+/, "");
  const newPath = parts.length ? `${parts.join("/")}/${restored}` : restored;
  renameNote(path, newPath);
  state.currentFile = newPath;
  updateURL();
}

export function hardDeleteNote(path) {
  if (!confirm("Permanently delete this note?")) {
    return false;
  }
  removeNote(path);
  state.currentFile = null;
  updateURL();
  return true;
}
