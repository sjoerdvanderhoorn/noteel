// Main application entry point
import { getSelectedProvider, setSelectedProvider } from "./core/auth.js";
import { state, updateURL, loadFromURL } from "./core/state.js";
import { ensureSettingsFile, updateSettingsFromFile, loadFs, saveFs } from "./core/storage.js";
import { serializeMarkdown } from "./core/markdown.js";
import { createAdapters } from "./core/adapters.js";
import { ui } from "./ui/components.js";
import { renderAll, renderEditor, renderBreadcrumb, renderNotes } from "./ui/renderer.js";
import { initEditor } from "./ui/editor.js";
import { showBanner, renderExtensions, renderThemes, showWelcomeScreenIfNeeded } from "./ui/dialogs.js";
import { addNote, getNextNoteNumber, softDeleteNote, restoreNote, hardDeleteNote } from "./features/notes.js";
import { createFolder, setFolderViewMode, getFolderViewMode } from "./features/folders.js";
import { syncFromAdapter, syncToAdapter, updateStatus, startPeriodicSyncCheck, stopPeriodicSyncCheck, scheduleCloudSync, setAdapters } from "./features/sync.js";
import { ensureExtensionStubs, loadExtensionsFromAdapter, applyExtensions, importExtensionZip, checkForExtensionUpdates } from "./features/extensions.js";
import { ensureThemeApplied, loadThemesFromAdapter, importTheme, setTheme } from "./features/themes.js";
import { getResponsiveMode, updateResponsiveLayout } from "./utils/responsive.js";
import { joinPath, normalizeFolderName } from "./utils/path-utils.js";
import { getFileTitle, generateFilenameFromTitle } from "./utils/file-utils.js";

// Create adapters
const adapters = createAdapters();
setAdapters(adapters);

// Debounced save function
function debounceSave() {
  clearTimeout(state.saveTimeout);
  updateStatus("", "unsaved");
  state.saveTimeout = setTimeout(() => {
    if (!state.currentFile) {
      return;
    }
    const title = ui.noteTitleInput.value.trim();
    const bodyContent = state.editorInstance ? serializeMarkdown(state.editorInstance.getJSON(), state.editorInstance) : "";
    const content = title ? `# ${title}\n\n${bodyContent}` : bodyContent;
    
    const fs = loadFs();
    const oldTitle = getFileTitle(fs.files[state.currentFile]?.content || "", "");
    if (title && title !== oldTitle) {
      const newFilename = generateFilenameFromTitle(title);
      const parts = state.currentFile.split("/");
      parts.pop();
      const newPath = parts.length ? `${parts.join("/")}/${newFilename}` : newFilename;
      
      if (newPath !== state.currentFile) {
        if (fs.files[newPath]) {
          fs.files[state.currentFile] = { content, modified: Date.now() };
        } else {
          fs.files[newPath] = { content, modified: Date.now() };
          delete fs.files[state.currentFile];
          
          const folderPath = parts.join("/");
          const noteelPath = folderPath ? `${folderPath}/.noteel` : ".noteel";
          if (fs.files[noteelPath]) {
            try {
              const noteelConfig = JSON.parse(fs.files[noteelPath].content);
              if (noteelConfig.order && Array.isArray(noteelConfig.order)) {
                const oldFilename = state.currentFile.split("/").pop();
                const idx = noteelConfig.order.indexOf(oldFilename);
                if (idx !== -1) {
                  noteelConfig.order[idx] = newFilename;
                  fs.files[noteelPath].content = JSON.stringify(noteelConfig, null, 2);
                }
              }
            } catch (e) {
              console.error("Failed to update .noteel file:", e);
            }
          }
          
          state.currentFile = newPath;
          updateURL();
        }
      } else {
        fs.files[state.currentFile] = { content, modified: Date.now() };
      }
    } else {
      fs.files[state.currentFile] = { content, modified: Date.now() };
    }
    
    saveFs(fs);
    state.modifiedFiles.add(state.currentFile);
    updateStatus("", "saved");
    renderNotes(renderEditor);
    scheduleCloudSync();
  }, 400);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => null);
  }
}

