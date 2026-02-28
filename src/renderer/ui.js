import {
  buyers,
  buyTree,
  getBuyerCooldownRemainingSeconds,
  getBuyerEffectivePricePerBanana,
  getCurrentTreeTier,
  getMarketPricePerBanana,
  getNextTreeTier,
  getPrestigeBonuses,
  getPrestigeGainPreview,
  getTreeCost,
  isBuyerUnlocked,
  isPrestigeUnlocked,
  isUpgradePurchased,
  isUpgradeUnlocked,
  pickBananaClick,
  prestigeReset,
  purchaseUpgrade,
  sellBananas,
  shipToBuyer,
  subscribe,
  unlockNextTreeTier,
  upgrades,
} from "./gameEngine.js";
import { formatGameNumber } from "./numbers.js";

const NEWS_TICKER_INTERVAL_MS = 9000;
const bananaBusinessNews = Object.freeze([
  "Banana Business News: Harbor inspectors approve faster crate loading lanes.",
  "Banana Business News: Tropical demand rises after smoothie trend spikes.",
  "Banana Business News: Orchard tools expo announces precision ladder prototypes.",
  "Banana Business News: Inter-island freight rates cool as fuel prices dip.",
  "Banana Business News: Buyers report higher quality from carefully pruned trees.",
  "Banana Business News: Market analysts expect a stable week for banana futures.",
  "Banana Business News: New produce regulations favor reliable shipment partners.",
  "Banana Business News: Export brokers praise consistent farm output this quarter.",
  "Banana Business News: Retail chains increase weekend banana promotions.",
  "Banana Business News: Galactic Logistics hints at expanded late-game demand.",
]);

let audioContext = null;
let soundEnabled = false;

function formatAmount(value) {
  return formatGameNumber(value);
}

function formatCooldown(seconds) {
  if (seconds <= 0) {
    return "Ready";
  }

  return `${seconds}s remaining`;
}

function formatRequirement(requirement) {
  if (requirement.type === "totalBananasEarned") {
    return `Produce total bananas: ${formatAmount(requirement.value)}`;
  }
  if (requirement.type === "treesOwned") {
    return `Own trees: ${formatAmount(requirement.value)}`;
  }
  if (requirement.type === "cash") {
    return `Reach cash: $${formatAmount(requirement.value)}`;
  }

  return "Unknown requirement";
}

function clampShipment(value, min, max) {
  const n = Math.floor(Number(value) || min);
  return Math.max(min, Math.min(max, n));
}

function getRandomNewsItem() {
  const index = Math.floor(Math.random() * bananaBusinessNews.length);
  return bananaBusinessNews[index];
}

function getAudioContext() {
  if (!audioContext && typeof window !== "undefined" && window.AudioContext) {
    audioContext = new window.AudioContext();
  }

  return audioContext;
}

function playClickSound() {
  if (!soundEnabled) {
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(660, now);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.05, now + 0.005);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.07);
}

function bindButtonClick(button, handler) {
  button.addEventListener("click", () => {
    playClickSound();
    handler();
  });
}

