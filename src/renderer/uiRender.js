import {
  applyLoadedState,
  buyers,
  buyBuilding,
  buyOrchard,
  buyWeirdScienceConverter,
  buyTree,
  getAutoExportStatus,
  getAutoSellPricePerBanana,
  getActiveContracts,
  getAchievementsStatus,
  getCeoEmails,
  getBuyerCooldownRemainingSeconds,
  getBuyerEffectivePricePerBanana,
  getBuyerReputationPercent,
  getBuildingCost,
  getCurrentTreeTier,
  getCurrentQuestStatus,
  getEffectiveTreeTierUnlockCost,
  getEffectiveUpgradeCost,
  getLiveEventStatus,
  getMarketPricePerBanana,
  getOrchardStatus,
  getPipUpgradeStatus,
  getNextTreeTier,
  getPipModifiers,
  getPrestigeBonuses,
  getPrestigeGainPreview,
  getProductionBreakdown,
  getResearchPointsPerSecond,
  getResearchTreeNodes,
  getShippingLanesStatus,
  getStatBreakdown,
  getTotalBananasPerSecond,
  getTreeHarvestSnapshot,
  getTreeHarvestUpgradesStatus,
  getWeirdScienceStatus,
  getTreeCost,
  getWorkerCost,
  gameState,
  hireWorker,
  isBuyerUnlocked,
  isPrestigeUnlocked,
  isUpgradePurchased,
  isUpgradeUnlocked,
  prestigeReset,
  purchaseTreeHarvestUpgrade,
  purchasePipUpgrade,
  purchaseUpgrade,
  resetAllProgress,
  shakeTreeHarvest,
  sellBananas,
  shipToBuyer,
  clickTreeBanana,
  subscribe,
  setAutoSellEnabled,
  setAutoSellThreshold,
  setAutoExportEnabled,
  selectShippingLane,
  unlockAutoExport,
  unlockNextTreeTier,
} from "./gameEngine.js";
import { formatGameNumber } from "./numbers.js";
import { themedUpgradeNames } from "./researchTree.js";
import { getTreeTextures, sanitizeGraphicsMode } from "./textureAssets.js";
import { fetchLeaderboard, fetchLeaderboardMe, startLeaderboardSession, submitLeaderboardStats } from "./leaderboardApi.js";
import { canChangeDisplayName, completeRegistration, loadUISettings, setUISettings, updateDisplayName } from "./settings.js";
import { exportSlotJson, getSaveSlotsSummary, importSlotJson, loadGameFromSlot, saveGameToSlot } from "./storage.js";
import { TreeHarvestView } from "./treeHarvestView.js";
import { renderCeoPanel } from "./components/ceoPanel.js";
import { renderHudBar } from "./components/hudBar.js";
import { renderLeaderboardModal } from "./components/leaderboardModal.js";
import { renderRegistrationModal } from "./components/registrationModal.js";
import { renderSettingsModal } from "./components/settingsModal.js";
import { renderCustomizeModal } from "./components/customizeModal.js";
import { renderTabPanels } from "./components/tabPanels.js";

function formatRequirement(requirement, formatAmount) {
  if (requirement.type === "totalBananasEarned") {
    return `Produce total bananas: ${formatAmount(requirement.value)}`;
  }
  if (requirement.type === "treesOwned") {
    return `Own trees: ${formatAmount(requirement.value)}`;
  }
  if (requirement.type === "cash") {
    return `Reach cash: $${formatAmount(requirement.value)}`;
  }
  if (requirement.type === "treeTierIndex") {
    return `Reach tree tier: ${formatAmount(requirement.value + 1)}`;
  }
  if (requirement.type === "antimatterBananas") {
    return `Generate antimatter bananas: ${formatAmount(requirement.value)}`;
  }

  return "Unknown requirement";
}

function formatCooldown(seconds) {
  if (seconds <= 0) {
    return "Ready";
  }

  return `${seconds}s remaining`;
}

