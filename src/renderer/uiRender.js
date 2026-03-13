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
  getActiveChallengeRunStatus,
  getAscensionChallengesStatus,
  getAscensionRewardsStatus,
  getChallengeLastResult,
  getCeoEmails,
  getBuyerCooldownRemainingSeconds,
  getBuyerEffectivePricePerBanana,
  getBuyerReputationPercent,
  getBaccaratStatus,
  getBlackjackStatus,
  getBuildingCost,
  getBuildingMaxLevel,
  getCasinoStatus,
  getCurrentTreeTier,
  getCurrentQuestStatus,
  getEffectiveTreeTierUnlockCost,
  getEffectiveUpgradeCost,
  getLiveEventStatus,
  getMarketPricePerBanana,
  getMississippiStudStatus,
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
  resumeChallengeRun,
  startChallengeRun,
  abandonChallengeRun,
  completeChallengeRun,
  clearChallengeLastResult,
  declineInsuranceBlackjack,
  doubleDownBlackjack,
  failChallengeRun,
  hitBlackjack,
  purchaseTreeHarvestUpgrade,
  purchasePipUpgrade,
  purchaseUpgrade,
  resetAllProgress,
  cancelBaccaratRound,
  cancelCasinoRound,
  cancelMississippiStudRound,
  shakeTreeHarvest,
  sellBananas,
  splitBlackjack,
  standBlackjack,
  startBaccaratRound,
  startBlackjackHand,
  startMississippiStudHand,
  surrenderBlackjack,
  placeMississippiStudStreetBet,
  foldMississippiStud,
  setCasinoActiveGame,
  takeInsuranceBlackjack,
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
import { ascensionRewardById } from "./ascensionChallenges.js";
import { createCasinoAnimationController } from "./casinoAnimations.js";
import { syncBaccaratCards, syncBlackjackDealer, syncBlackjackPlayerHands, syncStudCards } from "./casinoDomRenderer.js";
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

