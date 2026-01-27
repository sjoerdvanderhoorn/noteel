// Cloud sync functionality with automatic syncing and conflict resolution

import { loadFs, saveFs } from "../core/storage.js";
import { state } from "../core/state.js";
import { getSelectedProvider } from "../core/auth.js";

// Will be set by app.js during initialization
let adaptersInstance = null;

export function setAdapters(adapters) {
  adaptersInstance = adapters;
}

export function updateStatus(status, type = "info") {
  const syncStatusIcon = document.getElementById("syncStatusIcon");
  if (!syncStatusIcon) return;
  
  // Update sync icon based on status
  if (type === "syncing") {
    syncStatusIcon.textContent = "↻";
    syncStatusIcon.title = status;
    syncStatusIcon.classList.add("syncing");
    syncStatusIcon.classList.remove("error");
  } else if (type === "error") {
    syncStatusIcon.textContent = "⚠";
    syncStatusIcon.title = status || "Sync error";
    syncStatusIcon.classList.remove("syncing");
    syncStatusIcon.classList.add("error");
  } else if (type === "saving") {
    syncStatusIcon.textContent = "...";
    syncStatusIcon.title = "Saving...";
    syncStatusIcon.classList.remove("syncing", "error");
  } else if (type === "unsaved") {
    syncStatusIcon.textContent = "●";
    syncStatusIcon.title = "Unsaved changes";
    syncStatusIcon.classList.remove("syncing", "error");
  } else {
    // Default: saved state
    syncStatusIcon.textContent = "✓";
    syncStatusIcon.title = status || "All changes saved";
    syncStatusIcon.classList.remove("syncing", "error");
  }
}

export async function syncFromAdapter(adapter, progressCallback = null) {
  updateStatus(`Syncing from ${adapter.name}...`, "syncing");
  const fs = loadFs();
  const files = await adapter.listFiles();
  let current = 0;
  for (const path of files) {
    current++;
    if (progressCallback) {
      progressCallback(current, files.length);
    }
    const content = await adapter.getFileContent(path);
    fs.files[path] = { content, modified: Date.now() };
  }
  saveFs(fs);
  state.lastSyncTime = Date.now();
  updateStatus(`Synced ${files.length} files from ${adapter.name}.`, "saved");
  return files.length;
}

export async function syncToAdapter(adapter) {
  updateStatus(`Syncing to ${adapter.name}...`, "syncing");
  const { files } = loadFs();
  const entries = Object.entries(files);
  for (const [path, note] of entries) {
    await adapter.saveFileContent(path, note.content);
  }
  state.lastSyncTime = Date.now();
  updateStatus(`Synced ${entries.length} files to ${adapter.name}.`, "saved");
  return entries.length;
}

// Automatic sync functions
export async function autoSyncToCloud() {
  const provider = getSelectedProvider();
  if (!provider || provider === 'local' || !adaptersInstance) return;
  
  const adapter = adaptersInstance[provider];
  if (!adapter) return;
  
  // Check if there are any modified files to sync
  if (state.modifiedFiles.size === 0) {
    console.log('No modified files to sync');
    return;
  }
  
  try {
    updateStatus(`Auto-syncing to ${adapter.name}...`, "syncing");
    const { files } = loadFs();
    const modifiedPaths = Array.from(state.modifiedFiles);
    let syncedCount = 0;
    
    for (const path of modifiedPaths) {
      try {
        const note = files[path];
        if (note) {
          // File exists - upload it
          await adapter.saveFileContent(path, note.content);
          syncedCount++;
        } else {
          // File was deleted - try to delete from cloud
          try {
            await adapter.deleteFile(path);
            syncedCount++;
          } catch (deleteError) {
            // File might not exist on cloud, that's OK
            console.log(`Could not delete ${path} from cloud:`, deleteError.message);
          }
        }
        // Remove from modified set after successful sync
        state.modifiedFiles.delete(path);
      } catch (error) {
        console.error(`Failed to sync ${path}:`, error);
        // Keep in modified set to retry later
      }
    }
    
    state.lastSyncTime = Date.now();
    updateStatus(`${syncedCount} file(s) synced to ${adapter.name}`, "saved");
    console.log(`Auto-synced ${syncedCount} files to ${adapter.name}`);
  } catch (error) {
    console.error('Auto-sync to cloud failed:', error);
    updateStatus(`Sync error: ${error.message}`, 'error');
  }
}

export async function autoSyncFromCloud() {
  const provider = getSelectedProvider();
  if (!provider || provider === 'local' || !adaptersInstance) return;
  
  const adapter = adaptersInstance[provider];
  if (!adapter) return;
  
  try {
    updateStatus(`Checking ${adapter.name} for updates...`, "syncing");
    const fs = loadFs();
    const files = await adapter.listFiles();
    let updatedCount = 0;
    
    // Only update files that have changed
    for (const path of files) {
      const content = await adapter.getFileContent(path);
      const existing = fs.files[path];
      
      // Update if file doesn't exist or content is different
      if (!existing || existing.content !== content) {
        fs.files[path] = { content, modified: Date.now() };
        updatedCount++;
        // Remove from modified set since we just got the latest from cloud
        state.modifiedFiles.delete(path);
      }
    }
    
    if (updatedCount > 0) {
      saveFs(fs);
      state.lastSyncTime = Date.now();
      updateStatus(`${updatedCount} file(s) updated from ${adapter.name}`, "saved");
      console.log(`Auto-synced ${updatedCount} files from ${adapter.name}`);
      return updatedCount;
    } else {
      updateStatus('All files up to date', "saved");
      console.log(`No updates from ${adapter.name}`);
      return 0;
    }
  } catch (error) {
    console.error('Auto-sync from cloud failed:', error);
    updateStatus(`Sync error: ${error.message}`, 'error');
    return 0;
  }
}

export function scheduleCloudSync() {
  // Clear existing timeout
  clearTimeout(state.syncTimeout);
  
  // Schedule sync 10 seconds after last edit
  state.syncTimeout = setTimeout(async () => {
    await autoSyncToCloud();
  }, 10000); // 10 seconds
}

export function startPeriodicSyncCheck() {
  // Clear existing interval
  if (state.syncInterval) {
    clearInterval(state.syncInterval);
  }
  
  // Check for external changes every 60 seconds
  state.syncInterval = setInterval(async () => {
    await autoSyncFromCloud();
  }, 60000); // 1 minute
}

export function stopPeriodicSyncCheck() {
  if (state.syncInterval) {
    clearInterval(state.syncInterval);
    state.syncInterval = null;
  }
}