export function mountUI(container) {
  container.innerHTML = `
    <main class="game-shell">
      <header class="hud">
        <h1>Jungle Game</h1>
        <div class="hud-grid">
          <p id="bananasText">Bananas: 0</p>
          <p id="cashText">Cash: $0</p>
          <p id="bpsText">Bananas/sec: 0</p>
          <p id="clickYieldText">Click Yield: 0</p>
        </div>
        <div class="hud-tools">
          <button id="soundToggleBtn" type="button" title="Toggle a lightweight click sound effect">Sound: Off</button>
        </div>
        <div class="news-ticker" title="Flavor feed only. No direct economy effect.">
          <div class="news-track">
            <p id="newsTickerText">Banana Business News: Markets opening...</p>
          </div>
        </div>
      </header>

      <nav class="top-nav" aria-label="Game sections">
        <button class="tab-btn is-active" data-tab-target="treesPanel" type="button">Trees/Farms</button>
        <button class="tab-btn" data-tab-target="exportPanel" type="button">Exporting</button>
        <button class="tab-btn" data-tab-target="upgradesPanel" type="button">Upgrades</button>
      </nav>

      <section id="treesPanel" class="tab-panel is-active">
        <h2>Trees/Farms</h2>
        <div class="panel-block">
          <button id="pickBtn" type="button" title="Manual harvest. Uses your current click yield.">Pick Banana</button>
        </div>
        <div class="panel-block">
          <h3>Tree Tier</h3>
          <div class="list-item">
            <p id="currentTierText">Current Tier: -</p>
            <p id="nextTierText">Next Tier: -</p>
            <p id="tierMilestoneText">Tier transition milestone: -</p>
            <button id="unlockTierBtn" type="button" title="Spend cash to unlock the next tree technology tier.">Unlock Next Tier</button>
          </div>
        </div>
        <div class="panel-block">
          <h3>Tree List</h3>
          <div class="list-item">
            <p id="treesText">Trees Owned: 0</p>
            <p id="treeRateText">Each tree: 0 bananas/sec</p>
            <button id="buyTreeBtn" type="button" title="Buy another tree. Cost scales with trees owned.">Buy Tree</button>
          </div>
        </div>
      </section>

      <section id="exportPanel" class="tab-panel">
        <h2>Exporting</h2>
        <div class="panel-block">
          <h3>Sell Instantly At Market</h3>
          <p id="marketPriceText">Market price: $0 per banana</p>
          <div class="input-row">
            <input id="marketSellAmount" type="number" min="1" step="1" value="10" />
            <button id="sellBtn" type="button" title="Instant fallback sale at a lower market rate.">Sell Now</button>
          </div>
        </div>
        <div class="panel-block">
          <h3>Buyers</h3>
          <div id="buyersList" class="buyers-list"></div>
        </div>
      </section>

      <section id="upgradesPanel" class="tab-panel">
        <h2>Upgrades</h2>
        <div class="panel-block">
          <h3>Primate Intelligence Prestige</h3>
          <p id="pipText">PIP: 0</p>
          <p id="prestigeCountText">Prestige Resets: 0</p>
          <p id="prestigeBonusText">Permanent bonus: +0% production, +0% export price, +0% click yield</p>
          <p id="prestigeUnlockText">Unlock condition: Reach Quantum Banana Reactor tier or 1.00M total bananas earned.</p>
          <p id="prestigeGainText">Reset gain: +0 PIP</p>
          <button id="prestigeBtn" type="button" title="Reset most run progress for permanent PIP bonuses.">Reset for PIP</button>
        </div>
        <div id="upgradesGroups"></div>
      </section>
    </main>
  `;

  const bananasText = container.querySelector("#bananasText");
  const cashText = container.querySelector("#cashText");
  const bpsText = container.querySelector("#bpsText");
  const clickYieldText = container.querySelector("#clickYieldText");
  const treesText = container.querySelector("#treesText");
  const treeRateText = container.querySelector("#treeRateText");
  const currentTierText = container.querySelector("#currentTierText");
  const nextTierText = container.querySelector("#nextTierText");
  const tierMilestoneText = container.querySelector("#tierMilestoneText");
  const unlockTierBtn = container.querySelector("#unlockTierBtn");
  const buyTreeBtn = container.querySelector("#buyTreeBtn");
  const marketPriceText = container.querySelector("#marketPriceText");
  const marketSellAmountInput = container.querySelector("#marketSellAmount");
  const soundToggleBtn = container.querySelector("#soundToggleBtn");
  const newsTickerText = container.querySelector("#newsTickerText");
  const pipText = container.querySelector("#pipText");
  const prestigeCountText = container.querySelector("#prestigeCountText");
  const prestigeBonusText = container.querySelector("#prestigeBonusText");
  const prestigeUnlockText = container.querySelector("#prestigeUnlockText");
  const prestigeGainText = container.querySelector("#prestigeGainText");
  const prestigeBtn = container.querySelector("#prestigeBtn");

  const tabButtons = Array.from(container.querySelectorAll(".tab-btn"));
  const panels = Array.from(container.querySelectorAll(".tab-panel"));

  function setActiveTab(tabId) {
    tabButtons.forEach((button) => {
      const isActive = button.dataset.tabTarget === tabId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    panels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.id === tabId);
    });
  }

  tabButtons.forEach((button) => {
    bindButtonClick(button, () => {
      setActiveTab(button.dataset.tabTarget);
    });
  });

  bindButtonClick(container.querySelector("#pickBtn"), () => {
    pickBananaClick();
  });

  bindButtonClick(container.querySelector("#sellBtn"), () => {
    sellBananas(Math.max(1, Math.floor(Number(marketSellAmountInput.value) || 1)));
  });

  bindButtonClick(buyTreeBtn, () => {
    buyTree();
  });

  bindButtonClick(unlockTierBtn, () => {
    unlockNextTreeTier();
  });

  bindButtonClick(prestigeBtn, () => {
    prestigeReset();
  });

  bindButtonClick(soundToggleBtn, () => {
    soundEnabled = !soundEnabled;
    soundToggleBtn.textContent = soundEnabled ? "Sound: On" : "Sound: Off";
    if (soundEnabled) {
      const ctx = getAudioContext();
      if (ctx?.state === "suspended") {
        ctx.resume();
      }
    }
  });

  newsTickerText.textContent = getRandomNewsItem();
  window.setInterval(() => {
    newsTickerText.textContent = getRandomNewsItem();
  }, NEWS_TICKER_INTERVAL_MS);

  const buyersList = container.querySelector("#buyersList");
  const buyerElements = new Map();

  buyers.forEach((buyer) => {
    const card = document.createElement("div");
    card.className = "buyer-card";
    card.innerHTML = `
      <p class="buyer-name">${buyer.name}</p>
      <p class="buyer-status" id="status-${buyer.id}">Status: Locked</p>
      <p>Requirement: ${formatRequirement(buyer.unlockRequirement)}</p>
      <p id="price-${buyer.id}">Price: $0 / banana</p>
      <p id="cooldown-${buyer.id}">Cooldown: Ready</p>
      <div class="shipment-controls" id="controls-${buyer.id}">
        <input id="slider-${buyer.id}" type="range" min="${buyer.minShipment}" max="${buyer.maxShipment}" value="${buyer.minShipment}" />
        <input id="input-${buyer.id}" type="number" min="${buyer.minShipment}" max="${buyer.maxShipment}" step="1" value="${buyer.minShipment}" />
        <button id="ship-${buyer.id}" type="button">Ship</button>
      </div>
    `;

    buyersList.appendChild(card);

    const slider = card.querySelector(`#slider-${buyer.id}`);
    const input = card.querySelector(`#input-${buyer.id}`);
    const shipButton = card.querySelector(`#ship-${buyer.id}`);
    const controls = card.querySelector(`#controls-${buyer.id}`);
    const status = card.querySelector(`#status-${buyer.id}`);
    const cooldown = card.querySelector(`#cooldown-${buyer.id}`);
    const price = card.querySelector(`#price-${buyer.id}`);

    const syncShipmentInput = (value) => {
      const clamped = clampShipment(value, buyer.minShipment, buyer.maxShipment);
      slider.value = String(clamped);
      input.value = String(clamped);
      return clamped;
    };

    slider.addEventListener("input", () => {
      syncShipmentInput(slider.value);
    });

    input.addEventListener("change", () => {
      syncShipmentInput(input.value);
    });

    bindButtonClick(shipButton, () => {
      shipToBuyer(buyer.id, syncShipmentInput(input.value));
    });

    buyerElements.set(buyer.id, {
      status,
      cooldown,
      controls,
      input,
      price,
      shipButton,
      syncShipmentInput,
    });
  });

  const upgradesGroups = container.querySelector("#upgradesGroups");
  const upgradeElements = new Map();
  const groupedUpgrades = upgrades.reduce((acc, upgrade) => {
    if (!acc.has(upgrade.group)) {
      acc.set(upgrade.group, []);
    }

    acc.get(upgrade.group).push(upgrade);
    return acc;
  }, new Map());

  groupedUpgrades.forEach((items, groupName) => {
    const block = document.createElement("div");
    block.className = "panel-block";
    block.innerHTML = `<h3>${groupName}</h3><div class="upgrade-grid" id="upgrade-group-${groupName}"></div>`;
    upgradesGroups.appendChild(block);

    const groupRoot = block.querySelector(`#upgrade-group-${groupName}`);

    items.forEach((upgrade) => {
      const card = document.createElement("div");
      card.className = "upgrade-card";
      card.innerHTML = `
        <p class="upgrade-name">${upgrade.name}</p>
        <p>${upgrade.description}</p>
        <p>Cost: $${formatAmount(upgrade.costCash)}</p>
        <p class="upgrade-req">Requirement: ${formatRequirement(upgrade.unlockCondition)}</p>
        <p class="upgrade-state" id="upgrade-state-${upgrade.id}">State: Locked</p>
        <button id="upgrade-btn-${upgrade.id}" type="button">Purchase</button>
      `;

      const button = card.querySelector(`#upgrade-btn-${upgrade.id}`);
      const state = card.querySelector(`#upgrade-state-${upgrade.id}`);

      bindButtonClick(button, () => {
        purchaseUpgrade(upgrade.id);
      });

      upgradeElements.set(upgrade.id, { button, state, card });
      groupRoot.appendChild(card);
    });
  });

  return subscribe((state) => {
    const bananasPerSecond = state.treesOwned * state.bananasPerTreePerSecond;
    const currentTier = getCurrentTreeTier();
    const nextTier = getNextTreeTier();
    const treeCost = getTreeCost();
    const nextTierIndex = state.treeTierIndex + 1;
    const tierUnlockedByMilestone = nextTierIndex <= state.maxUnlockedTreeTierTransitionIndex;

    bananasText.textContent = `Bananas: ${formatAmount(state.bananas)}`;
    cashText.textContent = `Cash: $${formatAmount(state.cash)}`;
    bpsText.textContent = `Bananas/sec: ${formatAmount(bananasPerSecond)}`;
    clickYieldText.textContent = `Click Yield: ${formatAmount(state.clickYield)}`;
    treesText.textContent = `Trees Owned: ${formatAmount(state.treesOwned)}`;
    treeRateText.textContent = `Each tree: ${formatAmount(state.bananasPerTreePerSecond)} bananas/sec`;
    currentTierText.textContent = `Current Tier: ${currentTier.icon || ""} ${currentTier.name}`.trim();

    if (nextTier) {
      nextTierText.textContent = `Next Tier: ${nextTier.icon || ""} ${nextTier.name} (${formatAmount(nextTier.baseBananasPerSecondPerTree)} base bps/tree, unlock $${formatAmount(nextTier.costToUnlock)})`.trim();
      if (!tierUnlockedByMilestone) {
        tierMilestoneText.textContent = "Tier transition milestone: Produce more total bananas to unlock this transition.";
        unlockTierBtn.disabled = true;
        unlockTierBtn.textContent = "Transition Locked By Milestone";
      } else {
        tierMilestoneText.textContent = "Tier transition milestone: Unlocked";
        unlockTierBtn.disabled = state.cash < nextTier.costToUnlock;
        unlockTierBtn.textContent = `Unlock Next Tier ($${formatAmount(nextTier.costToUnlock)})`;
      }
    } else {
      nextTierText.textContent = "Next Tier: Max tier reached";
      tierMilestoneText.textContent = "Tier transition milestone: Complete";
      unlockTierBtn.disabled = true;
      unlockTierBtn.textContent = "All Tree Tiers Unlocked";
    }

    buyTreeBtn.textContent = `Buy Tree ($${formatAmount(treeCost)})`;
    buyTreeBtn.disabled = state.cash < treeCost;

    marketPriceText.textContent = `Market price: $${formatAmount(getMarketPricePerBanana())} per banana`;

    const prestigeUnlocked = isPrestigeUnlocked();
    const prestigeGain = getPrestigeGainPreview();
    const prestigeBonuses = getPrestigeBonuses();
    pipText.textContent = `PIP: ${formatAmount(state.pip)}`;
    prestigeCountText.textContent = `Prestige Resets: ${formatAmount(state.prestigeCount)}`;
    prestigeBonusText.textContent = `Permanent bonus: +${formatAmount((prestigeBonuses.productionMultiplier - 1) * 100)}% production, +${formatAmount((prestigeBonuses.exportPriceMultiplier - 1) * 100)}% export price, +${formatAmount((prestigeBonuses.clickMultiplier - 1) * 100)}% click yield`;
    prestigeUnlockText.textContent = prestigeUnlocked
      ? "Unlock condition: Met."
      : "Unlock condition: Reach Quantum Banana Reactor tier or 1.00M total bananas earned.";
    prestigeGainText.textContent = `Reset gain: +${formatAmount(prestigeGain)} PIP`;
    prestigeBtn.disabled = !prestigeUnlocked || prestigeGain <= 0;

    buyers.forEach((buyer) => {
      const refs = buyerElements.get(buyer.id);
      const unlocked = isBuyerUnlocked(buyer.id);
      const cooldownRemaining = getBuyerCooldownRemainingSeconds(buyer.id);
      const shipmentAmount = refs.syncShipmentInput(refs.input.value);

      refs.status.textContent = unlocked ? "Status: Unlocked" : "Status: Locked";
      refs.price.textContent = `Price: $${formatAmount(getBuyerEffectivePricePerBanana(buyer))} / banana`;
      refs.cooldown.textContent = `Cooldown: ${formatCooldown(cooldownRemaining)}`;
      refs.controls.classList.toggle("is-hidden", !unlocked);

      const lacksBananas = state.bananas < shipmentAmount;
      refs.shipButton.disabled = !unlocked || cooldownRemaining > 0 || lacksBananas;
    });

    upgrades.forEach((upgrade) => {
      const refs = upgradeElements.get(upgrade.id);
      const purchased = isUpgradePurchased(upgrade.id);
      const unlocked = isUpgradeUnlocked(upgrade.id);

      refs.card.classList.toggle("is-purchased", purchased);
      refs.card.classList.toggle("is-locked", !unlocked && !purchased);

      if (purchased) {
        refs.state.textContent = "State: Purchased";
        refs.button.disabled = true;
        refs.button.textContent = "Purchased";
      } else if (!unlocked) {
        refs.state.textContent = "State: Locked";
        refs.button.disabled = true;
        refs.button.textContent = "Locked";
      } else {
        refs.state.textContent = "State: Unlocked";
        refs.button.disabled = state.cash < upgrade.costCash;
        refs.button.textContent = `Purchase ($${formatAmount(upgrade.costCash)})`;
      }
    });
  });
}
