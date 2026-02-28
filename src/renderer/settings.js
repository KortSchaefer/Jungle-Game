const SETTINGS_KEY = "jungleGameUiSettings";

const DEFAULT_SETTINGS = Object.freeze({
  autosaveEnabled: true,
  numberFormat: "short",
  soundEnabled: false,
  treeDebugEnabled: false,
  companyName: "Monkey Banana Holdings",
  activeSaveSlot: 1,
});

let settingsCache = null;

function sanitizeSettings(raw) {
  const next = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  next.autosaveEnabled = Boolean(next.autosaveEnabled);
  next.numberFormat = next.numberFormat === "scientific" ? "scientific" : "short";
  next.soundEnabled = Boolean(next.soundEnabled);
  next.treeDebugEnabled = Boolean(next.treeDebugEnabled);
  const slotId = Number(next.activeSaveSlot);
  next.activeSaveSlot = [1, 2, 3].includes(slotId) ? slotId : 1;
  const companyName = String(next.companyName || DEFAULT_SETTINGS.companyName).trim();
  next.companyName = companyName || DEFAULT_SETTINGS.companyName;
  return next;
}

export function loadUISettings() {
  if (settingsCache) {
    return settingsCache;
  }

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    settingsCache = sanitizeSettings(raw ? JSON.parse(raw) : null);
  } catch (_error) {
    settingsCache = { ...DEFAULT_SETTINGS };
  }

  return settingsCache;
}

export function saveUISettings(settings) {
  settingsCache = sanitizeSettings(settings);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsCache));
  return settingsCache;
}

export function setUISettings(partial) {
  const current = loadUISettings();
  const next = saveUISettings({ ...current, ...(partial || {}) });
  window.dispatchEvent(new CustomEvent("jungle-ui-settings-changed", { detail: next }));
  return next;
}

export function onUISettingsChange(listener) {
  const handler = (event) => {
    listener(event.detail || loadUISettings());
  };

  window.addEventListener("jungle-ui-settings-changed", handler);
  return () => window.removeEventListener("jungle-ui-settings-changed", handler);
}
