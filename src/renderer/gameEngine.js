import { addStable, stabilizeNumber } from "./numbers.js";
import { farmEvolutions } from "./tiers.js";
import { researchTreeNodes } from "./researchTree.js";
import { achievements } from "./achievements.js";
import { TreeHarvestSystem, getDefaultTreeState } from "./treeHarvestSystem.js";

export const TICK_RATE_HZ = 10;
const TICK_INTERVAL_MS = 1000 / TICK_RATE_HZ;
export const GAME_STATE_SCHEMA_VERSION = 6;
const TREE_COST_GROWTH = 1.12;
const MARKET_PRICE_PER_BANANA = 0.35;
const AUTO_SELL_PRICE_PER_BANANA = 0.2;
const BASE_CLICK_YIELD = 1;
const PRESTIGE_UNLOCK_TOTAL_BANANAS = 1_000_000;
const PRESTIGE_UNLOCK_TIER_INDEX = 5;

// Orchard automation unlock: milestone + cash gate.
// This is intentionally later than workers so the early loop stays click + worker driven.
const ORCHARD_UNLOCK_MILESTONE_ID = "milestone_industry";
const ORCHARD_UNLOCK_CASH_REQUIREMENT = 2500;

const WORKER_COST_GROWTH = 1.15;
const BUILDING_COST_GROWTH = 1.35;
const MAX_ACTIVE_CONTRACTS = 3;
const CONTRACT_GENERATION_INTERVAL_SECONDS = 45;
const EVENT_MIN_ROLL_SECONDS = 120;
const EVENT_MAX_ROLL_SECONDS = 360;
const CEO_EMAIL_MIN_ROLL_SECONDS = 55;
const CEO_EMAIL_MAX_ROLL_SECONDS = 150;

let firstTickAfterLoadPending = true;
let lastLoggedBananasForDebug = 0;

const TREE_HARVEST_UPGRADES = Object.freeze([
  {
    id: "harvest_faster_growth",
    name: "Faster Growth",
    description: "Bananas ripen faster on the canopy.",
    costCash: 220,
    effect: { spawnIntervalMultiplier: 0.9 },
  },
  {
    id: "harvest_bigger_canopy",
    name: "Bigger Canopy",
    description: "More branches means more bananas can hang at once.",
    costCash: 650,
    effect: { maxBananasFlat: 4 },
  },
  {
    id: "harvest_heavier_bunches",
    name: "Heavier Bunches",
    description: "Every click harvests extra banana weight.",
    costCash: 1300,
    effect: { clickYieldMultiplier: 1.7 },
  },
  {
    id: "harvest_golden_bananas",
    name: "Golden Bananas",
    description: "Golden bananas can spawn and are worth far more.",
    costCash: 3500,
    effect: { goldenChanceAdd: 0.06, goldenMultiplierAdd: 10 },
  },
  {
    id: "harvest_monkey_picker",
    name: "Monkey Picker",
    description: "Automates one click every few seconds.",
    costCash: 8200,
    effect: { monkeyPickerInterval: 3.5, workerPickMultiplier: 1.12 },
  },
  {
    id: "harvest_agile_picker",
    name: "Monkey Picker II",
    description: "Monkey picker acts faster.",
    costCash: 19000,
    effect: { monkeyPickerInterval: 1.9, workerPickMultiplier: 1.18 },
    requires: ["harvest_monkey_picker"],
  },
  {
    id: "harvest_shake_cooldown",
    name: "Shake Tree Rigging",
    description: "Reduces shake cooldown.",
    costCash: 14000,
    effect: { shakeCooldownMultiplier: 0.7 },
  },
]);

const timedEvents = Object.freeze({
  squirrel_market_surge: {
    id: "squirrel_market_surge",
    name: "Squirrel Market Surge",
    description: "+10% export price for 60s.",
    durationMs: 60_000,
  },
  shark_investor_visit: {
    id: "shark_investor_visit",
    name: "Shark Investor Visit",
    description: "Investor bonus based on Shark reputation.",
    durationMs: 30_000,
  },
});

const ceoEmailTemplates = Object.freeze([
  { id: "seed-welcome", milestoneId: "milestone_seed", subject: "Welcome To Monkey Banana Holdings", body: "Great start. Keep shipments moving and keep the peel-side up." },
  { id: "seed-brand", milestoneId: "milestone_seed", subject: "Brand Voice Update", body: "We are now a premium banana intelligence company with fruit attached." },
  { id: "grove-ops", milestoneId: "milestone_grove", subject: "Orchard Ops Memo", body: "Local buyers like consistency. Send fewer tiny shipments and smooth your cadence." },
  { id: "grove-hr", milestoneId: "milestone_grove", subject: "Worker Retention Alert", body: "Monkeys love snacks and clear KPIs. In that order." },
  { id: "farm-finance", milestoneId: "milestone_farm", subject: "Finance Wants Forecasts", body: "Model the next 10k bananas before lunch. Yes, this lunch." },
  { id: "farm-export", milestoneId: "milestone_farm", subject: "Export Team Escalation", body: "Cooldown gaps are margin leaks. Stagger buyers and lanes intentionally." },
  { id: "industry-board", milestoneId: "milestone_industry", subject: "Board Packet: Industrial Scale", body: "You are no longer a farm. You are now a supply chain with leaves." },
  { id: "industry-pr", milestoneId: "milestone_industry", subject: "PR Suggestion", body: "Stop calling crates \"banana bricks\" in public announcements." },
  { id: "biodome-risk", milestoneId: "milestone_biodome", subject: "Risk Review", body: "Storm exposure remains high. Maintenance budget is not optional." },
  { id: "biodome-strategy", milestoneId: "milestone_biodome", subject: "Strategy Pivot", body: "Push premium buyers and protect reputation. Cheap volume is a trap." },
  { id: "quantum-rnd", milestoneId: "milestone_quantum", subject: "R&D Confidential", body: "Quantum teams request unlimited bananas and very limited questions." },
  { id: "quantum-legal", milestoneId: "milestone_quantum", subject: "Legal Reminder", body: "Please stop emailing about \"probability laundering\"." },
  { id: "singularity-celebrate", milestoneId: "milestone_singularity", subject: "Singularity Reached", body: "This is what peak banana capitalism looks like." },
  { id: "singularity-cosmic", milestoneId: "milestone_singularity", subject: "Cosmic Buyer Outreach", body: "Interstellar firms replied. They require antimatter and excellent etiquette." },
]);

export const bananaTypes = Object.freeze([
  { id: "standard", name: "Bananas", unlockTierIndex: 0, marketMultiplier: 1 },
]);

const BUILDING_TYPES = Object.freeze({
  packing_shed: {
    id: "packing_shed",
    label: "Packing Shed",
    stateKey: "packingShedLevel",
    baseCost: 750,
    growth: BUILDING_COST_GROWTH,
  },
  fertilizer_lab: {
    id: "fertilizer_lab",
    label: "Fertilizer Lab",
    stateKey: "fertilizerLabLevel",
    baseCost: 1200,
    growth: BUILDING_COST_GROWTH,
  },
  research_hut: {
    id: "research_hut",
    label: "Research Hut",
    stateKey: "researchHutLevel",
    baseCost: 1800,
    growth: BUILDING_COST_GROWTH,
  },
});

const WEIRD_SCIENCE_RESOURCES = Object.freeze({
  banana_matter: "bananaMatter",
  exotic_peel_particles: "exoticPeelParticles",
  antimatter_bananas: "antimatterBananas",
});

const WEIRD_SCIENCE_CONVERTERS = Object.freeze({
  quantum_reactor: {
    id: "quantum_reactor",
    name: "Quantum Reactor",
    stateKey: "quantumReactorLevel",
    inputResource: "bananas",
    outputResource: WEIRD_SCIENCE_RESOURCES.banana_matter,
    inputPerSecond: 120,
    outputPerSecond: 10,
    baseCost: 150_000,
    growth: 1.24,
    unlockRequirement: { type: "treeTierIndex", value: 5 },
  },
  collider: {
    id: "collider",
    name: "Collider",
    stateKey: "colliderLevel",
    inputResource: WEIRD_SCIENCE_RESOURCES.banana_matter,
    outputResource: WEIRD_SCIENCE_RESOURCES.exotic_peel_particles,
    inputPerSecond: 16,
    outputPerSecond: 1.6,
    baseCost: 900_000,
    growth: 1.27,
    unlockRequirement: { type: "treeTierIndex", value: 6 },
  },
  containment: {
    id: "containment",
    name: "Containment",
    stateKey: "containmentLevel",
    inputResource: WEIRD_SCIENCE_RESOURCES.exotic_peel_particles,
    outputResource: WEIRD_SCIENCE_RESOURCES.antimatter_bananas,
    inputPerSecond: 1.4,
    outputPerSecond: 0.1,
    baseCost: 4_200_000,
    growth: 1.3,
    unlockRequirement: { type: "treeTierIndex", value: 6 },
  },
});

export const shippingLanes = Object.freeze([
  { id: "local", name: "Local", priceMultiplier: 1, capacity: 250, unlockRequirement: { type: "totalBananasEarned", value: 0 } },
  { id: "regional", name: "Regional", priceMultiplier: 1.12, capacity: 900, unlockRequirement: { type: "totalBananasEarned", value: 20000 } },
  { id: "global", name: "Global", priceMultiplier: 1.28, capacity: 3200, unlockRequirement: { type: "totalBananasEarned", value: 200000 } },
  { id: "interstellar", name: "Interstellar", priceMultiplier: 1.55, capacity: 12000, unlockRequirement: { type: "totalBananasEarned", value: 1500000 } },
]);

export const treeTiers = farmEvolutions;