function setAttributeIfChanged(element, attribute, value) {
  if (!element) {
    return;
  }
  const next = String(value);
  if (element.getAttribute(attribute) !== next) {
    element.setAttribute(attribute, next);
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
    researchLabText: container.querySelector("#researchLabText"),
    financeOfficeText: container.querySelector("#financeOfficeText"),
    buyPackingShedBtn: container.querySelector("#buyPackingShedBtn"),
    buyFertilizerLabBtn: container.querySelector("#buyFertilizerLabBtn"),
    buyResearchLabBtn: container.querySelector("#buyResearchLabBtn"),
    buyFinanceOfficeBtn: container.querySelector("#buyFinanceOfficeBtn"),
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
    challengeRunSummaryText: container.querySelector("#challengeRunSummaryText"),
    challengeStartWarningText: container.querySelector("#challengeStartWarningText"),
    challengeObjectivesTracker: container.querySelector("#challengeObjectivesTracker"),
    challengesList: container.querySelector("#challengesList"),
    challengeResumeBtn: container.querySelector("#challengeResumeBtn"),
    challengeAbandonBtn: container.querySelector("#challengeAbandonBtn"),
    challengeCompleteBtn: container.querySelector("#challengeCompleteBtn"),
    challengeFailBtn: container.querySelector("#challengeFailBtn"),
    challengeResultModal: container.querySelector("#challengeResultModal"),
    challengeResultSummaryText: container.querySelector("#challengeResultSummaryText"),
    challengeResultObjectivesList: container.querySelector("#challengeResultObjectivesList"),
    closeChallengeResultBtn: container.querySelector("#closeChallengeResultBtn"),
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
    showMainViewBtn: container.querySelector("#showMainViewBtn"),
    toggleUpgradesBtn: container.querySelector("#toggleUpgradesBtn"),
    upgradesView: container.querySelector("#upgradesView"),
    toggleCasinoBtn: container.querySelector("#toggleCasinoBtn"),
    casinoView: container.querySelector("#casinoView"),
    challengeHudStrip: container.querySelector("#challengeHudStrip"),
    challengeHudStatusText: container.querySelector("#challengeHudStatusText"),
    challengeHudTimerText: container.querySelector("#challengeHudTimerText"),
    casinoLockedPanel: container.querySelector("#casinoLockedPanel"),
    blackjackTableCard: container.querySelector("#blackjackTableCard"),
    mississippiStudTableCard: container.querySelector("#mississippiStudTableCard"),
    baccaratTableCard: container.querySelector("#baccaratTableCard"),
    casinoIntroText: container.querySelector("#casinoIntroText"),
    casinoBlackjackGameBtn: container.querySelector("#casinoBlackjackGameBtn"),
    casinoMississippiStudGameBtn: container.querySelector("#casinoMississippiStudGameBtn"),
    casinoBaccaratGameBtn: container.querySelector("#casinoBaccaratGameBtn"),
    blackjackStatusText: container.querySelector("#blackjackStatusText"),
    blackjackStakeText: container.querySelector("#blackjackStakeText"),
    blackjackDealerValueText: container.querySelector("#blackjackDealerValueText"),
    blackjackDealerHands: container.querySelector("#blackjackDealerHands"),
    blackjackPlayerValueText: container.querySelector("#blackjackPlayerValueText"),
    blackjackPlayerHands: container.querySelector("#blackjackPlayerHands"),
    blackjackBetInput: container.querySelector("#blackjackBetInput"),
    blackjackMaxBetBtn: container.querySelector("#blackjackMaxBetBtn"),
    blackjackDealBtn: container.querySelector("#blackjackDealBtn"),
    blackjackInsuranceText: container.querySelector("#blackjackInsuranceText"),
    blackjackHitBtn: container.querySelector("#blackjackHitBtn"),
    blackjackStandBtn: container.querySelector("#blackjackStandBtn"),
    blackjackDoubleBtn: container.querySelector("#blackjackDoubleBtn"),
    blackjackSplitBtn: container.querySelector("#blackjackSplitBtn"),
    blackjackInsuranceBtn: container.querySelector("#blackjackInsuranceBtn"),
    blackjackDeclineInsuranceBtn: container.querySelector("#blackjackDeclineInsuranceBtn"),
    blackjackSurrenderBtn: container.querySelector("#blackjackSurrenderBtn"),
    blackjackCancelBtn: container.querySelector("#blackjackCancelBtn"),
    blackjackStatsList: container.querySelector("#blackjackStatsList"),
    mississippiStudStatusText: container.querySelector("#mississippiStudStatusText"),
    mississippiStudStakeText: container.querySelector("#mississippiStudStakeText"),
    mississippiStudHandText: container.querySelector("#mississippiStudHandText"),
    mississippiStudPlayerCards: container.querySelector("#mississippiStudPlayerCards"),
    mississippiStudCommunityText: container.querySelector("#mississippiStudCommunityText"),
    mississippiStudCommunityCards: container.querySelector("#mississippiStudCommunityCards"),
    mississippiStudAnteInput: container.querySelector("#mississippiStudAnteInput"),
    mississippiStudDealBtn: container.querySelector("#mississippiStudDealBtn"),
    mississippiStudCommittedText: container.querySelector("#mississippiStudCommittedText"),
    mississippiStudBet1xBtn: container.querySelector("#mississippiStudBet1xBtn"),
    mississippiStudBet2xBtn: container.querySelector("#mississippiStudBet2xBtn"),
    mississippiStudBet3xBtn: container.querySelector("#mississippiStudBet3xBtn"),
    mississippiStudFoldBtn: container.querySelector("#mississippiStudFoldBtn"),
    mississippiStudCancelBtn: container.querySelector("#mississippiStudCancelBtn"),
    mississippiStudStatsList: container.querySelector("#mississippiStudStatsList"),
    mississippiStudPaytableList: container.querySelector("#mississippiStudPaytableList"),
    baccaratStatusText: container.querySelector("#baccaratStatusText"),
    baccaratStakeText: container.querySelector("#baccaratStakeText"),
    baccaratPlayerValueText: container.querySelector("#baccaratPlayerValueText"),
    baccaratBankerValueText: container.querySelector("#baccaratBankerValueText"),
    baccaratPlayerCards: container.querySelector("#baccaratPlayerCards"),
    baccaratBankerCards: container.querySelector("#baccaratBankerCards"),
    baccaratBetInput: container.querySelector("#baccaratBetInput"),
    baccaratMaxBetBtn: container.querySelector("#baccaratMaxBetBtn"),
    baccaratResultText: container.querySelector("#baccaratResultText"),
    baccaratBetPlayerBtn: container.querySelector("#baccaratBetPlayerBtn"),
    baccaratBetBankerBtn: container.querySelector("#baccaratBetBankerBtn"),
    baccaratBetTieBtn: container.querySelector("#baccaratBetTieBtn"),
    baccaratStatsList: container.querySelector("#baccaratStatsList"),
    baccaratPayoutsList: container.querySelector("#baccaratPayoutsList"),
  };

  let numberFormatMode = settings.numberFormat;
  let graphicsMode = sanitizeGraphicsMode(settings.graphicsMode);
  let debugPanelVisible = false;
  let inspectorPanelVisible = false;
  let treeDebugVisible = false;
  let dismissedChallengeResultAt = 0;
  let blackjackBetDraft = 100;
  let mississippiStudAnteDraft = 10;
  let baccaratBetDraft = 25;
  let renderUI = () => {};
  let renderQueued = false;
  const requestCasinoRender = () => {
    if (renderQueued) {
      return;
    }
    renderQueued = true;
    setTimeout(() => {
      renderQueued = false;
      renderUI(gameState);
    }, 0);
  };
  const casinoAnimations = createCasinoAnimationController(requestCasinoRender);
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
  if (elements.blackjackBetInput) {
    blackjackBetDraft = Math.max(1, Math.floor(Number(elements.blackjackBetInput.value) || blackjackBetDraft));
  }
  if (elements.mississippiStudAnteInput) {
    mississippiStudAnteDraft = Math.max(1, Math.floor(Number(elements.mississippiStudAnteInput.value) || mississippiStudAnteDraft));
  }
  if (elements.baccaratBetInput) {
    baccaratBetDraft = Math.max(1, Math.floor(Number(elements.baccaratBetInput.value) || baccaratBetDraft));
  }
  elements.soundToggle.checked = settings.soundEnabled;
  if (elements.treeDebugToggle) {
    elements.treeDebugToggle.checked = Boolean(settings.treeDebugEnabled);
  }
  elements.saveSlotSelect.value = String(settings.activeSaveSlot || 1);

  const setTopView = (viewId, persist = true) => {
    const casinoUnlocked = Boolean(getCasinoStatus().unlocked);
    const safeView = viewId === "casino" && !casinoUnlocked ? "main" : (["main", "upgrades", "casino"].includes(viewId) ? viewId : "main");
    if (elements.mainView) {
      const hidden = safeView !== "main";
      elements.mainView.classList.toggle("is-hidden", hidden);
      elements.mainView.setAttribute("aria-hidden", String(hidden));
    }
    if (elements.upgradesView) {
      const hidden = safeView !== "upgrades";
      elements.upgradesView.classList.toggle("is-hidden", hidden);
      elements.upgradesView.setAttribute("aria-hidden", String(hidden));
    }
    if (elements.casinoView) {
      const hidden = safeView !== "casino";
      elements.casinoView.classList.toggle("is-hidden", hidden);
      elements.casinoView.setAttribute("aria-hidden", String(hidden));
    }
    if (elements.showMainViewBtn) {
      elements.showMainViewBtn.classList.toggle("is-active", safeView === "main");
      elements.showMainViewBtn.setAttribute("aria-expanded", String(safeView === "main"));
    }
    if (elements.toggleUpgradesBtn) {
      elements.toggleUpgradesBtn.classList.toggle("is-active", safeView === "upgrades");
      elements.toggleUpgradesBtn.setAttribute("aria-expanded", String(safeView === "upgrades"));
      elements.toggleUpgradesBtn.setAttribute("aria-controls", "upgradesView");
    }
    if (elements.toggleCasinoBtn) {
      elements.toggleCasinoBtn.classList.toggle("is-active", safeView === "casino");
      elements.toggleCasinoBtn.setAttribute("aria-expanded", String(safeView === "casino"));
      elements.toggleCasinoBtn.setAttribute("aria-controls", "casinoView");
      elements.toggleCasinoBtn.classList.toggle("is-hidden", !casinoUnlocked);
    }
    if (persist) {
      const next = setUISettings({ activeTopView: safeView });
      settings.activeTopView = next.activeTopView;
    } else {
      settings.activeTopView = safeView;
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

  setTopView(settings.activeTopView || "main", false);

  if (elements.showMainViewBtn) {
    elements.showMainViewBtn.addEventListener("click", () => {
      setTopView("main", true);
    });
  }

  if (elements.toggleUpgradesBtn) {
    elements.toggleUpgradesBtn.addEventListener("click", () => {
      setTopView("upgrades", true);
    });
  }

  if (elements.toggleCasinoBtn) {
    elements.toggleCasinoBtn.addEventListener("click", () => {
      setTopView("casino", true);
    });
  }
  if (elements.casinoBlackjackGameBtn) {
    elements.casinoBlackjackGameBtn.addEventListener("click", () => {
      setCasinoActiveGame("blackjack");
    });
  }
  if (elements.casinoMississippiStudGameBtn) {
    elements.casinoMississippiStudGameBtn.addEventListener("click", () => {
      setCasinoActiveGame("mississippi_stud");
    });
  }
  if (elements.casinoBaccaratGameBtn) {
    elements.casinoBaccaratGameBtn.addEventListener("click", () => {
      setCasinoActiveGame("baccarat");
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

  function openChallengeResultModal() {
    if (!elements.challengeResultModal) {
      return;
    }
    elements.challengeResultModal.classList.remove("is-hidden");
    elements.challengeResultModal.setAttribute("aria-hidden", "false");
  }

  function closeChallengeResultModal() {
    if (!elements.challengeResultModal) {
      return;
    }
    elements.challengeResultModal.classList.add("is-hidden");
    elements.challengeResultModal.setAttribute("aria-hidden", "true");
    const result = getChallengeLastResult();
    dismissedChallengeResultAt = Math.max(dismissedChallengeResultAt, Number(result?.completedAt) || 0);
    clearChallengeLastResult();
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
  if (elements.closeChallengeResultBtn) {
    elements.closeChallengeResultBtn.addEventListener("click", closeChallengeResultModal);
  }
  if (elements.challengeResultModal) {
    elements.challengeResultModal.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.dataset.closeChallengeResult === "true") {
        closeChallengeResultModal();
      }
    });
  }

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
  elements.buyResearchLabBtn.addEventListener("click", () => buyBuilding("research_lab"));
  elements.buyFinanceOfficeBtn.addEventListener("click", () => buyBuilding("finance_office"));
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

  if (elements.challengesList) {
    elements.challengesList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const button = target.closest("button[data-challenge-id]");
      if (!button) {
        return;
      }
      const challengeId = button.dataset.challengeId;
      if (challengeId) {
        const challenge = getAscensionChallengesStatus().find((item) => item.id === challengeId);
        const ruleText = challenge && Array.isArray(challenge.ruleIds) && challenge.ruleIds.length
          ? challenge.ruleIds.map((ruleId) => formatChallengeRuleLabel(ruleId)).join(", ")
          : "default rules";
        const shouldStart = window.confirm(
          `Start "${challenge?.name || challengeId}"?\n\nThis snapshots your current run, applies temporary challenge constraints, and disables normal progression flow until completion/abandon.\n\nRules: ${ruleText}`
        );
        if (shouldStart) {
          startChallengeRun(challengeId);
        }
      }
    });
  }

  if (elements.challengeResumeBtn) {
    elements.challengeResumeBtn.addEventListener("click", () => {
      resumeChallengeRun();
    });
  }

  if (elements.challengeAbandonBtn) {
    elements.challengeAbandonBtn.addEventListener("click", () => {
      const active = getActiveChallengeRunStatus();
      const shouldAbandon = window.confirm(
        `Abandon "${active?.challengeName || "active challenge"}" and restore pre-challenge state?`
      );
      if (shouldAbandon) {
        abandonChallengeRun();
      }
    });
  }

  if (elements.challengeCompleteBtn) {
    elements.challengeCompleteBtn.addEventListener("click", () => {
      completeChallengeRun();
    });
  }

  if (elements.challengeFailBtn) {
    elements.challengeFailBtn.addEventListener("click", () => {
      failChallengeRun();
    });
  }

  if (elements.blackjackDealBtn) {
    elements.blackjackDealBtn.addEventListener("click", () => {
      startBlackjackHand(elements.blackjackBetInput?.value);
    });
  }
  if (elements.blackjackBetInput) {
    elements.blackjackBetInput.addEventListener("input", () => {
      blackjackBetDraft = Math.max(1, Math.floor(Number(elements.blackjackBetInput.value) || blackjackBetDraft));
    });
  }
  if (elements.blackjackMaxBetBtn) {
    elements.blackjackMaxBetBtn.addEventListener("click", () => {
      blackjackBetDraft = Math.max(1, Math.floor(Number(gameState.cash) || 1));
      setValueIfChanged(elements.blackjackBetInput, blackjackBetDraft);
    });
  }

  if (elements.blackjackHitBtn) {
    elements.blackjackHitBtn.addEventListener("click", () => {
      hitBlackjack();
    });
  }

  if (elements.blackjackStandBtn) {
    elements.blackjackStandBtn.addEventListener("click", () => {
      standBlackjack();
    });
  }

  if (elements.blackjackDoubleBtn) {
    elements.blackjackDoubleBtn.addEventListener("click", () => {
      doubleDownBlackjack();
    });
  }

  if (elements.blackjackSplitBtn) {
    elements.blackjackSplitBtn.addEventListener("click", () => {
      splitBlackjack();
    });
  }

  if (elements.blackjackInsuranceBtn) {
    elements.blackjackInsuranceBtn.addEventListener("click", () => {
      takeInsuranceBlackjack();
    });
  }

  if (elements.blackjackDeclineInsuranceBtn) {
    elements.blackjackDeclineInsuranceBtn.addEventListener("click", () => {
      declineInsuranceBlackjack();
    });
  }

  if (elements.blackjackSurrenderBtn) {
    elements.blackjackSurrenderBtn.addEventListener("click", () => {
      surrenderBlackjack();
    });
  }

  if (elements.blackjackCancelBtn) {
    elements.blackjackCancelBtn.addEventListener("click", () => {
      cancelCasinoRound("manual_cancel");
    });
  }
  if (elements.mississippiStudDealBtn) {
    elements.mississippiStudDealBtn.addEventListener("click", () => {
      startMississippiStudHand(elements.mississippiStudAnteInput?.value);
    });
  }
  if (elements.mississippiStudAnteInput) {
    elements.mississippiStudAnteInput.addEventListener("input", () => {
      mississippiStudAnteDraft = Math.max(1, Math.floor(Number(elements.mississippiStudAnteInput.value) || mississippiStudAnteDraft));
    });
  }
  if (elements.mississippiStudBet1xBtn) {
    elements.mississippiStudBet1xBtn.addEventListener("click", () => {
      placeMississippiStudStreetBet(1);
    });
  }
  if (elements.mississippiStudBet2xBtn) {
    elements.mississippiStudBet2xBtn.addEventListener("click", () => {
      placeMississippiStudStreetBet(2);
    });
  }
  if (elements.mississippiStudBet3xBtn) {
    elements.mississippiStudBet3xBtn.addEventListener("click", () => {
      placeMississippiStudStreetBet(3);
    });
  }
  if (elements.mississippiStudFoldBtn) {
    elements.mississippiStudFoldBtn.addEventListener("click", () => {
      foldMississippiStud();
    });
  }
  if (elements.mississippiStudCancelBtn) {
    elements.mississippiStudCancelBtn.addEventListener("click", () => {
      cancelMississippiStudRound("manual_cancel");
    });
  }
  if (elements.baccaratBetInput) {
    elements.baccaratBetInput.addEventListener("input", () => {
      baccaratBetDraft = Math.max(1, Math.floor(Number(elements.baccaratBetInput.value) || baccaratBetDraft));
    });
  }
  if (elements.baccaratMaxBetBtn) {
    elements.baccaratMaxBetBtn.addEventListener("click", () => {
      baccaratBetDraft = Math.max(1, Math.floor(Number(gameState.cash) || 1));
      setValueIfChanged(elements.baccaratBetInput, baccaratBetDraft);
    });
  }
  if (elements.baccaratBetPlayerBtn) {
    elements.baccaratBetPlayerBtn.addEventListener("click", () => {
      startBaccaratRound({ betChoice: "player", betAmount: elements.baccaratBetInput?.value });
    });
  }
  if (elements.baccaratBetBankerBtn) {
    elements.baccaratBetBankerBtn.addEventListener("click", () => {
      startBaccaratRound({ betChoice: "banker", betAmount: elements.baccaratBetInput?.value });
    });
  }
  if (elements.baccaratBetTieBtn) {
    elements.baccaratBetTieBtn.addEventListener("click", () => {
      startBaccaratRound({ betChoice: "tie", betAmount: elements.baccaratBetInput?.value });
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

  const challengeCardElements = new Map();
  const challengeObjectiveElements = new Map();
  const challengeDifficultyLabelByCategory = {
    Starter: "Easy",
    Core: "Normal",
    Advanced: "Hard",
    Expert: "Expert",
  };
  const challengeRuleLabels = {
    no_orchard_bonus: "No Orchard bonus",
    reduced_export_value: "Reduced export value",
    tighter_lane_capacity: "Tighter lane capacity",
    contract_focus: "Contract-focused scoring",
    reduced_click_yield: "Reduced click yield",
    slower_spawn_rate: "Slower banana spawn",
    disable_prestige: "Prestige disabled during run",
  };

  const formatChallengeRuleLabel = (ruleId) => challengeRuleLabels[ruleId] || String(ruleId || "rule").replace(/_/g, " ");

  const getChallengeDifficultyLabel = (challenge) =>
    challengeDifficultyLabelByCategory[challenge.category] || (challenge.timeLimitMs && challenge.timeLimitMs <= 8 * 60 * 1000 ? "Hard" : "Normal");

  const ensureChallengeCard = (challengeId) => {
    if (!elements.challengesList) {
      return null;
    }
    const existing = challengeCardElements.get(challengeId);
    if (existing) {
      return existing;
    }

    const card = document.createElement("div");
    card.className = "buyer-card challenge-card";
    card.dataset.challengeId = challengeId;

    const statusRow = document.createElement("div");
    statusRow.className = "challenge-status-row";

    const title = document.createElement("p");
    title.className = "buyer-name";
    statusRow.appendChild(title);

    const statusChip = document.createElement("span");
    statusChip.className = "challenge-status-chip status-available";
    statusRow.appendChild(statusChip);

    const description = document.createElement("p");
    description.className = "field-label";

    const metadata = document.createElement("div");
    metadata.className = "challenge-meta-list";
    const difficulty = document.createElement("p");
    const rules = document.createElement("p");
    const objectives = document.createElement("p");
    const rewards = document.createElement("p");
    const best = document.createElement("p");
    const unlock = document.createElement("p");
    metadata.appendChild(difficulty);
    metadata.appendChild(rules);
    metadata.appendChild(objectives);
    metadata.appendChild(rewards);
    metadata.appendChild(best);
    metadata.appendChild(unlock);

    const startBtn = document.createElement("button");
    startBtn.type = "button";
    startBtn.dataset.challengeId = challengeId;

    card.appendChild(statusRow);
    card.appendChild(description);
    card.appendChild(metadata);
    card.appendChild(startBtn);
    elements.challengesList.appendChild(card);

    const refs = { card, title, statusChip, description, difficulty, rules, objectives, rewards, best, unlock, startBtn };
    challengeCardElements.set(challengeId, refs);
    return refs;
  };

  const ensureChallengeObjective = (objectiveId) => {
    if (!elements.challengeObjectivesTracker) {
      return null;
    }
    const existing = challengeObjectiveElements.get(objectiveId);
    if (existing) {
      return existing;
    }
    const card = document.createElement("div");
    card.className = "buyer-card challenge-objective-item";
    card.dataset.challengeObjectiveId = objectiveId;
    const head = document.createElement("div");
    head.className = "challenge-objective-head";
    const name = document.createElement("span");
    const value = document.createElement("span");
    head.appendChild(name);
    head.appendChild(value);
    const progressWrap = document.createElement("div");
    progressWrap.className = "progress-wrap";
    const progressFill = document.createElement("div");
    progressFill.className = "progress-fill";
    progressWrap.appendChild(progressFill);
    card.appendChild(head);
    card.appendChild(progressWrap);
    elements.challengeObjectivesTracker.appendChild(card);
    const refs = { card, name, value, progressFill };
    challengeObjectiveElements.set(objectiveId, refs);
    return refs;
  };

  getAscensionChallengesStatus().forEach((challenge) => {
    ensureChallengeCard(challenge.id);
  });

  renderUI = (state) => {
    const fmt = (value) => formatGameNumber(value, numberFormatMode);

    const bananasPerSecond = getTotalBananasPerSecond();
    const breakdown = getProductionBreakdown();
    const statBreakdown = getStatBreakdown();
    const ascensionRewards = getAscensionRewardsStatus();
    const treeHarvestSnapshot = getTreeHarvestSnapshot();
    const treeHarvestUpgrades = getTreeHarvestUpgradesStatus();
    const currentTier = getCurrentTreeTier();
    const nextTier = getNextTreeTier();
    const treeCost = getTreeCost();
    const workerCost = getWorkerCost();
    const packingShedCost = getBuildingCost("packing_shed");
    const fertilizerLabCost = getBuildingCost("fertilizer_lab");
    const researchLabCost = getBuildingCost("research_lab");
    const financeOfficeCost = getBuildingCost("finance_office");
    const financeOfficeMaxLevel = getBuildingMaxLevel("finance_office");
    const questStatus = getCurrentQuestStatus();
    const casinoStatus = getCasinoStatus();
    const blackjackStatus = getBlackjackStatus();
    const mississippiStudStatus = getMississippiStudStatus();
    const baccaratStatus = getBaccaratStatus();
    casinoAnimations.syncBlackjack(blackjackStatus);
    casinoAnimations.syncStud(mississippiStudStatus);
    casinoAnimations.syncBaccarat(baccaratStatus);
    const visibleBlackjackStatus = casinoAnimations.getVisibleBlackjackStatus(blackjackStatus);
    const visibleMississippiStudStatus = casinoAnimations.getVisibleStudStatus(mississippiStudStatus);
    const visibleBaccaratStatus = casinoAnimations.getVisibleBaccaratStatus(baccaratStatus);

    if (settings.activeTopView === "casino" && !casinoStatus.unlocked) {
      setTopView("main", true);
    } else {
      setTopView(settings.activeTopView || "main", false);
    }

    setTextIfChanged(elements.bananasText, fmt(state.bananas));
    setTextIfChanged(elements.cashText, `$${fmt(state.cash)}`);
    setTextIfChanged(elements.bpsText, fmt(bananasPerSecond));
    setTextIfChanged(elements.clickYieldText, fmt(state.clickYield));
    setTextIfChanged(elements.treesText, `Trees Owned: ${fmt(state.treesOwned)}`);
    setTextIfChanged(elements.treeRateText, `Harvest power: ${fmt(state.productionMultiplier)}x`);
    setTextIfChanged(elements.buyerBonusText, `${fmt((state.exportPriceMultiplier - 1) * 100)}%`);
    if (elements.toggleCasinoBtn) {
      elements.toggleCasinoBtn.classList.toggle("is-hidden", !casinoStatus.unlocked);
    }
    if (elements.casinoLockedPanel) {
      elements.casinoLockedPanel.classList.toggle("is-hidden", casinoStatus.unlocked);
      elements.casinoLockedPanel.setAttribute("aria-hidden", String(casinoStatus.unlocked));
    }
    if (elements.blackjackTableCard) {
      const hidden = !casinoStatus.unlocked || casinoStatus.activeGameId !== "blackjack";
      elements.blackjackTableCard.classList.toggle("is-hidden", hidden);
      elements.blackjackTableCard.setAttribute("aria-hidden", String(hidden));
    }
    if (elements.mississippiStudTableCard) {
      const hidden = !casinoStatus.unlocked || !casinoStatus.mississippiStudUnlocked || casinoStatus.activeGameId !== "mississippi_stud";
      elements.mississippiStudTableCard.classList.toggle("is-hidden", hidden);
      elements.mississippiStudTableCard.setAttribute("aria-hidden", String(hidden));
    }
    if (elements.baccaratTableCard) {
      const hidden = !casinoStatus.unlocked || !casinoStatus.baccaratUnlocked || casinoStatus.activeGameId !== "baccarat";
      elements.baccaratTableCard.classList.toggle("is-hidden", hidden);
      elements.baccaratTableCard.setAttribute("aria-hidden", String(hidden));
    }
    if (elements.casinoIntroText) {
      setTextIfChanged(
        elements.casinoIntroText,
        casinoStatus.unlocked
          ? "Monkey Casino is live. Blackjack uses cash only and tracks full table stats for future casino progression."
          : "Unlock Card Shark License in the PIP Shop for 20 PIP to open the Monkey Casino."
      );
    }
    if (elements.casinoBlackjackGameBtn) {
      setTextIfChanged(elements.casinoBlackjackGameBtn, "Blackjack");
      setDisabledIfChanged(elements.casinoBlackjackGameBtn, !casinoStatus.unlocked);
      elements.casinoBlackjackGameBtn.classList.toggle("is-active", casinoStatus.activeGameId === "blackjack");
    }
    if (elements.casinoMississippiStudGameBtn) {
      setTextIfChanged(elements.casinoMississippiStudGameBtn, casinoStatus.mississippiStudUnlocked ? "Mississippi Stud" : "Mississippi Stud (20 PIP)");
      setDisabledIfChanged(elements.casinoMississippiStudGameBtn, !casinoStatus.unlocked || !casinoStatus.mississippiStudUnlocked);
      elements.casinoMississippiStudGameBtn.classList.toggle("is-active", casinoStatus.activeGameId === "mississippi_stud");
    }
    if (elements.casinoBaccaratGameBtn) {
      setTextIfChanged(elements.casinoBaccaratGameBtn, casinoStatus.baccaratUnlocked ? "Baccarat" : "Baccarat (20 PIP)");
      setDisabledIfChanged(elements.casinoBaccaratGameBtn, !casinoStatus.unlocked || !casinoStatus.baccaratUnlocked);
      elements.casinoBaccaratGameBtn.classList.toggle("is-active", casinoStatus.activeGameId === "baccarat");
    }
    if (casinoStatus.unlocked) {
      setTextIfChanged(
        elements.blackjackStatusText,
        visibleBlackjackStatus.animationBusy ? "Dealing cards..." : (blackjackStatus.handResultSummary || "Place a bet and deal a hand.")
      );
      setTextIfChanged(
        elements.blackjackStakeText,
        `Main Bet: $${fmt(blackjackStatus.mainBet)} | Insurance: $${fmt(blackjackStatus.insuranceBet)} | Active Stake: $${fmt(blackjackStatus.outstandingStake)}`
      );
      setTextIfChanged(
        elements.blackjackDealerValueText,
        blackjackStatus.dealerValue == null || visibleBlackjackStatus.animationBusy ? "Dealer Total: Hidden" : `Dealer Total: ${fmt(blackjackStatus.dealerValue.total)}`
      );
      const activePlayerHand = blackjackStatus.playerHands.find((hand) => hand.isActive) || blackjackStatus.playerHands[blackjackStatus.activeHandIndex] || null;
      setTextIfChanged(
        elements.blackjackPlayerValueText,
        activePlayerHand ? `Active Hand Total: ${fmt(activePlayerHand.displayValue.total)}` : "Active Hand Total: -"
      );
      setTextIfChanged(
        elements.blackjackInsuranceText,
        blackjackStatus.canTakeInsurance || blackjackStatus.canDeclineInsurance
          ? `Insurance offered: stake up to $${fmt(Math.floor(Math.max(0, Number(blackjackStatus.mainBet) || 0) / 2))}`
          : "Insurance: Not currently offered"
      );
      syncBlackjackDealer(elements.blackjackDealerHands, visibleBlackjackStatus);
      syncBlackjackPlayerHands(elements.blackjackPlayerHands, visibleBlackjackStatus);
      if (elements.blackjackBetInput && document.activeElement !== elements.blackjackBetInput) {
        const clampedDraft = Math.max(1, Math.floor(Number(blackjackBetDraft) || 1));
        setValueIfChanged(elements.blackjackBetInput, clampedDraft);
      }
      setDisabledIfChanged(elements.blackjackMaxBetBtn, Math.floor(Number(state.cash) || 0) <= 0);
      setDisabledIfChanged(elements.blackjackDealBtn, visibleBlackjackStatus.animationBusy || !blackjackStatus.canDeal);
      setDisabledIfChanged(elements.blackjackHitBtn, visibleBlackjackStatus.animationBusy || !blackjackStatus.canHit);
      setDisabledIfChanged(elements.blackjackStandBtn, visibleBlackjackStatus.animationBusy || !blackjackStatus.canStand);
      setDisabledIfChanged(elements.blackjackDoubleBtn, visibleBlackjackStatus.animationBusy || !blackjackStatus.canDouble);
      setDisabledIfChanged(elements.blackjackSplitBtn, visibleBlackjackStatus.animationBusy || !blackjackStatus.canSplit);
      setDisabledIfChanged(elements.blackjackInsuranceBtn, visibleBlackjackStatus.animationBusy || !blackjackStatus.canTakeInsurance);
      setDisabledIfChanged(elements.blackjackDeclineInsuranceBtn, visibleBlackjackStatus.animationBusy || !blackjackStatus.canDeclineInsurance);
      setDisabledIfChanged(elements.blackjackSurrenderBtn, visibleBlackjackStatus.animationBusy || !blackjackStatus.canSurrender);
      setDisabledIfChanged(
        elements.blackjackCancelBtn,
        visibleBlackjackStatus.animationBusy || blackjackStatus.tablePhase === "idle" || blackjackStatus.tablePhase === "settled"
      );
      setHtmlIfChanged(
        elements.blackjackStatsList,
        [
          ["Hands", blackjackStatus.blackjackStats.handsPlayed],
          ["Wins", blackjackStatus.blackjackStats.handsWon],
          ["Losses", blackjackStatus.blackjackStats.handsLost],
          ["Pushes", blackjackStatus.blackjackStats.handsPushed],
          ["Blackjacks", blackjackStatus.blackjackStats.naturalBlackjacks],
          ["Splits", blackjackStatus.blackjackStats.splitHandsCreated],
          ["Doubles", blackjackStatus.blackjackStats.doubleDownHands],
          ["Wagered", `$${fmt(blackjackStatus.blackjackStats.totalCashWagered)}`],
          ["Won", `$${fmt(blackjackStatus.blackjackStats.totalCashWon)}`],
          ["Largest Win", `$${fmt(blackjackStatus.blackjackStats.largestSingleWin)}`],
          ["Best Streak", fmt(blackjackStatus.blackjackStats.bestWinStreak)],
          ["Casino Games", fmt(blackjackStatus.casinoStats.totalGamesPlayed)],
        ]
          .map(([label, value]) => `<div class="buyer-card"><p class="buyer-name">${label}</p><p>${value}</p></div>`)
          .join("")
      );

      if (casinoStatus.mississippiStudUnlocked) {
        setTextIfChanged(
          elements.mississippiStudStatusText,
          visibleMississippiStudStatus.animationBusy ? "Revealing the next street..." : (mississippiStudStatus.resultText || "Place an ante to start a hand.")
        );
        setTextIfChanged(
          elements.mississippiStudStakeText,
          `Ante: $${fmt(mississippiStudStatus.anteBet)} | Total Action: $${fmt(mississippiStudStatus.totalCommitted)}`
        );
        setTextIfChanged(
          elements.mississippiStudHandText,
          mississippiStudStatus.handRank
            ? `Current Hand: ${mississippiStudStatus.handRank}${mississippiStudStatus.totalPayout > 0 ? ` | Paid $${fmt(mississippiStudStatus.totalPayout)}` : ""}`
            : "Current Hand: In progress"
        );
        setTextIfChanged(
          elements.mississippiStudCommunityText,
          `Street ${fmt(mississippiStudStatus.currentDecisionIndex + 1)} | Bets ${mississippiStudStatus.streetBets.map((bet) => `$${fmt(bet)}`).join(" / ")}`
        );
        setTextIfChanged(elements.mississippiStudCommittedText, `Committed: $${fmt(mississippiStudStatus.totalCommitted)}`);
        syncStudCards(elements.mississippiStudPlayerCards, visibleMississippiStudStatus.playerCards, visibleMississippiStudStatus.visiblePlayerCount);
        syncStudCards(elements.mississippiStudCommunityCards, visibleMississippiStudStatus.communityCards, visibleMississippiStudStatus.visibleCommunityFaceUpCount);
        if (elements.mississippiStudAnteInput && document.activeElement !== elements.mississippiStudAnteInput) {
          const clampedDraft = Math.max(1, Math.floor(Number(mississippiStudAnteDraft) || 1));
          setValueIfChanged(elements.mississippiStudAnteInput, clampedDraft);
        }
        setDisabledIfChanged(elements.mississippiStudDealBtn, visibleMississippiStudStatus.animationBusy || !mississippiStudStatus.canDeal);
        setDisabledIfChanged(elements.mississippiStudBet1xBtn, visibleMississippiStudStatus.animationBusy || !mississippiStudStatus.canBet1x);
        setDisabledIfChanged(elements.mississippiStudBet2xBtn, visibleMississippiStudStatus.animationBusy || !mississippiStudStatus.canBet2x);
        setDisabledIfChanged(elements.mississippiStudBet3xBtn, visibleMississippiStudStatus.animationBusy || !mississippiStudStatus.canBet3x);
        setDisabledIfChanged(elements.mississippiStudFoldBtn, visibleMississippiStudStatus.animationBusy || !mississippiStudStatus.canFold);
        setDisabledIfChanged(
          elements.mississippiStudCancelBtn,
          visibleMississippiStudStatus.animationBusy || ["idle", "settled", "folded"].includes(mississippiStudStatus.tablePhase)
        );
        setHtmlIfChanged(
          elements.mississippiStudStatsList,
          [
            ["Hands", mississippiStudStatus.stats.handsPlayed],
            ["Wins", mississippiStudStatus.stats.handsWon],
            ["Losses", mississippiStudStatus.stats.handsLost],
            ["Wagered", `$${fmt(mississippiStudStatus.stats.totalCashWagered)}`],
            ["Won", `$${fmt(mississippiStudStatus.stats.totalCashWon)}`],
            ["Largest Ante", `$${fmt(mississippiStudStatus.stats.largestAnte)}`],
            ["Largest Payout", `$${fmt(mississippiStudStatus.stats.largestPayout)}`],
            ["Best Streak", fmt(mississippiStudStatus.stats.bestWinStreak)],
          ]
            .map(([label, value]) => `<div class="buyer-card"><p class="buyer-name">${label}</p><p>${value}</p></div>`)
            .join("")
        );
        setHtmlIfChanged(
          elements.mississippiStudPaytableList,
          mississippiStudStatus.paytable
            .map((entry) => `<div class="buyer-card"><p class="buyer-name">${entry.label}</p><p>${fmt(entry.payoutMultiplier)}:1</p></div>`)
            .join("")
        );
      }

      setTextIfChanged(
        elements.baccaratStatusText,
        visibleBaccaratStatus.animationBusy ? "Dealing baccarat cards..." : (baccaratStatus.resultText || "Choose a side and place a wager.")
      );
      setTextIfChanged(
        elements.baccaratStakeText,
        `Bet: $${fmt(baccaratStatus.betAmount)} | Side: ${baccaratStatus.betChoice ? baccaratStatus.betChoice[0].toUpperCase() + baccaratStatus.betChoice.slice(1) : "-"}`
      );
      setTextIfChanged(
        elements.baccaratPlayerValueText,
        baccaratStatus.playerTotal == null ? "Player Total: -" : `Player Total: ${fmt(baccaratStatus.playerTotal)}`
      );
      setTextIfChanged(
        elements.baccaratBankerValueText,
        baccaratStatus.bankerTotal == null ? "Banker Total: -" : `Banker Total: ${fmt(baccaratStatus.bankerTotal)}`
      );
      setTextIfChanged(
        elements.baccaratResultText,
        baccaratStatus.result && visibleBaccaratStatus.showResult
          ? `Result: ${baccaratStatus.result[0].toUpperCase() + baccaratStatus.result.slice(1)} | Paid $${fmt(baccaratStatus.payoutAmount)}${baccaratStatus.commissionPaid > 0 ? ` | Commission $${fmt(baccaratStatus.commissionPaid)}` : ""}`
          : `Payouts: Player ${fmt(baccaratStatus.payouts.player)}:1 | Banker ${fmt(baccaratStatus.payouts.banker)}:1 minus ${fmt(baccaratStatus.payouts.bankerCommissionRate * 100)}% | Tie ${fmt(baccaratStatus.payouts.tie)}:1`
      );
      syncBaccaratCards(elements.baccaratPlayerCards, visibleBaccaratStatus.playerCards, visibleBaccaratStatus.visiblePlayerCount);
      syncBaccaratCards(elements.baccaratBankerCards, visibleBaccaratStatus.bankerCards, visibleBaccaratStatus.visibleBankerCount);
      if (elements.baccaratBetInput && document.activeElement !== elements.baccaratBetInput) {
        const clampedDraft = Math.max(1, Math.floor(Number(baccaratBetDraft) || 1));
        setValueIfChanged(elements.baccaratBetInput, clampedDraft);
      }
      setDisabledIfChanged(elements.baccaratMaxBetBtn, Math.floor(Number(state.cash) || 0) <= 0);
      setDisabledIfChanged(elements.baccaratBetPlayerBtn, visibleBaccaratStatus.animationBusy || !baccaratStatus.canBet);
      setDisabledIfChanged(elements.baccaratBetBankerBtn, visibleBaccaratStatus.animationBusy || !baccaratStatus.canBet);
      setDisabledIfChanged(elements.baccaratBetTieBtn, visibleBaccaratStatus.animationBusy || !baccaratStatus.canBet);
      setHtmlIfChanged(
        elements.baccaratStatsList,
        [
          ["Hands", baccaratStatus.stats.handsPlayed],
          ["Wins", baccaratStatus.stats.handsWon],
          ["Losses", baccaratStatus.stats.handsLost],
          ["Pushes", baccaratStatus.stats.handsPushed],
          ["Player Wins", baccaratStatus.stats.playerWins],
          ["Banker Wins", baccaratStatus.stats.bankerWins],
          ["Ties", baccaratStatus.stats.tieResults],
          ["Naturals", baccaratStatus.stats.naturals],
          ["Third Card", baccaratStatus.stats.thirdCardRounds],
          ["Wagered", `$${fmt(baccaratStatus.stats.totalCashWagered)}`],
          ["Won", `$${fmt(baccaratStatus.stats.totalCashWon)}`],
          ["Commission", `$${fmt(baccaratStatus.stats.totalCommissionPaid)}`],
          ["Best Streak", fmt(baccaratStatus.stats.bestWinStreak)],
        ].map(([label, value]) => `<div class="buyer-card"><p class="buyer-name">${label}</p><p>${value}</p></div>`).join("")
      );
      setHtmlIfChanged(
        elements.baccaratPayoutsList,
        [
          ["Player Bet", `${fmt(baccaratStatus.payouts.player)}:1`],
          ["Banker Bet", `${fmt(baccaratStatus.payouts.banker)}:1 - ${fmt(baccaratStatus.payouts.bankerCommissionRate * 100)}% commission`],
          ["Tie Bet", `${fmt(baccaratStatus.payouts.tie)}:1`],
        ].map(([label, value]) => `<div class="buyer-card"><p class="buyer-name">${label}</p><p>${value}</p></div>`).join("")
      );
    }
    if (inspectorPanelVisible) {
      const challengeRuleIds = Array.from(new Set((statBreakdown.challenge.rulesApplied || []).map((modifier) => modifier.sourceId))).join(", ");
      const challengeLabel = statBreakdown.challenge.active
        ? `Challenge ${fmt(statBreakdown.sources.challengeProduction)}x prod, ${fmt(statBreakdown.sources.challengeExportPrice)}x export [${challengeRuleIds || "none"}]`
        : "Challenge 1x (inactive)";
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
        `Sources: Prestige ${fmt(statBreakdown.sources.prestigeProduction)}x | PIP ${fmt(statBreakdown.sources.pipProduction)}x | Achievements ${fmt(statBreakdown.sources.achievementProduction)}x | Research rows ${fmt(statBreakdown.sources.researchRowProduction)}x | Evolution ${fmt(statBreakdown.sources.evolutionProduction)}x | CEO ${fmt(statBreakdown.sources.ceoGlobal)}x | Research Lab ${fmt(statBreakdown.sources.researchLabRatePerSecBase)}/s | Finance Discount ${fmt(statBreakdown.sources.financeOfficeDiscountMultiplier)}x | Ascension ${fmt(statBreakdown.sources.rewardProduction)}x prod, ${fmt(statBreakdown.sources.rewardExportPrice)}x export | Rewards ${fmt(ascensionRewards.unlockedRewardIds.length)} | ${challengeLabel}`
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
    if (elements.shakeTreeBtn) {
      const shakeBlocked = Boolean(treeHarvestSnapshot.shakeDisabled);
      setDisabledIfChanged(elements.shakeTreeBtn, shakeBlocked);
      setTextIfChanged(elements.shakeTreeBtn, shakeBlocked ? "Shake Disabled" : "Shake Tree");
    }
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
    setTextIfChanged(elements.buyResearchLabBtn, `Buy Research Lab ($${fmt(researchLabCost)})`);
    setDisabledIfChanged(elements.buyResearchLabBtn, state.cash < researchLabCost);
    const financeOfficeMaxed = financeOfficeMaxLevel != null && state.financeOfficeLevel >= financeOfficeMaxLevel;
    setTextIfChanged(
      elements.buyFinanceOfficeBtn,
      financeOfficeMaxed ? "Finance Office Maxed" : `Buy Finance Office ($${fmt(financeOfficeCost)})`
    );
    setDisabledIfChanged(elements.buyFinanceOfficeBtn, financeOfficeMaxed || state.cash < financeOfficeCost);
    setTextIfChanged(elements.packingShedText, `Packing Shed Lv ${fmt(state.packingShedLevel)} (+${fmt((state.packedExportBonusMultiplier - 1) * 100)}% export price)`);
    setTextIfChanged(elements.fertilizerLabText, `Fertilizer Lab Lv ${fmt(state.fertilizerLabLevel)} (tree output boost)`);
    setTextIfChanged(elements.researchLabText, `Research Lab Lv ${fmt(state.researchLabLevel)} (+${fmt(state.researchLabLevel * 0.06)} RP/sec base)`);
    setTextIfChanged(
      elements.financeOfficeText,
      `Finance Office Lv ${fmt(state.financeOfficeLevel)}${financeOfficeMaxLevel != null ? ` / ${fmt(financeOfficeMaxLevel)}` : ""} (upgrade costs x${fmt(Math.max(0.35, 1 - state.financeOfficeLevel * 0.03))})`
    );

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

    const challengeStatuses = getAscensionChallengesStatus();
    const activeChallenge = getActiveChallengeRunStatus();
    const challengeLastResult = getChallengeLastResult();
    const activeObjectiveCount = activeChallenge ? activeChallenge.objectives.filter((objective) => objective.complete).length : 0;
    if (elements.challengeHudStrip && elements.challengeHudStatusText && elements.challengeHudTimerText) {
      elements.challengeHudStrip.classList.toggle("is-active", Boolean(activeChallenge));
      elements.challengeHudStrip.classList.toggle("is-warning", !activeChallenge && challengeLastResult?.status === "failed");
      if (activeChallenge) {
        setTextIfChanged(
          elements.challengeHudStatusText,
          `Ascension Challenge: ${activeChallenge.challengeName} (${activeChallenge.rankPreview})`
        );
        const timeLimitText = activeChallenge.timeLimitMs > 0 ? ` / ${formatRemainingMs(activeChallenge.timeLimitMs)}` : "";
        setTextIfChanged(
          elements.challengeHudTimerText,
          `Time ${formatRemainingMs(activeChallenge.elapsedMs)}${timeLimitText} | Objectives ${fmt(activeObjectiveCount)} / ${fmt(activeChallenge.objectives.length)}`
        );
      } else if (challengeLastResult?.status === "failed") {
        setTextIfChanged(elements.challengeHudStatusText, "Ascension Challenge: Last run failed");
        setTextIfChanged(elements.challengeHudTimerText, "Retry from Upgrades to earn permanent rewards.");
      } else {
        setTextIfChanged(elements.challengeHudStatusText, "Ascension Challenge: Inactive");
        setTextIfChanged(elements.challengeHudTimerText, "Start a challenge from the Upgrades view.");
      }
    }
    if (elements.challengeRunSummaryText) {
      if (!activeChallenge) {
        setTextIfChanged(elements.challengeRunSummaryText, "No active challenge run.");
      } else {
        const timeLimitText = activeChallenge.timeLimitMs > 0 ? ` / ${formatRemainingMs(activeChallenge.timeLimitMs)}` : "";
        setTextIfChanged(
          elements.challengeRunSummaryText,
          `Active: ${activeChallenge.challengeName} | Time ${formatRemainingMs(activeChallenge.elapsedMs)}${timeLimitText} | Rank ${activeChallenge.rankPreview} | Score ${fmt(activeChallenge.score)} | Objectives ${fmt(activeObjectiveCount)} / ${fmt(activeChallenge.objectives.length)}`
        );
      }
    }
    if (elements.challengeStartWarningText) {
      setTextIfChanged(
        elements.challengeStartWarningText,
        activeChallenge
          ? "Challenge constraints are active. Complete, fail, or abandon to return to normal progression."
          : "Starting a challenge snapshots this run and applies temporary constraints until run end."
      );
    }

    if (elements.challengeObjectivesTracker) {
      if (!activeChallenge) {
        challengeObjectiveElements.forEach((refs) => {
          refs.card.classList.add("is-hidden");
        });
        if (!elements.challengeObjectivesTracker.querySelector(".challenge-objective-empty")) {
          const empty = document.createElement("p");
          empty.className = "challenge-objective-empty";
          empty.textContent = "Start a challenge to track objectives here.";
          elements.challengeObjectivesTracker.appendChild(empty);
        }
      } else {
        const empty = elements.challengeObjectivesTracker.querySelector(".challenge-objective-empty");
        if (empty) {
          empty.remove();
        }
        const activeObjectiveIds = new Set();
        activeChallenge.objectives.forEach((objective) => {
          activeObjectiveIds.add(objective.id);
          const refs = ensureChallengeObjective(objective.id);
          const pct = (objective.progressPct * 100).toFixed(1);
          refs.card.classList.remove("is-hidden");
          refs.card.classList.toggle("is-achievement-unlocked", objective.complete);
          setTextIfChanged(refs.name, objective.id.replace(/_/g, " "));
          setTextIfChanged(refs.value, `${fmt(objective.progress)} / ${fmt(objective.target)} (${pct}%)`);
          setWidthIfChanged(refs.progressFill, pct);
        });
        challengeObjectiveElements.forEach((refs, objectiveId) => {
          if (!activeObjectiveIds.has(objectiveId)) {
            refs.card.classList.add("is-hidden");
          }
        });
      }
    }

    if (elements.challengesList) {
      const rankOrder = { Bronze: 0, Silver: 1, Gold: 2 };
      challengeStatuses.forEach((challenge) => {
        const refs = ensureChallengeCard(challenge.id);
        if (!refs) {
          return;
        }
        const history = challenge.history;
        const historyText = history
          ? `Best: ${history.bestRank || "-"} | Best Time: ${history.bestTimeMs ? formatRemainingMs(history.bestTimeMs) : "-"} | Clears: ${fmt(history.completions)}`
          : "Best: - | Best Time: - | Clears: 0";
        const rewardText = (challenge.rewardPreview || []).length
          ? [...challenge.rewardPreview]
              .sort((a, b) => (rankOrder[a.rank] ?? 99) - (rankOrder[b.rank] ?? 99))
              .map((rankSet) => {
                const rewards = Array.isArray(rankSet.rewards) ? rankSet.rewards : [];
                if (!rewards.length) {
                  return `${rankSet.rank}: None`;
                }
                return `${rankSet.rank}: ${rewards.map((reward) => `${reward.unlocked ? "[Owned]" : "[ ]"} ${reward.title}`).join(", ")}`;
              })
              .join(" | ")
          : "None";
        const objectivesText = Array.isArray(challenge.objectives)
          ? challenge.objectives.map((objective) => `${objective.id.replace(/_/g, " ")} ${fmt(objective.target)}`).join(" | ")
          : "-";
        const rulesText = Array.isArray(challenge.ruleIds) && challenge.ruleIds.length
          ? challenge.ruleIds.map((ruleId) => formatChallengeRuleLabel(ruleId)).join(", ")
          : "Standard rules";
        const thresholds = challenge.rankThresholds || {};
        const thresholdText = `Gold <= ${formatRemainingMs(thresholds.goldMaxElapsedMs || 0)}, Silver <= ${formatRemainingMs(
          thresholds.silverMaxElapsedMs || 0
        )}, Bronze <= ${formatRemainingMs(thresholds.bronzeMaxElapsedMs || challenge.timeLimitMs || 0)}`;
        const disabled = !challenge.unlocked || Boolean(activeChallenge);
        const buttonLabel = challenge.active ? "Active" : "Start Challenge";
        const challengeState = challenge.active
          ? "active"
          : challenge.unlocked
            ? (challengeLastResult?.challengeId === challenge.id && challengeLastResult?.status === "failed" ? "failed" : (history?.completions ? "completed" : "available"))
            : "locked";
        setTextIfChanged(refs.title, `${challenge.category}: ${challenge.name}`);
        setTextIfChanged(refs.description, challenge.description);
        setTextIfChanged(refs.difficulty, `Difficulty: ${getChallengeDifficultyLabel(challenge)}`);
        setTextIfChanged(refs.rules, `Rules: ${rulesText}`);
        setTextIfChanged(refs.objectives, `Objectives: ${objectivesText}`);
        setTextIfChanged(refs.rewards, `Rewards: ${rewardText}`);
        setTextIfChanged(refs.best, `${historyText} | Ranks: ${thresholdText}`);
        setTextIfChanged(refs.unlock, challenge.unlocked ? "Unlock: Available" : `Unlock: ${formatRequirement(challenge.unlockCondition, fmt)}`);
        setTextIfChanged(refs.startBtn, buttonLabel);
        setDisabledIfChanged(refs.startBtn, disabled);
        refs.card.classList.toggle("is-locked", challengeState === "locked");
        refs.card.classList.toggle("is-active", challengeState === "active");
        refs.card.classList.toggle("is-failed", challengeState === "failed");
        refs.statusChip.className = `challenge-status-chip status-${challengeState}`;
        setTextIfChanged(refs.statusChip, challengeState.toUpperCase());
      });
    }

    if (elements.challengeResumeBtn) {
      setDisabledIfChanged(elements.challengeResumeBtn, !activeChallenge || activeChallenge.status === "active");
    }
    if (elements.challengeAbandonBtn) {
      setDisabledIfChanged(elements.challengeAbandonBtn, !activeChallenge);
    }
    if (elements.challengeCompleteBtn) {
      setDisabledIfChanged(elements.challengeCompleteBtn, !activeChallenge || !activeChallenge.allObjectivesComplete);
    }
    if (elements.challengeFailBtn) {
      setDisabledIfChanged(elements.challengeFailBtn, !activeChallenge);
    }

    if (challengeLastResult && (Number(challengeLastResult.completedAt) || 0) > dismissedChallengeResultAt) {
      const challengeDef = challengeStatuses.find((challenge) => challenge.id === challengeLastResult.challengeId);
      const resultTitle = challengeDef ? challengeDef.name : challengeLastResult.challengeId;
      const rewardsGranted = Array.isArray(challengeLastResult.rewardsGranted) ? challengeLastResult.rewardsGranted : [];
      const rewardTitles = rewardsGranted
        .map((rewardId) => ascensionRewardById.get(rewardId)?.title || rewardId)
        .join(", ");
      const rewardsText = rewardsGranted.length ? ` | New Rewards: ${rewardTitles}` : "";
      setTextIfChanged(
        elements.challengeResultSummaryText,
        `${resultTitle}: ${challengeLastResult.status.toUpperCase()} | Rank ${challengeLastResult.rank} | Time ${formatRemainingMs(
          challengeLastResult.elapsedMs
        )} | Score ${fmt(challengeLastResult.score)}${rewardsText}`
      );
      const resultObjectives = challengeDef?.objectives || [];
      setHtmlIfChanged(
        elements.challengeResultObjectivesList,
        resultObjectives.length
          ? resultObjectives
              .map((objective) => {
                const progress = Math.max(0, Number(challengeLastResult.objectiveProgress?.[objective.id]) || 0);
                const target = Math.max(0, Number(objective.target) || 0);
                const pct = target <= 0 ? 100 : Math.max(0, Math.min(100, (progress / target) * 100));
                return `<div class="buyer-card">
              <p class="buyer-name">${objective.id.replace(/_/g, " ")}</p>
              <p>${fmt(progress)} / ${fmt(target)} (${pct.toFixed(1)}%)</p>
            </div>`;
              })
              .join("")
          : "<p>No objective breakdown available.</p>"
      );
      openChallengeResultModal();
    }

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
