// Extension system for loading and managing user extensions

import { loadExtensions, saveExtensions, loadSettings, saveSettings, updateSettingsFileFromLocal } from "../core/storage.js";
import { addNote, removeNote, renameNote } from "./notes.js";
import { loadFs, saveFs } from "../core/storage.js";

export function ensureExtensionStubs() {
  const extensions = loadExtensions();
  let updated = false;
  Object.values(extensions).forEach((ext) => {
    if (!ext.manifest?.main) {
      return;
    }
    ext.files = ext.files || {};
    if (!ext.files[ext.manifest.main]) {
      ext.files[ext.manifest.main] = "export default function() {}";
      updated = true;
    }
  });
  if (updated) {
    saveExtensions(extensions);
  }
}

export async function loadExtensionsFromAdapter(adapter) {
  const files = await adapter.listFiles();
  const manifestFiles = files.filter((path) => path.includes(".noteel/extensions/") && path.endsWith("manifest.json"));
  if (manifestFiles.length === 0) {
    return;
  }
  const extensions = loadExtensions();
  for (const manifestPath of manifestFiles) {
    const content = await adapter.getFileContent(manifestPath);
    try {
      const manifest = JSON.parse(content);
      const id = manifestPath.split("/").slice(-2, -1)[0];
      const filesMap = {};
      if (manifest.main) {
        const mainPath = manifestPath.replace("manifest.json", manifest.main);
        try {
          const code = await adapter.getFileContent(mainPath);
          filesMap[manifest.main] = code?.trim() ? code : "export default function() {}";
        } catch {
          filesMap[manifest.main] = "export default function() {}";
        }
      }
      extensions[id] = {
        id,
        manifest,
        source: "user-folder",
        files: filesMap
      };
    } catch {
      console.error(`Failed to parse ${manifestPath}.`);
    }
  }
  saveExtensions(extensions);
}

export async function applyExtensions(showBannerFn) {
  const extensions = loadExtensions();
  const settings = loadSettings();
  Object.values(extensions).forEach((ext) => {
    if (!settings.extensions?.[ext.id]?.enabled) {
      return;
    }
    const mainFile = ext.manifest.main;
    if (!mainFile) {
      return;
    }
    const code = ext.files?.[mainFile];
    if (code) {
      try {
        const fn = new Function("Noteel", `${code}; return typeof defaultExport === 'function' ? defaultExport : null;`);
        const result = fn({
          addNote,
          removeNote,
          renameNote,
          loadFs,
          saveFs,
          showBanner: showBannerFn
        });
        if (typeof result === "function") {
          result();
        }
      } catch {
        showBannerFn(`Extension ${ext.manifest.name} failed to load.`);
      }
    }
  });
}

export async function importExtensionZip(source, showBannerFn) {
  if (!window.JSZip) {
    showBannerFn("JSZip not available.");
    return;
  }
  const zipData = source instanceof Blob ? await source.arrayBuffer() : await (await fetch(source)).arrayBuffer();
  const zip = await JSZip.loadAsync(zipData);
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    showBannerFn("manifest.json missing in ZIP.");
    return;
  }
  const manifest = JSON.parse(await manifestFile.async("string"));
  const id = manifest.name.toLowerCase().replace(/\s+/g, "-");
  const extensions = loadExtensions();
  const files = {};
  for (const fileName of Object.keys(zip.files)) {
    if (zip.files[fileName].dir) {
      continue;
    }
    files[fileName] = await zip.files[fileName].async("string");
  }
  extensions[id] = { id, manifest, source: "upload", files };
  saveExtensions(extensions);
  const settings = loadSettings();
  settings.extensions = settings.extensions ?? {};
  settings.extensions[id] = { enabled: true };
  saveSettings(settings);
  updateSettingsFileFromLocal();
  showBannerFn(`Extension ${manifest.name} installed.`);
}

export async function checkForExtensionUpdates(showBannerFn) {
  const extensions = loadExtensions();
  for (const ext of Object.values(extensions)) {
    const url = ext.manifest.url;
    if (!url) {
      continue;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }
      const zipData = await response.arrayBuffer();
      const zip = await JSZip.loadAsync(zipData);
      const manifestFile = zip.file("manifest.json");
      if (!manifestFile) {
        continue;
      }
      const manifest = JSON.parse(await manifestFile.async("string"));
      if (compareVersions(manifest.version, ext.manifest.version) > 0) {
        showBannerFn(`Update available for ${ext.manifest.name} (${manifest.version}).`);
      }
    } catch {
      showBannerFn(`Failed to check updates for ${ext.manifest.name}.`);
    }
  }
}

function compareVersions(a, b) {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i += 1) {
    const diff = (aParts[i] || 0) - (bParts[i] || 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}