export const buyers = Object.freeze([
  { id: "squirrel_market", name: "Squirrel Market", tierGroup: "Local", logoEmoji: "🐿️", flavorText: "Street carts, quick cash, and endless nut-based haggling.", unlockRequirement: { type: "totalBananasEarned", value: 0 }, pricePerBananaMultiplier: 1, minShipment: 10, maxShipment: 80, cooldownSeconds: 4 },
  { id: "raccoon_roadside", name: "Raccoon Roadside Depot", tierGroup: "Local", logoEmoji: "🦝", flavorText: "Midnight logistics with questionable paperwork.", unlockRequirement: { type: "treesOwned", value: 2 }, pricePerBananaMultiplier: 1.2, minShipment: 25, maxShipment: 180, cooldownSeconds: 8 },
  { id: "beaver_bazaar", name: "Beaver Builder Bazaar", tierGroup: "Local", logoEmoji: "🦫", flavorText: "They only buy if your crates are engineered to code.", unlockRequirement: { type: "cash", value: 220 }, pricePerBananaMultiplier: 1.28, minShipment: 35, maxShipment: 220, cooldownSeconds: 10 },
  { id: "otter_outlet", name: "Otter River Outlet", tierGroup: "Local", logoEmoji: "🦦", flavorText: "Fast river lanes, playful but strict on freshness.", unlockRequirement: { type: "totalBananasEarned", value: 900 }, pricePerBananaMultiplier: 1.34, minShipment: 45, maxShipment: 260, cooldownSeconds: 12 },
  { id: "badger_bodega", name: "Badger Bodega Co-op", tierGroup: "Local", logoEmoji: "🦡", flavorText: "Tough negotiators that reward reliable volume.", unlockRequirement: { type: "treesOwned", value: 6 }, pricePerBananaMultiplier: 1.42, minShipment: 60, maxShipment: 320, cooldownSeconds: 14 },

  { id: "parrot_traders", name: "Parrot Produce Traders", tierGroup: "Corporate", logoEmoji: "🦜", flavorText: "Repeats your margin targets until you hit them.", unlockRequirement: { type: "cash", value: 300 }, pricePerBananaMultiplier: 1.45, minShipment: 60, maxShipment: 350, cooldownSeconds: 14 },
  { id: "gorilla_wholesale", name: "Gorilla Wholesale Guild", tierGroup: "Corporate", logoEmoji: "🦍", flavorText: "Bulk deals, executive muscle, no nonsense.", unlockRequirement: { type: "totalBananasEarned", value: 3000 }, pricePerBananaMultiplier: 1.8, minShipment: 120, maxShipment: 700, cooldownSeconds: 20 },
  { id: "penguin_freight", name: "Penguin Polar Freight", tierGroup: "Corporate", logoEmoji: "🐧", flavorText: "Cold-chain precision from glacier to grocery.", unlockRequirement: { type: "treesOwned", value: 15 }, pricePerBananaMultiplier: 2.15, minShipment: 220, maxShipment: 1200, cooldownSeconds: 28 },
  { id: "elephant_exports", name: "Elephant Export Collective", tierGroup: "Corporate", logoEmoji: "🐘", flavorText: "Massive contracts and memory-perfect audits.", unlockRequirement: { type: "cash", value: 8000 }, pricePerBananaMultiplier: 2.55, minShipment: 350, maxShipment: 1800, cooldownSeconds: 35 },
  { id: "wolf_logistics", name: "Wolf Logistics Syndicate", tierGroup: "Corporate", logoEmoji: "🐺", flavorText: "Pack-optimized routes that hunt margin leakage.", unlockRequirement: { type: "totalBananasEarned", value: 25000 }, pricePerBananaMultiplier: 3, minShipment: 550, maxShipment: 2600, cooldownSeconds: 45 },

  { id: "octopus_shipping", name: "Octopus Deep-Sea Shipping", tierGroup: "Global", logoEmoji: "🐙", flavorText: "Eight lanes at once and never misses a port window.", unlockRequirement: { type: "treesOwned", value: 40 }, pricePerBananaMultiplier: 3.6, minShipment: 900, maxShipment: 4000, cooldownSeconds: 58 },
  { id: "shark_investment_group", name: "Shark Investment Group", tierGroup: "Global", logoEmoji: "🦈", flavorText: "Aggressive capital and even more aggressive deadlines.", unlockRequirement: { type: "cash", value: 120000 }, pricePerBananaMultiplier: 4.3, minShipment: 1500, maxShipment: 6500, cooldownSeconds: 72 },
  { id: "falcon_air_cargo", name: "Falcon Air Cargo", tierGroup: "Global", logoEmoji: "🦅", flavorText: "High-speed air lanes for high-grade fruit.", unlockRequirement: { type: "totalBananasEarned", value: 90000 }, pricePerBananaMultiplier: 4.75, minShipment: 1800, maxShipment: 7800, cooldownSeconds: 78 },
  { id: "tiger_commodities", name: "Tiger Commodities Desk", tierGroup: "Global", logoEmoji: "🐯", flavorText: "Volatility hunters with sharp premium contracts.", unlockRequirement: { type: "cash", value: 220000 }, pricePerBananaMultiplier: 5.2, minShipment: 2100, maxShipment: 9000, cooldownSeconds: 84 },
  { id: "rhino_bulk_terminals", name: "Rhino Bulk Terminals", tierGroup: "Global", logoEmoji: "🦏", flavorText: "Heavy throughput, concrete terms, steel nerves.", unlockRequirement: { type: "treesOwned", value: 85 }, pricePerBananaMultiplier: 5.6, minShipment: 2400, maxShipment: 10200, cooldownSeconds: 88 },

  { id: "dragon_galactic_logistics", name: "Dragon Galactic Logistics", tierGroup: "Interstellar", logoEmoji: "🐉", flavorText: "Solar lanes guarded by dragons and lawyers.", unlockRequirement: { type: "totalBananasEarned", value: 500000 }, pricePerBananaMultiplier: 6.3, minShipment: 2500, maxShipment: 12000, cooldownSeconds: 90 },
  { id: "phoenix_orbital_freight", name: "Phoenix Orbital Freight", tierGroup: "Interstellar", logoEmoji: "🔥", flavorText: "Each route reborn stronger after every cycle.", unlockRequirement: { type: "totalBananasEarned", value: 900000 }, pricePerBananaMultiplier: 7.1, minShipment: 3200, maxShipment: 15000, cooldownSeconds: 96 },
  { id: "manta_nebula_haulers", name: "Manta Nebula Haulers", tierGroup: "Interstellar", logoEmoji: "🌌", flavorText: "Glides through nebula currents with premium insurance.", unlockRequirement: { type: "cash", value: 1200000 }, pricePerBananaMultiplier: 7.8, minShipment: 3800, maxShipment: 18000, cooldownSeconds: 102 },
  { id: "lynx_lunar_exchange", name: "Lynx Lunar Exchange", tierGroup: "Interstellar", logoEmoji: "🌙", flavorText: "Moon-market spreads are narrow but ruthless.", unlockRequirement: { type: "treesOwned", value: 140 }, pricePerBananaMultiplier: 8.4, minShipment: 4200, maxShipment: 21000, cooldownSeconds: 108 },
  { id: "orca_star_port", name: "Orca Star Port Authority", tierGroup: "Interstellar", logoEmoji: "🐋", flavorText: "Deep-space docking rights at premium rates.", unlockRequirement: { type: "totalBananasEarned", value: 2500000 }, pricePerBananaMultiplier: 9.2, minShipment: 4800, maxShipment: 25000, cooldownSeconds: 114 },

  { id: "nebula_exchange", name: "Nebula Exchange", tierGroup: "Cosmic", logoEmoji: "✨", flavorText: "Trades only when your antimatter books look clean.", unlockRequirement: { type: "antimatterBananas", value: 10 }, pricePerBananaMultiplier: 10.1, minShipment: 3000, maxShipment: 18000, cooldownSeconds: 96 },
  { id: "void_whale_consortium", name: "Void Whale Consortium", tierGroup: "Cosmic", logoEmoji: "🌀", flavorText: "Ancient brokers in the vacuum between markets.", unlockRequirement: { type: "antimatterBananas", value: 150 }, pricePerBananaMultiplier: 11.4, minShipment: 4500, maxShipment: 26000, cooldownSeconds: 110 },
  { id: "kraken_event_horizon", name: "Kraken Event Horizon", tierGroup: "Cosmic", logoEmoji: "🕳️", flavorText: "Extreme leverage, extreme pull, extreme profits.", unlockRequirement: { type: "antimatterBananas", value: 900 }, pricePerBananaMultiplier: 12.8, minShipment: 7000, maxShipment: 36000, cooldownSeconds: 126 },
  { id: "chimp_multiverse_holdings", name: "Chimp Multiverse Holdings", tierGroup: "Cosmic", logoEmoji: "🐵", flavorText: "A committee of CEOs from parallel jungles.", unlockRequirement: { type: "antimatterBananas", value: 3500 }, pricePerBananaMultiplier: 14.2, minShipment: 10000, maxShipment: 50000, cooldownSeconds: 140 },
  { id: "celestial_serpent_arbitrage", name: "Celestial Serpent Arbitrage", tierGroup: "Cosmic", logoEmoji: "🐍", flavorText: "Wraps around timelines and squeezes every spread.", unlockRequirement: { type: "antimatterBananas", value: 12000 }, pricePerBananaMultiplier: 16, minShipment: 14000, maxShipment: 70000, cooldownSeconds: 160 },
]);

const bananaTypeById = new Map(bananaTypes.map((bananaType) => [bananaType.id, bananaType]));

export const upgrades = researchTreeNodes;

export const milestones = Object.freeze([
  { id: "milestone_seed", requiredTotalBananasEarned: 0, unlockBuyerIds: ["squirrel_market"], unlockUpgradeIds: [], maxTreeTierTransitionIndex: 0 },
  { id: "milestone_grove", requiredTotalBananasEarned: 250, unlockBuyerIds: ["raccoon_roadside"], unlockUpgradeIds: ["soil_mapping", "grip_gloves_mk2"], maxTreeTierTransitionIndex: 1 },
  { id: "milestone_farm", requiredTotalBananasEarned: 2000, unlockBuyerIds: ["parrot_traders"], unlockUpgradeIds: ["smart_irrigation", "port_scheduling"], maxTreeTierTransitionIndex: 2 },
  { id: "milestone_industry", requiredTotalBananasEarned: 12000, unlockBuyerIds: ["gorilla_wholesale", "penguin_freight"], unlockUpgradeIds: ["precision_pruning", "cold_chain", "hedge_desk"], maxTreeTierTransitionIndex: 3 },
  { id: "milestone_biodome", requiredTotalBananasEarned: 70000, unlockBuyerIds: ["elephant_exports", "wolf_logistics"], unlockUpgradeIds: ["genetic_cultivars", "dock_ai", "capital_efficiency"], maxTreeTierTransitionIndex: 4 },
  { id: "milestone_quantum", requiredTotalBananasEarned: 350000, unlockBuyerIds: ["octopus_shipping", "shark_investment_group"], unlockUpgradeIds: ["micro_drone_swarm", "lane_optimizer", "treasury_algorithms"], maxTreeTierTransitionIndex: 5 },
  { id: "milestone_singularity", requiredTotalBananasEarned: 2000000, unlockBuyerIds: ["dragon_galactic_logistics"], unlockUpgradeIds: ["quantum_pollination", "reality_fork_finance"], maxTreeTierTransitionIndex: 6 },
]);

const buyerById = new Map(buyers.map((buyer) => [buyer.id, buyer]));
const laneById = new Map(shippingLanes.map((lane) => [lane.id, lane]));
const upgradeById = new Map(upgrades.map((upgrade) => [upgrade.id, upgrade]));
const milestoneById = new Map(milestones.map((milestone) => [milestone.id, milestone]));
const achievementById = new Map(achievements.map((achievement) => [achievement.id, achievement]));
const treeHarvestUpgradeById = new Map(TREE_HARVEST_UPGRADES.map((upgrade) => [upgrade.id, upgrade]));

const treeHarvestSystem = new TreeHarvestSystem({
  onHarvest: (harvestAmount, banana, context) => {
    // Tree special bananas are yield multipliers, not inventory product types.
    addBananas(harvestAmount, null);
    if (context?.source === "shake_tree") {
      gameState.totalClicks += 1;
    }
  },
});

function getDefaultUpgradeModifiers() {
  return { productionMultiplier: 1, clickMultiplier: 1, exportPriceMultiplier: 1, exportCooldownMultiplier: 1 };
}

const DEFAULT_STATE = Object.freeze({
  schemaVersion: GAME_STATE_SCHEMA_VERSION,
  bananas: 0,
  bananaInventory: { standard: 0 },
  productionMode: "highest",
  tree: getDefaultTreeState(),
  purchasedTreeHarvestUpgradeIds: [],
  cash: 0,
  treesOwned: 0,
  workersOwned: 0,
  orchardsOwned: 0,
  treeTierIndex: 0,
  maxUnlockedTreeTierTransitionIndex: 0,
  bananasPerTreePerSecond: treeTiers[0].baseBananasPerSecondPerTree,
  workersBasePerSecond: 0.35,
  bananasPerWorkerPerSecond: 0.35,
  clickYield: BASE_CLICK_YIELD,
  productionMultiplier: 1,
  clickMultiplier: 1,
  exportPriceMultiplier: 1,
  exportCooldownMultiplier: 1,
  packedExportBonusMultiplier: 1,
  evolutionProductionMultiplier: 1,
  treeBaseCost: 25,
  treeCostGrowth: TREE_COST_GROWTH,
  workerBaseCost: 40,
  workerCostGrowth: WORKER_COST_GROWTH,
  orchardBaseCost: 4000,
  orchardCostGrowth: 1.22,
  orchardPickRatePerSecondPerOrchard: 0.85,
  packingShedLevel: 0,
  fertilizerLabLevel: 0,
  researchHutLevel: 0,
  researchPoints: 0,
  bananaMatter: 0,
  exoticPeelParticles: 0,
  antimatterBananas: 0,
  quantumReactorLevel: 0,
  colliderLevel: 0,
  containmentLevel: 0,
  autoSellEnabled: false,
  autoSellThreshold: 200,
  purchasedUpgradeIds: [],
  unlockedResearchNodeIds: [],
  unlockedAchievementIds: [],
  totalClicks: 0,
  totalShipments: 0,
  contractsCompleted: 0,
  reachedMilestoneIds: ["milestone_seed"],
  milestoneUnlockedBuyerIds: ["squirrel_market"],
  milestoneUnlockedUpgradeIds: [],
  unlockedEvolutionRewardBuyerIds: [],
  unlockedUpgradeCategories: ["Farming Tech", "Finance"],
  lifetimeBuyerShipmentTotals: {},
  lastTickTime: Date.now(),
  lastTickDurationMs: 0,
  totalBananasEarned: 0,
  totalCashEarned: 0,
  unlockedBuyerIds: ["squirrel_market"],
  buyerReputation: { squirrel_market: 10 },
  selectedShippingLaneId: "local",
  unlockedShippingLaneIds: ["local"],
  activeContracts: [],
  nextContractId: 1,
  lastContractGenerationTime: Date.now(),
  activeTimedEventId: null,
  activeTimedEventEndTimestamp: 0,
  nextEventRollTimestamp: Date.now() + 180_000,
  lastEventMessage: "",
  ceoEmails: [],
  sentCeoEmailIds: [],
  nextCeoEmailRollTimestamp: Date.now() + 65_000,
  rareItems: [],
  buyerCooldowns: {},
  pip: 0,
  prestigeCount: 0,
  lastSaveTimestamp: Date.now(),
});

export const gameState = { ...DEFAULT_STATE };

const listeners = new Set();
let tickTimer = null;

function clampNonNegative(value) {
  return Math.max(0, value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isEconomyDebugEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage?.getItem("jungle_debug_economy") === "1";
  } catch (_error) {
    return false;
  }
}

function logEconomyDebug(label, payload) {
  if (!isEconomyDebugEnabled()) {
    return;
  }

  console.info(`[EconomyDebug] ${label}`, payload);
}

function coerceFiniteNumber(value, fallback, contextLabel) {
  const n = Number(value);
  if (Number.isFinite(n)) {
    return n;
  }

  console.error(`[EconomyGuard] Non-finite value detected in ${contextLabel}. Resetting to fallback.`, { value, fallback });
  return fallback;
}

