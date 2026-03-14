const SETTINGS_KEY = "jungleGameUiSettings";
const UI_SETTINGS_SCHEMA_VERSION = 6;
const DISPLAY_NAME_MIN_LENGTH = 3;
const DISPLAY_NAME_MAX_LENGTH = 16;
const DISPLAY_NAME_CHANGE_COOLDOWN_MS = 60 * 1000;
const DEFAULT_DISPLAY_NAME = "Banana CEO";
const DEFAULT_LEADERBOARD_API_BASE_URL = "https://jungle-game.onrender.com";
const BUYER_TIER_ORDER = Object.freeze(["Local", "Corporate", "Global", "Interstellar", "Cosmic"]);
export const TOP_BAR_THEME_OPTIONS = Object.freeze([
  { id: "forest", label: "Forest", minAccountLevel: 1 },
  { id: "slate", label: "Slate", minAccountLevel: 10 },
  { id: "sunset", label: "Sunset", minAccountLevel: 20 },
  { id: "quantum", label: "Quantum", minAccountLevel: 30 },
  { id: "amber", label: "Cosmic Amber", minAccountLevel: 40 },
]);
export const BODY_THEME_OPTIONS = Object.freeze([
  { id: "meadow", label: "Meadow", minAccountLevel: 1 },
  { id: "dusk", label: "Dusk", minAccountLevel: 10 },
  { id: "sand", label: "Sand", minAccountLevel: 20 },
  { id: "lab", label: "Research Lab", minAccountLevel: 30 },
  { id: "exotic", label: "Exotic Field", minAccountLevel: 40 },
]);
export const ICON_STYLE_OPTIONS = Object.freeze([
  { id: "classic", label: "Classic", minAccountLevel: 1 },
  { id: "gold", label: "Golden Badge", minAccountLevel: 10 },
  { id: "research", label: "Research Crest", minAccountLevel: 20 },
  { id: "antimatter", label: "Antimatter Sigil", minAccountLevel: 30 },
  { id: "highroller", label: "High Roller Emblem", minAccountLevel: 40 },
]);

const DEFAULT_SETTINGS = Object.freeze({
  schemaVersion: UI_SETTINGS_SCHEMA_VERSION,
  autosaveEnabled: true,
  numberFormat: "short",
  graphicsMode: "modern",
  topBarTheme: "forest",
  bodyTheme: "meadow",
  iconStyle: "classic",
  soundEnabled: false,
  treeDebugEnabled: false,
  companyName: "Monkey Banana Holdings",
  activeSaveSlot: 1,
  leaderboardApiBaseUrl: DEFAULT_LEADERBOARD_API_BASE_URL,
  playerId: "",
  displayName: DEFAULT_DISPLAY_NAME,
  avatarEmoji: "🐵",
  createdAt: 0,
  profileCompleted: false,
  lastDisplayNameChangeAt: 0,
  activeTopView: "main",
  buyerTierExpanded: {
    Local: true,
    Corporate: false,
    Global: false,
    Interstellar: false,
    Cosmic: false,
  },
});

let settingsCache = null;
const bannedNameTokens = ["admin", "moderator", "owner", "support"];

function generatePlayerId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `jg-${timePart}-${randomPart}`;
}

function collapseWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function escapeHtml(text) {
  return String(text || "").replace(/[<>&"'`]/g, "");
}

export function sanitizeDisplayName(rawName) {
  const collapsed = collapseWhitespace(rawName);
  const stripped = escapeHtml(collapsed);
  const truncated = stripped.slice(0, DISPLAY_NAME_MAX_LENGTH);
  if (truncated.length < DISPLAY_NAME_MIN_LENGTH) {
    return DEFAULT_DISPLAY_NAME;
  }
  const lower = truncated.toLowerCase();
  if (bannedNameTokens.some((token) => lower.includes(token))) {
    return DEFAULT_DISPLAY_NAME;
  }
  return truncated;
}

function sanitizeAvatarEmoji(rawEmoji) {
  const value = String(rawEmoji || "").trim();
  if (!value) {
    return "🐵";
  }
  return value.slice(0, 2);
}

function sanitizeSettings(raw, options = {}) {
  const hasExistingStoredSettings = Boolean(options.hasExistingStoredSettings);
  const next = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  next.schemaVersion = UI_SETTINGS_SCHEMA_VERSION;
  next.autosaveEnabled = Boolean(next.autosaveEnabled);
  next.numberFormat = next.numberFormat === "scientific" ? "scientific" : "short";
  next.graphicsMode = next.graphicsMode === "legacy" ? "legacy" : "modern";
  next.topBarTheme = TOP_BAR_THEME_OPTIONS.some((option) => option.id === next.topBarTheme) ? next.topBarTheme : "forest";
  next.bodyTheme = BODY_THEME_OPTIONS.some((option) => option.id === next.bodyTheme) ? next.bodyTheme : "meadow";
  next.iconStyle = ICON_STYLE_OPTIONS.some((option) => option.id === next.iconStyle) ? next.iconStyle : "classic";
  next.soundEnabled = Boolean(next.soundEnabled);
  next.treeDebugEnabled = Boolean(next.treeDebugEnabled);
  const slotId = Number(next.activeSaveSlot);
  next.activeSaveSlot = [1, 2, 3].includes(slotId) ? slotId : 1;
  const companyName = String(next.companyName || DEFAULT_SETTINGS.companyName).trim();
  next.companyName = companyName || DEFAULT_SETTINGS.companyName;
  next.leaderboardApiBaseUrl = String(next.leaderboardApiBaseUrl || DEFAULT_LEADERBOARD_API_BASE_URL).trim().replace(/\/+$/, "");
  next.playerId = String(next.playerId || "").trim() || generatePlayerId();
  next.createdAt = Number(next.createdAt) > 0 ? Number(next.createdAt) : Date.now();
  next.displayName = sanitizeDisplayName(next.displayName);
  next.avatarEmoji = sanitizeAvatarEmoji(next.avatarEmoji);
  next.lastDisplayNameChangeAt = Number(next.lastDisplayNameChangeAt) > 0 ? Number(next.lastDisplayNameChangeAt) : 0;
  const legacyUpgradesViewOpen = Boolean(next.upgradesViewOpen);
  next.activeTopView = ["main", "upgrades", "research", "casino"].includes(next.activeTopView)
    ? next.activeTopView
    : (legacyUpgradesViewOpen ? "upgrades" : "main");
  delete next.upgradesViewOpen;
  const expandedSource = next.buyerTierExpanded && typeof next.buyerTierExpanded === "object" ? next.buyerTierExpanded : {};
  next.buyerTierExpanded = BUYER_TIER_ORDER.reduce((acc, tier) => {
    const fallback = DEFAULT_SETTINGS.buyerTierExpanded[tier];
    acc[tier] = typeof expandedSource[tier] === "boolean" ? expandedSource[tier] : fallback;
    return acc;
  }, {});

  // Existing installs are auto-migrated and do not get blocked by registration.
  // New installs (no stored settings) are required to complete registration once.
  if (typeof next.profileCompleted !== "boolean") {
    next.profileCompleted = hasExistingStoredSettings;
  } else {
    next.profileCompleted = Boolean(next.profileCompleted);
  }

  return next;
}

export function loadUISettings() {
  if (settingsCache) {
    return settingsCache;
  }

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const hasExistingStoredSettings = Boolean(raw);
    settingsCache = sanitizeSettings(parsed, { hasExistingStoredSettings });
  } catch (_error) {
    settingsCache = { ...DEFAULT_SETTINGS };
  }

  return settingsCache;
}

export function saveUISettings(settings) {
  settingsCache = sanitizeSettings(settings, { hasExistingStoredSettings: true });
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

export function canChangeDisplayName(settings = loadUISettings(), now = Date.now()) {
  const lastChanged = Number(settings.lastDisplayNameChangeAt) || 0;
  const remainingMs = Math.max(0, lastChanged + DISPLAY_NAME_CHANGE_COOLDOWN_MS - now);
  return {
    canChange: remainingMs <= 0,
    remainingMs,
    cooldownMs: DISPLAY_NAME_CHANGE_COOLDOWN_MS,
  };
}

export function completeRegistration({ displayName, avatarEmoji } = {}) {
  const current = loadUISettings();
  const sanitizedDisplayName = sanitizeDisplayName(displayName || current.displayName);
  const sanitizedEmoji = sanitizeAvatarEmoji(avatarEmoji || current.avatarEmoji);
  return setUISettings({
    playerId: current.playerId || generatePlayerId(),
    displayName: sanitizedDisplayName,
    avatarEmoji: sanitizedEmoji,
    createdAt: current.createdAt || Date.now(),
    profileCompleted: true,
    lastDisplayNameChangeAt: Date.now(),
  });
}

export function updateDisplayName(displayName) {
  const current = loadUISettings();
  const lock = canChangeDisplayName(current);
  if (!lock.canChange) {
    return {
      success: false,
      reason: "cooldown",
      remainingMs: lock.remainingMs,
      settings: current,
    };
  }

  const next = setUISettings({
    displayName: sanitizeDisplayName(displayName),
    lastDisplayNameChangeAt: Date.now(),
  });
  return {
    success: true,
    remainingMs: 0,
    settings: next,
  };
}