async function initialSync() {
  const fs = loadFs();
  if (Object.keys(fs.files).length === 0) {
    await syncFromAdapter(adapters.sample);
  }
  ensureSettingsFile();
  updateSettingsFromFile();
  await loadExtensionsFromAdapter(adapters.sample);
  ensureExtensionStubs();
  await loadThemesFromAdapter(adapters.sample);
  renderExtensions();
  renderThemes();
  ensureThemeApplied();
  applyExtensions(showBanner);
}

async function handleProviderSelection(provider) {
  setSelectedProvider(provider);
  
  if (provider !== 'local') {
    try {
      const adapter = adapters[provider];
      
      // Show loading state in welcome dialog
      ui.welcomeContentMain.style.display = 'none';
      ui.welcomeLoading.style.display = 'flex';
      ui.welcomeLoadingTitle.textContent = `Connecting to ${adapter.name}...`;
      ui.welcomeLoadingMessage.textContent = 'Please wait while we sync your notes';
      ui.welcomeProgressText.textContent = '';
      
      // Sync with progress callback
      const count = await syncFromAdapter(adapter, (current, total) => {
        if (total > 0) {
          ui.welcomeProgressText.textContent = `Syncing file ${current} of ${total}...`;
        }
      });
      
      ui.welcomeLoadingTitle.textContent = 'Success!';
      ui.welcomeLoadingMessage.textContent = `Synced ${count} files from ${adapter.name}`;
      ui.welcomeProgressText.textContent = '';
      
      // Close dialog after a brief delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      ui.welcomeDialog.close();
      
      // Reset loading state for next time
      ui.welcomeContentMain.style.display = 'block';
      ui.welcomeLoading.style.display = 'none';
      
      startPeriodicSyncCheck();
    } catch (error) {
      console.error('Provider sync failed:', error);
      ui.welcomeLoadingTitle.textContent = 'Connection Failed';
      ui.welcomeLoadingMessage.textContent = `Failed to connect to ${adapters[provider].name}: ${error.message}`;
      ui.welcomeProgressText.textContent = '';
      
      // Show error for 2 seconds, then go back to selection
      await new Promise(resolve => setTimeout(resolve, 2000));
      ui.welcomeContentMain.style.display = 'block';
      ui.welcomeLoading.style.display = 'none';
      return;
    }
  } else {
    stopPeriodicSyncCheck();
    ui.welcomeDialog.close();
  }
  
  renderAll(renderEditor, showBanner, renderBreadcrumb);
}

// Event Listeners
ui.searchInput.addEventListener("input", (event) => {
  state.searchQuery = event.target.value.trim();
  renderNotes(renderEditor);
});

ui.showDeletedToggle.addEventListener("click", () => {
  state.showDeleted = !state.showDeleted;
  if (state.showDeleted) {
    ui.showDeletedToggle.textContent = "👁";
    ui.showDeletedToggle.title = "Hide deleted";
    ui.showDeletedToggle.style.opacity = "1";
  } else {
    ui.showDeletedToggle.textContent = "👁";
    ui.showDeletedToggle.title = "Show deleted";
    ui.showDeletedToggle.style.opacity = "0.5";
  }
  renderNotes(renderEditor);
});

ui.newNoteBtn.addEventListener("click", () => {
  const noteNum = getNextNoteNumber();
  const filename = `note-${noteNum}.md`;
  const path = joinPath(state.currentFolder, filename);
  addNote(path, "");
  state.currentFile = path;
  updateURL();
  renderAll(renderEditor, showBanner, renderBreadcrumb);
  setTimeout(() => {
    ui.noteTitleInput.focus();
  }, 50);
});

