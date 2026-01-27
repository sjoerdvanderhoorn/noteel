// Local storage management for files, settings, extensions, and themes

const STORAGE_KEY = "noteel_fs_v1";
const EXTENSIONS_KEY = "noteel_extensions_v1";
const THEMES_KEY = "noteel_themes_v1";
const SETTINGS_KEY = "noteel_settings_v1";

export function loadFs() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { files: {} };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { files: {} };
  }
}

export function saveFs(fs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fs));
}

export function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return { extensions: {}, theme: "default" };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { extensions: {}, theme: "default" };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadExtensions() {
  const raw = localStorage.getItem(EXTENSIONS_KEY);
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveExtensions(extensions) {
  localStorage.setItem(EXTENSIONS_KEY, JSON.stringify(extensions));
}

export function loadThemes() {
  const raw = localStorage.getItem(THEMES_KEY);
  if (!raw) {
    return { default: "" };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { default: "" };
  }
}

export function saveThemes(themes) {
  localStorage.setItem(THEMES_KEY, JSON.stringify(themes));
}

export function ensureSettingsFile() {
  const fs = loadFs();
  const settings = loadSettings();
  fs.files[".noteel/settings.json"] = {
    content: JSON.stringify(settings, null, 2),
    modified: Date.now()
  };
  saveFs(fs);
}

export function updateSettingsFromFile() {
  const fs = loadFs();
  const settingsFile = fs.files[".noteel/settings.json"];
  if (!settingsFile) {
    return;
  }
  try {
    const parsed = JSON.parse(settingsFile.content);
    saveSettings({
      extensions: parsed.extensions ?? {},
      theme: parsed.theme ?? "default"
    });
  } catch {
    console.error("Invalid settings.json detected.");
  }
}

export function updateSettingsFileFromLocal() {
  const fs = loadFs();
  const settings = loadSettings();
  fs.files[".noteel/settings.json"] = {
    content: JSON.stringify(settings, null, 2),
    modified: Date.now()
  };
  saveFs(fs);
}
