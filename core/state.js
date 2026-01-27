// Application state management and URL synchronization

import { loadFs } from "./storage.js";

export const state = {
  currentFolder: "",
  currentFile: null,
  showDeleted: false,
  searchQuery: "",
  saveTimeout: null,
  editorInstance: null,
  viewMode: "list",
  phoneShowingList: false, // Track if we should show list on phone
  syncTimeout: null, // Timeout for debounced cloud sync
  syncInterval: null, // Interval for periodic sync checks
  lastSyncTime: 0, // Track last sync to avoid conflicts
  modifiedFiles: new Set(), // Track locally modified files that need syncing
  searchFilters: { // Track active search filters
    tags: [],
    categories: []
  },
  currentFrontmatter: null // Track frontmatter of current file
};

// URL state management
export function updateURL() {
  let path = '';
  
  if (state.currentFile) {
    // Remove .md extension from the file path for the URL
    path = state.currentFile.replace(/\.md$/i, '');
  } else if (state.currentFolder) {
    path = state.currentFolder;
  }
  
  window.location.hash = path ? '#/' + path : '#/';
}

export function loadFromURL() {
  const fs = loadFs();
  let hash = window.location.hash;
  
  // Remove leading #/ or #
  if (hash.startsWith('#/')) {
    hash = hash.substring(2);
  } else if (hash.startsWith('#')) {
    hash = hash.substring(1);
  }
  
  // Decode URI components
  hash = decodeURIComponent(hash);
  
  // Empty hash means root folder
  if (!hash) {
    state.currentFolder = '';
    state.currentFile = null;
    return true;
  }
  
  // Try to load as a note (with .md extension)
  const notePath = hash.endsWith('.md') ? hash : hash + '.md';
  if (fs.files[notePath]) {
    state.currentFile = notePath;
    // Set folder from note path
    const parts = notePath.split('/');
    parts.pop();
    state.currentFolder = parts.join('/');
    return true;
  }
  
  // Try to load as a folder
  const folderExists = Object.keys(fs.files).some(filePath => 
    filePath.startsWith(hash + '/') || filePath === hash
  );
  
  if (folderExists) {
    state.currentFolder = hash;
    state.currentFile = null;
    return true;
  }
  
  // Path doesn't exist, start at root
  state.currentFolder = '';
  state.currentFile = null;
  return false;
}