function assertFiniteCoreState(contextLabel) {
  const checks = [
    ["bananas", 0],
    ["cash", 0],
    ["workersOwned", 0],
    ["treesOwned", 0],
    ["orchardsOwned", 0],
    ["bananasPerTreePerSecond", DEFAULT_STATE.bananasPerTreePerSecond],
    ["bananasPerWorkerPerSecond", DEFAULT_STATE.bananasPerWorkerPerSecond],
    ["workersBasePerSecond", DEFAULT_STATE.workersBasePerSecond],
    ["totalBananasEarned", 0],
    ["totalCashEarned", 0],
    ["lastTickTime", Date.now()],
    ["lastSaveTimestamp", Date.now()],
  ];

  checks.forEach(([key, fallback]) => {
    gameState[key] = coerceFiniteNumber(gameState[key], fallback, `${contextLabel}:${key}`);
  });
}

function sanitizeIds(rawValues, validMap) {
  const valueSet = new Set(Array.isArray(rawValues) ? rawValues : []);
  return Array.from(valueSet).filter((id) => validMap.has(id));
}

function isRequirementMet(requirement, state = gameState) {
  if (!requirement) {
    return true;
  }

  const targetValue = clampNonNegative(Number(requirement.value) || 0);
  if (requirement.type === "totalBananasEarned") {
    return state.totalBananasEarned >= targetValue;
  }
  if (requirement.type === "treesOwned") {
    return state.treesOwned >= targetValue;
  }
  if (requirement.type === "cash") {
    return state.cash >= targetValue;
  }
  if (requirement.type === "treeTierIndex") {
    return state.treeTierIndex >= targetValue;
  }
  if (requirement.type === "antimatterBananas") {
    return state.antimatterBananas >= targetValue;
  }

  return false;
}

function sanitizeBuyerCooldowns(rawCooldowns) {
  const now = Date.now();
  const nextCooldowns = {};
  if (!rawCooldowns || typeof rawCooldowns !== "object") {
    return nextCooldowns;
  }

  for (const [buyerId, cooldownEndMs] of Object.entries(rawCooldowns)) {
    if (!buyerById.has(buyerId)) {
      continue;
    }

    const safeEndMs = Number(cooldownEndMs) || 0;
    if (safeEndMs > now) {
      nextCooldowns[buyerId] = safeEndMs;
    }
  }

  return nextCooldowns;
}

function sanitizeShipmentTotals(rawTotals) {
  const nextTotals = {};
  if (!rawTotals || typeof rawTotals !== "object") {
    return nextTotals;
  }

  for (const [buyerId, total] of Object.entries(rawTotals)) {
    if (!buyerById.has(buyerId)) {
      continue;
    }

    nextTotals[buyerId] = clampNonNegative(Number(total) || 0);
  }

  return nextTotals;
}

function sanitizeUpgradeCategories(rawCategories) {
  const allowed = new Set(upgrades.map((upgrade) => upgrade.group));
  const categories = Array.isArray(rawCategories) ? rawCategories : [];
  const next = categories.filter((category) => allowed.has(category));
  if (!next.includes("Farming Tech")) {
    next.push("Farming Tech");
  }
  if (!next.includes("Finance")) {
    next.push("Finance");
  }

  return Array.from(new Set(next));
}

function sanitizeBuyerReputation(rawReputation) {
  const next = {};
  const source = rawReputation && typeof rawReputation === "object" ? rawReputation : {};
  buyers.forEach((buyer) => {
    const raw = Number(source[buyer.id]);
    next[buyer.id] = clamp(Number.isFinite(raw) ? raw : (buyer.id === "squirrel_market" ? 10 : 0), 0, 100);
  });
  return next;
}

function sanitizeShippingLanes(rawLaneIds) {
  const set = new Set(Array.isArray(rawLaneIds) ? rawLaneIds : []);
  set.add("local");
  return Array.from(set).filter((laneId) => laneById.has(laneId));
}

function sanitizeBananaInventory(rawInventory) {
  const next = {};
  const source = rawInventory && typeof rawInventory === "object" ? rawInventory : {};
  bananaTypes.forEach((bananaType) => {
    next[bananaType.id] = clampNonNegative(Number(source[bananaType.id]) || 0);
  });
  return next;
}

function sanitizeTreeHarvestUpgradeIds(rawIds) {
  const set = new Set(Array.isArray(rawIds) ? rawIds : []);
  return Array.from(set).filter((id) => treeHarvestUpgradeById.has(id));
}

function sanitizeCeoEmailEntries(rawEmails) {
  if (!Array.isArray(rawEmails)) {
    return [];
  }

  return rawEmails
    .filter((email) => email && typeof email === "object")
    .map((email) => ({
      id: String(email.id || `email-${Math.random().toString(36).slice(2, 8)}`),
      subject: String(email.subject || "Executive Update"),
      body: String(email.body || "No details provided."),
      milestoneId: typeof email.milestoneId === "string" ? email.milestoneId : "milestone_seed",
      receivedAt: Number(email.receivedAt) || Date.now(),
    }))
    .slice(-40);
}

function migrateLoadedState(rawState) {
  if (!rawState || typeof rawState !== "object") {
    return {};
  }

  const migrated = { ...rawState };
  const sourceSchemaVersion = Math.floor(Number(migrated.schemaVersion) || 0);

  if (sourceSchemaVersion < 3) {
    // v3 introduces a stable worker base stat. Older saves can carry compounded values.
    migrated.workersBasePerSecond = DEFAULT_STATE.workersBasePerSecond;
  }
  if (sourceSchemaVersion < 4) {
    migrated.tree = getDefaultTreeState();
    migrated.purchasedTreeHarvestUpgradeIds = [];
  }
  if (sourceSchemaVersion < 5) {
    migrated.orchardsOwned = 0;
    migrated.orchardBaseCost = DEFAULT_STATE.orchardBaseCost;
    migrated.orchardCostGrowth = DEFAULT_STATE.orchardCostGrowth;
    migrated.orchardPickRatePerSecondPerOrchard = DEFAULT_STATE.orchardPickRatePerSecondPerOrchard;
  }
  if (sourceSchemaVersion < 6) {
    // v6 removes the tree condition (quality/health) system.
    delete migrated.treeQuality;
    delete migrated.treeHealth;
  }

  migrated.schemaVersion = GAME_STATE_SCHEMA_VERSION;
  return migrated;
}

function getAchievementConditionValue(condition) {
  if (!condition) {
    return 0;
  }

  if (condition.type === "clicks") {
    return gameState.totalClicks;
  }
  if (condition.type === "trees_owned") {
    return gameState.treesOwned;
  }
  if (condition.type === "shipments_total") {
    return gameState.totalShipments;
  }
  if (condition.type === "contracts_completed") {
    return gameState.contractsCompleted;
  }
  if (condition.type === "tier_index") {
    return gameState.treeTierIndex;
  }

  return 0;
}

function refreshAchievements() {
  const unlockedSet = new Set(gameState.unlockedAchievementIds);
  let unlockedNew = false;

  achievements.forEach((achievement) => {
    if (unlockedSet.has(achievement.id)) {
      return;
    }

    const value = getAchievementConditionValue(achievement.condition);
    if (value >= (achievement.condition?.target || 0)) {
      unlockedSet.add(achievement.id);
      unlockedNew = true;
    }
  });

  gameState.unlockedAchievementIds = Array.from(unlockedSet).filter((achievementId) => achievementById.has(achievementId));
  return unlockedNew;
}

function sanitizeContracts(rawContracts) {
  if (!Array.isArray(rawContracts)) {
    return [];
  }

  const now = Date.now();
  return rawContracts
    .filter((contract) => contract && buyerById.has(contract.buyerId))
    .map((contract) => {
      const target = Math.max(1, Math.floor(Number(contract.targetBananas) || 0));
      const progress = clampNonNegative(Math.floor(Number(contract.progressBananas) || 0));
      const expiresAt = Number(contract.expiresAt) || now;
      return {
        id: String(contract.id || `legacy-${Math.random().toString(36).slice(2, 8)}`),
        buyerId: contract.buyerId,
        targetBananas: target,
        progressBananas: Math.min(target, progress),
        createdAt: Number(contract.createdAt) || now,
        expiresAt,
        rewardCash: clampNonNegative(Number(contract.rewardCash) || 0),
        rewardRep: clampNonNegative(Number(contract.rewardRep) || 0),
        rewardRareItem: typeof contract.rewardRareItem === "string" ? contract.rewardRareItem : null,
        premium: Boolean(contract.premium),
      };
    })
    .filter((contract) => contract.expiresAt > now);
}

function getBuildingLevel(buildingType) {
  const config = BUILDING_TYPES[buildingType];
  if (!config) {
    return 0;
  }

  return clampNonNegative(Math.floor(Number(gameState[config.stateKey]) || 0));
}

function getConverterLevel(converterId) {
  const converter = WEIRD_SCIENCE_CONVERTERS[converterId];
  if (!converter) {
    return 0;
  }

  return clampNonNegative(Math.floor(Number(gameState[converter.stateKey]) || 0));
}

function getPackingShedMultiplier() {
  return 1 + getBuildingLevel("packing_shed") * 0.04;
}

function getFertilizerLabMultiplier() {
  return 1 + getBuildingLevel("fertilizer_lab") * 0.08;
}

function getResearchDiscountMultiplier() {
  return Math.max(0.55, 1 - getBuildingLevel("research_hut") * 0.03);
}

function getAntimatterExportBoostMultiplier() {
  const antimatter = clampNonNegative(Number(gameState.antimatterBananas) || 0);
  // Strong late-game reward curve for weird science progression.
  return stabilizeNumber(1 + Math.log10(antimatter + 1) * 4);
}

function recomputeDerivedStats() {
  const upgradeModifiers = gameState.purchasedUpgradeIds.reduce((current, upgradeId) => {
    const upgrade = upgradeById.get(upgradeId);
    return upgrade ? upgrade.effect(current) : current;
  }, getDefaultUpgradeModifiers());

  const prestigeBonuses = getPrestigeBonuses();
  const packingMultiplier = getPackingShedMultiplier();
  const achievementMultipliers = getAchievementMultipliers();
  const treeHarvestModifiers = getTreeHarvestModifiers();

  gameState.productionMultiplier = Math.max(1, stabilizeNumber(upgradeModifiers.productionMultiplier * prestigeBonuses.productionMultiplier * gameState.evolutionProductionMultiplier * achievementMultipliers.productionMultiplier));
  gameState.clickMultiplier = Math.max(1, stabilizeNumber(upgradeModifiers.clickMultiplier * prestigeBonuses.clickMultiplier * achievementMultipliers.clickMultiplier));
  gameState.exportPriceMultiplier = Math.max(1, stabilizeNumber(upgradeModifiers.exportPriceMultiplier * prestigeBonuses.exportPriceMultiplier * packingMultiplier * achievementMultipliers.exportPriceMultiplier));
  gameState.exportCooldownMultiplier = Math.max(0.1, stabilizeNumber(upgradeModifiers.exportCooldownMultiplier));
  gameState.packedExportBonusMultiplier = stabilizeNumber(packingMultiplier);

  const tier = treeTiers[gameState.treeTierIndex];
  const tierHarvest = tier?.harvest || {};
  gameState.bananasPerTreePerSecond = stabilizeNumber(tier.baseBananasPerSecondPerTree * gameState.productionMultiplier);

  const workerBase = clampNonNegative(Number(gameState.workersBasePerSecond) || DEFAULT_STATE.workersBasePerSecond);
  const workerPrestigeMultiplier = 1 + Math.max(0, gameState.pip) * 0.005;
  gameState.bananasPerWorkerPerSecond = stabilizeNumber(workerBase * workerPrestigeMultiplier * achievementMultipliers.workerMultiplier);
  gameState.clickYield = stabilizeNumber(BASE_CLICK_YIELD * gameState.clickMultiplier);

  const ownedTrees = clampNonNegative(gameState.treesOwned);
  const treeCapacityBonusFromTrees = Math.floor(ownedTrees * 0.75);
  // Trees speed up spawn with diminishing returns so we don't instantly hit the hard min spawnInterval clamp.
  const spawnIntervalMultiplierFromTrees = 1 / (1 + Math.sqrt(ownedTrees) * 0.14);
  const fertilizerLabLevel = getBuildingLevel("fertilizer_lab");
  const fertilizerSpawnMultiplier = 1 / (1 + fertilizerLabLevel * 0.06);
  const fertilizerCapacityBonus = Math.floor(fertilizerLabLevel * 0.5);

  treeHarvestSystem.applyModifiers({
    spawnInterval:
      1.5 *
      (Number(tierHarvest.spawnIntervalMultiplier) || 1) *
      treeHarvestModifiers.spawnIntervalMultiplier *
      spawnIntervalMultiplierFromTrees *
      fertilizerSpawnMultiplier,
    maxBananasOnTree:
      12 +
      (Number(tierHarvest.maxBananasBonus) || 0) +
      treeHarvestModifiers.maxBananasFlat +
      treeCapacityBonusFromTrees +
      fertilizerCapacityBonus,
    clickHarvestYield: gameState.clickYield * (Number(tierHarvest.clickYieldMultiplier) || 1) * treeHarvestModifiers.clickYieldMultiplier,
    goldenChance: 0.005 + (Number(tierHarvest.goldenChanceAdd) || 0) + treeHarvestModifiers.goldenChanceAdd,
    goldenMultiplier: 35 + (Number(tierHarvest.goldenMultiplierAdd) || 0) + treeHarvestModifiers.goldenMultiplierAdd,
    diamondChance: 0.0005 + (Number(tierHarvest.diamondChanceAdd) || 0) + treeHarvestModifiers.diamondChanceAdd,
    diamondMultiplier: 200 + (Number(tierHarvest.diamondMultiplierAdd) || 0) + treeHarvestModifiers.diamondMultiplierAdd,
    monkeyPickerInterval: treeHarvestModifiers.monkeyPickerInterval,
    shakeCooldownSeconds: 35 * (Number(tierHarvest.shakeCooldownMultiplier) || 1) * treeHarvestModifiers.shakeCooldownMultiplier,
  });
  gameState.tree = treeHarvestSystem.serialize();
}

