import { deserializeBigNumbers, serializeBigNumbers } from "./numbers.js";
import { loadUISettings } from "./settings.js";

const LEGACY_STORAGE_KEY = "jungleGameState";
const SLOT_STORAGE_PREFIX = "jungleGameSaveSlot:";
const SAVE_SCHEMA_VERSION = 2;
const SAVE_SLOTS = [1, 2, 3];
export const MAX_OFFLINE_SECONDS = 8 * 60 * 60;

function toSlotId(slotId) {
  const parsed = Number(slotId);
  if (!Number.isInteger(parsed) || !SAVE_SLOTS.includes(parsed)) {
    return 1;
  }
  return parsed;
}

function slotStorageKey(slotId) {
  return `${SLOT_STORAGE_PREFIX}${toSlotId(slotId)}`;
}

function getEnvelopeFromGameState(gameState, slotId) {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    slotId: toSlotId(slotId),
    savedAt: Date.now(),
    gameState: serializeBigNumbers({
      ...gameState,
      lastSaveTimestamp: Date.now(),
    }),
  };
}

function isLegacyGameStateObject(raw) {
  return raw && typeof raw === "object" && !Array.isArray(raw) && "bananas" in raw;
}

function normalizeEnvelope(raw, fallbackSlotId = 1) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  // Current schema
  if (raw.schemaVersion === SAVE_SCHEMA_VERSION && raw.gameState && typeof raw.gameState === "object") {
    return {
      schemaVersion: SAVE_SCHEMA_VERSION,
      slotId: toSlotId(raw.slotId || fallbackSlotId),
      savedAt: Number(raw.savedAt) || Date.now(),
      gameState: deserializeBigNumbers(raw.gameState),
    };
  }

  // Older schema envelope with gameState
  if ("gameState" in raw && raw.gameState && typeof raw.gameState === "object") {
    return {
      schemaVersion: SAVE_SCHEMA_VERSION,
      slotId: toSlotId(raw.slotId || fallbackSlotId),
      savedAt: Number(raw.savedAt) || Date.now(),
      gameState: deserializeBigNumbers(raw.gameState),
    };
  }

  // Raw legacy state object
  if (isLegacyGameStateObject(raw)) {
    return {
      schemaVersion: SAVE_SCHEMA_VERSION,
      slotId: toSlotId(fallbackSlotId),
      savedAt: Number(raw.lastSaveTimestamp) || Date.now(),
      gameState: deserializeBigNumbers(raw),
    };
  }

  return null;
}

async function writeSlotFileIfAvailable(slotId, jsonString) {
  if (!window.electronAPI?.saveFileSupport || typeof window.electronAPI.writeSlotFile !== "function") {
    return;
  }

  try {
    await window.electronAPI.writeSlotFile(toSlotId(slotId), jsonString);
  } catch (_error) {
    // Fallback remains localStorage-only.
  }
}

async function readSlotFileIfAvailable(slotId) {
  if (!window.electronAPI?.saveFileSupport || typeof window.electronAPI.readSlotFile !== "function") {
    return null;
  }

  try {
    const result = await window.electronAPI.readSlotFile(toSlotId(slotId));
    if (!result?.jsonString) {
      return null;
    }
    return String(result.jsonString);
  } catch (_error) {
    return null;
  }
}

function saveEnvelopeLocal(slotId, envelope) {
  localStorage.setItem(slotStorageKey(slotId), JSON.stringify(envelope));
}

