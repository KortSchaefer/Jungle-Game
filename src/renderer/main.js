import "./styles.css";
import { applyLoadedState, applyOfflineProgress, gameState, startTickLoop, stopTickLoop } from "./gameEngine.js";
import { calculateOfflineSeconds, loadGameState, saveGameState } from "./storage.js";
import { onUISettingsChange, loadUISettings } from "./settings.js";
import { mountUI } from "./uiRender.js";

const SAVE_INTERVAL_MS = 10_000;

async function bootstrap() {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Root element not found.");
  }

  const loadedState = await loadGameState();
  applyLoadedState(loadedState || {});

  let offlineApplied = false;
  if (loadedState?.lastSaveTimestamp) {
    // Simulate passive gains while the app was closed.
    const offlineSeconds = calculateOfflineSeconds(loadedState.lastSaveTimestamp);
    applyOfflineProgress(offlineSeconds);
    offlineApplied = true;
    gameState.lastSaveTimestamp = Date.now();
    await saveGameState(gameState);
  }

  const unmountUI = mountUI(root);
  startTickLoop();

  let saveTimer = null;
  const configureAutosave = (enabled) => {
    if (saveTimer) {
      window.clearInterval(saveTimer);
      saveTimer = null;
    }

    if (enabled) {
      saveTimer = window.setInterval(() => {
        // Persist on a fixed cadence to limit data loss.
        saveGameState(gameState).then((savedAt) => {
          gameState.lastSaveTimestamp = savedAt;
        });
      }, SAVE_INTERVAL_MS);
    }
  };

  configureAutosave(loadUISettings().autosaveEnabled);
  const unsubscribeSettings = onUISettingsChange((settings) => {
    configureAutosave(settings.autosaveEnabled);
  });

  const saveAndCleanup = () => {
    saveGameState(gameState).then((savedAt) => {
      gameState.lastSaveTimestamp = savedAt;
    });
    configureAutosave(false);
    unsubscribeSettings();
    unmountUI();
    stopTickLoop();
  };

  window.addEventListener("beforeunload", saveAndCleanup);

  if (typeof window !== "undefined" && window.localStorage?.getItem("jungle_debug_economy") === "1") {
    console.info("[EconomyDebug] bootstrap", {
      loadedLastSaveTimestamp: loadedState?.lastSaveTimestamp ?? null,
      offlineApplied,
      postLoadBananas: gameState.bananas,
      postLoadWorkers: gameState.workersOwned,
      postLoadWorkerRate: gameState.bananasPerWorkerPerSecond,
    });
  }
}

bootstrap();