function getBuyerReputation(buyerId) {
  return clampNonNegative(Number(gameState.buyerReputation[buyerId]) || 0);
}

function changeBuyerReputation(buyerId, delta) {
  const current = getBuyerReputation(buyerId);
  gameState.buyerReputation[buyerId] = clamp(stabilizeNumber(current + delta), 0, 100);
}

function getBuyerReputationMultiplier(buyerId) {
  const rep = getBuyerReputation(buyerId);
  return 1 + rep * 0.004;
}

function isBuyerPremiumUnlocked(buyerId) {
  return getBuyerReputation(buyerId) >= 60;
}

function getSelectedShippingLane() {
  const lane = laneById.get(gameState.selectedShippingLaneId);
  return lane || shippingLanes[0];
}

function getRandomEventRollDelayMs() {
  const seconds = EVENT_MIN_ROLL_SECONDS + Math.floor(Math.random() * (EVENT_MAX_ROLL_SECONDS - EVENT_MIN_ROLL_SECONDS + 1));
  return seconds * 1000;
}

function scheduleNextEventRoll(fromTimestamp = Date.now()) {
  gameState.nextEventRollTimestamp = fromTimestamp + getRandomEventRollDelayMs();
}

function getRandomCeoEmailDelayMs() {
  const seconds = CEO_EMAIL_MIN_ROLL_SECONDS + Math.floor(Math.random() * (CEO_EMAIL_MAX_ROLL_SECONDS - CEO_EMAIL_MIN_ROLL_SECONDS + 1));
  return seconds * 1000;
}

function isEventActive(eventId) {
  return gameState.activeTimedEventId === eventId;
}

function clearActiveEvent(now = Date.now()) {
  gameState.activeTimedEventId = null;
  gameState.activeTimedEventEndTimestamp = 0;
  scheduleNextEventRoll(now);
}

function triggerTimedEvent(now = Date.now()) {
  const eventPool = [
    timedEvents.squirrel_market_surge,
    timedEvents.shark_investor_visit,
  ];
  const selectedEvent = eventPool[Math.floor(Math.random() * eventPool.length)];
  gameState.activeTimedEventId = selectedEvent.id;
  gameState.activeTimedEventEndTimestamp = selectedEvent.durationMs > 0 ? now + selectedEvent.durationMs : 0;

  if (selectedEvent.id === "shark_investor_visit") {
    const sharkRep = getBuyerReputation("shark_investment_group");
    if (sharkRep >= 50) {
      const bonusCash = stabilizeNumber(2000 + sharkRep * 50);
      addCash(bonusCash);
      gameState.lastEventMessage = `${selectedEvent.name}: +$${bonusCash.toFixed(0)} secured.`;
    } else {
      gameState.lastEventMessage = `${selectedEvent.name}: Reputation too low for investment.`;
    }
  } else {
    gameState.lastEventMessage = selectedEvent.description;
  }
}

function updateTimedEvents(now = Date.now()) {
  if (gameState.activeTimedEventId) {
    if (gameState.activeTimedEventEndTimestamp > 0 && now >= gameState.activeTimedEventEndTimestamp) {
      clearActiveEvent(now);
    }
    return;
  }

  if (!gameState.nextEventRollTimestamp) {
    scheduleNextEventRoll(now);
    return;
  }

  if (now >= gameState.nextEventRollTimestamp) {
    triggerTimedEvent(now);
  }
}

function updateCeoEmails(now = Date.now()) {
  if (!gameState.nextCeoEmailRollTimestamp) {
    gameState.nextCeoEmailRollTimestamp = now + getRandomCeoEmailDelayMs();
    return;
  }

  if (now < gameState.nextCeoEmailRollTimestamp) {
    return;
  }

  const reached = new Set(gameState.reachedMilestoneIds);
  const sent = new Set(gameState.sentCeoEmailIds);
  const candidates = ceoEmailTemplates.filter((template) => reached.has(template.milestoneId) && !sent.has(template.id));

  if (candidates.length > 0) {
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    gameState.ceoEmails = [
      ...gameState.ceoEmails,
      {
        id: selected.id,
        subject: selected.subject,
        body: selected.body,
        milestoneId: selected.milestoneId,
        receivedAt: now,
      },
    ].slice(-40);
    gameState.sentCeoEmailIds = [...sent, selected.id];
  }

  gameState.nextCeoEmailRollTimestamp = now + getRandomCeoEmailDelayMs();
}

function getAchievementMultipliers() {
  const multipliers = {
    productionMultiplier: 1,
    clickMultiplier: 1,
    exportPriceMultiplier: 1,
    workerMultiplier: 1,
    researchMultiplier: 1,
  };

  gameState.unlockedAchievementIds.forEach((achievementId) => {
    const achievement = achievementById.get(achievementId);
    const perk = achievement?.perk;
    if (!perk) {
      return;
    }

    if (perk.type === "production_multiplier") {
      multipliers.productionMultiplier *= perk.value;
    } else if (perk.type === "click_multiplier") {
      multipliers.clickMultiplier *= perk.value;
    } else if (perk.type === "export_price_multiplier") {
      multipliers.exportPriceMultiplier *= perk.value;
    } else if (perk.type === "worker_multiplier") {
      multipliers.workerMultiplier *= perk.value;
    } else if (perk.type === "research_multiplier") {
      multipliers.researchMultiplier *= perk.value;
    }
  });

  return multipliers;
}

function getTreeHarvestModifiers() {
  const modifiers = {
    spawnIntervalMultiplier: 1,
    maxBananasFlat: 0,
    clickYieldMultiplier: 1,
    workerPickMultiplier: 1,
    goldenChanceAdd: 0,
    goldenMultiplierAdd: 0,
    diamondChanceAdd: 0,
    diamondMultiplierAdd: 0,
    monkeyPickerInterval: 0,
    shakeCooldownMultiplier: 1,
  };

  gameState.purchasedTreeHarvestUpgradeIds.forEach((upgradeId) => {
    const upgrade = treeHarvestUpgradeById.get(upgradeId);
    if (!upgrade?.effect) {
      return;
    }
    const effect = upgrade.effect;
    if (effect.spawnIntervalMultiplier) {
      modifiers.spawnIntervalMultiplier *= effect.spawnIntervalMultiplier;
    }
    if (effect.maxBananasFlat) {
      modifiers.maxBananasFlat += effect.maxBananasFlat;
    }
    if (effect.clickYieldMultiplier) {
      modifiers.clickYieldMultiplier *= effect.clickYieldMultiplier;
    }
    if (effect.workerPickMultiplier) {
      modifiers.workerPickMultiplier *= effect.workerPickMultiplier;
    }
    if (effect.goldenChanceAdd) {
      modifiers.goldenChanceAdd += effect.goldenChanceAdd;
    }
    if (effect.goldenMultiplierAdd) {
      modifiers.goldenMultiplierAdd += effect.goldenMultiplierAdd;
    }
    if (effect.diamondChanceAdd) {
      modifiers.diamondChanceAdd += effect.diamondChanceAdd;
    }
    if (effect.diamondMultiplierAdd) {
      modifiers.diamondMultiplierAdd += effect.diamondMultiplierAdd;
    }
    if (effect.monkeyPickerInterval) {
      modifiers.monkeyPickerInterval = modifiers.monkeyPickerInterval
        ? Math.min(modifiers.monkeyPickerInterval, effect.monkeyPickerInterval)
        : effect.monkeyPickerInterval;
    }
    if (effect.shakeCooldownMultiplier) {
      modifiers.shakeCooldownMultiplier *= effect.shakeCooldownMultiplier;
    }
  });

  return modifiers;
}

function refreshShippingLaneUnlocks() {
  const unlocked = new Set(gameState.unlockedShippingLaneIds);
  shippingLanes.forEach((lane) => {
    if (isRequirementMet(lane.unlockRequirement)) {
      unlocked.add(lane.id);
    }
  });
  unlocked.add("local");
  gameState.unlockedShippingLaneIds = Array.from(unlocked).filter((laneId) => laneById.has(laneId));
  if (!gameState.unlockedShippingLaneIds.includes(gameState.selectedShippingLaneId)) {
    gameState.selectedShippingLaneId = "local";
  }
}

function createContract() {
  const availableBuyers = buyers.filter((buyer) => isBuyerUnlocked(buyer.id));
  if (availableBuyers.length === 0) {
    return null;
  }

  const buyer = availableBuyers[Math.floor(Math.random() * availableBuyers.length)];
  const premium = isBuyerPremiumUnlocked(buyer.id) && Math.random() < 0.5;
  const scale = premium ? 2.1 : 1.35;
  const targetBananas = Math.floor(buyer.minShipment * scale + Math.random() * buyer.maxShipment * 0.4);
  const durationMinutes = premium ? 10 : 6;
  const rewardCash = targetBananas * getBuyerEffectivePricePerBanana(buyer) * (premium ? 1.4 : 0.95);
  const rewardRep = premium ? 8 : 4;
  const rareItem = premium && Math.random() < 0.35 ? "Golden Banana Crate" : null;

  const contractId = `contract-${gameState.nextContractId}`;
  gameState.nextContractId += 1;
  const now = Date.now();
  return {
    id: contractId,
    buyerId: buyer.id,
    targetBananas,
    progressBananas: 0,
    createdAt: now,
    expiresAt: now + durationMinutes * 60 * 1000,
    rewardCash: stabilizeNumber(rewardCash),
    rewardRep,
    rewardRareItem: rareItem,
    premium,
  };
}

function updateContracts(nowMs = Date.now()) {
  const active = [];
  gameState.activeContracts.forEach((contract) => {
    if (contract.expiresAt <= nowMs) {
      return;
    }
    active.push(contract);
  });
  gameState.activeContracts = active;

  const elapsedSinceGen = (nowMs - gameState.lastContractGenerationTime) / 1000;
  if (elapsedSinceGen >= CONTRACT_GENERATION_INTERVAL_SECONDS && gameState.activeContracts.length < MAX_ACTIVE_CONTRACTS) {
    const newContract = createContract();
    if (newContract) {
      gameState.activeContracts = [...gameState.activeContracts, newContract];
    }
    gameState.lastContractGenerationTime = nowMs;
  }
}

export function getResearchPointsPerSecond() {
  const achievementMultipliers = getAchievementMultipliers();
  return stabilizeNumber(gameState.researchHutLevel * 0.06 * achievementMultipliers.researchMultiplier);
}

function hasResearchPrerequisites(upgrade) {
  const prereqs = Array.isArray(upgrade.prerequisites) ? upgrade.prerequisites : [];
  return prereqs.every((prereqId) => gameState.purchasedUpgradeIds.includes(prereqId));
}

function refreshUnlockedResearchNodes() {
  const unlocked = new Set(gameState.unlockedResearchNodeIds);
  upgrades.forEach((upgrade) => {
    const categoryUnlocked = gameState.unlockedUpgradeCategories.includes(upgrade.group);
    const requirementUnlocked = gameState.milestoneUnlockedUpgradeIds.includes(upgrade.id) || isRequirementMet(upgrade.unlockCondition);
    if (categoryUnlocked && hasResearchPrerequisites(upgrade) && requirementUnlocked) {
      unlocked.add(upgrade.id);
    }
  });
  gameState.unlockedResearchNodeIds = Array.from(unlocked).filter((id) => upgradeById.has(id));
}

function applyShipmentToContracts(buyerId, shipmentAmount) {
  if (shipmentAmount <= 0) {
    return;
  }

  const now = Date.now();
  const nextContracts = [];
  gameState.activeContracts.forEach((contract) => {
    if (contract.expiresAt <= now) {
      return;
    }

    if (contract.buyerId !== buyerId) {
      nextContracts.push(contract);
      return;
    }

    const progress = clamp(contract.progressBananas + shipmentAmount, 0, contract.targetBananas);
    if (progress >= contract.targetBananas) {
      addCash(contract.rewardCash);
      changeBuyerReputation(buyerId, contract.rewardRep);
      gameState.contractsCompleted += 1;
      if (contract.rewardRareItem) {
        gameState.rareItems = [...gameState.rareItems, contract.rewardRareItem];
      }
      return;
    }

    nextContracts.push({ ...contract, progressBananas: progress });
  });
  gameState.activeContracts = nextContracts;
}