function loadEnvelopeLocal(slotId) {
  const raw = localStorage.getItem(slotStorageKey(slotId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    localStorage.removeItem(slotStorageKey(slotId));
    return null;
  }
}

export async function saveGameToSlot(slotId, gameState) {
  const envelope = getEnvelopeFromGameState(gameState, slotId);
  const jsonString = JSON.stringify(envelope);
  saveEnvelopeLocal(slotId, envelope);
  await writeSlotFileIfAvailable(slotId, jsonString);
  return envelope.savedAt;
}

export async function loadGameFromSlot(slotId) {
  const safeSlot = toSlotId(slotId);
  const fileRaw = await readSlotFileIfAvailable(safeSlot);
  if (fileRaw) {
    try {
      const parsed = JSON.parse(fileRaw);
      const normalized = normalizeEnvelope(parsed, safeSlot);
      if (normalized) {
        saveEnvelopeLocal(safeSlot, {
          ...normalized,
          gameState: serializeBigNumbers(normalized.gameState),
        });
        return normalized.gameState;
      }
    } catch (_error) {
      // Fall through to local copy.
    }
  }

  const localEnvelope = loadEnvelopeLocal(safeSlot);
  const normalizedLocal = normalizeEnvelope(localEnvelope, safeSlot);
  if (normalizedLocal) {
    return normalizedLocal.gameState;
  }

  // One-time migration from old single-save key into slot 1.
  if (safeSlot === 1) {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      try {
        const parsedLegacy = JSON.parse(legacyRaw);
        const migrated = normalizeEnvelope(parsedLegacy, 1);
        if (migrated) {
          saveEnvelopeLocal(1, {
            ...migrated,
            gameState: serializeBigNumbers(migrated.gameState),
          });
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          return migrated.gameState;
        }
      } catch (_error) {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
  }

  return null;
}

export async function exportSlotJson(slotId) {
  const safeSlot = toSlotId(slotId);
  const state = await loadGameFromSlot(safeSlot);
  const envelope = getEnvelopeFromGameState(state || {}, safeSlot);
  return JSON.stringify(envelope, null, 2);
}

export async function importSlotJson(slotId, jsonString) {
  const safeSlot = toSlotId(slotId);
  const parsed = JSON.parse(String(jsonString || "{}"));
  const normalized = normalizeEnvelope(parsed, safeSlot);
  if (!normalized || !normalized.gameState || typeof normalized.gameState !== "object") {
    throw new Error("Invalid save format.");
  }

  const envelope = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    slotId: safeSlot,
    savedAt: Date.now(),
    gameState: serializeBigNumbers(normalized.gameState),
  };
  const serialized = JSON.stringify(envelope);
  saveEnvelopeLocal(safeSlot, envelope);
  await writeSlotFileIfAvailable(safeSlot, serialized);
  return deserializeBigNumbers(envelope.gameState);
}

export async function getSaveSlotsSummary() {
  const summaries = [];

  for (const slotId of SAVE_SLOTS) {
    const localEnvelope = loadEnvelopeLocal(slotId);
    const normalized = normalizeEnvelope(localEnvelope, slotId);
    const savedAt = normalized?.savedAt || null;
    const gameState = normalized?.gameState || null;

    summaries.push({
      slotId,
      exists: Boolean(normalized),
      savedAt,
      bananas: gameState?.bananas || 0,
      cash: gameState?.cash || 0,
      treesOwned: gameState?.treesOwned || 0,
    });
  }

  return summaries;
}

// Backward-compatible wrappers used by existing autosave flow.
export async function saveGameState(gameState) {
  const activeSlot = toSlotId(loadUISettings().activeSaveSlot || 1);
  return saveGameToSlot(activeSlot, gameState);
}

export async function loadGameState() {
  const activeSlot = toSlotId(loadUISettings().activeSaveSlot || 1);
  return loadGameFromSlot(activeSlot);
}

export function calculateOfflineSeconds(lastSaveTimestamp) {
  const parsed = Number(lastSaveTimestamp);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error("[EconomyGuard] Invalid lastSaveTimestamp. Offline progress skipped.", { lastSaveTimestamp });
    return 0;
  }
  const lastSave = parsed;
  const elapsedSeconds = Math.floor((Date.now() - lastSave) / 1000);
  return Math.max(0, Math.min(MAX_OFFLINE_SECONDS, elapsedSeconds));
}