ui.newFolderBtn.addEventListener("click", () => {
  const name = normalizeFolderName(prompt("Folder name"));
  if (!name) return;
  const folderPath = joinPath(state.currentFolder, name);
  try {
    createFolder(folderPath);
    renderAll(renderEditor, showBanner, renderBreadcrumb);
    showBanner("Folder created.");
  } catch (error) {
    showBanner(error.message);
  }
});

ui.softDeleteBtn.addEventListener("click", () => {
  if (!state.currentFile) return;
  try {
    softDeleteNote(state.currentFile);
    renderAll(renderEditor, showBanner, renderBreadcrumb);
  } catch (error) {
    showBanner(error.message);
  }
});

ui.restoreBtn.addEventListener("click", () => {
  if (!state.currentFile) return;
  try {
    restoreNote(state.currentFile);
    renderAll(renderEditor, showBanner, renderBreadcrumb);
  } catch (error) {
    showBanner(error.message);
  }
});

ui.hardDeleteBtn.addEventListener("click", () => {
  if (!state.currentFile) return;
  if (hardDeleteNote(state.currentFile)) {
    renderAll(renderEditor, showBanner, renderBreadcrumb);
  }
});

ui.syncFromBtn.addEventListener("click", async () => {
  const provider = getSelectedProvider();
  const adapter = adapters[provider];
  try {
    const count = await syncFromAdapter(adapter);
    await loadExtensionsFromAdapter(adapter);
    await loadThemesFromAdapter(adapter);
    renderAll(renderEditor, showBanner, renderBreadcrumb);
    showBanner(`Synced ${count} files from ${adapter.name}.`);
  } catch (error) {
    showBanner(error.message);
  }
});

ui.syncToBtn.addEventListener("click", async () => {
  const provider = getSelectedProvider();
  const adapter = adapters[provider];
  try {
    const count = await syncToAdapter(adapter);
    showBanner(`Synced ${count} files to ${adapter.name}.`);
  } catch (error) {
    showBanner(error.message);
  }
});

ui.settingsBtn.addEventListener("click", () => {
  renderExtensions();
  renderThemes();
  
  // Update the current adapter display
  const provider = getSelectedProvider();
  const adapter = adapters[provider];
  ui.currentAdapterDisplay.textContent = adapter ? adapter.name : 'None';
  
  ui.settingsDialog.showModal();
});

ui.logoutBtn.addEventListener("click", () => {
  if (confirm('Are you sure you want to logout? You will need to select a storage provider again.')) {
    // Clear the selected provider and tokens
    localStorage.removeItem('noteel_selected_provider_v1');
    localStorage.removeItem('noteel_oauth_tokens_v1');
    // Reload the page to show the welcome screen
    window.location.reload();
  }
});

ui.exportZipBtn.addEventListener("click", async () => {
  try {
    showBanner('Creating ZIP file...');
    const { files } = loadFs();
    const zip = new JSZip();
    
    // Add all files to the ZIP
    for (const [path, fileData] of Object.entries(files)) {
      zip.file(path, fileData.content);
    }
    
    // Generate the ZIP file
    const blob = await zip.generateAsync({ type: 'blob' });
    
    // Create a download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noteel-export-${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showBanner('Notes exported successfully!');
  } catch (error) {
    showBanner(`Export failed: ${error.message}`);
  }
});

ui.extensionFile.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  await importExtensionZip(file, showBanner);
  renderExtensions();
  event.target.value = "";
});

ui.addExtensionUrl.addEventListener("click", async () => {
  const url = ui.extensionUrl.value.trim();
  if (!url) return;
  await importExtensionZip(url, showBanner);
  renderExtensions();
  ui.extensionUrl.value = "";
});

ui.checkExtensionUpdates.addEventListener("click", () => {
  checkForExtensionUpdates(showBanner);
});

ui.themeFile.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  await importTheme(file, file.name.replace(/\.css$/, ""), showBanner);
  renderThemes();
  event.target.value = "";
});