function getQuestProgressValue(quest) {
  if (!quest) {
    return 0;
  }

  if (quest.type === "trees_owned") {
    return gameState.treesOwned;
  }
  if (quest.type === "cash_earned") {
    return gameState.totalCashEarned;
  }
  if (quest.type === "ship_to_buyer") {
    return gameState.lifetimeBuyerShipmentTotals[quest.buyerId] || 0;
  }

  return 0;
}

function isQuestComplete(quest) {
  if (!quest) {
    return true;
  }

  return getQuestProgressValue(quest) >= (Number(quest.target) || 0);
}

function rebuildEvolutionRewardsFromTier() {
  gameState.evolutionProductionMultiplier = 1;
  gameState.unlockedEvolutionRewardBuyerIds = [];
  gameState.unlockedUpgradeCategories = ["Farming Tech", "Finance"];

  for (let index = 1; index <= gameState.treeTierIndex; index += 1) {
    const tier = treeTiers[index];
    if (tier?.reward) {
      applyEvolutionReward(tier.reward);
    }
  }
}

function applyEvolutionReward(reward) {
  if (!reward || reward.type === "none") {
    return;
  }

  if (reward.type === "multiplier") {
    const value = Math.max(1, Number(reward.value) || 1);
    gameState.evolutionProductionMultiplier = stabilizeNumber(gameState.evolutionProductionMultiplier * value);
    return;
  }

  if (reward.type === "buyer" && reward.buyerId && buyerById.has(reward.buyerId)) {
    if (!gameState.unlockedEvolutionRewardBuyerIds.includes(reward.buyerId)) {
      gameState.unlockedEvolutionRewardBuyerIds = [...gameState.unlockedEvolutionRewardBuyerIds, reward.buyerId];
    }
    return;
  }

  if (reward.type === "upgrade_category" && reward.category) {
    const categoryAliases = {
      Production: "Farming Tech",
      Export: "Logistics",
      Clicking: "Weird Science",
    };
    const normalizedCategory = categoryAliases[reward.category] || reward.category;
    if (!gameState.unlockedUpgradeCategories.includes(normalizedCategory)) {
      gameState.unlockedUpgradeCategories = [...gameState.unlockedUpgradeCategories, normalizedCategory];
    }
  }
}

export function getCurrentQuestStatus() {
  const nextTier = getNextTreeTier();
  if (!nextTier || !nextTier.quest) {
    return null;
  }

  const quest = nextTier.quest;
  const progress = getQuestProgressValue(quest);
  const target = Math.max(1, Number(quest.target) || 1);
  const pct = clamp(progress / target, 0, 1);

  return {
    questId: quest.id,
    description: quest.description,
    progress,
    target,
    progressPct: pct,
    rewardDescription: nextTier.reward?.description || "No reward",
    isComplete: progress >= target,
  };
}

export function getPrestigeGainFromTotalBananas(totalBananasEarned) {
  const safeTotal = Math.max(0, Number(totalBananasEarned) || 0);
  const scaledLog = Math.log10(safeTotal + 1);
  return Math.max(0, Math.floor((scaledLog - 5) * 5));
}

export function getPrestigeGainPreview() {
  return getPrestigeGainFromTotalBananas(gameState.totalBananasEarned);
}

export function getPrestigeBonuses() {
  const pip = Math.max(0, Number(gameState.pip) || 0);
  return {
    productionMultiplier: 1 + pip * 0.02,
    exportPriceMultiplier: 1 + pip * 0.015,
    clickMultiplier: 1 + pip * 0.01,
  };
}

export function isPrestigeUnlocked() {
  return gameState.treeTierIndex >= PRESTIGE_UNLOCK_TIER_INDEX || gameState.totalBananasEarned >= PRESTIGE_UNLOCK_TOTAL_BANANAS;
}

function refreshMilestones() {
  const reached = new Set(gameState.reachedMilestoneIds);
  const unlockedBuyers = new Set(gameState.milestoneUnlockedBuyerIds);
  const unlockedUpgrades = new Set(gameState.milestoneUnlockedUpgradeIds);
  let maxTierTransition = 0;

  milestones.forEach((milestone) => {
    if (gameState.totalBananasEarned >= milestone.requiredTotalBananasEarned) {
      reached.add(milestone.id);
      milestone.unlockBuyerIds.forEach((buyerId) => unlockedBuyers.add(buyerId));
      milestone.unlockUpgradeIds.forEach((upgradeId) => unlockedUpgrades.add(upgradeId));
      maxTierTransition = Math.max(maxTierTransition, milestone.maxTreeTierTransitionIndex);
    }
  });

  gameState.reachedMilestoneIds = Array.from(reached).filter((milestoneId) => milestoneById.has(milestoneId));
  gameState.milestoneUnlockedBuyerIds = Array.from(unlockedBuyers).filter((buyerId) => buyerById.has(buyerId));
  gameState.milestoneUnlockedUpgradeIds = Array.from(unlockedUpgrades).filter((upgradeId) => upgradeById.has(upgradeId));
  gameState.maxUnlockedTreeTierTransitionIndex = Math.min(treeTiers.length - 1, maxTierTransition);
}

function refreshUnlockedBuyers() {
  const unlockedSet = new Set(gameState.unlockedBuyerIds);

  buyers.forEach((buyer) => {
    if (isRequirementMet(buyer.unlockRequirement)) {
      unlockedSet.add(buyer.id);
    }
  });

  gameState.milestoneUnlockedBuyerIds.forEach((buyerId) => unlockedSet.add(buyerId));
  gameState.unlockedEvolutionRewardBuyerIds.forEach((buyerId) => unlockedSet.add(buyerId));
  gameState.unlockedBuyerIds = Array.from(unlockedSet).filter((buyerId) => buyerById.has(buyerId));
}

function pruneExpiredCooldowns() {
  const now = Date.now();
  for (const [buyerId, cooldownEndMs] of Object.entries(gameState.buyerCooldowns)) {
    if (cooldownEndMs <= now) {
      delete gameState.buyerCooldowns[buyerId];
    }
  }
}

function notifyListeners() {
  refreshMilestones();
  refreshUnlockedBuyers();
  refreshShippingLaneUnlocks();
  refreshUnlockedResearchNodes();
  updateCeoEmails(Date.now());
  const unlockedNewAchievements = refreshAchievements();
  if (unlockedNewAchievements) {
    recomputeDerivedStats();
  }
  pruneExpiredCooldowns();
  updateContracts();
  listeners.forEach((listener) => listener(gameState));
}

function getUnlockedBananaTypesInternal() {
  return bananaTypes;
}

function getHighestUnlockedBananaTypeId() {
  return "standard";
}

function syncTotalBananasFromInventory() {
  gameState.bananas = clampNonNegative(Number(gameState.bananas) || 0);
  gameState.bananaInventory.standard = gameState.bananas;
}

function addBananasToType(typeId, amount) {
  const safeAmount = clampNonNegative(Number(amount) || 0);
  if (safeAmount <= 0) {
    return;
  }

  gameState.bananas = addStable(gameState.bananas, safeAmount);
  gameState.bananaInventory.standard = gameState.bananas;
  gameState.totalBananasEarned = addStable(gameState.totalBananasEarned, safeAmount);
}

function removeBananasFromType(typeId, amount) {
  const safeAmount = clampNonNegative(Number(amount) || 0);
  if (safeAmount <= 0) {
    return 0;
  }

  const available = clampNonNegative(gameState.bananas || 0);
  const used = Math.min(available, safeAmount);
  gameState.bananas = stabilizeNumber(available - used);
  gameState.bananaInventory.standard = gameState.bananas;
  return used;
}

function removeBananasAny(amount) {
  let remaining = clampNonNegative(Number(amount) || 0);
  if (remaining <= 0) {
    return 0;
  }

  const used = removeBananasFromType("standard", remaining);
  remaining = stabilizeNumber(remaining - used);

  return stabilizeNumber((Number(amount) || 0) - remaining);
}

function addBananas(amount, typeId = null) {
  const safeAmount = clampNonNegative(Number(amount) || 0);
  if (safeAmount <= 0) {
    return;
  }

  addBananasToType("standard", safeAmount);
}

function removeBananas(amount) {
  removeBananasAny(amount);
}

function getWeirdScienceResourceValue(resourceKey) {
  if (resourceKey === "bananas") {
    return clampNonNegative(Number(gameState.bananas) || 0);
  }

  return clampNonNegative(Number(gameState[resourceKey]) || 0);
}

function addWeirdScienceResourceValue(resourceKey, amount) {
  const safeAmount = clampNonNegative(Number(amount) || 0);
  if (safeAmount <= 0) {
    return;
  }

  if (resourceKey === "bananas") {
    addBananas(safeAmount, "antimatter");
    return;
  }

  gameState[resourceKey] = addStable(getWeirdScienceResourceValue(resourceKey), safeAmount);
}

function removeWeirdScienceResourceValue(resourceKey, amount) {
  const safeAmount = clampNonNegative(Number(amount) || 0);
  if (safeAmount <= 0) {
    return 0;
  }

  if (resourceKey === "bananas") {
    return removeBananasAny(safeAmount);
  }

  const available = getWeirdScienceResourceValue(resourceKey);
  const used = Math.min(available, safeAmount);
  gameState[resourceKey] = stabilizeNumber(available - used);
  return used;
}

function addCash(amount) {
  gameState.cash = addStable(gameState.cash, amount);
  gameState.totalCashEarned = addStable(gameState.totalCashEarned, amount);
}

function removeCash(amount) {
  gameState.cash = clampNonNegative(addStable(gameState.cash, -amount));
}

function performAutoSell() {
  if (!gameState.autoSellEnabled) {
    return 0;
  }

  const threshold = Math.floor(clampNonNegative(gameState.autoSellThreshold));
  const excess = Math.floor(gameState.bananas - threshold);
  if (excess <= 0) {
    return 0;
  }

  removeBananas(excess);
  addCash(excess * AUTO_SELL_PRICE_PER_BANANA);
  return excess;
}

function getEstimatedAutoBananasPerSecond() {
  const snapshot = treeHarvestSystem.getSnapshot();
  const spawnInterval = Math.max(0.001, Number(snapshot.spawnInterval) || 1.5);
  const spawnRatePerSecond = 1 / spawnInterval;

  const clickYield = Math.max(1, Number(snapshot.clickHarvestYield) || 1);
  const goldenChance = Math.max(0, Math.min(0.95, Number(snapshot.goldenChance) || 0));
  const goldenMultiplier = Math.max(1, Number(snapshot.goldenMultiplier) || 1);
  const diamondChance = Math.max(0, Math.min(0.2, Number(snapshot.diamondChance) || 0));
  const diamondMultiplier = Math.max(1, Number(snapshot.diamondMultiplier) || 1);
  const expectedYieldPerPick =
    clickYield * (1 + goldenChance * (goldenMultiplier - 1) + diamondChance * (diamondMultiplier - 1));

  const tierHarvest = treeTiers[gameState.treeTierIndex]?.harvest || {};
  const tierWorkerPickMultiplier = Math.max(0.1, Number(tierHarvest.workerPickMultiplier) || 1);
  const baseWorkerPickRatePerSecond = gameState.workersOwned * (Math.max(0, Number(gameState.bananasPerWorkerPerSecond) || 0) / clickYield);
  // Keep in sync with TreeHarvestSystem's worker cap so the HUD estimate matches reality.
  const workerPickRatePerSecondRaw = baseWorkerPickRatePerSecond * tierWorkerPickMultiplier * getTreeHarvestModifiers().workerPickMultiplier;
  const workerPickRatePerSecond = Math.min(workerPickRatePerSecondRaw, spawnRatePerSecond * 0.8);

  const monkeyPickRatePerSecond = snapshot.monkeyPickerInterval > 0 ? 1 / Math.max(0.05, Number(snapshot.monkeyPickerInterval)) : 0;
  const orchardPickRatePerSecond = getOrchardPickRatePerSecond();
  const totalAutoPicksPerSecond = Math.max(0, workerPickRatePerSecond + monkeyPickRatePerSecond + orchardPickRatePerSecond);

  const effectiveAutoPicksPerSecond = Math.min(spawnRatePerSecond, totalAutoPicksPerSecond);
  return stabilizeNumber(effectiveAutoPicksPerSecond * expectedYieldPerPick);
}

