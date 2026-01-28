// Dialog management for settings, banners, and welcome screen

import { ui } from "./components.js";
import { state } from "../core/state.js";
import { loadExtensions, loadSettings, saveSettings, updateSettingsFileFromLocal } from "../core/storage.js";
import { loadThemes } from "../core/storage.js";
import { applyExtensions } from "../features/extensions.js";
import { parseFrontmatter } from "../core/markdown.js";

export function showBanner(message) {
  ui.banner.textContent = message;
  ui.banner.classList.remove("hidden");
  setTimeout(() => ui.banner.classList.add("hidden"), 5000);
}

export function renderExtensions() {
  const extensions = loadExtensions();
  const settings = loadSettings();
  ui.extensionsList.innerHTML = "";
  Object.values(extensions).forEach((ext) => {
    const item = document.createElement("div");
    item.className = "settings-item";
    const label = document.createElement("div");
    label.textContent = `${ext.manifest.name} (${ext.manifest.version})`;
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = settings.extensions?.[ext.id]?.enabled ?? false;
    toggle.addEventListener("change", () => {
      const updated = loadSettings();
      updated.extensions = updated.extensions ?? {};
      updated.extensions[ext.id] = { enabled: toggle.checked };
      saveSettings(updated);
      updateSettingsFileFromLocal();
      applyExtensions(showBanner, {
        state,
        ui,
        renderAll: () => window.location.reload(), // Simple reload to apply changes
        parseFrontmatter
      });
      // Trigger toolbar button rendering
      window.dispatchEvent(new CustomEvent('extensionToolbarChanged'));
    });
    item.appendChild(label);
    item.appendChild(toggle);
    ui.extensionsList.appendChild(item);
  });
}

export function renderThemes() {
  const themes = loadThemes();
  const settings = loadSettings();
  ui.themeSelect.innerHTML = "";
  Object.keys(themes).forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    if (settings.theme === name) {
      option.selected = true;
    }
    ui.themeSelect.appendChild(option);
  });
}

export function showWelcomeScreenIfNeeded(getSelectedProviderFn) {
  const selectedProvider = getSelectedProviderFn();
  if (!selectedProvider) {
    ui.welcomeDialog.showModal();
    return true;
  }
  return false;
}