ui.addThemeUrl.addEventListener("click", async () => {
  const url = ui.themeUrl.value.trim();
  if (!url) return;
  const name = url.split("/").pop().replace(/\.css$/, "");
  await importTheme(url, name, showBanner);
  renderThemes();
  ui.themeUrl.value = "";
});

ui.themeSelect.addEventListener("change", () => {
  setTheme(ui.themeSelect.value);
});

ui.viewToggleBtn.addEventListener("click", () => {
  const currentMode = getFolderViewMode(state.currentFolder);
  const newMode = currentMode === "masonry" ? "list" : "masonry";
  setFolderViewMode(state.currentFolder, newMode);
  renderNotes(renderEditor);
});

ui.closeEditorBtn.addEventListener("click", () => {
  state.currentFile = null;
  updateURL();
  renderAll(renderEditor, showBanner, renderBreadcrumb);
});

ui.moreActionsBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const dropdown = ui.moreActionsBtn.parentElement;
  dropdown.classList.toggle("open");
});

document.addEventListener("click", () => {
  const dropdown = document.querySelector(".dropdown.open");
  if (dropdown) {
    dropdown.classList.remove("open");
  }
});

ui.listBackBtn.addEventListener("click", () => {
  state.phoneShowingList = false;
  renderAll(renderEditor, showBanner, renderBreadcrumb);
});

ui.editorBackBtn.addEventListener("click", () => {
  state.currentFile = null;
  updateURL();
  renderAll(renderEditor, showBanner, renderBreadcrumb);
});

window.addEventListener("resize", () => {
  const mode = getResponsiveMode();
  if (mode !== "phone") {
    state.phoneShowingList = false;
  }
  updateResponsiveLayout();
});

ui.noteTitleInput.addEventListener("input", () => {
  debounceSave();
});

ui.welcomeDropboxBtn.addEventListener("click", () => handleProviderSelection('dropbox'));
ui.welcomeOneDriveBtn.addEventListener("click", () => handleProviderSelection('onedrive'));
ui.welcomeGoogleDriveBtn.addEventListener("click", () => handleProviderSelection('googledrive'));
ui.welcomeDemoBtn.addEventListener("click", async () => {
  setSelectedProvider('local');
  ui.welcomeDialog.close();
  
  // Load demo files from sample adapter
  try {
    await syncFromAdapter(adapters.sample);
    renderAll(renderEditor, showBanner, renderBreadcrumb);
    showBanner('Demo content loaded! Explore the sample notes.');
  } catch (error) {
    console.error('Failed to load demo:', error);
    showBanner('Failed to load demo content.');
  }
});
ui.welcomeDecideLaterBtn.addEventListener("click", () => {
  setSelectedProvider('local');
  ui.welcomeDialog.close();
  renderAll(renderEditor, showBanner, renderBreadcrumb);
});

// Custom event for folder changes
window.addEventListener('folderChanged', () => {
  renderAll(renderEditor, showBanner, renderBreadcrumb);
});

// Initialize application
async function init() {
  await initEditor(debounceSave);
  
  if (showWelcomeScreenIfNeeded(getSelectedProvider)) {
    return;
  }
  
  await initialSync();
  loadFromURL();
  ui.showDeletedToggle.style.opacity = state.showDeleted ? "1" : "0.5";
  renderAll(renderEditor, showBanner, renderBreadcrumb);
  registerServiceWorker();
  
  const selectedProvider = getSelectedProvider();
  if (selectedProvider && selectedProvider !== 'local' && adapters[selectedProvider]) {
    
    syncFromAdapter(adapters[selectedProvider])
      .then((count) => {
        renderAll(renderEditor, showBanner, renderBreadcrumb);
        if (count > 0) {
          showBanner(`Synced ${count} files from ${adapters[selectedProvider].name}.`);
        }
      })
      .catch(error => {
        console.error('Initial sync failed:', error);
        showBanner(`Sync from ${adapters[selectedProvider].name} failed. Using local data.`);
      });
    
    startPeriodicSyncCheck();
  }
}

init();