function processWeirdScienceConverters(elapsedSeconds) {
  const seconds = clampNonNegative(Number(elapsedSeconds) || 0);
  if (seconds <= 0) {
    return;
  }

  Object.values(WEIRD_SCIENCE_CONVERTERS).forEach((converter) => {
    const level = getConverterLevel(converter.id);
    if (level <= 0 || !isRequirementMet(converter.unlockRequirement)) {
      return;
    }

    const desiredInput = converter.inputPerSecond * level * seconds;
    if (desiredInput <= 0) {
      return;
    }

    const usedInput = removeWeirdScienceResourceValue(converter.inputResource, desiredInput);
    if (usedInput <= 0) {
      return;
    }

    const outputGain = (usedInput / converter.inputPerSecond) * converter.outputPerSecond;
    addWeirdScienceResourceValue(converter.outputResource, outputGain);
  });
}

export function getProductionBreakdown() {
  const treePerSec = 0;
  const workerPerSec = stabilizeNumber(gameState.workersOwned * gameState.bananasPerWorkerPerSecond);
  const autoPerSecEstimated = getEstimatedAutoBananasPerSecond();

  return {
    treePerSec,
    workerPerSec,
    totalPerSec: autoPerSecEstimated,
    autoPerSecEstimated,
    productionMultiplier: stabilizeNumber(gameState.productionMultiplier),
    exportPriceMultiplier: stabilizeNumber(gameState.exportPriceMultiplier),
    antimatterExportMultiplier: getAntimatterExportBoostMultiplier(),
    researchDiscountMultiplier: stabilizeNumber(getResearchDiscountMultiplier()),
  };
}

export function getUnlockedBananaTypes() {
  return getUnlockedBananaTypesInternal();
}

export function getResearchTreeNodes() {
  return upgrades;
}

export function getAchievementsStatus() {
  return achievements.map((achievement) => {
    const target = Math.max(1, Number(achievement.condition?.target) || 1);
    const current = Math.min(target, getAchievementConditionValue(achievement.condition));
    const unlocked = gameState.unlockedAchievementIds.includes(achievement.id);
    return {
      ...achievement,
      unlocked,
      progress: current,
      target,
      progressPct: clamp(current / target, 0, 1),
    };
  });
}

export function getCeoEmails() {
  return [...gameState.ceoEmails].sort((a, b) => (b.receivedAt || 0) - (a.receivedAt || 0));
}

export function getBananaInventory() {
  return { standard: clampNonNegative(gameState.bananas) };
}

export function getTreeHarvestSnapshot() {
  return treeHarvestSystem.getSnapshot();
}

export function clickTreeBanana(bananaId, context = {}) {
  const result = treeHarvestSystem.clickBanana(bananaId, context);
  if (!result) {
    return null;
  }
  gameState.totalClicks += 1;
  gameState.tree = treeHarvestSystem.serialize();
  notifyListeners();
  return result;
}

export function shakeTreeHarvest() {
  const result = treeHarvestSystem.shakeTree();
  if (!result.success) {
    return result;
  }
  gameState.tree = treeHarvestSystem.serialize();
  notifyListeners();
  return result;
}

export function getTreeHarvestUpgradesStatus() {
  return TREE_HARVEST_UPGRADES.map((upgrade) => {
    const purchased = gameState.purchasedTreeHarvestUpgradeIds.includes(upgrade.id);
    const requires = Array.isArray(upgrade.requires) ? upgrade.requires : [];
    const requirementsMet = requires.every((requiredId) => gameState.purchasedTreeHarvestUpgradeIds.includes(requiredId));
    return {
      ...upgrade,
      purchased,
      unlocked: requirementsMet,
      canAfford: gameState.cash >= upgrade.costCash,
    };
  });
}

export function purchaseTreeHarvestUpgrade(upgradeId) {
  const upgrade = treeHarvestUpgradeById.get(upgradeId);
  if (!upgrade) {
    return false;
  }
  if (gameState.purchasedTreeHarvestUpgradeIds.includes(upgradeId)) {
    return false;
  }
  const requires = Array.isArray(upgrade.requires) ? upgrade.requires : [];
  const requirementsMet = requires.every((requiredId) => gameState.purchasedTreeHarvestUpgradeIds.includes(requiredId));
  if (!requirementsMet || gameState.cash < upgrade.costCash) {
    return false;
  }
  removeCash(upgrade.costCash);
  gameState.purchasedTreeHarvestUpgradeIds = [...gameState.purchasedTreeHarvestUpgradeIds, upgradeId];
  recomputeDerivedStats();
  notifyListeners();
  return true;
}

export function setProductionMode(mode) {
  gameState.productionMode = "highest";
  notifyListeners();
}

export function getTotalBananasPerSecond() {
  return getProductionBreakdown().autoPerSecEstimated;
}

export function getWorkerCost() {
  const cost = gameState.workerBaseCost * gameState.workerCostGrowth ** gameState.workersOwned;
  return stabilizeNumber(cost);
}

export function hireWorker() {
  const cost = getWorkerCost();
  if (gameState.cash < cost) {
    return false;
  }

  removeCash(cost);
  gameState.workersOwned = Math.floor(gameState.workersOwned + 1);
  notifyListeners();
  return true;
}

export function getBuildingCost(buildingType) {
  const config = BUILDING_TYPES[buildingType];
  if (!config) {
    return 0;
  }

  const level = getBuildingLevel(buildingType);
  const cost = config.baseCost * config.growth ** level;
  return stabilizeNumber(cost);
}

export function buyBuilding(buildingType) {
  const config = BUILDING_TYPES[buildingType];
  if (!config) {
    return false;
  }

  const cost = getBuildingCost(buildingType);
  if (gameState.cash < cost) {
    return false;
  }

  removeCash(cost);
  gameState[config.stateKey] = getBuildingLevel(buildingType) + 1;
  recomputeDerivedStats();
  notifyListeners();
  return true;
}

export function getWeirdScienceConverterCost(converterId) {
  const converter = WEIRD_SCIENCE_CONVERTERS[converterId];
  if (!converter) {
    return 0;
  }

  const level = getConverterLevel(converterId);
  return stabilizeNumber(converter.baseCost * converter.growth ** level);
}

export function buyWeirdScienceConverter(converterId) {
  const converter = WEIRD_SCIENCE_CONVERTERS[converterId];
  if (!converter || !isRequirementMet(converter.unlockRequirement)) {
    return false;
  }

  const cost = getWeirdScienceConverterCost(converterId);
  if (gameState.cash < cost) {
    return false;
  }

  removeCash(cost);
  gameState[converter.stateKey] = getConverterLevel(converterId) + 1;
  notifyListeners();
  return true;
}

export function getWeirdScienceStatus() {
  const resources = {
    bananaMatter: clampNonNegative(Number(gameState.bananaMatter) || 0),
    exoticPeelParticles: clampNonNegative(Number(gameState.exoticPeelParticles) || 0),
    antimatterBananas: clampNonNegative(Number(gameState.antimatterBananas) || 0),
  };

  const converters = Object.values(WEIRD_SCIENCE_CONVERTERS).map((converter) => {
    const level = getConverterLevel(converter.id);
    const unlocked = isRequirementMet(converter.unlockRequirement);
    const cost = getWeirdScienceConverterCost(converter.id);
    return {
      id: converter.id,
      name: converter.name,
      level,
      unlocked,
      cost,
      inputResource: converter.inputResource,
      outputResource: converter.outputResource,
      inputPerSecond: stabilizeNumber(converter.inputPerSecond * level),
      outputPerSecond: stabilizeNumber(converter.outputPerSecond * level),
    };
  });

  return {
    resources,
    converters,
    antimatterExportMultiplier: getAntimatterExportBoostMultiplier(),
  };
}

export function setAutoSellEnabled(enabled) {
  gameState.autoSellEnabled = Boolean(enabled);
  notifyListeners();
}

export function setAutoSellThreshold(threshold) {
  gameState.autoSellThreshold = Math.max(0, Math.floor(Number(threshold) || 0));
  notifyListeners();
}

export function isUpgradeUnlocked(upgradeId) {
  const upgrade = upgradeById.get(upgradeId);
  if (!upgrade) {
    return false;
  }

  if (!gameState.unlockedUpgradeCategories.includes(upgrade.group)) {
    return false;
  }

  const requirementUnlocked = gameState.unlockedResearchNodeIds.includes(upgradeId) || gameState.milestoneUnlockedUpgradeIds.includes(upgradeId) || isRequirementMet(upgrade.unlockCondition);
  return requirementUnlocked && hasResearchPrerequisites(upgrade);
}

export function isUpgradePurchased(upgradeId) {
  return gameState.purchasedUpgradeIds.includes(upgradeId);
}

export function getEffectiveUpgradeCost(upgradeIdOrObject) {
  const upgrade = typeof upgradeIdOrObject === "string" ? upgradeById.get(upgradeIdOrObject) : upgradeIdOrObject;
  if (!upgrade) {
    return { cash: 0, researchPoints: 0 };
  }

  return {
    cash: stabilizeNumber((upgrade.costCash || 0) * getResearchDiscountMultiplier()),
    researchPoints: stabilizeNumber(upgrade.costResearchPoints || 0),
  };
}

export function purchaseUpgrade(upgradeId) {
  const upgrade = upgradeById.get(upgradeId);
  const cost = getEffectiveUpgradeCost(upgrade);
  if (!upgrade || isUpgradePurchased(upgradeId) || !isUpgradeUnlocked(upgradeId) || gameState.cash < cost.cash || gameState.researchPoints < cost.researchPoints) {
    return false;
  }

  removeCash(cost.cash);
  gameState.researchPoints = clampNonNegative(stabilizeNumber(gameState.researchPoints - cost.researchPoints));
  gameState.purchasedUpgradeIds = [...gameState.purchasedUpgradeIds, upgradeId];
  recomputeDerivedStats();
  notifyListeners();
  return true;
}