function formatRemainingMs(ms) {
  const total = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins <= 0) {
    return `${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

function clampShipment(value, min, max) {
  const n = Math.floor(Number(value) || min);
  return Math.max(min, Math.min(max, n));
}

function getCeoLevelProgress(totalBananasEarned) {
  const total = Math.max(0, Number(totalBananasEarned) || 0);
  const level = Math.max(1, Math.floor(Math.log10(total + 1)) + 1);
  const levelStart = level <= 1 ? 0 : 10 ** (level - 1);
  const levelEnd = 10 ** level;
  const progress = Math.max(0, Math.min(1, (total - levelStart) / (levelEnd - levelStart)));
  return { level, progress };
}

const RENDER_RATE_HZ = 4;
const RENDER_INTERVAL_MS = Math.floor(1000 / RENDER_RATE_HZ);

function setTextIfChanged(element, value) {
  if (!element) {
    return;
  }

  const next = String(value);
  if (element.textContent !== next) {
    element.textContent = next;
  }
}

function setHtmlIfChanged(element, value) {
  if (!element) {
    return;
  }

  const next = String(value);
  if (element.innerHTML !== next) {
    element.innerHTML = next;
  }
}

function setValueIfChanged(element, value) {
  if (!element) {
    return;
  }

  const next = String(value);
  if (element.value !== next) {
    element.value = next;
  }
}

function setCheckedIfChanged(element, checked) {
  if (!element) {
    return;
  }

  const next = Boolean(checked);
  if (element.checked !== next) {
    element.checked = next;
  }
}

function setDisabledIfChanged(element, disabled) {
  if (!element) {
    return;
  }

  const next = Boolean(disabled);
  if (element.disabled !== next) {
    element.disabled = next;
  }
}

function setWidthIfChanged(element, widthPercent) {
  if (!element) {
    return;
  }

  const next = `${widthPercent}%`;
  if (element.style.width !== next) {
    element.style.width = next;
  }
}

export function mountUI(container) {
  const settings = loadUISettings();

  container.innerHTML = `
    <main class="app-shell">
      ${renderHudBar()}
      <div class="app-body">
        ${renderCeoPanel()}
        ${renderTabPanels()}
      </div>
      ${renderSettingsModal()}
      ${renderCustomizeModal()}
      ${renderLeaderboardModal()}
      ${renderRegistrationModal()}
    </main>
  `;

  const formatAmount = (value) => formatGameNumber(value, numberFormatMode);

  const elements = {
    bananasText: container.querySelector("#bananasText"),
    cashText: container.querySelector("#cashText"),
    bpsText: container.querySelector("#bpsText"),
    clickYieldText: container.querySelector("#clickYieldText"),
    buyerBonusText: container.querySelector("#buyerBonusText"),
    eventNameText: container.querySelector("#eventNameText"),
    eventDetailText: container.querySelector("#eventDetailText"),
    debugToggleBtn: container.querySelector("#debugToggleBtn"),
    inspectorToggleBtn: container.querySelector("#inspectorToggleBtn"),
    openLeaderboardBtn: container.querySelector("#openLeaderboardBtn"),
    resetProgressBtn: container.querySelector("#resetProgressBtn"),
    debugPanel: container.querySelector("#debugPanel"),
    statInspectorPanel: container.querySelector("#statInspectorPanel"),
    debugTickText: container.querySelector("#debugTickText"),
    debugRenderText: container.querySelector("#debugRenderText"),
    debugFpsText: container.querySelector("#debugFpsText"),
    inspectorProductionText: container.querySelector("#inspectorProductionText"),
    inspectorClickText: container.querySelector("#inspectorClickText"),
    inspectorExportText: container.querySelector("#inspectorExportText"),
    inspectorCooldownText: container.querySelector("#inspectorCooldownText"),
    inspectorHarvestText: container.querySelector("#inspectorHarvestText"),
    inspectorSpawnText: container.querySelector("#inspectorSpawnText"),
    inspectorWorkerText: container.querySelector("#inspectorWorkerText"),
    inspectorOrchardText: container.querySelector("#inspectorOrchardText"),
    inspectorPricesText: container.querySelector("#inspectorPricesText"),
    inspectorSourcesText: container.querySelector("#inspectorSourcesText"),
    companyNameInput: container.querySelector("#companyNameInput"),
    playerIdText: container.querySelector("#playerIdText"),
    displayNameInput: container.querySelector("#displayNameInput"),
    avatarEmojiInput: container.querySelector("#avatarEmojiInput"),
    saveIdentityBtn: container.querySelector("#saveIdentityBtn"),
    displayNameCooldownText: container.querySelector("#displayNameCooldownText"),
    ceoLevelText: container.querySelector("#ceoLevelText"),
    ceoProgressFill: container.querySelector("#ceoProgressFill"),
    ceoProgressText: container.querySelector("#ceoProgressText"),
    playerTotalBananasText: container.querySelector("#playerTotalBananasText"),
    playerTotalCashText: container.querySelector("#playerTotalCashText"),
    playerTotalClicksText: container.querySelector("#playerTotalClicksText"),
    playerTotalShipmentsText: container.querySelector("#playerTotalShipmentsText"),
    playerContractsText: container.querySelector("#playerContractsText"),
    playerTreesWorkersText: container.querySelector("#playerTreesWorkersText"),
    playerPrestigeText: container.querySelector("#playerPrestigeText"),
    treesText: container.querySelector("#treesText"),
    treeTextureImg: container.querySelector("#treeTextureImg"),
    treeBananaLayer: container.querySelector("#treeBananaLayer"),
    treeHarvestFxLayer: container.querySelector("#treeHarvestFxLayer"),
    treeHarvestUpgradesList: container.querySelector("#treeHarvestUpgradesList"),
    shakeTreeBtn: container.querySelector("#shakeTreeBtn"),
    quickSellBtn: container.querySelector("#quickSellBtn"),
    toggleUpgradeTreeBtn: container.querySelector("#toggleUpgradeTreeBtn"),
    treeUpgradePanel: container.querySelector("#treeUpgradePanel"),
    treeDebugPanel: container.querySelector("#treeDebugPanel"),
    treeDebugCountText: container.querySelector("#treeDebugCountText"),
    treeDebugIntervalText: container.querySelector("#treeDebugIntervalText"),
    treeDebugAccumulatorText: container.querySelector("#treeDebugAccumulatorText"),
    treeDebugGoldenText: container.querySelector("#treeDebugGoldenText"),
    treeRateText: container.querySelector("#treeRateText"),
    workersText: container.querySelector("#workersText"),
    workerRateText: container.querySelector("#workerRateText"),
    hireWorkerBtn: container.querySelector("#hireWorkerBtn"),
    packingShedText: container.querySelector("#packingShedText"),
    fertilizerLabText: container.querySelector("#fertilizerLabText"),
    researchHutText: container.querySelector("#researchHutText"),
    buyPackingShedBtn: container.querySelector("#buyPackingShedBtn"),
    buyFertilizerLabBtn: container.querySelector("#buyFertilizerLabBtn"),
    buyResearchHutBtn: container.querySelector("#buyResearchHutBtn"),
    orchardText: container.querySelector("#orchardText"),
    orchardInfoText: container.querySelector("#orchardInfoText"),
    buyOrchardBtn: container.querySelector("#buyOrchardBtn"),
    autoSellToggle: container.querySelector("#autoSellToggle"),
    autoSellThresholdInput: container.querySelector("#autoSellThresholdInput"),
    autoSellInfoText: container.querySelector("#autoSellInfoText"),
    autoExportStatusText: container.querySelector("#autoExportStatusText"),
    autoExportBtn: container.querySelector("#autoExportBtn"),
    treesPerSecText: container.querySelector("#treesPerSecText"),
    workersPerSecText: container.querySelector("#workersPerSecText"),
    bonusMultipliersText: container.querySelector("#bonusMultipliersText"),
    currentTierText: container.querySelector("#currentTierText"),
    nextTierText: container.querySelector("#nextTierText"),
    tierUnlockCostText: container.querySelector("#tierUnlockCostText"),
    questTitleText: container.querySelector("#questTitleText"),
    questRewardText: container.querySelector("#questRewardText"),
    questProgressLabel: container.querySelector("#questProgressLabel"),
    questProgressFill: container.querySelector("#questProgressFill"),
    questCashProgressLabel: container.querySelector("#questCashProgressLabel"),
    questCashProgressFill: container.querySelector("#questCashProgressFill"),
    unlockTierBtn: container.querySelector("#unlockTierBtn"),
    buyTreeBtn: container.querySelector("#buyTreeBtn"),
    shippingLaneSelect: container.querySelector("#shippingLaneSelect"),
    laneInfoText: container.querySelector("#laneInfoText"),
    marketPriceText: container.querySelector("#marketPriceText"),
    contractsList: container.querySelector("#contractsList"),
    marketSellAmountInput: container.querySelector("#marketSellAmount"),
    pipText: container.querySelector("#pipText"),
    pipSpentText: container.querySelector("#pipSpentText"),
    pipShopSummaryText: container.querySelector("#pipShopSummaryText"),
    pipUpgradesList: container.querySelector("#pipUpgradesList"),
    prestigeCountText: container.querySelector("#prestigeCountText"),
    prestigeBonusText: container.querySelector("#prestigeBonusText"),
    prestigeUnlockText: container.querySelector("#prestigeUnlockText"),
    prestigeGainText: container.querySelector("#prestigeGainText"),
    prestigeBtn: container.querySelector("#prestigeBtn"),
    researchPointsText: container.querySelector("#researchPointsText"),
    researchRateText: container.querySelector("#researchRateText"),
    bananaMatterText: container.querySelector("#bananaMatterText"),
    exoticPeelParticlesText: container.querySelector("#exoticPeelParticlesText"),
    antimatterBananasText: container.querySelector("#antimatterBananasText"),
    antimatterBoostText: container.querySelector("#antimatterBoostText"),
    quantumReactorText: container.querySelector("#quantumReactorText"),
    colliderText: container.querySelector("#colliderText"),
    containmentText: container.querySelector("#containmentText"),
    buyQuantumReactorBtn: container.querySelector("#buyQuantumReactorBtn"),
    buyColliderBtn: container.querySelector("#buyColliderBtn"),
    buyContainmentBtn: container.querySelector("#buyContainmentBtn"),
    researchTreeGrid: container.querySelector("#researchTreeGrid"),
    researchDetailName: container.querySelector("#researchDetailName"),
    researchDetailDesc: container.querySelector("#researchDetailDesc"),
    researchDetailReq: container.querySelector("#researchDetailReq"),
    researchDetailCost: container.querySelector("#researchDetailCost"),
    researchDetailState: container.querySelector("#researchDetailState"),
    researchBuyBtn: container.querySelector("#researchBuyBtn"),
    achievementSummaryText: container.querySelector("#achievementSummaryText"),
    achievementsList: container.querySelector("#achievementsList"),
    ceoInboxList: container.querySelector("#ceoInboxList"),
    upgradeNameCatalog: container.querySelector("#upgradeNameCatalog"),
    openSettingsBtn: container.querySelector("#openSettingsBtn"),
    openCustomizeBtn: container.querySelector("#openCustomizeBtn"),
    closeSettingsBtn: container.querySelector("#closeSettingsBtn"),
    settingsModal: container.querySelector("#settingsModal"),
    closeCustomizeBtn: container.querySelector("#closeCustomizeBtn"),
    customizeModal: container.querySelector("#customizeModal"),
    topBarThemeSelect: container.querySelector("#topBarThemeSelect"),
    bodyThemeSelect: container.querySelector("#bodyThemeSelect"),
    iconStyleSelect: container.querySelector("#iconStyleSelect"),
    leaderboardModal: container.querySelector("#leaderboardModal"),
    closeLeaderboardBtn: container.querySelector("#closeLeaderboardBtn"),
    refreshLeaderboardBtn: container.querySelector("#refreshLeaderboardBtn"),
    leaderboardStatusText: container.querySelector("#leaderboardStatusText"),
    leaderboardProofText: container.querySelector("#leaderboardProofText"),
    leaderboardUpdatedText: container.querySelector("#leaderboardUpdatedText"),
    leaderboardList: container.querySelector("#leaderboardList"),
    registrationModal: container.querySelector("#registrationModal"),
    registrationDisplayNameInput: container.querySelector("#registrationDisplayNameInput"),
    registrationAvatarEmojiInput: container.querySelector("#registrationAvatarEmojiInput"),
    registrationErrorText: container.querySelector("#registrationErrorText"),
    confirmRegistrationBtn: container.querySelector("#confirmRegistrationBtn"),
    autosaveToggle: container.querySelector("#autosaveToggle"),
    numberFormatSelect: container.querySelector("#numberFormatSelect"),
    graphicsModeSelect: container.querySelector("#graphicsModeSelect"),
    soundToggle: container.querySelector("#soundToggle"),
    treeDebugToggle: container.querySelector("#treeDebugToggle"),
    saveSlotSelect: container.querySelector("#saveSlotSelect"),
    saveSlotSummaryText: container.querySelector("#saveSlotSummaryText"),
    saveNowBtn: container.querySelector("#saveNowBtn"),
    loadSlotBtn: container.querySelector("#loadSlotBtn"),
    exportSaveBtn: container.querySelector("#exportSaveBtn"),
    showImportBtn: container.querySelector("#showImportBtn"),
    importSaveWrap: container.querySelector("#importSaveWrap"),
    importSaveInput: container.querySelector("#importSaveInput"),
    confirmImportBtn: container.querySelector("#confirmImportBtn"),
    cancelImportBtn: container.querySelector("#cancelImportBtn"),
    mainView: container.querySelector("#mainView"),
    toggleUpgradesBtn: container.querySelector("#toggleUpgradesBtn"),
    upgradesView: container.querySelector("#upgradesView"),
  };

  let numberFormatMode = settings.numberFormat;
  let graphicsMode = sanitizeGraphicsMode(settings.graphicsMode);
  let debugPanelVisible = false;
  let inspectorPanelVisible = false;
  let treeDebugVisible = false;
  const appShell = container.querySelector(".app-shell");
  const applyThemeSettings = (sourceSettings = settings) => {
    const topBarTheme = String(sourceSettings.topBarTheme || "forest");
    const bodyTheme = String(sourceSettings.bodyTheme || "meadow");
    if (appShell) {
      appShell.setAttribute("data-topbar-theme", topBarTheme);
    }
    document.body.setAttribute("data-body-theme", bodyTheme);
  };
  if (appShell) {
    appShell.setAttribute("data-graphics-mode", graphicsMode);
  }
  applyThemeSettings(settings);

  const treeHarvestView = new TreeHarvestView({
    bananaLayer: elements.treeBananaLayer,
    fxLayer: elements.treeHarvestFxLayer,
    graphicsMode,
    treeTierIndex: gameState.treeTierIndex,
    onBananaClick: (bananaId) => clickTreeBanana(bananaId, { source: "manual_click" }),
  });
  if (elements.treeTextureImg) {
    elements.treeTextureImg.setAttribute("draggable", "false");
    elements.treeTextureImg.addEventListener("dragstart", (event) => event.preventDefault());
  }

  elements.companyNameInput.value = settings.companyName;
  elements.autosaveToggle.checked = settings.autosaveEnabled;
  elements.numberFormatSelect.value = settings.numberFormat;
  if (elements.topBarThemeSelect) {
    elements.topBarThemeSelect.value = settings.topBarTheme || "forest";
  }
  if (elements.bodyThemeSelect) {
    elements.bodyThemeSelect.value = settings.bodyTheme || "meadow";
  }
  if (elements.iconStyleSelect) {
    elements.iconStyleSelect.value = settings.iconStyle || "classic";
  }
  if (elements.graphicsModeSelect) {
    elements.graphicsModeSelect.value = graphicsMode;
  }
  elements.soundToggle.checked = settings.soundEnabled;
  if (elements.treeDebugToggle) {
    elements.treeDebugToggle.checked = Boolean(settings.treeDebugEnabled);
  }
  elements.saveSlotSelect.value = String(settings.activeSaveSlot || 1);

  const setUpgradesViewOpen = (isOpen, persist = true) => {
    if (elements.mainView) {
      elements.mainView.classList.toggle("is-hidden", isOpen);
      elements.mainView.setAttribute("aria-hidden", String(isOpen));
    }
    if (elements.upgradesView) {
      elements.upgradesView.classList.toggle("is-hidden", !isOpen);
      elements.upgradesView.setAttribute("aria-hidden", String(!isOpen));
    }
    if (elements.toggleUpgradesBtn) {
      elements.toggleUpgradesBtn.textContent = isOpen ? "Back To Main" : "Upgrades";
      elements.toggleUpgradesBtn.setAttribute("aria-expanded", String(isOpen));
      elements.toggleUpgradesBtn.setAttribute("aria-controls", "upgradesView");
    }
    if (persist) {
      const next = setUISettings({ upgradesViewOpen: isOpen });
      settings.upgradesViewOpen = next.upgradesViewOpen;
    } else {
      settings.upgradesViewOpen = isOpen;
    }
  };

  const isValidRegistrationName = (rawName) => {
    const trimmed = String(rawName || "").replace(/\s+/g, " ").trim();
    return trimmed.length >= 3 && trimmed.length <= 16;
  };

  const syncIdentityUi = (identity = settings) => {
    if (elements.playerIdText) {
      setTextIfChanged(elements.playerIdText, `Player ID: ${identity.playerId || "-"}`);
    }
    if (elements.displayNameInput) {
      setValueIfChanged(elements.displayNameInput, identity.displayName || "Banana CEO");
    }
    if (elements.avatarEmojiInput) {
      setValueIfChanged(elements.avatarEmojiInput, identity.avatarEmoji || "🐵");
    }
    if (elements.registrationDisplayNameInput) {
      setValueIfChanged(elements.registrationDisplayNameInput, identity.displayName || "Banana CEO");
    }
    if (elements.registrationAvatarEmojiInput) {
      setValueIfChanged(elements.registrationAvatarEmojiInput, identity.avatarEmoji || "🐵");
    }
    if (elements.displayNameCooldownText) {
      const lock = canChangeDisplayName(identity);
      setTextIfChanged(
        elements.displayNameCooldownText,
        lock.canChange
          ? "Display name can be changed once per minute."
          : `Display name can be changed again in ${formatRemainingMs(lock.remainingMs)}.`
      );
    }
  };

  const clientVersion = "1.0.5";

  let leaderboardLoading = false;
  const refreshLeaderboard = async () => {
    if (leaderboardLoading) {
      return;
    }
    leaderboardLoading = true;
    const baseUrl = String(settings.leaderboardApiBaseUrl || "").trim().replace(/\/+$/, "");
    if (!baseUrl) {
      setTextIfChanged(elements.leaderboardStatusText, "Leaderboard API is not configured.");
      setTextIfChanged(elements.leaderboardProofText, "Shared DB proof: not configured.");
      setHtmlIfChanged(elements.leaderboardList, "");
      leaderboardLoading = false;
      return;
    }

    setTextIfChanged(elements.leaderboardStatusText, "Loading leaderboard...");
    setTextIfChanged(elements.leaderboardProofText, "Shared DB proof: connecting...");
    setHtmlIfChanged(elements.leaderboardList, "");
    try {
      const session = await startLeaderboardSession({
        baseUrl,
        playerId: settings.playerId,
        displayName: settings.displayName,
        clientVersion,
      });

      let submitOutcome = "Stats synced.";
      try {
        await submitLeaderboardStats({
          baseUrl,
          token: session.token,
          playerId: settings.playerId,
          sessionId: session.sessionId,
          prestigeCount: Math.max(0, Number(gameState.prestigeCount) || 0),
          pip: Math.max(0, Number(gameState.pip) || 0),
          totalBananasEarned: Math.max(0, Number(gameState.totalBananasEarned) || 0),
          clientVersion,
        });
      } catch (submitError) {
        const submitReason = submitError?.payload?.reason || submitError?.payload?.error || submitError?.message || "submit failed";
        submitOutcome = `Stats not accepted: ${submitReason}.`;
      }

      const [payload, me] = await Promise.all([
        fetchLeaderboard({ baseUrl, limit: 25 }),
        fetchLeaderboardMe({ baseUrl, token: session.token }),
      ]);

      setTextIfChanged(elements.leaderboardUpdatedText, `Last updated: ${new Date(payload.lastUpdatedAt || Date.now()).toLocaleString()}`);
      setTextIfChanged(
        elements.leaderboardStatusText,
        payload.entries.length ? `Connected to ${baseUrl}. ${submitOutcome}` : `Connected to ${baseUrl}, no entries yet. ${submitOutcome}`
      );
      setTextIfChanged(
        elements.leaderboardProofText,
        `Shared DB proof: confirmed as ${me.player.displayName} (${me.player.playerId}), source=${me.source}, last DB update ${me.player.updatedAt ? new Date(me.player.updatedAt).toLocaleString() : "pending"}`
      );
      setHtmlIfChanged(
        elements.leaderboardList,
        Array.isArray(payload.entries) && payload.entries.length
          ? payload.entries
              .map((entry) => {
                const isLocal = entry.playerId === settings.playerId;
                return `<div class="buyer-card ${isLocal ? "is-local-entry" : ""}">
              <p class="buyer-name">#${entry.rank} ${entry.displayName}${isLocal ? " (You)" : ""}</p>
              <p>Prestige: ${entry.prestigeCount}</p>
              <p>PIP: ${entry.pip}</p>
            </div>`;
              })
              .join("")
          : "<p>No leaderboard entries available.</p>"
      );
    } catch (error) {
      setTextIfChanged(elements.leaderboardStatusText, "Error loading leaderboard. Check API URL, deployment, or backend logs.");
      setTextIfChanged(elements.leaderboardProofText, `Shared DB proof: failed (${error?.message || "unknown error"}).`);
      setHtmlIfChanged(elements.leaderboardList, "");
      console.error("[Leaderboard] Failed to load shared leaderboard.", error);
    } finally {
      leaderboardLoading = false;
    }
  };

  setUpgradesViewOpen(Boolean(settings.upgradesViewOpen), false);

  if (elements.toggleUpgradesBtn && elements.upgradesView) {
    elements.toggleUpgradesBtn.addEventListener("click", () => {
      const currentlyOpen = !elements.upgradesView.classList.contains("is-hidden");
      setUpgradesViewOpen(!currentlyOpen, true);
    });
  }

  function openSettingsModal() {
    elements.settingsModal.classList.remove("is-hidden");
  }

  function closeSettingsModal() {
    elements.settingsModal.classList.add("is-hidden");
  }

  function openCustomizeModal() {
    elements.customizeModal.classList.remove("is-hidden");
  }

  function closeCustomizeModal() {
    elements.customizeModal.classList.add("is-hidden");
  }

  elements.openSettingsBtn.addEventListener("click", openSettingsModal);
  if (elements.openCustomizeBtn) {
    elements.openCustomizeBtn.addEventListener("click", openCustomizeModal);
  }
  elements.openLeaderboardBtn.addEventListener("click", async () => {
    elements.leaderboardModal.classList.remove("is-hidden");
    await refreshLeaderboard();
  });
  elements.closeSettingsBtn.addEventListener("click", closeSettingsModal);
  if (elements.closeCustomizeBtn) {
    elements.closeCustomizeBtn.addEventListener("click", closeCustomizeModal);
  }
  elements.closeLeaderboardBtn.addEventListener("click", () => {
    elements.leaderboardModal.classList.add("is-hidden");
  });
  elements.refreshLeaderboardBtn.addEventListener("click", async () => {
    await refreshLeaderboard();
  });
  elements.settingsModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.closeSettings === "true") {
      closeSettingsModal();
    }
  });
  if (elements.customizeModal) {
    elements.customizeModal.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.dataset.closeCustomize === "true") {
        closeCustomizeModal();
      }
    });
  }
  elements.leaderboardModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.closeLeaderboard === "true") {
      elements.leaderboardModal.classList.add("is-hidden");
    }
  });

  elements.companyNameInput.addEventListener("change", () => {
    const companyName = elements.companyNameInput.value.trim();
    const next = setUISettings({ companyName });
    elements.companyNameInput.value = next.companyName;
  });
  elements.saveIdentityBtn.addEventListener("click", () => {
    const nextAvatar = String(elements.avatarEmojiInput.value || "").trim().slice(0, 2) || "🐵";
    const desiredName = elements.displayNameInput.value;
    const nameChanged = desiredName.trim() !== String(settings.displayName || "").trim();

    if (nameChanged) {
      const result = updateDisplayName(desiredName);
      if (!result.success && result.reason === "cooldown") {
        setTextIfChanged(
          elements.displayNameCooldownText,
          `Display name can be changed again in ${formatRemainingMs(result.remainingMs)}.`
        );
        return;
      }
      Object.assign(settings, result.settings);
    }

    const next = setUISettings({ avatarEmoji: nextAvatar });
    Object.assign(settings, next);
    syncIdentityUi(settings);
  });

  if (!settings.profileCompleted) {
    elements.registrationModal.classList.remove("is-hidden");
  }
  elements.confirmRegistrationBtn.addEventListener("click", () => {
    const rawDisplayName = elements.registrationDisplayNameInput.value;
    if (!isValidRegistrationName(rawDisplayName)) {
      elements.registrationErrorText.classList.remove("is-hidden");
      setTextIfChanged(elements.registrationErrorText, "Display name must be 3 to 16 characters.");
      return;
    }
    const next = completeRegistration({
      displayName: rawDisplayName,
      avatarEmoji: elements.registrationAvatarEmojiInput.value,
    });
    Object.assign(settings, next);
    elements.registrationErrorText.classList.add("is-hidden");
    elements.registrationModal.classList.add("is-hidden");
    syncIdentityUi(settings);
  });

  elements.autosaveToggle.addEventListener("change", () => {
    setUISettings({ autosaveEnabled: elements.autosaveToggle.checked });
  });

  elements.numberFormatSelect.addEventListener("change", () => {
    const next = setUISettings({ numberFormat: elements.numberFormatSelect.value });
    settings.numberFormat = next.numberFormat;
    numberFormatMode = next.numberFormat;
  });

  if (elements.graphicsModeSelect) {
    elements.graphicsModeSelect.addEventListener("change", () => {
      const next = setUISettings({ graphicsMode: elements.graphicsModeSelect.value });
      settings.graphicsMode = next.graphicsMode;
      graphicsMode = sanitizeGraphicsMode(next.graphicsMode);
      treeHarvestView.setGraphicsMode(graphicsMode);
      if (appShell) {
        appShell.setAttribute("data-graphics-mode", graphicsMode);
      }
      renderDirty = true;
    });
  }

  if (elements.topBarThemeSelect) {
    elements.topBarThemeSelect.addEventListener("change", () => {
      const next = setUISettings({ topBarTheme: elements.topBarThemeSelect.value });
      settings.topBarTheme = next.topBarTheme;
      applyThemeSettings(settings);
    });
  }

  if (elements.bodyThemeSelect) {
    elements.bodyThemeSelect.addEventListener("change", () => {
      const next = setUISettings({ bodyTheme: elements.bodyThemeSelect.value });
      settings.bodyTheme = next.bodyTheme;
      applyThemeSettings(settings);
    });
  }

  if (elements.iconStyleSelect) {
    elements.iconStyleSelect.addEventListener("change", () => {
      const next = setUISettings({ iconStyle: elements.iconStyleSelect.value });
      settings.iconStyle = next.iconStyle;
    });
  }

  elements.soundToggle.addEventListener("change", () => {
    const next = setUISettings({ soundEnabled: elements.soundToggle.checked });
    settings.soundEnabled = next.soundEnabled;
  });

  if (elements.treeDebugToggle) {
    elements.treeDebugToggle.addEventListener("change", () => {
      const next = setUISettings({ treeDebugEnabled: elements.treeDebugToggle.checked });
      settings.treeDebugEnabled = next.treeDebugEnabled;
    });
  }

  elements.debugToggleBtn.addEventListener("click", () => {
    debugPanelVisible = !debugPanelVisible;
    elements.debugPanel.classList.toggle("is-hidden", !debugPanelVisible);
    elements.debugToggleBtn.textContent = debugPanelVisible ? "Hide Debug" : "Debug";
  });

  if (elements.inspectorToggleBtn && elements.statInspectorPanel) {
    elements.inspectorToggleBtn.addEventListener("click", () => {
      inspectorPanelVisible = !inspectorPanelVisible;
      elements.statInspectorPanel.classList.toggle("is-hidden", !inspectorPanelVisible);
      elements.inspectorToggleBtn.textContent = inspectorPanelVisible ? "Hide Inspector" : "Inspector";
    });
  }

  elements.resetProgressBtn.addEventListener("click", async () => {
    const shouldReset = window.confirm("Reset all progress in the active save slot? This cannot be undone.");
    if (!shouldReset) {
      return;
    }

    resetAllProgress();
    const slotId = Number(elements.saveSlotSelect.value) || 1;
    await saveGameToSlot(slotId, gameState);
    await refreshSaveSummary();
  });

  const refreshSaveSummary = async () => {
    const slotId = Number(elements.saveSlotSelect.value) || 1;
    const summaries = await getSaveSlotsSummary();
    const summary = summaries.find((item) => item.slotId === slotId);
    if (!summary?.exists) {
      elements.saveSlotSummaryText.textContent = `Slot ${slotId}: Empty`;
      return;
    }

    const savedDate = summary.savedAt ? new Date(summary.savedAt).toLocaleString() : "Unknown";
    elements.saveSlotSummaryText.textContent = `Slot ${slotId}: ${savedDate} | Bananas ${formatAmount(summary.bananas)} | Cash $${formatAmount(summary.cash)} | Trees ${formatAmount(summary.treesOwned)}`;
  };

  elements.saveSlotSelect.addEventListener("change", async () => {
    const slotId = Number(elements.saveSlotSelect.value) || 1;
    const next = setUISettings({ activeSaveSlot: slotId });
    settings.activeSaveSlot = next.activeSaveSlot;
    await refreshSaveSummary();
  });

  elements.saveNowBtn.addEventListener("click", async () => {
    const slotId = Number(elements.saveSlotSelect.value) || 1;
    await saveGameToSlot(slotId, gameState);
    await refreshSaveSummary();
  });

  elements.loadSlotBtn.addEventListener("click", async () => {
    const slotId = Number(elements.saveSlotSelect.value) || 1;
    const loadedState = await loadGameFromSlot(slotId);
    if (loadedState) {
      applyLoadedState(loadedState);
    }
    await refreshSaveSummary();
  });

  elements.exportSaveBtn.addEventListener("click", async () => {
    const slotId = Number(elements.saveSlotSelect.value) || 1;
    const json = await exportSlotJson(slotId);
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(json);
        elements.saveSlotSummaryText.textContent = `Slot ${slotId}: Save JSON copied to clipboard.`;
      } catch (_error) {
        elements.saveSlotSummaryText.textContent = "Clipboard permission denied. Copy manually from import box.";
      }
    } else {
      elements.saveSlotSummaryText.textContent = "Clipboard API unavailable in this environment.";
    }
  });

  elements.showImportBtn.addEventListener("click", () => {
    elements.importSaveWrap.classList.remove("is-hidden");
  });

  elements.cancelImportBtn.addEventListener("click", () => {
    elements.importSaveWrap.classList.add("is-hidden");
    elements.importSaveInput.value = "";
  });

  elements.confirmImportBtn.addEventListener("click", async () => {
    const slotId = Number(elements.saveSlotSelect.value) || 1;
    try {
      const importedState = await importSlotJson(slotId, elements.importSaveInput.value);
      applyLoadedState(importedState);
      elements.importSaveWrap.classList.add("is-hidden");
      elements.importSaveInput.value = "";
      await refreshSaveSummary();
    } catch (_error) {
      elements.saveSlotSummaryText.textContent = "Import failed: invalid or unsupported save JSON.";
    }
  });

  refreshSaveSummary();
  syncIdentityUi(settings);

  setHtmlIfChanged(
    elements.upgradeNameCatalog,
    themedUpgradeNames
      .map((upgradeName, index) => `<p>${index + 1}. ${upgradeName}</p>`)
      .join("")
  );

  elements.shakeTreeBtn.addEventListener("click", () => {
    const result = shakeTreeHarvest();
    if (!result?.success) {
      return;
    }

    if (elements.treeTextureImg) {
      elements.treeTextureImg.classList.remove("is-shaking");
      void elements.treeTextureImg.offsetWidth;
      elements.treeTextureImg.classList.add("is-shaking");
      window.setTimeout(() => {
        elements.treeTextureImg.classList.remove("is-shaking");
      }, 420);
    }

    treeHarvestView.dropAllBananas();
  });
  elements.quickSellBtn.addEventListener("click", () => {
    sellBananas(25);
  });
  elements.toggleUpgradeTreeBtn.addEventListener("click", () => {
    elements.treeUpgradePanel.classList.toggle("is-hidden");
  });
  container.querySelector("#sellBtn").addEventListener("click", () => {
    sellBananas(Math.max(1, Math.floor(Number(elements.marketSellAmountInput.value) || 1)));
  });
  elements.buyTreeBtn.addEventListener("click", () => buyTree());
  elements.hireWorkerBtn.addEventListener("click", () => hireWorker());
  elements.buyPackingShedBtn.addEventListener("click", () => buyBuilding("packing_shed"));
  elements.buyFertilizerLabBtn.addEventListener("click", () => buyBuilding("fertilizer_lab"));
  elements.buyResearchHutBtn.addEventListener("click", () => buyBuilding("research_hut"));
  elements.buyQuantumReactorBtn.addEventListener("click", () => buyWeirdScienceConverter("quantum_reactor"));
  elements.buyColliderBtn.addEventListener("click", () => buyWeirdScienceConverter("collider"));
  elements.buyContainmentBtn.addEventListener("click", () => buyWeirdScienceConverter("containment"));
  if (elements.buyOrchardBtn) {
    elements.buyOrchardBtn.addEventListener("click", () => buyOrchard());
  }
  elements.unlockTierBtn.addEventListener("click", () => unlockNextTreeTier());
  elements.prestigeBtn.addEventListener("click", () => prestigeReset());
  elements.autoSellToggle.addEventListener("change", () => setAutoSellEnabled(elements.autoSellToggle.checked));
  elements.autoSellThresholdInput.addEventListener("change", () => {
    setAutoSellThreshold(elements.autoSellThresholdInput.value);
  });
  if (elements.autoExportBtn) {
    elements.autoExportBtn.addEventListener("click", () => {
      const status = getAutoExportStatus();
      if (!status.unlocked) {
        unlockAutoExport();
        return;
      }
      setAutoExportEnabled(!status.enabled);
    });
  }
  elements.shippingLaneSelect.addEventListener("change", () => {
    selectShippingLane(elements.shippingLaneSelect.value);
  });

  elements.treeHarvestUpgradesList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const button = target.closest("button[data-harvest-upgrade-id]");
    if (!button) {
      return;
    }
    const upgradeId = button.dataset.harvestUpgradeId;
    if (upgradeId) {
      purchaseTreeHarvestUpgrade(upgradeId);
    }
  });

  if (elements.pipUpgradesList) {
    elements.pipUpgradesList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const button = target.closest("button[data-pip-upgrade-id]");
      if (!button) {
        return;
      }
      const upgradeId = button.dataset.pipUpgradeId;
      if (upgradeId) {
        purchasePipUpgrade(upgradeId);
      }
    });
  }

  const buyersList = container.querySelector("#buyersList");
  const buyerElements = new Map();

  const buyerTierOrder = ["Local", "Corporate", "Global", "Interstellar", "Cosmic"];
  const buyersByTier = new Map(buyerTierOrder.map((tier) => [tier, []]));
  buyers.forEach((buyer) => {
    const tier = buyerTierOrder.includes(buyer.tierGroup) ? buyer.tierGroup : "Local";
    buyersByTier.get(tier).push(buyer);
  });

  const tierSectionElements = new Map();
  const getTierExpandedState = (tier) => {
    const source = settings.buyerTierExpanded && typeof settings.buyerTierExpanded === "object" ? settings.buyerTierExpanded : {};
    if (typeof source[tier] === "boolean") {
      return source[tier];
    }
    return tier === "Local";
  };

  const setTierExpandedState = (tier, expanded, persist = true) => {
    const current = settings.buyerTierExpanded && typeof settings.buyerTierExpanded === "object"
      ? settings.buyerTierExpanded
      : {};
    const nextExpanded = {
      ...current,
      [tier]: Boolean(expanded),
    };

    settings.buyerTierExpanded = nextExpanded;
    if (persist) {
      setUISettings({ buyerTierExpanded: nextExpanded });
    }

    const refs = tierSectionElements.get(tier);
    if (!refs) {
      return;
    }
    refs.toggleBtn.setAttribute("aria-expanded", String(Boolean(expanded)));
    refs.panel.classList.toggle("is-hidden", !expanded);
    refs.panel.setAttribute("aria-hidden", String(!expanded));
  };

  buyerTierOrder.forEach((tier) => {
    const section = document.createElement("section");
    section.className = "buyer-tier-group";

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "buyer-tier-toggle";
    toggleBtn.setAttribute("aria-expanded", "false");
    toggleBtn.setAttribute("aria-controls", `buyer-tier-${tier.toLowerCase()}-panel`);
    toggleBtn.textContent = `${tier} Buyers`;

    const panel = document.createElement("div");
    panel.className = "buyers-list buyer-tier-panel";
    panel.id = `buyer-tier-${tier.toLowerCase()}-panel`;

    section.appendChild(toggleBtn);
    section.appendChild(panel);
    buyersList.appendChild(section);

    tierSectionElements.set(tier, { section, toggleBtn, panel });

    toggleBtn.addEventListener("click", () => {
      const currentlyExpanded = toggleBtn.getAttribute("aria-expanded") === "true";
      setTierExpandedState(tier, !currentlyExpanded, true);
    });

    const tierBuyers = buyersByTier.get(tier) || [];
    tierBuyers.forEach((buyer) => {
      const card = document.createElement("div");
      card.className = "buyer-card";
      card.innerHTML = `
      <p class="buyer-name">${buyer.logoEmoji || "M"} ${buyer.name}</p>
      <p>${buyer.flavorText || "No profile on file."}</p>
      <p class="buyer-status" id="status-${buyer.id}">Status: Locked</p>
      <p>Requirement: ${formatRequirement(buyer.unlockRequirement, formatAmount)}</p>
      <p id="price-${buyer.id}">Price: $0 / banana</p>
      <p id="rep-${buyer.id}">Reputation: 0 / 100</p>
      <p id="cooldown-${buyer.id}">Cooldown: Ready</p>
      <div class="shipment-controls" id="controls-${buyer.id}">
        <input id="slider-${buyer.id}" type="range" min="${buyer.minShipment}" max="${buyer.maxShipment}" value="${buyer.minShipment}" title="Shipment amount" />
        <input id="input-${buyer.id}" type="number" min="${buyer.minShipment}" max="${buyer.maxShipment}" step="1" value="${buyer.minShipment}" />
        <button id="max-${buyer.id}" type="button" title="Set shipment to the maximum you can currently ship">Max</button>
        <button id="ship-${buyer.id}" type="button" title="Ship bananas to this buyer">Ship</button>
      </div>
    `;

      panel.appendChild(card);

      const slider = card.querySelector(`#slider-${buyer.id}`);
      const input = card.querySelector(`#input-${buyer.id}`);
      const shipButton = card.querySelector(`#ship-${buyer.id}`);
      const maxButton = card.querySelector(`#max-${buyer.id}`);
      const controls = card.querySelector(`#controls-${buyer.id}`);
      const status = card.querySelector(`#status-${buyer.id}`);
      const cooldown = card.querySelector(`#cooldown-${buyer.id}`);
      const price = card.querySelector(`#price-${buyer.id}`);
      const reputation = card.querySelector(`#rep-${buyer.id}`);

      const syncShipmentInput = (value) => {
        const clamped = clampShipment(value, buyer.minShipment, buyer.maxShipment);
        slider.value = String(clamped);
        input.value = String(clamped);
        return clamped;
      };

      slider.addEventListener("input", () => syncShipmentInput(slider.value));
      input.addEventListener("change", () => syncShipmentInput(input.value));
      shipButton.addEventListener("click", () => shipToBuyer(buyer.id, syncShipmentInput(input.value)));
      maxButton.addEventListener("click", () => {
        const lanes = getShippingLanesStatus();
        const selectedLane = lanes.find((lane) => lane.selected) || lanes[0];
        const laneCap = Math.max(1, Math.floor(Number(selectedLane?.capacity) || buyer.maxShipment));
        const maxAllowedShipment = Math.min(buyer.maxShipment, laneCap);
        const available = Math.floor(Number(gameState.bananas) || 0);
        const desired = Math.min(available, maxAllowedShipment);

        // If the player doesn't have enough for the min shipment, keep it at min so the UI stays consistent.
        const next = clampShipment(Math.max(buyer.minShipment, desired), buyer.minShipment, maxAllowedShipment);
        syncShipmentInput(next);
      });

      buyerElements.set(buyer.id, {
        card,
        status,
        cooldown,
        controls,
        input,
        price,
        reputation,
        shipButton,
        maxButton,
        syncShipmentInput,
        requirement: buyer.unlockRequirement,
      });
    });

    setTierExpandedState(tier, getTierExpandedState(tier), false);
  });

  const researchNodes = getResearchTreeNodes();
  let selectedResearchNodeId = researchNodes[0]?.id || null;
  const researchNodeElements = new Map();

  researchNodes.forEach((node) => {
    const nodeButton = document.createElement("button");
    nodeButton.type = "button";
    nodeButton.className = "research-node";
    nodeButton.style.gridColumn = String(node.col + 1);
    nodeButton.style.gridRow = String(node.row + 1);
    nodeButton.textContent = node.name;
    nodeButton.addEventListener("click", () => {
      selectedResearchNodeId = node.id;
    });
    elements.researchTreeGrid.appendChild(nodeButton);
    researchNodeElements.set(node.id, nodeButton);
  });

  elements.researchBuyBtn.addEventListener("click", () => {
    if (selectedResearchNodeId) {
      purchaseUpgrade(selectedResearchNodeId);
    }
  });

  const renderUI = (state) => {
    const fmt = (value) => formatGameNumber(value, numberFormatMode);

    const bananasPerSecond = getTotalBananasPerSecond();
    const breakdown = getProductionBreakdown();
    const statBreakdown = getStatBreakdown();
    const treeHarvestSnapshot = getTreeHarvestSnapshot();
    const treeHarvestUpgrades = getTreeHarvestUpgradesStatus();
    const currentTier = getCurrentTreeTier();
    const nextTier = getNextTreeTier();
    const treeCost = getTreeCost();
    const workerCost = getWorkerCost();
    const packingShedCost = getBuildingCost("packing_shed");
    const fertilizerLabCost = getBuildingCost("fertilizer_lab");
    const researchHutCost = getBuildingCost("research_hut");
    const questStatus = getCurrentQuestStatus();

    setTextIfChanged(elements.bananasText, fmt(state.bananas));
    setTextIfChanged(elements.cashText, `$${fmt(state.cash)}`);
    setTextIfChanged(elements.bpsText, fmt(bananasPerSecond));
    setTextIfChanged(elements.clickYieldText, fmt(state.clickYield));
    setTextIfChanged(elements.treesText, `Trees Owned: ${fmt(state.treesOwned)}`);
    setTextIfChanged(elements.treeRateText, `Harvest power: ${fmt(state.productionMultiplier)}x`);
    if (inspectorPanelVisible) {
      setTextIfChanged(elements.inspectorProductionText, `Production: ${fmt(statBreakdown.final.productionMultiplier)}x`);
      setTextIfChanged(elements.inspectorClickText, `Click: ${fmt(statBreakdown.final.clickMultiplier)}x`);
      setTextIfChanged(elements.inspectorExportText, `Export: ${fmt(statBreakdown.final.exportPriceMultiplier)}x`);
      setTextIfChanged(elements.inspectorCooldownText, `Cooldown: ${fmt(statBreakdown.final.exportCooldownMultiplier)}x`);
      setTextIfChanged(elements.inspectorHarvestText, `Harvest yield/pick: ${fmt(statBreakdown.final.clickHarvestYield)}`);
      setTextIfChanged(elements.inspectorSpawnText, `Spawn interval: ${fmt(statBreakdown.final.spawnInterval)}s (cap ${fmt(statBreakdown.final.maxBananasOnTree)})`);
      setTextIfChanged(elements.inspectorWorkerText, `Worker output: ${fmt(statBreakdown.final.workerOutputPerSecond)}/s`);
      setTextIfChanged(elements.inspectorOrchardText, `Orchard picks: ${fmt(statBreakdown.final.orchardPickRatePerSecond)}/s`);
      setTextIfChanged(
        elements.inspectorPricesText,
        `Market/AutoSell: $${fmt(statBreakdown.final.marketPricePerBanana)} / $${fmt(statBreakdown.final.autoSellPricePerBanana)}`
      );
      setTextIfChanged(
        elements.inspectorSourcesText,
        `Sources: Prestige ${fmt(statBreakdown.sources.prestigeProduction)}x | PIP ${fmt(statBreakdown.sources.pipProduction)}x | Achievements ${fmt(statBreakdown.sources.achievementProduction)}x | Research rows ${fmt(statBreakdown.sources.researchRowProduction)}x | Evolution ${fmt(statBreakdown.sources.evolutionProduction)}x | CEO ${fmt(statBreakdown.sources.ceoGlobal)}x`
      );
    }
    const treeTextures = getTreeTextures(graphicsMode);
    const treeTextureIndex = Math.max(0, Math.min(treeTextures.length - 1, Math.floor(Number(state.treeTierIndex) || 0)));
    const treeTextureSrc = treeTextures[treeTextureIndex];
    if (elements.treeTextureImg && elements.treeTextureImg.getAttribute("src") !== treeTextureSrc) {
      elements.treeTextureImg.setAttribute("src", treeTextureSrc);
    }
    treeHarvestView.setTreeTierIndex(state.treeTierIndex);
    treeHarvestView.render(treeHarvestSnapshot);
    treeDebugVisible = Boolean(settings.treeDebugEnabled);
    elements.treeDebugPanel.classList.toggle("is-hidden", !treeDebugVisible);
    if (treeDebugVisible) {
      setTextIfChanged(elements.treeDebugCountText, `Bananas on tree: ${fmt(treeHarvestSnapshot.bananasOnTree.length)} / ${fmt(treeHarvestSnapshot.maxBananasOnTree)}`);
      setTextIfChanged(elements.treeDebugIntervalText, `Spawn interval: ${fmt(treeHarvestSnapshot.spawnInterval)}s`);
      setTextIfChanged(elements.treeDebugAccumulatorText, `Spawn accumulator: ${fmt(treeHarvestSnapshot.spawnAccumulator)}s`);
      setTextIfChanged(
        elements.treeDebugGoldenText,
        `Golden: ${fmt(treeHarvestSnapshot.goldenChance * 100)}% (x${fmt(treeHarvestSnapshot.goldenMultiplier)}), Diamond: ${fmt(treeHarvestSnapshot.diamondChance * 100)}% (x${fmt(treeHarvestSnapshot.diamondMultiplier)})`
      );
    }
    if (treeHarvestSnapshot.shakeCooldownRemaining > 0) {
      setTextIfChanged(elements.shakeTreeBtn, `Shake Tree (${fmt(treeHarvestSnapshot.shakeCooldownRemaining)}s)`);
      setDisabledIfChanged(elements.shakeTreeBtn, true);
    } else {
      setTextIfChanged(elements.shakeTreeBtn, "Shake Tree");
      setDisabledIfChanged(elements.shakeTreeBtn, treeHarvestSnapshot.bananasOnTree.length <= 0);
    }
    setHtmlIfChanged(
      elements.treeHarvestUpgradesList,
      treeHarvestUpgrades
        .map((upgrade) => {
          const effectiveCostCash = Number(upgrade.effectiveCostCash || upgrade.costCash || 0);
          const baseCostCash = Number(upgrade.costCash || 0);
          const showDiscount = !upgrade.purchased && effectiveCostCash < baseCostCash;
          const buttonLabel = upgrade.purchased ? "Purchased" : `Buy ($${fmt(effectiveCostCash)})`;
          const disabled = upgrade.purchased || !upgrade.unlocked || !upgrade.canAfford;
          const reqText = upgrade.unlocked ? "" : `Requires: ${(upgrade.requires || []).join(", ")}`;
          const costText = showDiscount
            ? `<p>Cost: $${fmt(effectiveCostCash)} (base $${fmt(baseCostCash)})</p>`
            : `<p>Cost: $${fmt(baseCostCash)}</p>`;
          return `<div class="buyer-card">
          <p class="buyer-name">${upgrade.name}</p>
          <p>${upgrade.description}</p>
          ${costText}
          ${reqText ? `<p>${reqText}</p>` : ""}
          <button type="button" data-harvest-upgrade-id="${upgrade.id}" ${disabled ? "disabled" : ""}>${buttonLabel}</button>
        </div>`;
        })
        .join("")
    );
    setTextIfChanged(elements.workersText, `Workers: ${fmt(state.workersOwned)}`);
    setTextIfChanged(elements.workerRateText, `Workers/sec: ${fmt(state.bananasPerWorkerPerSecond)}`);
    const orchardStatus = getOrchardStatus();
    if (elements.orchardText) {
      setTextIfChanged(
        elements.orchardText,
        `Orchards: ${fmt(orchardStatus.orchardsOwned)} (${fmt(orchardStatus.pickRatePerSecond)} picks/sec, +${fmt(orchardStatus.capacityBonus)} canopy cap)`
      );
    }
    if (elements.orchardInfoText) {
      if (!orchardStatus.milestoneMet) {
        setTextIfChanged(
          elements.orchardInfoText,
          `Locked: Produce ${fmt(orchardStatus.requiredTotalBananasEarned)} total bananas to unlock orchards.`
        );
      } else if (!orchardStatus.cashGateMet) {
        setTextIfChanged(elements.orchardInfoText, `Requirement: Have at least $${fmt(orchardStatus.cashGate)} cash to start orchard ops.`);
      } else {
        setTextIfChanged(
          elements.orchardInfoText,
          `Unlocked: Orchards boost throughput (spawn ${fmt((1 - orchardStatus.spawnIntervalMultiplier) * 100)}% faster) and export value (+${fmt((orchardStatus.exportBonusMultiplier - 1) * 100)}%).`
        );
      }
    }
    if (elements.buyOrchardBtn) {
      setTextIfChanged(elements.buyOrchardBtn, `Buy Orchard ($${fmt(orchardStatus.cost)})`);
      const disabled = !orchardStatus.milestoneMet || !orchardStatus.cashGateMet || state.cash < orchardStatus.cost;
      setDisabledIfChanged(elements.buyOrchardBtn, disabled);
    }
    setCheckedIfChanged(elements.autoSellToggle, state.autoSellEnabled);
    setValueIfChanged(elements.autoSellThresholdInput, state.autoSellThreshold);
    setTextIfChanged(elements.autoSellInfoText, `Auto-Sell price: $${fmt(getAutoSellPricePerBanana())} per banana above threshold`);
    setTextIfChanged(elements.treesPerSecText, `Auto/sec (est): ${fmt(breakdown.autoPerSecEstimated || 0)}`);
    setTextIfChanged(elements.workersPerSecText, `Worker potential/sec: ${fmt(breakdown.workerPerSec)}`);
    setTextIfChanged(
      elements.bonusMultipliersText,
      `Bonuses: Production ${fmt(breakdown.productionMultiplier)}x, Export ${fmt(breakdown.exportPriceMultiplier)}x, Antimatter Export ${fmt(
        breakdown.antimatterExportMultiplier
      )}x`
    );
    setTextIfChanged(elements.currentTierText, `Current Tier: ${currentTier.icon || ""} ${currentTier.name}`.trim());

    if (nextTier) {
      const baseUnlockCost = Number(nextTier.unlockCostCash) || 0;
      const unlockCost = getEffectiveTreeTierUnlockCost(nextTier);
      const questComplete = questStatus?.isComplete ?? true;
      setTextIfChanged(elements.nextTierText, `Next Tier: ${nextTier.icon || ""} ${nextTier.name} (${fmt(nextTier.baseBananasPerSecondPerTree)} base bps/tree)`.trim());
      if (unlockCost < baseUnlockCost) {
        setTextIfChanged(elements.tierUnlockCostText, `Unlock cost: $${fmt(unlockCost)} (base $${fmt(baseUnlockCost)})`);
      } else {
        setTextIfChanged(elements.tierUnlockCostText, `Unlock cost: $${fmt(unlockCost)}`);
      }
      setDisabledIfChanged(elements.unlockTierBtn, state.cash < unlockCost || !questComplete);
      setTextIfChanged(elements.unlockTierBtn, `Unlock Next Tier ($${fmt(unlockCost)})`);
    } else {
      setTextIfChanged(elements.nextTierText, "Next Tier: Max tier reached");
      setTextIfChanged(elements.tierUnlockCostText, "Unlock cost: Complete");
      setDisabledIfChanged(elements.unlockTierBtn, true);
      setTextIfChanged(elements.unlockTierBtn, "All Tree Tiers Unlocked");
    }

    if (questStatus) {
      const questPct = (questStatus.progressPct * 100).toFixed(1);
      const cashTarget = getEffectiveTreeTierUnlockCost(nextTier);
      const cashPct = cashTarget <= 0 ? 100 : Math.min(100, (state.cash / cashTarget) * 100);
      setTextIfChanged(elements.questTitleText, `Current quest: ${questStatus.description}`);
      setTextIfChanged(elements.questRewardText, `Reward: ${questStatus.rewardDescription}`);
      setTextIfChanged(elements.questProgressLabel, `Quest Progress: ${fmt(questStatus.progress)} / ${fmt(questStatus.target)} (${questPct}%)`);
      setWidthIfChanged(elements.questProgressFill, questPct);
      setTextIfChanged(elements.questCashProgressLabel, `Cash Requirement: $${fmt(state.cash)} / $${fmt(cashTarget)} (${cashPct.toFixed(1)}%)`);
      setWidthIfChanged(elements.questCashProgressFill, cashPct.toFixed(1));
    } else {
      setTextIfChanged(elements.questTitleText, "Current quest: All evolutions complete");
      setTextIfChanged(elements.questRewardText, "Reward: Max evolution reached");
      setTextIfChanged(elements.questProgressLabel, "Quest Progress: Complete");
      setWidthIfChanged(elements.questProgressFill, 100);
      setTextIfChanged(elements.questCashProgressLabel, "Cash Requirement: Complete");
      setWidthIfChanged(elements.questCashProgressFill, 100);
    }

    setTextIfChanged(elements.buyTreeBtn, `Buy Tree ($${fmt(treeCost)})`);
    setDisabledIfChanged(elements.buyTreeBtn, state.cash < treeCost);
    setTextIfChanged(elements.hireWorkerBtn, `Hire Worker ($${fmt(workerCost)})`);
    setDisabledIfChanged(elements.hireWorkerBtn, state.cash < workerCost);
    setTextIfChanged(elements.buyPackingShedBtn, `Buy Packing Shed ($${fmt(packingShedCost)})`);
    setDisabledIfChanged(elements.buyPackingShedBtn, state.cash < packingShedCost);
    setTextIfChanged(elements.buyFertilizerLabBtn, `Buy Fertilizer Lab ($${fmt(fertilizerLabCost)})`);
    setDisabledIfChanged(elements.buyFertilizerLabBtn, state.cash < fertilizerLabCost);
    setTextIfChanged(elements.buyResearchHutBtn, `Buy Research Hut ($${fmt(researchHutCost)})`);
    setDisabledIfChanged(elements.buyResearchHutBtn, state.cash < researchHutCost);
    setTextIfChanged(elements.packingShedText, `Packing Shed Lv ${fmt(state.packingShedLevel)} (+${fmt((state.packedExportBonusMultiplier - 1) * 100)}% export price)`);
    setTextIfChanged(elements.fertilizerLabText, `Fertilizer Lab Lv ${fmt(state.fertilizerLabLevel)} (tree output boost)`);
    setTextIfChanged(elements.researchHutText, `Research Hut Lv ${fmt(state.researchHutLevel)} (upgrade discount)`);

    const marketPrice = getMarketPricePerBanana();
    setTextIfChanged(elements.marketPriceText, `Market price: $${fmt(marketPrice)} per banana`);
    const autoExportStatus = getAutoExportStatus();
    if (elements.autoExportStatusText && elements.autoExportBtn) {
      if (!autoExportStatus.unlocked) {
        setTextIfChanged(
          elements.autoExportStatusText,
          `Locked: Pay $${fmt(autoExportStatus.unlockCost)} to unlock automatic max shipments when buyers are ready.`
        );
        setTextIfChanged(elements.autoExportBtn, `Unlock Auto-Export ($${fmt(autoExportStatus.unlockCost)})`);
        setDisabledIfChanged(elements.autoExportBtn, !autoExportStatus.canUnlock);
      } else {
        setTextIfChanged(
          elements.autoExportStatusText,
          autoExportStatus.enabled
            ? "Auto-Export: ON (ships max available to ready buyers)."
            : "Auto-Export: OFF."
        );
        setTextIfChanged(elements.autoExportBtn, autoExportStatus.enabled ? "Disable Auto-Export" : "Enable Auto-Export");
        setDisabledIfChanged(elements.autoExportBtn, false);
      }
    }

    const lanes = getShippingLanesStatus();
    setHtmlIfChanged(
      elements.shippingLaneSelect,
      lanes
      .map((lane) => `<option value="${lane.id}" ${lane.selected ? "selected" : ""} ${lane.unlocked ? "" : "disabled"}>${lane.name}${lane.unlocked ? "" : " (Locked)"}</option>`)
      .join("")
    );
    const selectedLane = lanes.find((lane) => lane.selected) || lanes[0];
    if (selectedLane) {
      setTextIfChanged(elements.laneInfoText, `Lane bonus: +${fmt((selectedLane.priceMultiplier - 1) * 100)}% export price, capacity: ${fmt(selectedLane.capacity)} bananas/shipment`);
    }

    let bestBuyerBonusPct = 0;
    buyers.forEach((buyer) => {
      const refs = buyerElements.get(buyer.id);
      const unlocked = isBuyerUnlocked(buyer.id);
      const cooldownRemaining = getBuyerCooldownRemainingSeconds(buyer.id);
      refs.syncShipmentInput(refs.input.value);
      const buyerPrice = getBuyerEffectivePricePerBanana(buyer);

      if (refs.card) {
        refs.card.classList.toggle("is-locked", !unlocked);
      }
      setTextIfChanged(refs.status, unlocked ? "Status: Unlocked" : "Status: Locked");
      setTextIfChanged(refs.price, `Price: $${fmt(buyerPrice)} / banana`);
      setTextIfChanged(refs.reputation, `Reputation: ${fmt(getBuyerReputationPercent(buyer.id))} / 100`);
      setTextIfChanged(refs.cooldown, `Cooldown: ${formatCooldown(cooldownRemaining)}`);
      refs.controls.classList.toggle("is-hidden", !unlocked);
      setDisabledIfChanged(refs.shipButton, !unlocked || cooldownRemaining > 0);
      if (refs.maxButton) {
        setDisabledIfChanged(refs.maxButton, !unlocked);
      }

      if (unlocked) {
        bestBuyerBonusPct = Math.max(bestBuyerBonusPct, ((buyerPrice / marketPrice) - 1) * 100);
      }
    });

    const activeContracts = getActiveContracts();
    setHtmlIfChanged(
      elements.contractsList,
      activeContracts.length
        ? activeContracts
            .map((contract) => {
              const buyer = buyers.find((item) => item.id === contract.buyerId);
              const pct = (contract.progressPct * 100).toFixed(1);
              const rareText = contract.rewardRareItem ? `, Rare Item: ${contract.rewardRareItem}` : "";
              return `<div class="buyer-card">
              <p class="buyer-name">${contract.premium ? "Premium" : "Standard"} Contract - ${buyer?.name || contract.buyerId}</p>
              <p>Progress: ${fmt(contract.progressBananas)} / ${fmt(contract.targetBananas)} (${pct}%)</p>
              <div class="progress-wrap"><div class="progress-fill" style="width:${pct}%"></div></div>
              <p>Time Left: ${formatCooldown(contract.timeRemainingSeconds)}</p>
              <p>Rewards: $${fmt(contract.rewardCash)} +${fmt(contract.rewardRep)} rep${rareText}</p>
            </div>`;
            })
            .join("")
        : "<p>No active contracts. New requests will appear shortly.</p>"
    );

    setTextIfChanged(elements.buyerBonusText, `+${fmt(bestBuyerBonusPct)}%`);

    const liveEvent = getLiveEventStatus();
    if (liveEvent.activeEventId) {
      const timerText = liveEvent.remainingSeconds > 0 ? `${formatCooldown(liveEvent.remainingSeconds)}` : "Active";
      setTextIfChanged(elements.eventNameText, `Event: ${liveEvent.activeEventName} (${timerText})`);
      setTextIfChanged(elements.eventDetailText, liveEvent.activeEventDescription);
    } else {
      setTextIfChanged(elements.eventNameText, `Event: No active event (next roll in ${formatCooldown(liveEvent.nextRollSeconds)})`);
      setTextIfChanged(elements.eventDetailText, "Prepare cash and reputation for the next market event.");
    }

    const prestigeUnlocked = isPrestigeUnlocked();
    const prestigeGain = getPrestigeGainPreview();
    const prestigeBonuses = getPrestigeBonuses();
    const pipUpgradeStatus = getPipUpgradeStatus();
    const pipModifiers = getPipModifiers();
    const boughtPipRanks = pipUpgradeStatus.reduce((sum, item) => sum + item.rank, 0);
    setTextIfChanged(elements.pipText, `PIP: ${fmt(state.pip)}`);
    setTextIfChanged(elements.pipSpentText, `PIP Spent: ${fmt(state.pipSpentTotal)}`);
    setTextIfChanged(
      elements.pipShopSummaryText,
      `Ranks purchased: ${fmt(boughtPipRanks)} | Total spent: ${fmt(state.pipSpentTotal)} | Permanent mods: Prod ${fmt(pipModifiers.productionMultiplier)}x, Click ${fmt(pipModifiers.clickMultiplier)}x, Export ${fmt(pipModifiers.exportPriceMultiplier)}x`
    );
    setTextIfChanged(elements.prestigeCountText, `Prestige Resets: ${fmt(state.prestigeCount)}`);
    setTextIfChanged(elements.prestigeBonusText, `Permanent bonus: +${fmt((prestigeBonuses.productionMultiplier - 1) * 100)}% production, +${fmt((prestigeBonuses.exportPriceMultiplier - 1) * 100)}% export price, +${fmt((prestigeBonuses.clickMultiplier - 1) * 100)}% click yield`);
    setTextIfChanged(
      elements.prestigeUnlockText,
      prestigeUnlocked
      ? "Unlock condition: Met."
      : "Unlock condition: Reach Quantum Banana Reactor tier or 1.00M total bananas earned."
    );
    setTextIfChanged(elements.prestigeGainText, `Reset gain: +${fmt(prestigeGain)} PIP`);
    setDisabledIfChanged(elements.prestigeBtn, !prestigeUnlocked || prestigeGain <= 0);
    setHtmlIfChanged(
      elements.pipUpgradesList,
      pipUpgradeStatus
        .map((upgrade) => {
          const stateLabel = upgrade.maxed
            ? "Maxed"
            : upgrade.unlocked
              ? `Rank ${fmt(upgrade.rank)} / ${fmt(upgrade.maxRank)}`
              : "Locked";
          const costLabel = upgrade.maxed ? "Max Rank" : `${fmt(upgrade.nextCost)} PIP`;
          const disabled = upgrade.maxed || !upgrade.unlocked || !upgrade.canAfford;
          const requirementText = upgrade.unlocked
            ? ""
            : `<p>Unlock: ${formatRequirement(upgrade.unlockCondition, fmt)}</p>`;
          return `<div class="upgrade-card">
          <p class="buyer-name">${upgrade.category}: ${upgrade.name}</p>
          <p>${upgrade.description}</p>
          ${requirementText}
          <p>Status: ${stateLabel}</p>
          <button type="button" data-pip-upgrade-id="${upgrade.id}" ${disabled ? "disabled" : ""}>
            ${upgrade.maxed ? "Maxed" : `Buy (${costLabel})`}
          </button>
        </div>`;
        })
        .join("")
    );

    const ceo = getCeoLevelProgress(state.totalBananasEarned);
    setTextIfChanged(elements.ceoLevelText, `Level ${ceo.level}`);
    setWidthIfChanged(elements.ceoProgressFill, (ceo.progress * 100).toFixed(2));
    setTextIfChanged(elements.ceoProgressText, `${(ceo.progress * 100).toFixed(1)}% to next level`);
    setTextIfChanged(elements.playerTotalBananasText, `Total Bananas: ${fmt(state.totalBananasEarned)}`);
    setTextIfChanged(elements.playerTotalCashText, `Total Cash: $${fmt(state.totalCashEarned)}`);
    setTextIfChanged(elements.playerTotalClicksText, `Total Clicks: ${fmt(state.totalClicks)}`);
    setTextIfChanged(elements.playerTotalShipmentsText, `Total Shipments: ${fmt(state.totalShipments)}`);
    setTextIfChanged(elements.playerContractsText, `Contracts Completed: ${fmt(state.contractsCompleted)}`);
    setTextIfChanged(elements.playerTreesWorkersText, `Trees / Workers: ${fmt(state.treesOwned)} / ${fmt(state.workersOwned)}`);
    setTextIfChanged(elements.playerPrestigeText, `Prestige / PIP: ${fmt(state.prestigeCount)} / ${fmt(state.pip)}`);

    setTextIfChanged(elements.researchPointsText, `Research Points: ${fmt(state.researchPoints)}`);
    setTextIfChanged(elements.researchRateText, `RP/sec: ${fmt(getResearchPointsPerSecond())}`);

    const weirdScience = getWeirdScienceStatus();
    setTextIfChanged(elements.bananaMatterText, `Banana Matter: ${fmt(weirdScience.resources.bananaMatter)}`);
    setTextIfChanged(elements.exoticPeelParticlesText, `Exotic Peel Particles: ${fmt(weirdScience.resources.exoticPeelParticles)}`);
    setTextIfChanged(elements.antimatterBananasText, `Antimatter Bananas: ${fmt(weirdScience.resources.antimatterBananas)}`);
    setTextIfChanged(elements.antimatterBoostText, `Antimatter Export Boost: ${fmt(weirdScience.antimatterExportMultiplier)}x`);

    const reactor = weirdScience.converters.find((converter) => converter.id === "quantum_reactor");
    const collider = weirdScience.converters.find((converter) => converter.id === "collider");
    const containment = weirdScience.converters.find((converter) => converter.id === "containment");
    if (reactor) {
      setTextIfChanged(
        elements.quantumReactorText,
        `Quantum Reactor Lv ${fmt(reactor.level)} (${fmt(reactor.inputPerSecond)} bananas/sec -> ${fmt(reactor.outputPerSecond)} matter/sec)`
      );
      setTextIfChanged(elements.buyQuantumReactorBtn, `Build Reactor ($${fmt(reactor.cost)})`);
      setDisabledIfChanged(elements.buyQuantumReactorBtn, !reactor.unlocked || state.cash < reactor.cost);
    }
    if (collider) {
      setTextIfChanged(
        elements.colliderText,
        `Collider Lv ${fmt(collider.level)} (${fmt(collider.inputPerSecond)} matter/sec -> ${fmt(collider.outputPerSecond)} particles/sec)`
      );
      setTextIfChanged(elements.buyColliderBtn, `Build Collider ($${fmt(collider.cost)})`);
      setDisabledIfChanged(elements.buyColliderBtn, !collider.unlocked || state.cash < collider.cost);
    }
    if (containment) {
      setTextIfChanged(
        elements.containmentText,
        `Containment Lv ${fmt(containment.level)} (${fmt(containment.inputPerSecond)} particles/sec -> ${fmt(containment.outputPerSecond)} antimatter/sec)`
      );
      setTextIfChanged(elements.buyContainmentBtn, `Build Containment ($${fmt(containment.cost)})`);
      setDisabledIfChanged(elements.buyContainmentBtn, !containment.unlocked || state.cash < containment.cost);
    }

    researchNodes.forEach((node) => {
      const nodeElement = researchNodeElements.get(node.id);
      const purchased = isUpgradePurchased(node.id);
      const unlocked = isUpgradeUnlocked(node.id);
      nodeElement.classList.toggle("is-purchased", purchased);
      nodeElement.classList.toggle("is-unlocked", unlocked && !purchased);
      nodeElement.classList.toggle("is-locked", !unlocked && !purchased);
      nodeElement.classList.toggle("is-selected", selectedResearchNodeId === node.id);
    });

    const selectedNode = researchNodes.find((node) => node.id === selectedResearchNodeId) || researchNodes[0];
    if (selectedNode) {
      const purchased = isUpgradePurchased(selectedNode.id);
      const unlocked = isUpgradeUnlocked(selectedNode.id);
      const cost = getEffectiveUpgradeCost(selectedNode.id);
      const prereqText = selectedNode.prerequisites?.length ? selectedNode.prerequisites.join(", ") : "None";
      setTextIfChanged(elements.researchDetailName, `${selectedNode.category}: ${selectedNode.name}`);
      setTextIfChanged(elements.researchDetailDesc, selectedNode.description);
      setTextIfChanged(elements.researchDetailReq, `Requirements: ${formatRequirement(selectedNode.unlockCondition, fmt)} | Prerequisites: ${prereqText}`);
      setTextIfChanged(elements.researchDetailCost, `Cost: $${fmt(cost.cash)} + ${fmt(cost.researchPoints)} RP`);
      if (purchased) {
        setTextIfChanged(elements.researchDetailState, "State: Purchased");
        setDisabledIfChanged(elements.researchBuyBtn, true);
        setTextIfChanged(elements.researchBuyBtn, "Purchased");
      } else if (!unlocked) {
        setTextIfChanged(elements.researchDetailState, "State: Locked");
        setDisabledIfChanged(elements.researchBuyBtn, true);
        setTextIfChanged(elements.researchBuyBtn, "Locked");
      } else {
        const canAfford = state.cash >= cost.cash && state.researchPoints >= cost.researchPoints;
        setTextIfChanged(elements.researchDetailState, "State: Unlocked");
        setDisabledIfChanged(elements.researchBuyBtn, !canAfford);
        setTextIfChanged(elements.researchBuyBtn, `Research ($${fmt(cost.cash)} + ${fmt(cost.researchPoints)} RP)`);
      }
    }

    const achievementStatuses = getAchievementsStatus();
    const unlockedCount = achievementStatuses.filter((achievement) => achievement.unlocked).length;
    setTextIfChanged(elements.achievementSummaryText, `${fmt(unlockedCount)} / ${fmt(achievementStatuses.length)} unlocked`);
    setHtmlIfChanged(
      elements.achievementsList,
      achievementStatuses
        .map((achievement) => {
          const pct = (achievement.progressPct * 100).toFixed(1);
          return `<div class="buyer-card ${achievement.unlocked ? "is-achievement-unlocked" : ""}">
          <p class="buyer-name">${achievement.name}</p>
          <p>${achievement.description}</p>
          <p>Perk: ${achievement.perk.text}</p>
          <p>Status: ${achievement.unlocked ? "Unlocked" : `${fmt(achievement.progress)} / ${fmt(achievement.target)}`}</p>
          <div class="progress-wrap"><div class="progress-fill" style="width:${achievement.unlocked ? 100 : pct}%"></div></div>
        </div>`;
        })
        .join("")
    );

    const ceoEmails = getCeoEmails();
    setHtmlIfChanged(
      elements.ceoInboxList,
      ceoEmails.length
        ? ceoEmails
            .map((email) => `<div class="buyer-card">
          <p class="buyer-name">${email.subject}</p>
          <p>${email.body}</p>
          <p>Received: ${new Date(email.receivedAt).toLocaleString()}</p>
        </div>`)
            .join("")
        : "<p>No CEO emails yet. Hit milestones to unlock inbox messages.</p>"
    );
  };

  let latestState = gameState;
  let renderDirty = true;
  let lastRenderDurationMs = 0;
  let renderFps = 0;
  let fpsWindowFrames = 0;
  let fpsWindowStart = typeof performance !== "undefined" ? performance.now() : Date.now();

  const renderDebugPanel = () => {
    if (!debugPanelVisible) {
      return;
    }

    setTextIfChanged(elements.debugTickText, `Tick: ${(Number(latestState?.lastTickDurationMs) || 0).toFixed(2)}ms`);
    setTextIfChanged(elements.debugRenderText, `Render: ${lastRenderDurationMs.toFixed(2)}ms`);
    setTextIfChanged(elements.debugFpsText, `Render FPS: ${renderFps.toFixed(2)}`);
  };

  const scheduledRender = () => {
    if (!renderDirty) {
      renderDebugPanel();
      return;
    }

    const start = typeof performance !== "undefined" ? performance.now() : Date.now();
    renderUI(latestState);
    const end = typeof performance !== "undefined" ? performance.now() : Date.now();
    lastRenderDurationMs = end - start;
    renderDirty = false;
    fpsWindowFrames += 1;

    if (end - fpsWindowStart >= 1000) {
      renderFps = (fpsWindowFrames * 1000) / Math.max(1, end - fpsWindowStart);
      fpsWindowFrames = 0;
      fpsWindowStart = end;
    }

    renderDebugPanel();
  };

  const unsubscribe = subscribe((state) => {
    latestState = state;
    renderDirty = true;
  });

  const renderTimer = window.setInterval(scheduledRender, RENDER_INTERVAL_MS);
  scheduledRender();

  return () => {
    window.clearInterval(renderTimer);
    treeHarvestView.destroy();
    unsubscribe();
  };
}
