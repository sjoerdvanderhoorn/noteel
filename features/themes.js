// Theme management for loading and applying custom themes

import { loadThemes, saveThemes, loadSettings, saveSettings, updateSettingsFileFromLocal } from "../core/storage.js";

const THEME_STYLE_ID = "noteel-theme-style";

export function ensureThemeApplied() {
  const settings = loadSettings();
  const themes = loadThemes();
  let styleTag = document.getElementById(THEME_STYLE_ID);
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = THEME_STYLE_ID;
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = themes[settings.theme] ?? "";
  
  // Apply light theme by setting data-theme attribute
  if (settings.theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export async function loadThemesFromAdapter(adapter) {
  const files = await adapter.listFiles();
  const themeFiles = files.filter((path) => path.startsWith(".noteel/themes/") && path.endsWith(".css"));
  if (themeFiles.length === 0) {
    return;
  }
  const themes = loadThemes();
  for (const themePath of themeFiles) {
    const name = themePath.split("/").pop().replace(/\.css$/, "");
    themes[name] = await adapter.getFileContent(themePath);
  }
  saveThemes(themes);
}

export async function importTheme(source, nameHint, showBannerFn) {
  const css = source instanceof Blob ? await source.text() : await (await fetch(source)).text();
  const themes = loadThemes();
  const name = nameHint || `theme-${Object.keys(themes).length + 1}`;
  themes[name] = css;
  saveThemes(themes);
  showBannerFn(`Theme ${name} added.`);
}

export function setTheme(themeName) {
  const settings = loadSettings();
  settings.theme = themeName;
  saveSettings(settings);
  updateSettingsFileFromLocal();
  ensureThemeApplied();
}