export function applyLoadedState(loadedState = {}) {
  const migratedState = migrateLoadedState(loadedState);
  Object.assign(gameState, DEFAULT_STATE, migratedState);
  gameState.schemaVersion = GAME_STATE_SCHEMA_VERSION;

  gameState.bananas = clampNonNegative(Number(gameState.bananas) || 0);
  gameState.bananaInventory = sanitizeBananaInventory(gameState.bananaInventory);
  if (gameState.bananas > 0 && gameState.bananaInventory.standard === 0) {
    // Backward compatibility for saves before per-type inventory existed.
    gameState.bananaInventory.standard = gameState.bananas;
  }
  gameState.productionMode = "highest";
  gameState.tree = gameState.tree && typeof gameState.tree === "object" ? gameState.tree : getDefaultTreeState();
  gameState.cash = clampNonNegative(Number(gameState.cash) || 0);
  gameState.treesOwned = clampNonNegative(Number(gameState.treesOwned) || 0);
  gameState.workersOwned = clampNonNegative(Math.floor(Number(gameState.workersOwned) || 0));

  const maxTierIndex = treeTiers.length - 1;
  const requestedTier = Math.floor(Number(gameState.treeTierIndex) || 0);
  gameState.treeTierIndex = Math.max(0, Math.min(maxTierIndex, requestedTier));

  gameState.treeBaseCost = Math.max(1, Number(gameState.treeBaseCost) || DEFAULT_STATE.treeBaseCost);
  gameState.treeCostGrowth = Math.max(1, Number(gameState.treeCostGrowth) || TREE_COST_GROWTH);
  gameState.workerBaseCost = Math.max(1, Number(gameState.workerBaseCost) || DEFAULT_STATE.workerBaseCost);
  gameState.workerCostGrowth = Math.max(1, Number(gameState.workerCostGrowth) || WORKER_COST_GROWTH);
  gameState.workersBasePerSecond = Math.max(0.01, Number(gameState.workersBasePerSecond) || DEFAULT_STATE.workersBasePerSecond);
  gameState.bananasPerWorkerPerSecond = Math.max(0.05, Number(gameState.bananasPerWorkerPerSecond) || DEFAULT_STATE.bananasPerWorkerPerSecond);
  gameState.totalBananasEarned = clampNonNegative(Number(gameState.totalBananasEarned) || 0);
  gameState.totalCashEarned = clampNonNegative(Number(gameState.totalCashEarned) || 0);
  gameState.totalClicks = clampNonNegative(Math.floor(Number(gameState.totalClicks) || 0));
  gameState.totalShipments = clampNonNegative(Math.floor(Number(gameState.totalShipments) || 0));
  gameState.contractsCompleted = clampNonNegative(Math.floor(Number(gameState.contractsCompleted) || 0));
  gameState.pip = clampNonNegative(Math.floor(Number(gameState.pip) || 0));
  gameState.prestigeCount = clampNonNegative(Math.floor(Number(gameState.prestigeCount) || 0));

  gameState.evolutionProductionMultiplier = Math.max(1, Number(gameState.evolutionProductionMultiplier) || 1);
  gameState.packingShedLevel = clampNonNegative(Math.floor(Number(gameState.packingShedLevel) || 0));
  gameState.fertilizerLabLevel = clampNonNegative(Math.floor(Number(gameState.fertilizerLabLevel) || 0));
  gameState.researchHutLevel = clampNonNegative(Math.floor(Number(gameState.researchHutLevel) || 0));
  gameState.researchPoints = clampNonNegative(Number(gameState.researchPoints) || 0);
  gameState.bananaMatter = clampNonNegative(Number(gameState.bananaMatter) || 0);
  gameState.exoticPeelParticles = clampNonNegative(Number(gameState.exoticPeelParticles) || 0);
  gameState.antimatterBananas = clampNonNegative(Number(gameState.antimatterBananas) || 0);
  gameState.quantumReactorLevel = clampNonNegative(Math.floor(Number(gameState.quantumReactorLevel) || 0));
  gameState.colliderLevel = clampNonNegative(Math.floor(Number(gameState.colliderLevel) || 0));
  gameState.containmentLevel = clampNonNegative(Math.floor(Number(gameState.containmentLevel) || 0));
  gameState.autoSellEnabled = Boolean(gameState.autoSellEnabled);
  gameState.autoSellThreshold = clampNonNegative(Math.floor(Number(gameState.autoSellThreshold) || 0));

  gameState.unlockedBuyerIds = sanitizeIds(gameState.unlockedBuyerIds, buyerById);
  gameState.purchasedUpgradeIds = sanitizeIds(gameState.purchasedUpgradeIds, upgradeById);
  gameState.purchasedTreeHarvestUpgradeIds = sanitizeTreeHarvestUpgradeIds(gameState.purchasedTreeHarvestUpgradeIds);
  gameState.unlockedResearchNodeIds = sanitizeIds(gameState.unlockedResearchNodeIds, upgradeById);
  gameState.unlockedAchievementIds = sanitizeIds(gameState.unlockedAchievementIds, achievementById);
  gameState.reachedMilestoneIds = sanitizeIds(gameState.reachedMilestoneIds, milestoneById);
  gameState.milestoneUnlockedBuyerIds = sanitizeIds(gameState.milestoneUnlockedBuyerIds, buyerById);
  gameState.milestoneUnlockedUpgradeIds = sanitizeIds(gameState.milestoneUnlockedUpgradeIds, upgradeById);
  gameState.unlockedEvolutionRewardBuyerIds = sanitizeIds(gameState.unlockedEvolutionRewardBuyerIds, buyerById);
  gameState.unlockedUpgradeCategories = sanitizeUpgradeCategories(gameState.unlockedUpgradeCategories);
  gameState.lifetimeBuyerShipmentTotals = sanitizeShipmentTotals(gameState.lifetimeBuyerShipmentTotals);
  gameState.buyerReputation = sanitizeBuyerReputation(gameState.buyerReputation);
  gameState.unlockedShippingLaneIds = sanitizeShippingLanes(gameState.unlockedShippingLaneIds);
  gameState.selectedShippingLaneId = laneById.has(gameState.selectedShippingLaneId) ? gameState.selectedShippingLaneId : "local";
  gameState.activeContracts = sanitizeContracts(gameState.activeContracts);
  gameState.nextContractId = Math.max(1, Math.floor(Number(gameState.nextContractId) || 1));
  gameState.lastContractGenerationTime = Number(gameState.lastContractGenerationTime) || Date.now();
  gameState.activeTimedEventId = timedEvents[gameState.activeTimedEventId] ? gameState.activeTimedEventId : null;
  gameState.activeTimedEventEndTimestamp = Number(gameState.activeTimedEventEndTimestamp) || 0;
  gameState.nextEventRollTimestamp = Number(gameState.nextEventRollTimestamp) || 0;
  gameState.lastEventMessage = typeof gameState.lastEventMessage === "string" ? gameState.lastEventMessage : "";
  gameState.ceoEmails = sanitizeCeoEmailEntries(gameState.ceoEmails);
  gameState.sentCeoEmailIds = Array.from(new Set(Array.isArray(gameState.sentCeoEmailIds) ? gameState.sentCeoEmailIds.map((id) => String(id)) : []));
  gameState.nextCeoEmailRollTimestamp = Number(gameState.nextCeoEmailRollTimestamp) || (Date.now() + getRandomCeoEmailDelayMs());
  gameState.rareItems = Array.isArray(gameState.rareItems) ? gameState.rareItems.filter((item) => typeof item === "string") : [];
  gameState.buyerCooldowns = sanitizeBuyerCooldowns(gameState.buyerCooldowns);

  gameState.lastTickTime = Date.now();
  gameState.lastSaveTimestamp = Number(gameState.lastSaveTimestamp) || Date.now();

  if (gameState.activeTimedEventId && gameState.activeTimedEventEndTimestamp > 0 && Date.now() >= gameState.activeTimedEventEndTimestamp) {
    gameState.activeTimedEventId = null;
    gameState.activeTimedEventEndTimestamp = 0;
  }
  if (!gameState.activeTimedEventId && !gameState.nextEventRollTimestamp) {
    scheduleNextEventRoll(Date.now());
  }

  rebuildEvolutionRewardsFromTier();
  refreshMilestones();
  refreshShippingLaneUnlocks();
  updateContracts();
  treeHarvestSystem.deserialize(gameState.tree);
  recomputeDerivedStats();
  syncTotalBananasFromInventory();
  assertFiniteCoreState("applyLoadedState");
  logEconomyDebug("after-applyLoadedState", {
    schemaVersion: gameState.schemaVersion,
    workersBasePerSecond: gameState.workersBasePerSecond,
    bananasPerWorkerPerSecond: gameState.bananasPerWorkerPerSecond,
    lastSaveTimestamp: gameState.lastSaveTimestamp,
  });
  firstTickAfterLoadPending = true;
  lastLoggedBananasForDebug = gameState.bananas;
  notifyListeners();
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(gameState);

  return () => {
    listeners.delete(listener);
  };
}

function addPassiveBananas(elapsedSeconds) {
  if (elapsedSeconds <= 0) {
    return 0;
  }

  // Passive banana income is intentionally negligible; income comes from clicks + harvesting bananas on tree.
  return 0;
}

function addPassiveResearchPoints(elapsedSeconds) {
  if (elapsedSeconds <= 0) {
    return 0;
  }

  const gain = getResearchPointsPerSecond() * elapsedSeconds;
  if (gain <= 0) {
    return 0;
  }

  gameState.researchPoints = addStable(gameState.researchPoints, gain);
  return gain;
}

export function applyOfflineProgress(elapsedSeconds) {
  const safeElapsedSeconds = Number(elapsedSeconds);
  if (!Number.isFinite(safeElapsedSeconds) || safeElapsedSeconds < 0) {
    console.error("[EconomyGuard] Invalid offline elapsed seconds. Skipping offline progress.", { elapsedSeconds });
    return 0;
  }

  logEconomyDebug("offline-before", {
    elapsedSeconds: safeElapsedSeconds,
    bananas: gameState.bananas,
    bananasPerWorkerPerSecond: gameState.bananasPerWorkerPerSecond,
    workersOwned: gameState.workersOwned,
  });
  updateTimedEvents(Date.now());
  const earned = addPassiveBananas(safeElapsedSeconds);
  addPassiveResearchPoints(safeElapsedSeconds);
  const tierHarvest = treeTiers[gameState.treeTierIndex]?.harvest || {};
  const tierWorkerPickMultiplier = Math.max(0.1, Number(tierHarvest.workerPickMultiplier) || 1);
  const treeClickYield = Math.max(1, Number(gameState.tree?.clickHarvestYield) || 1);
  const baseWorkerPickRatePerSecond = gameState.workersOwned * (Math.max(0, Number(gameState.bananasPerWorkerPerSecond) || 0) / treeClickYield);
  const workerPickRatePerSecond = baseWorkerPickRatePerSecond * tierWorkerPickMultiplier * getTreeHarvestModifiers().workerPickMultiplier;
  const orchardPickRatePerSecond = getOrchardPickRatePerSecond();
  treeHarvestSystem.update(safeElapsedSeconds, { workerPickRatePerSecond, orchardPickRatePerSecond, simulateOffline: true });
  gameState.tree = treeHarvestSystem.serialize();
  processWeirdScienceConverters(safeElapsedSeconds);
  gameState.lastTickTime = Date.now();
  performAutoSell();
  assertFiniteCoreState("applyOfflineProgress");
  logEconomyDebug("offline-after", {
    earned,
    bananas: gameState.bananas,
    bananasPerWorkerPerSecond: gameState.bananasPerWorkerPerSecond,
  });
  notifyListeners();
  return earned;
}

export function tick() {
  const tickStart = typeof performance !== "undefined" ? performance.now() : Date.now();
  const now = Date.now();
  const elapsedMs = now - gameState.lastTickTime;
  let elapsedSeconds = elapsedMs / 1000;
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    console.error("[EconomyGuard] Invalid tick delta detected. Resetting elapsedSeconds to 0.", {
      elapsedMs,
      lastTickTime: gameState.lastTickTime,
      now,
    });
    elapsedSeconds = 0;
  }
  gameState.lastTickTime = now;

  const bananasBeforeTick = gameState.bananas;
  updateTimedEvents(now);
  recomputeDerivedStats();
  addPassiveBananas(elapsedSeconds);
  addPassiveResearchPoints(elapsedSeconds);
  const tierHarvest = treeTiers[gameState.treeTierIndex]?.harvest || {};
  const tierWorkerPickMultiplier = Math.max(0.1, Number(tierHarvest.workerPickMultiplier) || 1);
  const treeClickYield = Math.max(1, Number(gameState.tree?.clickHarvestYield) || 1);
  const baseWorkerPickRatePerSecond = gameState.workersOwned * (Math.max(0, Number(gameState.bananasPerWorkerPerSecond) || 0) / treeClickYield);
  const workerPickRatePerSecond = baseWorkerPickRatePerSecond * tierWorkerPickMultiplier * getTreeHarvestModifiers().workerPickMultiplier;
  const orchardPickRatePerSecond = getOrchardPickRatePerSecond();
  treeHarvestSystem.update(elapsedSeconds, { workerPickRatePerSecond, orchardPickRatePerSecond });
  gameState.tree = treeHarvestSystem.serialize();
  processWeirdScienceConverters(elapsedSeconds);
  performAutoSell();
  assertFiniteCoreState("tick");
  const tickEnd = typeof performance !== "undefined" ? performance.now() : Date.now();
  gameState.lastTickDurationMs = stabilizeNumber(tickEnd - tickStart, 3);
  if (firstTickAfterLoadPending) {
    logEconomyDebug("first-tick-after-load", {
      elapsedMs,
      elapsedSeconds,
      bananasDelta: stabilizeNumber(gameState.bananas - bananasBeforeTick),
      bananasPerWorkerPerSecond: gameState.bananasPerWorkerPerSecond,
      workersOwned: gameState.workersOwned,
    });
    firstTickAfterLoadPending = false;
  } else if (isEconomyDebugEnabled()) {
    const delta = stabilizeNumber(gameState.bananas - lastLoggedBananasForDebug);
    if (Math.abs(delta) > 0) {
      logEconomyDebug("tick-delta", {
        elapsedSeconds,
        bananasDelta: delta,
        bananasPerWorkerPerSecond: gameState.bananasPerWorkerPerSecond,
      });
    }
  }
  lastLoggedBananasForDebug = gameState.bananas;
  notifyListeners();
}

export function startTickLoop() {
  if (tickTimer) {
    return;
  }

  gameState.lastTickTime = Date.now();
  firstTickAfterLoadPending = true;
  lastLoggedBananasForDebug = gameState.bananas;
  tickTimer = window.setInterval(tick, TICK_INTERVAL_MS);
}

export function stopTickLoop() {
  if (!tickTimer) {
    return;
  }

  window.clearInterval(tickTimer);
  tickTimer = null;
}

export function __testElapsedSeconds(lastTickTimeMs, nowMs = Date.now()) {
  const elapsedSeconds = (Number(nowMs) - Number(lastTickTimeMs)) / 1000;
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    return 0;
  }
  return elapsedSeconds;
}

export function __testOfflineBananaGain(input = {}) {
  const treesOwned = Math.max(0, Number(input.treesOwned) || 0);
  const bananasPerTreePerSecond = Math.max(0, Number(input.bananasPerTreePerSecond) || 0);
  const workersOwned = Math.max(0, Number(input.workersOwned) || 0);
  const bananasPerWorkerPerSecond = Math.max(0, Number(input.bananasPerWorkerPerSecond) || 0);
  const elapsedSeconds = Math.max(0, Number(input.elapsedSeconds) || 0);
  return stabilizeNumber((treesOwned * bananasPerTreePerSecond + workersOwned * bananasPerWorkerPerSecond) * elapsedSeconds);
}

export function getMarketPricePerBanana(bananaTypeId = null) {
  const tierValueMultipliers = [1, 1.15, 1.35, 1.65, 2.05, 2.6, 3.4];
  const tierIndex = Math.max(0, Math.min(tierValueMultipliers.length - 1, Math.floor(Number(gameState.treeTierIndex) || 0)));
  const valueMultiplier = tierValueMultipliers[tierIndex] || 1;
  return stabilizeNumber(MARKET_PRICE_PER_BANANA * valueMultiplier);
}

export function getAutoSellPricePerBanana() {
  return AUTO_SELL_PRICE_PER_BANANA;
}

export function pickBananaClick() {
  gameState.totalClicks += 1;
  addBananas(gameState.clickYield);
  notifyListeners();
}

export function sellBananas(amount, bananaTypeId = null) {
  const safeAmount = Math.floor(clampNonNegative(Number(amount) || 0));
  if (safeAmount === 0) {
    return false;
  }

  if (gameState.bananas < safeAmount) {
    return false;
  }

  const revenue = safeAmount * getMarketPricePerBanana();
  removeBananas(safeAmount);
  addCash(revenue);
  notifyListeners();
  return true;
}

export function getCurrentTreeTier() {
  return treeTiers[gameState.treeTierIndex];
}

export function getNextTreeTier() {
  return treeTiers[gameState.treeTierIndex + 1] || null;
}

export function getTreeCost() {
  const cost = gameState.treeBaseCost * gameState.treeCostGrowth ** gameState.treesOwned;
  return stabilizeNumber(cost);
}

function getOrchardUnlockMilestone() {
  return milestoneById.get(ORCHARD_UNLOCK_MILESTONE_ID) || milestones.find((milestone) => milestone.id === ORCHARD_UNLOCK_MILESTONE_ID) || null;
}

export function isOrchardUnlocked() {
  const milestone = getOrchardUnlockMilestone();
  const required = Number(milestone?.requiredTotalBananasEarned) || 0;
  return gameState.totalBananasEarned >= required;
}

export function getOrchardCost() {
  const owned = Math.max(0, Math.floor(Number(gameState.orchardsOwned) || 0));
  const base = Math.max(0, Number(gameState.orchardBaseCost) || DEFAULT_STATE.orchardBaseCost);
  const growth = Math.max(1.01, Number(gameState.orchardCostGrowth) || DEFAULT_STATE.orchardCostGrowth);
  return stabilizeNumber(base * growth ** owned);
}

export function getOrchardPickRatePerSecond() {
  if (!isOrchardUnlocked()) {
    return 0;
  }
  const owned = Math.max(0, Math.floor(Number(gameState.orchardsOwned) || 0));
  const per = Math.max(0, Number(gameState.orchardPickRatePerSecondPerOrchard) || DEFAULT_STATE.orchardPickRatePerSecondPerOrchard);
  return stabilizeNumber(owned * per);
}

export function buyOrchard() {
  const milestone = getOrchardUnlockMilestone();
  const requiredBananas = Number(milestone?.requiredTotalBananasEarned) || 0;
  if (gameState.totalBananasEarned < requiredBananas) {
    return false;
  }
  if (gameState.cash < ORCHARD_UNLOCK_CASH_REQUIREMENT) {
    return false;
  }

  const cost = getOrchardCost();
  if (gameState.cash < cost) {
    return false;
  }

  removeCash(cost);
  gameState.orchardsOwned = Math.floor((Number(gameState.orchardsOwned) || 0) + 1);
  recomputeDerivedStats();
  notifyListeners();
  return true;
}

export function getOrchardStatus() {
  const milestone = getOrchardUnlockMilestone();
  const requiredBananas = Number(milestone?.requiredTotalBananasEarned) || 0;
  const milestoneMet = gameState.totalBananasEarned >= requiredBananas;
  const cashGateMet = gameState.cash >= ORCHARD_UNLOCK_CASH_REQUIREMENT;
  const unlocked = milestoneMet;
  const pickRatePerSecond = getOrchardPickRatePerSecond();
  return {
    unlocked,
    milestoneId: milestone?.id || ORCHARD_UNLOCK_MILESTONE_ID,
    requiredTotalBananasEarned: requiredBananas,
    cashGate: ORCHARD_UNLOCK_CASH_REQUIREMENT,
    milestoneMet,
    cashGateMet,
    orchardsOwned: Math.max(0, Math.floor(Number(gameState.orchardsOwned) || 0)),
    cost: getOrchardCost(),
    pickRatePerSecond,
  };
}

export function buyTree() {
  const treeCost = getTreeCost();
  if (gameState.cash < treeCost) {
    return false;
  }

  removeCash(treeCost);
  gameState.treesOwned = Math.floor(gameState.treesOwned + 1);
  recomputeDerivedStats();
  notifyListeners();
  return true;
}

export function unlockNextTreeTier() {
  const nextTier = getNextTreeTier();
  const nextTierIndex = gameState.treeTierIndex + 1;
  const unlockCost = Number(nextTier?.unlockCostCash) || 0;

  if (!nextTier || gameState.cash < unlockCost || !isQuestComplete(nextTier.quest)) {
    return false;
  }

  removeCash(unlockCost);
  gameState.treeTierIndex = nextTierIndex;
  applyEvolutionReward(nextTier.reward);
  recomputeDerivedStats();
  notifyListeners();
  return true;
}

export function isBuyerUnlocked(buyerId) {
  return gameState.unlockedBuyerIds.includes(buyerId);
}

export function getBuyerCooldownRemainingSeconds(buyerId) {
  const cooldownEnd = Number(gameState.buyerCooldowns[buyerId]) || 0;
  if (!cooldownEnd) {
    return 0;
  }

  return Math.max(0, Math.ceil((cooldownEnd - Date.now()) / 1000));
}

export function getBuyerEffectivePricePerBanana(buyer, bananaTypeId = null) {
  const lane = getSelectedShippingLane();
  const eventBoost = isEventActive("squirrel_market_surge") ? 1.1 : 1;
  const antimatterBoost = getAntimatterExportBoostMultiplier();
  return stabilizeNumber(
    getMarketPricePerBanana() *
      buyer.pricePerBananaMultiplier *
      gameState.exportPriceMultiplier *
      antimatterBoost *
      getBuyerReputationMultiplier(buyer.id) *
      lane.priceMultiplier *
      eventBoost
  );
}

export function getBuyerReputationPercent(buyerId) {
  return getBuyerReputation(buyerId);
}

export function getShippingLanesStatus() {
  return shippingLanes.map((lane) => ({
    ...lane,
    unlocked: gameState.unlockedShippingLaneIds.includes(lane.id),
    selected: gameState.selectedShippingLaneId === lane.id,
  }));
}

export function selectShippingLane(laneId) {
  if (!gameState.unlockedShippingLaneIds.includes(laneId) || !laneById.has(laneId)) {
    return false;
  }
  gameState.selectedShippingLaneId = laneId;
  notifyListeners();
  return true;
}

export function getActiveContracts() {
  const now = Date.now();
  return gameState.activeContracts
    .filter((contract) => contract.expiresAt > now)
    .map((contract) => ({
      ...contract,
      timeRemainingSeconds: Math.max(0, Math.ceil((contract.expiresAt - now) / 1000)),
      progressPct: clamp(contract.progressBananas / Math.max(1, contract.targetBananas), 0, 1),
    }));
}

export function getBuyerTypePolicy(buyerId) {
  return {
    minAcceptedTypeTier: 0,
    preferredMultipliers: {},
  };
}

export function getLiveEventStatus() {
  const now = Date.now();
  const activeEvent = gameState.activeTimedEventId ? timedEvents[gameState.activeTimedEventId] : null;
  const remainingSeconds =
    activeEvent && gameState.activeTimedEventEndTimestamp > 0
      ? Math.max(0, Math.ceil((gameState.activeTimedEventEndTimestamp - now) / 1000))
      : 0;
  const nextRollSeconds = gameState.activeTimedEventId
    ? 0
    : Math.max(0, Math.ceil((gameState.nextEventRollTimestamp - now) / 1000));

  return {
    activeEventId: gameState.activeTimedEventId,
    activeEventName: activeEvent?.name || "No active event",
    activeEventDescription: activeEvent ? gameState.lastEventMessage || activeEvent.description : "Next event rolling soon.",
    remainingSeconds,
    nextRollSeconds,
  };
}

export function shipToBuyer(buyerId, amount, bananaTypeId = null) {
  const buyer = buyerById.get(buyerId);
  if (!buyer || !isBuyerUnlocked(buyerId)) {
    return false;
  }

  if (getBuyerCooldownRemainingSeconds(buyerId) > 0) {
    return false;
  }

  const shipmentAmount = Math.floor(clampNonNegative(Number(amount) || 0));
  const lane = getSelectedShippingLane();
  const maxAllowedShipment = Math.min(buyer.maxShipment, Math.max(1, Math.floor(lane.capacity)));
  if (shipmentAmount < buyer.minShipment || shipmentAmount > maxAllowedShipment) {
    return false;
  }

  if (gameState.bananas < shipmentAmount) {
    changeBuyerReputation(buyerId, -0.8);
    notifyListeners();
    return false;
  }

  const revenue = shipmentAmount * getBuyerEffectivePricePerBanana(buyer);
  removeBananas(shipmentAmount);
  addCash(revenue);
  gameState.totalShipments += shipmentAmount;
  changeBuyerReputation(buyerId, 0.9);
  const currentShipped = gameState.lifetimeBuyerShipmentTotals[buyerId] || 0;
  gameState.lifetimeBuyerShipmentTotals[buyerId] = addStable(currentShipped, shipmentAmount);
  applyShipmentToContracts(buyerId, shipmentAmount);

  const cooldownMs = buyer.cooldownSeconds * gameState.exportCooldownMultiplier * 1000;
  gameState.buyerCooldowns[buyerId] = Date.now() + Math.max(1000, cooldownMs);

  notifyListeners();
  return true;
}

export function prestigeReset() {
  if (!isPrestigeUnlocked()) {
    return false;
  }

  const pipGain = getPrestigeGainPreview();
  if (pipGain <= 0) {
    return false;
  }

  gameState.pip += pipGain;
  gameState.prestigeCount += 1;

  gameState.bananas = 0;
  gameState.tree = getDefaultTreeState();
  gameState.cash = 0;
  gameState.treesOwned = 0;
  gameState.workersOwned = 0;
  gameState.orchardsOwned = 0;
  gameState.treeTierIndex = 0;
  gameState.packingShedLevel = 0;
  gameState.fertilizerLabLevel = 0;
  gameState.researchHutLevel = 0;
  gameState.researchPoints = 0;
  gameState.workersBasePerSecond = DEFAULT_STATE.workersBasePerSecond;
  gameState.bananaMatter = 0;
  gameState.exoticPeelParticles = 0;
  gameState.antimatterBananas = 0;
  gameState.quantumReactorLevel = 0;
  gameState.colliderLevel = 0;
  gameState.containmentLevel = 0;
  gameState.autoSellEnabled = false;
  gameState.autoSellThreshold = DEFAULT_STATE.autoSellThreshold;
  gameState.evolutionProductionMultiplier = 1;
  gameState.totalBananasEarned = 0;
  gameState.totalCashEarned = 0;
  gameState.purchasedUpgradeIds = [];
  gameState.purchasedTreeHarvestUpgradeIds = [];
  gameState.unlockedResearchNodeIds = [];
  gameState.unlockedAchievementIds = [];
  gameState.totalClicks = 0;
  gameState.totalShipments = 0;
  gameState.contractsCompleted = 0;
  gameState.buyerCooldowns = {};
  gameState.lifetimeBuyerShipmentTotals = {};
  gameState.buyerReputation = { squirrel_market: 10 };
  gameState.selectedShippingLaneId = "local";
  gameState.unlockedShippingLaneIds = ["local"];
  gameState.activeContracts = [];
  gameState.nextContractId = 1;
  gameState.lastContractGenerationTime = Date.now();
  gameState.activeTimedEventId = null;
  gameState.activeTimedEventEndTimestamp = 0;
  gameState.nextEventRollTimestamp = Date.now() + 180_000;
  gameState.lastEventMessage = "";
  gameState.ceoEmails = [];
  gameState.sentCeoEmailIds = [];
  gameState.nextCeoEmailRollTimestamp = Date.now() + getRandomCeoEmailDelayMs();
  gameState.rareItems = [];
  gameState.unlockedBuyerIds = ["squirrel_market"];
  gameState.unlockedEvolutionRewardBuyerIds = [];
  gameState.unlockedUpgradeCategories = ["Farming Tech", "Finance"];
  gameState.reachedMilestoneIds = ["milestone_seed"];
  gameState.milestoneUnlockedBuyerIds = ["squirrel_market"];
  gameState.milestoneUnlockedUpgradeIds = [];
  gameState.maxUnlockedTreeTierTransitionIndex = 0;
  gameState.lastTickTime = Date.now();

  treeHarvestSystem.deserialize(gameState.tree);
  refreshMilestones();
  recomputeDerivedStats();
  notifyListeners();
  return true;
}

export function resetAllProgress() {
  Object.assign(gameState, DEFAULT_STATE, {
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    lastTickTime: Date.now(),
    lastSaveTimestamp: Date.now(),
    lastContractGenerationTime: Date.now(),
    nextEventRollTimestamp: Date.now() + 180_000,
    nextCeoEmailRollTimestamp: Date.now() + getRandomCeoEmailDelayMs(),
  });

  assertFiniteCoreState("resetAllProgress");
  treeHarvestSystem.deserialize(gameState.tree);
  firstTickAfterLoadPending = true;
  lastLoggedBananasForDebug = gameState.bananas;
  recomputeDerivedStats();
  notifyListeners();
}
