import { addStable, stabilizeNumber } from "./numbers.js";
import { farmEvolutions } from "./tiers.js";
import { researchTreeNodes } from "./researchTree.js";
import { achievements } from "./achievements.js";
import { TreeHarvestSystem, getDefaultTreeState } from "./treeHarvestSystem.js";
import {
  ascensionChallenges,
  ascensionChallengeById,
  ascensionRewardById,
  buildDefaultObjectiveProgress,
  CHALLENGE_RUN_STATUS,
  getDefaultActiveChallengeRun,
  getDefaultChallengeHistory,
  getDefaultChallengeLastResult,
  getDefaultChallengeRewardsUnlocked,
  getRankIndex,
  getRewardsForChallengeRank,
  sanitizeActiveChallengeRun,
  sanitizeChallengeHistory,
  sanitizeChallengeLastResult,
  sanitizeChallengeRewardsUnlocked,
} from "./ascensionChallenges.js";
import {
  BLACKJACK_PHASES,
  canSplitBlackjackHand,
  createShuffledBlackjackDeck,
  dealerShouldHit,
  getBlackjackHandValue,
  getDefaultBlackjackState,
  getDefaultBlackjackStats,
  getDefaultCasinoState,
  getDefaultCasinoStats,
  isNaturalBlackjack,
  isTenValueCard,
  sanitizeBlackjackHand,
  sanitizeCasinoState,
} from "./blackjack.js";
import {
  createShuffledMississippiStudDeck,
  evaluateMississippiStudHand,
  getDefaultMississippiStudState,
  getMississippiStudCommittedWager,
  getVisibleMississippiStudCommunityCards,
  MISSISSIPPI_STUD_PAYTABLE,
  MISSISSIPPI_STUD_PHASES,
} from "./mississippiStud.js";
import {
  BACCARAT_BET_CHOICES,
  BACCARAT_PAYOUTS,
  BACCARAT_PHASES,
  createShuffledBaccaratDeck,
  getBaccaratHandTotal,
  getDefaultBaccaratState,
  isBaccaratNatural,
  resolveBaccaratWinner,
  shouldBankerDrawBaccarat,
  shouldPlayerDrawBaccarat,
} from "./baccarat.js";

export const TICK_RATE_HZ = 10;
const TICK_INTERVAL_MS = 1000 / TICK_RATE_HZ;
export const GAME_STATE_SCHEMA_VERSION = 13;
const TREE_COST_GROWTH = 1.12;
const MARKET_PRICE_PER_BANANA = 0.35;
const AUTO_SELL_PRICE_PER_BANANA = 0.2;
const BASE_CLICK_YIELD = 1;
const PRESTIGE_UNLOCK_TOTAL_BANANAS = 1_000_000;
const PRESTIGE_UNLOCK_TIER_INDEX = 5;
const CEO_LEVEL_MULTIPLIER_BASE = 1.03;
const SHIPPING_CAPACITY_PER_TIER = 0.05;
const TREE_TIER_VALUE_MULTIPLIERS = Object.freeze([1, 1.25, 1.6, 2.2, 3.4, 5.5, 9.0]);

// Orchard automation unlock: milestone + cash gate.
// This is intentionally later than workers so the early loop stays click + worker driven.
const ORCHARD_UNLOCK_MILESTONE_ID = "milestone_industry";
const ORCHARD_UNLOCK_CASH_REQUIREMENT = 1200;

const WORKER_COST_GROWTH = 1.15;
const BUILDING_COST_GROWTH = 1.35;
const ORCHARD_CAPACITY_BONUS_PER_ORCHARD = 1;
const ORCHARD_SPAWN_INTERVAL_STEP = 0.008;
const ORCHARD_MIN_SPAWN_INTERVAL_MULTIPLIER = 0.65;
const ORCHARD_EXPORT_BONUS_PER_ORCHARD = 0.01;
const ORCHARD_MAX_EXPORT_BONUS = 2.5;
const MAX_ACTIVE_CONTRACTS = 3;
const CONTRACT_GENERATION_INTERVAL_SECONDS = 45;
const EVENT_MIN_ROLL_SECONDS = 120;
const EVENT_MAX_ROLL_SECONDS = 360;
const CEO_EMAIL_MIN_ROLL_SECONDS = 55;
const CEO_EMAIL_MAX_ROLL_SECONDS = 150;
const AUTO_EXPORT_UNLOCK_CASH = 20_000;

let firstTickAfterLoadPending = true;
let lastLoggedBananasForDebug = 0;

const CHALLENGE_MODIFIER_OPS = Object.freeze({
  mul: "mul",
  add: "add",
  set: "set",
  min: "min",
  max: "max",
});

const CHALLENGE_MODIFIER_DEFAULTS = Object.freeze({
  productionMultiplier: 1,
  clickMultiplier: 1,
  exportPriceMultiplier: 1,
  exportCooldownMultiplier: 1,
  clickYieldMultiplier: 1,
  spawnIntervalMultiplier: 1,
  maxBananasAdd: 0,
  workerPickRateMultiplier: 1,
  workerOutputMultiplier: 1,
  orchardPickRateMultiplier: 1,
  orchardCapacityMultiplier: 1,
  orchardSpawnIntervalMultiplier: 1,
  orchardExportMultiplier: 1,
  shippingCapacityMultiplier: 1,
  researchPointMultiplier: 1,
  shakeEnabled: true,
  offlineGainsEnabled: true,
  prestigeEnabled: true,
});

const CHALLENGE_RULE_MODIFIERS = Object.freeze({
  no_workers: [
    { stat: "workerPickRateMultiplier", op: CHALLENGE_MODIFIER_OPS.set, value: 0, sourceId: "no_workers", category: "constraint" },
    { stat: "workerOutputMultiplier", op: CHALLENGE_MODIFIER_OPS.set, value: 0, sourceId: "no_workers", category: "constraint" },
  ],
  no_orchards: [
    { stat: "orchardPickRateMultiplier", op: CHALLENGE_MODIFIER_OPS.set, value: 0, sourceId: "no_orchards", category: "constraint" },
    { stat: "orchardCapacityMultiplier", op: CHALLENGE_MODIFIER_OPS.set, value: 0, sourceId: "no_orchards", category: "constraint" },
    { stat: "orchardSpawnIntervalMultiplier", op: CHALLENGE_MODIFIER_OPS.set, value: 1, sourceId: "no_orchards", category: "constraint" },
    { stat: "orchardExportMultiplier", op: CHALLENGE_MODIFIER_OPS.set, value: 1, sourceId: "no_orchards", category: "constraint" },
  ],
  no_orchard_bonus: [
    { stat: "orchardPickRateMultiplier", op: CHALLENGE_MODIFIER_OPS.set, value: 0, sourceId: "no_orchard_bonus", category: "constraint" },
    { stat: "orchardCapacityMultiplier", op: CHALLENGE_MODIFIER_OPS.set, value: 0, sourceId: "no_orchard_bonus", category: "constraint" },
    { stat: "orchardSpawnIntervalMultiplier", op: CHALLENGE_MODIFIER_OPS.set, value: 1, sourceId: "no_orchard_bonus", category: "constraint" },
    { stat: "orchardExportMultiplier", op: CHALLENGE_MODIFIER_OPS.set, value: 1, sourceId: "no_orchard_bonus", category: "constraint" },
  ],
  reduced_export_value: [
    { stat: "exportPriceMultiplier", op: CHALLENGE_MODIFIER_OPS.mul, value: 0.7, sourceId: "reduced_export_value", category: "economy" },
  ],
  slower_spawn_rate: [
    { stat: "spawnIntervalMultiplier", op: CHALLENGE_MODIFIER_OPS.mul, value: 1.35, sourceId: "slower_spawn_rate", category: "harvest" },
  ],
  disabled_shake: [
    { stat: "shakeEnabled", op: CHALLENGE_MODIFIER_OPS.set, value: false, sourceId: "disabled_shake", category: "constraint" },
  ],
  no_offline_gains: [
    { stat: "offlineGainsEnabled", op: CHALLENGE_MODIFIER_OPS.set, value: false, sourceId: "no_offline_gains", category: "constraint" },
  ],
  disable_prestige: [
    { stat: "prestigeEnabled", op: CHALLENGE_MODIFIER_OPS.set, value: false, sourceId: "disable_prestige", category: "constraint" },
  ],
  reduced_click_yield: [
    { stat: "clickYieldMultiplier", op: CHALLENGE_MODIFIER_OPS.mul, value: 0.8, sourceId: "reduced_click_yield", category: "harvest" },
  ],
  tighter_lane_capacity: [
    { stat: "shippingCapacityMultiplier", op: CHALLENGE_MODIFIER_OPS.mul, value: 0.75, sourceId: "tighter_lane_capacity", category: "export" },
  ],
  contract_focus: [
    { stat: "exportCooldownMultiplier", op: CHALLENGE_MODIFIER_OPS.mul, value: 0.85, sourceId: "contract_focus", category: "export" },
    { stat: "productionMultiplier", op: CHALLENGE_MODIFIER_OPS.mul, value: 0.9, sourceId: "contract_focus", category: "tradeoff" },
  ],
});

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

export const pipUpgrades = Object.freeze([
  {
    id: "pip_prod_foundation",
    name: "Jungle Foundations",
    description: "Permanent production boost.",
    category: "Production",
    maxRank: 12,
    baseCostPip: 1,
    costGrowth: 1.5,
    effect: { productionMultiplierPerRank: 1.06 },
  },
  {
    id: "pip_prod_canopy",
    name: "Canopy Expansion",
    description: "Adds more banana slots on every run.",
    category: "Production",
    maxRank: 8,
    baseCostPip: 2,
    costGrowth: 1.65,
    unlockCondition: { type: "totalBananasEarned", value: 20_000 },
    effect: { maxBananasFlatPerRank: 2 },
  },
  {
    id: "pip_prod_ripening",
    name: "Accelerated Ripening",
    description: "Bananas spawn faster permanently.",
    category: "Production",
    maxRank: 10,
    baseCostPip: 3,
    costGrowth: 1.65,
    unlockCondition: { type: "treesOwned", value: 20 },
    effect: { spawnIntervalMultiplierPerRank: 0.96 },
  },
  {
    id: "pip_prod_foreman",
    name: "Foreman Training",
    description: "Workers pick faster each prestige cycle.",
    category: "Production",
    maxRank: 8,
    baseCostPip: 5,
    costGrowth: 1.75,
    unlockCondition: { type: "treeTierIndex", value: 3 },
    effect: { workerPickMultiplierPerRank: 1.09 },
  },
  {
    id: "pip_click_grip",
    name: "Executive Grip",
    description: "Permanent click harvest strength.",
    category: "Clicking",
    maxRank: 12,
    baseCostPip: 1,
    costGrowth: 1.5,
    effect: { clickMultiplierPerRank: 1.07 },
  },
  {
    id: "pip_click_precision",
    name: "Precision Picking",
    description: "Further improves click yield on tree harvest.",
    category: "Clicking",
    maxRank: 8,
    baseCostPip: 3,
    costGrowth: 1.7,
    unlockCondition: { type: "totalBananasEarned", value: 60_000 },
    effect: { clickYieldMultiplierPerRank: 1.06 },
  },
  {
    id: "pip_click_golden",
    name: "Golden Insight",
    description: "Raises golden spawn odds and payout.",
    category: "Clicking",
    maxRank: 6,
    baseCostPip: 5,
    costGrowth: 1.85,
    unlockCondition: { type: "treeTierIndex", value: 4 },
    effect: { goldenChanceAddPerRank: 0.0025, goldenMultiplierAddPerRank: 8 },
  },
  {
    id: "pip_click_shaker",
    name: "Hydraulic Shaker",
    description: "Lower Shake Tree cooldown permanently.",
    category: "Clicking",
    maxRank: 6,
    baseCostPip: 6,
    costGrowth: 1.85,
    unlockCondition: { type: "treeTierIndex", value: 4 },
    effect: { shakeCooldownMultiplierPerRank: 0.95 },
  },
  {
    id: "pip_export_brand",
    name: "Premium Branding",
    description: "Permanent export price increase.",
    category: "Export",
    maxRank: 10,
    baseCostPip: 2,
    costGrowth: 1.6,
    effect: { exportPriceMultiplierPerRank: 1.05 },
  },
  {
    id: "pip_export_coldchain",
    name: "Cold Chain Mastery",
    description: "Reduces buyer cooldowns globally.",
    category: "Export",
    maxRank: 8,
    baseCostPip: 4,
    costGrowth: 1.7,
    unlockCondition: { type: "totalBananasEarned", value: 40_000 },
    effect: { exportCooldownMultiplierPerRank: 0.96 },
  },
  {
    id: "pip_export_lane",
    name: "Lane Infrastructure",
    description: "Increases shipping lane capacity.",
    category: "Export",
    maxRank: 8,
    baseCostPip: 5,
    costGrowth: 1.75,
    unlockCondition: { type: "treeTierIndex", value: 3 },
    effect: { shippingCapacityMultiplierPerRank: 1.08 },
  },
  {
    id: "pip_export_orchard",
    name: "Orchard Routing",
    description: "Orchards auto-pick faster.",
    category: "Export",
    maxRank: 6,
    baseCostPip: 7,
    costGrowth: 1.9,
    unlockCondition: { type: "treeTierIndex", value: 5 },
    effect: { orchardPickMultiplierPerRank: 1.12 },
  },
  {
    id: "pip_qol_broker",
    name: "Market Broker",
    description: "Improves auto-sell fallback price.",
    category: "QoL",
    maxRank: 8,
    baseCostPip: 2,
    costGrowth: 1.65,
    unlockCondition: { type: "cash", value: 10_000 },
    effect: { autoSellPriceMultiplierPerRank: 1.08 },
  },
  {
    id: "pip_qol_research",
    name: "Research Endowment",
    description: "Permanent research node cash discount.",
    category: "QoL",
    maxRank: 6,
    baseCostPip: 4,
    costGrowth: 1.75,
    unlockCondition: { type: "treesOwned", value: 30 },
    effect: { researchDiscountMultiplierPerRank: 0.97 },
  },
  {
    id: "pip_qol_ceo",
    name: "CEO Playbook",
    description: "Small all-around production and export gain.",
    category: "QoL",
    maxRank: 5,
    baseCostPip: 8,
    costGrowth: 2.0,
    unlockCondition: { type: "treeTierIndex", value: 5 },
    effect: { productionMultiplierPerRank: 1.04, exportPriceMultiplierPerRank: 1.04 },
  },
  {
    id: "pip_qol_legacy",
    name: "Legacy Doctrine",
    description: "Late-game permanent efficiency package.",
    category: "QoL",
    maxRank: 4,
    baseCostPip: 12,
    costGrowth: 2.1,
    unlockCondition: { type: "totalBananasEarned", value: 1_500_000 },
    effect: {
      productionMultiplierPerRank: 1.06,
      clickMultiplierPerRank: 1.05,
      exportPriceMultiplierPerRank: 1.05,
      workerPickMultiplierPerRank: 1.06,
    },
  },
  {
    id: "pip_qol_casino",
    name: "Card Shark License",
    description: "Unlock the Monkey Casino and its blackjack table.",
    category: "QoL",
    maxRank: 1,
    baseCostPip: 20,
    costGrowth: 2.0,
    effect: { casinoUnlocked: true },
  },
  {
    id: "pip_qol_mississippi_stud",
    name: "Riverboat License",
    description: "Unlock Mississippi Stud in the Monkey Casino.",
    category: "QoL",
    maxRank: 1,
    baseCostPip: 20,
    costGrowth: 2.0,
    unlockCondition: { type: "totalBananasEarned", value: 100_000 },
    effect: { mississippiStudUnlocked: true },
  },
  {
    id: "pip_qol_baccarat",
    name: "High Roller License",
    description: "Unlock Baccarat in the Monkey Casino.",
    category: "QoL",
    maxRank: 1,
    baseCostPip: 20,
    costGrowth: 2.0,
    unlockCondition: { type: "totalBananasEarned", value: 250_000 },
    effect: { baccaratUnlocked: true },
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
  research_lab: {
    id: "research_lab",
    label: "Research Lab",
    stateKey: "researchLabLevel",
    baseCost: 1500,
    growth: BUILDING_COST_GROWTH,
  },
  finance_office: {
    id: "finance_office",
    label: "Finance Office",
    stateKey: "financeOfficeLevel",
    baseCost: 2100,
    growth: BUILDING_COST_GROWTH,
    maxLevel: 21,
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
const pipUpgradeById = new Map(pipUpgrades.map((upgrade) => [upgrade.id, upgrade]));

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
  orchardExportBonusMultiplier: 1,
  evolutionProductionMultiplier: 1,
  treeBaseCost: 25,
  treeCostGrowth: TREE_COST_GROWTH,
  workerBaseCost: 40,
  workerCostGrowth: WORKER_COST_GROWTH,
  orchardBaseCost: 1800,
  orchardCostGrowth: 1.18,
  orchardPickRatePerSecondPerOrchard: 1.4,
  packingShedLevel: 0,
  fertilizerLabLevel: 0,
  researchLabLevel: 0,
  financeOfficeLevel: 0,
  researchPoints: 0,
  bananaMatter: 0,
  exoticPeelParticles: 0,
  antimatterBananas: 0,
  quantumReactorLevel: 0,
  colliderLevel: 0,
  containmentLevel: 0,
  autoSellEnabled: false,
  autoSellThreshold: 200,
  autoExportUnlocked: false,
  autoExportEnabled: false,
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
  purchasedPipUpgrades: {},
  pipSpentTotal: 0,
  pipRespecCount: 0,
  prestigeCount: 0,
  activeChallengeRun: getDefaultActiveChallengeRun(),
  challengeHistory: getDefaultChallengeHistory(),
  challengeRewardsUnlocked: getDefaultChallengeRewardsUnlocked(),
  challengeLastResult: getDefaultChallengeLastResult(),
  casino: getDefaultCasinoState(),
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
    ["pipSpentTotal", 0],
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

function applyNormalizedModifierValue(currentValue, modifier) {
  const safeModifier = modifier && typeof modifier === "object" ? modifier : null;
  if (!safeModifier) {
    return currentValue;
  }
  const op = safeModifier.op;
  if (op === CHALLENGE_MODIFIER_OPS.mul) {
    return Number(currentValue) * Number(safeModifier.value);
  }
  if (op === CHALLENGE_MODIFIER_OPS.add) {
    return Number(currentValue) + Number(safeModifier.value);
  }
  if (op === CHALLENGE_MODIFIER_OPS.set) {
    return safeModifier.value;
  }
  if (op === CHALLENGE_MODIFIER_OPS.min) {
    return Math.min(Number(currentValue), Number(safeModifier.value));
  }
  if (op === CHALLENGE_MODIFIER_OPS.max) {
    return Math.max(Number(currentValue), Number(safeModifier.value));
  }
  return currentValue;
}

function resolveChallengeContext() {
  const run = gameState.activeChallengeRun;
  if (!run || run.status !== CHALLENGE_RUN_STATUS.active || !ascensionChallengeById.has(run.challengeId)) {
    return {
      active: false,
      challengeId: null,
      modifiersApplied: [],
      resolved: { ...CHALLENGE_MODIFIER_DEFAULTS },
    };
  }

  const ruleIds = Array.isArray(run.appliedRuleIds) ? run.appliedRuleIds : [];
  const resolved = { ...CHALLENGE_MODIFIER_DEFAULTS };
  const modifiersApplied = [];

  ruleIds.forEach((ruleId) => {
    const ruleModifiers = Array.isArray(CHALLENGE_RULE_MODIFIERS[ruleId]) ? CHALLENGE_RULE_MODIFIERS[ruleId] : [];
    ruleModifiers.forEach((modifier) => {
      if (!modifier || typeof modifier !== "object" || !(modifier.stat in resolved)) {
        return;
      }
      const nextValue = applyNormalizedModifierValue(resolved[modifier.stat], modifier);
      resolved[modifier.stat] = nextValue;
      modifiersApplied.push({
        stat: modifier.stat,
        op: modifier.op,
        value: modifier.value,
        sourceId: modifier.sourceId || ruleId,
        category: modifier.category || "challenge",
      });
    });
  });

  resolved.productionMultiplier = Math.max(0, Number(resolved.productionMultiplier) || 0);
  resolved.clickMultiplier = Math.max(0, Number(resolved.clickMultiplier) || 0);
  resolved.exportPriceMultiplier = Math.max(0, Number(resolved.exportPriceMultiplier) || 0);
  resolved.exportCooldownMultiplier = Math.max(0.1, Number(resolved.exportCooldownMultiplier) || 0.1);
  resolved.clickYieldMultiplier = Math.max(0, Number(resolved.clickYieldMultiplier) || 0);
  resolved.spawnIntervalMultiplier = Math.max(0.1, Number(resolved.spawnIntervalMultiplier) || 1);
  resolved.maxBananasAdd = Math.floor(Number(resolved.maxBananasAdd) || 0);
  resolved.workerPickRateMultiplier = Math.max(0, Number(resolved.workerPickRateMultiplier) || 0);
  resolved.workerOutputMultiplier = Math.max(0, Number(resolved.workerOutputMultiplier) || 0);
  resolved.orchardPickRateMultiplier = Math.max(0, Number(resolved.orchardPickRateMultiplier) || 0);
  resolved.orchardCapacityMultiplier = Math.max(0, Number(resolved.orchardCapacityMultiplier) || 0);
  resolved.orchardSpawnIntervalMultiplier = Math.max(0.1, Number(resolved.orchardSpawnIntervalMultiplier) || 1);
  resolved.orchardExportMultiplier = Math.max(0, Number(resolved.orchardExportMultiplier) || 0);
  resolved.shippingCapacityMultiplier = Math.max(0, Number(resolved.shippingCapacityMultiplier) || 0);
  resolved.researchPointMultiplier = Math.max(0, Number(resolved.researchPointMultiplier) || 0);
  resolved.shakeEnabled = Boolean(resolved.shakeEnabled);
  resolved.offlineGainsEnabled = Boolean(resolved.offlineGainsEnabled);
  resolved.prestigeEnabled = Boolean(resolved.prestigeEnabled);

  return {
    active: true,
    challengeId: run.challengeId,
    modifiersApplied,
    resolved,
  };
}

function isChallengeUnlocked(challenge) {
  return isRequirementMet(challenge?.unlockCondition);
}

function cloneSerializable(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function createChallengePreRunSnapshot() {
  const snapshot = cloneSerializable(gameState);
  snapshot.activeChallengeRun = null;
  snapshot.challengeHistory = cloneSerializable(gameState.challengeHistory || {});
  snapshot.challengeRewardsUnlocked = cloneSerializable(gameState.challengeRewardsUnlocked || []);
  return snapshot;
}

function prepareStateForChallengeRun() {
  const preservedMeta = {
    pip: gameState.pip,
    purchasedPipUpgrades: cloneSerializable(gameState.purchasedPipUpgrades || {}),
    pipSpentTotal: gameState.pipSpentTotal,
    pipRespecCount: gameState.pipRespecCount,
    prestigeCount: gameState.prestigeCount,
    challengeHistory: cloneSerializable(gameState.challengeHistory || {}),
    challengeRewardsUnlocked: cloneSerializable(gameState.challengeRewardsUnlocked || []),
    casino: cloneSerializable(gameState.casino || getDefaultCasinoState()),
  };

  Object.assign(gameState, DEFAULT_STATE, preservedMeta, {
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    lastTickTime: Date.now(),
    lastSaveTimestamp: Date.now(),
    lastContractGenerationTime: Date.now(),
    nextEventRollTimestamp: Date.now() + 180_000,
    nextCeoEmailRollTimestamp: Date.now() + getRandomCeoEmailDelayMs(),
  });
}

function restoreStateFromChallengeSnapshot(preRunSnapshot) {
  const safeSnapshot = preRunSnapshot && typeof preRunSnapshot === "object" ? preRunSnapshot : {};
  Object.assign(gameState, DEFAULT_STATE, safeSnapshot);
  gameState.schemaVersion = GAME_STATE_SCHEMA_VERSION;
}

const CHALLENGE_OBJECTIVE_EVALUATORS = Object.freeze({
  bananas: () => gameState.bananas,
  cash: () => gameState.cash,
  total_bananas_earned: () => gameState.totalBananasEarned,
  tree_tier_index: () => gameState.treeTierIndex,
  shipments_total: () => gameState.totalShipments,
  ship_bananas_total: () => gameState.totalShipments,
  contracts_completed: () => gameState.contractsCompleted,
  workers_owned: () => gameState.workersOwned,
  survive_time_ms: (_objective, runState) => runState?.elapsedMs || 0,
  score: (_objective, runState) => Math.max(0, Number(runState?.score) || 0),
});

const ASCENSION_REWARD_MODIFIER_DEFAULTS = Object.freeze({
  productionMultiplier: 1,
  clickMultiplier: 1,
  exportPriceMultiplier: 1,
  exportCooldownMultiplier: 1,
  shippingCapacityMultiplier: 1,
  researchPointMultiplier: 1,
  maxActiveContractsAdd: 0,
  qolChallengeTelemetry: false,
});

function compareChallengeRanks(left, right) {
  const leftIndex = getRankIndex(left);
  const rightIndex = getRankIndex(right);
  const safeLeft = leftIndex >= 0 ? leftIndex : -1;
  const safeRight = rightIndex >= 0 ? rightIndex : -1;
  return safeLeft - safeRight;
}

function resolveAscensionRewardContext() {
  const unlockedIds = sanitizeChallengeRewardsUnlocked(gameState.challengeRewardsUnlocked);
  const resolved = { ...ASCENSION_REWARD_MODIFIER_DEFAULTS };
  const applied = [];
  const unlockedCosmetics = [];
  const unlockedUtility = [];

  unlockedIds.forEach((rewardId) => {
    const reward = ascensionRewardById.get(rewardId);
    if (!reward) {
      return;
    }

    if (reward.type === "badge" || reward.type === "cosmetic_title") {
      unlockedCosmetics.push(reward);
    } else if (reward.type === "utility_unlock" || reward.type === "qol_toggle") {
      unlockedUtility.push(reward);
    }

    const modifiers = Array.isArray(reward.modifiers) ? reward.modifiers : [];
    modifiers.forEach((modifier) => {
      if (!modifier || typeof modifier !== "object" || !(modifier.stat in resolved)) {
        return;
      }
      resolved[modifier.stat] = applyNormalizedModifierValue(resolved[modifier.stat], modifier);
      applied.push({
        stat: modifier.stat,
        op: modifier.op,
        value: modifier.value,
        sourceId: reward.id,
        category: modifier.category || "ascension_reward",
      });
    });
  });

  resolved.productionMultiplier = Math.max(0.1, Number(resolved.productionMultiplier) || 1);
  resolved.clickMultiplier = Math.max(0.1, Number(resolved.clickMultiplier) || 1);
  resolved.exportPriceMultiplier = Math.max(0.1, Number(resolved.exportPriceMultiplier) || 1);
  resolved.exportCooldownMultiplier = Math.max(0.1, Number(resolved.exportCooldownMultiplier) || 1);
  resolved.shippingCapacityMultiplier = Math.max(0.1, Number(resolved.shippingCapacityMultiplier) || 1);
  resolved.researchPointMultiplier = Math.max(0.1, Number(resolved.researchPointMultiplier) || 1);
  resolved.maxActiveContractsAdd = Math.max(0, Math.floor(Number(resolved.maxActiveContractsAdd) || 0));
  resolved.qolChallengeTelemetry = Boolean(resolved.qolChallengeTelemetry);

  return {
    unlockedRewardIds: unlockedIds,
    modifiersApplied: applied,
    resolved,
    unlockedCosmetics,
    unlockedUtility,
  };
}

function getChallengeObjectiveCurrentValue(objective, runState) {
  const evaluator = CHALLENGE_OBJECTIVE_EVALUATORS[objective?.type];
  if (typeof evaluator !== "function") {
    return 0;
  }
  return Math.max(0, Number(evaluator(objective, runState)) || 0);
}

function getChallengeRankFromElapsed(challenge, elapsedMs) {
  const thresholds = challenge?.rankThresholds || {};
  const safeElapsed = Math.max(0, Math.floor(Number(elapsedMs) || 0));
  const goldMax = Math.max(0, Number(thresholds.goldMaxElapsedMs) || 0);
  const silverMax = Math.max(0, Number(thresholds.silverMaxElapsedMs) || 0);
  const bronzeMax = Math.max(0, Number(thresholds.bronzeMaxElapsedMs) || Number(challenge?.timeLimitMs) || 0);
  if (goldMax > 0 && safeElapsed <= goldMax) {
    return "Gold";
  }
  if (silverMax > 0 && safeElapsed <= silverMax) {
    return "Silver";
  }
  if (bronzeMax <= 0 || safeElapsed <= bronzeMax) {
    return "Bronze";
  }
  return "Bronze";
}

function getChallengeScore(challenge, runState) {
  const safeElapsed = Math.max(0, Math.floor(Number(runState?.elapsedMs) || 0));
  const rank = getChallengeRankFromElapsed(challenge, safeElapsed);
  const rankBase = rank === "Gold" ? 3000 : rank === "Silver" ? 2000 : 1200;
  const timeBonus = Math.max(0, Math.floor(1_000_000 / Math.max(1, safeElapsed + 1000)));
  const objectives = Array.isArray(challenge?.objectives) ? challenge.objectives : [];
  const objectiveBonus = objectives.reduce((sum, objective) => {
    const target = Math.max(1, Number(objective.target) || 1);
    const progress = Math.max(0, Number(runState?.objectiveProgress?.[objective.id]) || 0);
    const completionPct = Math.max(0, Math.min(1.5, progress / target));
    return sum + Math.floor(completionPct * 120);
  }, 0);
  return rankBase + timeBonus + objectiveBonus;
}

function updateChallengeObjectiveProgress(runState) {
  if (!runState || !ascensionChallengeById.has(runState.challengeId)) {
    return;
  }
  const challenge = ascensionChallengeById.get(runState.challengeId);
  const nextProgress = { ...runState.objectiveProgress };
  for (const objective of challenge.objectives || []) {
    const currentValue = getChallengeObjectiveCurrentValue(objective, runState);
    const prevValue = Math.max(0, Number(nextProgress[objective.id]) || 0);
    nextProgress[objective.id] = Math.max(prevValue, currentValue);
  }
  runState.objectiveProgress = nextProgress;
  runState.score = getChallengeScore(challenge, runState);
}

function areChallengeObjectivesMet(runState) {
  if (!runState || !ascensionChallengeById.has(runState.challengeId)) {
    return false;
  }
  const challenge = ascensionChallengeById.get(runState.challengeId);
  return (challenge.objectives || []).every((objective) => {
    const value = Math.max(0, Number(runState.objectiveProgress?.[objective.id]) || 0);
    const target = Math.max(0, Number(objective.target) || 0);
    return value >= target;
  });
}

function shouldFailChallengeRun(runState) {
  if (!runState || !ascensionChallengeById.has(runState.challengeId)) {
    return false;
  }
  const challenge = ascensionChallengeById.get(runState.challengeId);
  const timeLimitMs = Math.max(0, Number(challenge.timeLimitMs) || 0);
  if (timeLimitMs <= 0) {
    return false;
  }
  return Math.floor(Number(runState.elapsedMs) || 0) > timeLimitMs && !areChallengeObjectivesMet(runState);
}

function evaluateActiveChallengeRunCompletion() {
  const run = gameState.activeChallengeRun;
  if (!run || run.status !== CHALLENGE_RUN_STATUS.active) {
    return null;
  }
  updateChallengeObjectiveProgress(run);
  if (areChallengeObjectivesMet(run)) {
    return finalizeChallengeRun(CHALLENGE_RUN_STATUS.completed);
  }
  if (shouldFailChallengeRun(run)) {
    return finalizeChallengeRun(CHALLENGE_RUN_STATUS.failed);
  }
  return null;
}

function applyChallengeHistoryCompletion(challengeId, elapsedMs, rank) {
  const history = sanitizeChallengeHistory(gameState.challengeHistory);
  const current = history[challengeId] || {
    completions: 0,
    bestRank: null,
    bestTimeMs: null,
    lastCompletedAt: null,
  };
  const normalizedElapsed = Math.max(0, Math.floor(Number(elapsedMs) || 0));
  const normalizedRank = String(rank || "Bronze");
  const currentBestRank = current.bestRank || "Bronze";
  const betterRank = compareChallengeRanks(normalizedRank, currentBestRank) > 0;
  const bestRank = current.bestRank == null ? normalizedRank : (betterRank ? normalizedRank : current.bestRank);
  history[challengeId] = {
    completions: current.completions + 1,
    bestRank,
    bestTimeMs: current.bestTimeMs == null ? normalizedElapsed : Math.min(current.bestTimeMs, normalizedElapsed),
    lastCompletedAt: Date.now(),
  };
  gameState.challengeHistory = history;
}

function finalizeChallengeRun(status, options = {}) {
  const activeRun = gameState.activeChallengeRun;
  if (!activeRun || !ascensionChallengeById.has(activeRun.challengeId)) {
    return false;
  }

  const challenge = ascensionChallengeById.get(activeRun.challengeId);
  const elapsedMs = Math.max(0, Math.floor(Number(activeRun.elapsedMs) || 0));
  const objectiveProgress = cloneSerializable(activeRun.objectiveProgress || {});
  const preRunSnapshot = cloneSerializable(activeRun.preRunSnapshot || {});
  const score = Math.max(0, Number(activeRun.score) || 0);

  restoreStateFromChallengeSnapshot(preRunSnapshot);
  gameState.challengeHistory = sanitizeChallengeHistory(gameState.challengeHistory);
  gameState.challengeRewardsUnlocked = sanitizeChallengeRewardsUnlocked(gameState.challengeRewardsUnlocked);
  gameState.activeChallengeRun = null;
  gameState.challengeLastResult = null;

  let finalRank = String(options.rank || "Bronze");
  const rewardsGranted = [];
  if (status === CHALLENGE_RUN_STATUS.completed) {
    finalRank = getChallengeRankFromElapsed(challenge, elapsedMs);
    applyChallengeHistoryCompletion(challenge.id, elapsedMs, finalRank);
    const rankRewards = getRewardsForChallengeRank(challenge, finalRank);
    const rewards = new Set(gameState.challengeRewardsUnlocked || []);
    rankRewards.forEach((rewardId) => {
      const rewardDef = ascensionRewardById.get(rewardId);
      const repeatable = Boolean(rewardDef?.repeatable);
      const alreadyUnlocked = rewards.has(rewardId);
      if (!alreadyUnlocked || repeatable) {
        rewardsGranted.push(rewardId);
      }
      rewards.add(rewardId);
    });
    gameState.challengeRewardsUnlocked = Array.from(rewards);
  }

  gameState.challengeLastResult = {
    challengeId: challenge.id,
    status,
    rank: finalRank,
    elapsedMs,
    score,
    completedAt: Date.now(),
    objectiveProgress,
    rewardsGranted,
  };

  treeHarvestSystem.deserialize(gameState.tree);
  rebuildEvolutionRewardsFromTier();
  refreshMilestones();
  refreshShippingLaneUnlocks();
  updateContracts();
  recomputeDerivedStats();
  assertFiniteCoreState(`challenge-${status}`);
  notifyListeners();

  return {
    success: true,
    status,
    challengeId: challenge.id,
    elapsedMs,
    rank: finalRank,
    score,
    rewardsGranted,
    objectiveProgress,
  };
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
  const allowed = new Set(upgrades.map((upgrade) => upgrade.category || upgrade.group).filter(Boolean));
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

function getUpgradeCategory(upgrade) {
  return upgrade?.category || upgrade?.group || "";
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

function sanitizePipUpgradeRanks(rawRanks) {
  const sanitized = {};
  if (!rawRanks || typeof rawRanks !== "object") {
    return sanitized;
  }

  for (const [upgradeId, rankValue] of Object.entries(rawRanks)) {
    const upgrade = pipUpgradeById.get(upgradeId);
    if (!upgrade) {
      continue;
    }

    const rank = clamp(Math.floor(Number(rankValue) || 0), 0, Math.max(1, Number(upgrade.maxRank) || 1));
    if (rank > 0) {
      sanitized[upgradeId] = rank;
    }
  }

  return sanitized;
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
  if (sourceSchemaVersion < 7) {
    migrated.autoExportUnlocked = false;
    migrated.autoExportEnabled = false;
  }
  if (sourceSchemaVersion < 8) {
    migrated.purchasedPipUpgrades = {};
    migrated.pipSpentTotal = 0;
    migrated.pipRespecCount = 0;
  }
  if (sourceSchemaVersion < 9) {
    migrated.activeChallengeRun = getDefaultActiveChallengeRun();
    migrated.challengeHistory = getDefaultChallengeHistory();
    migrated.challengeRewardsUnlocked = getDefaultChallengeRewardsUnlocked();
    migrated.challengeLastResult = getDefaultChallengeLastResult();
  }
  if (sourceSchemaVersion < 10) {
    const legacyResearchHutLevel = clampNonNegative(Math.floor(Number(migrated.researchHutLevel) || 0));
    migrated.researchLabLevel = clampNonNegative(
      Number.isFinite(Number(migrated.researchLabLevel))
        ? Math.floor(Number(migrated.researchLabLevel))
        : legacyResearchHutLevel
    );
    migrated.financeOfficeLevel = clampNonNegative(
      Number.isFinite(Number(migrated.financeOfficeLevel))
        ? Math.floor(Number(migrated.financeOfficeLevel))
        : legacyResearchHutLevel
    );
  }
  if (sourceSchemaVersion < 11) {
    migrated.casino = getDefaultCasinoState();
  }
  if (sourceSchemaVersion < 13) {
    migrated.casino = {
      ...getDefaultCasinoState(),
      ...(migrated.casino || {}),
    };
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

  const rawLevel = clampNonNegative(Math.floor(Number(gameState[config.stateKey]) || 0));
  const maxLevel = Number.isFinite(Number(config.maxLevel)) ? Math.max(0, Math.floor(Number(config.maxLevel))) : null;
  return maxLevel == null ? rawLevel : Math.min(rawLevel, maxLevel);
}

function getConverterLevel(converterId) {
  const converter = WEIRD_SCIENCE_CONVERTERS[converterId];
  if (!converter) {
    return 0;
  }

  return clampNonNegative(Math.floor(Number(gameState[converter.stateKey]) || 0));
}

function getPackingShedMultiplier() {
  const baseMultiplier = 1 + getBuildingLevel("packing_shed") * 0.04;
  const tierIndex = Math.max(0, Math.floor(Number(gameState.treeTierIndex) || 0));
  if (tierIndex >= 5) {
    return baseMultiplier * 1.6;
  }
  if (tierIndex >= 3) {
    return baseMultiplier * 1.25;
  }
  return baseMultiplier;
}

function getFertilizerLabMultiplier() {
  return 1 + getBuildingLevel("fertilizer_lab") * 0.08;
}

function getResearchDiscountMultiplier() {
  const pipModifiers = getPipModifiers();
  return Math.max(0.35, (1 - getBuildingLevel("finance_office") * 0.03) * pipModifiers.researchDiscountMultiplier);
}

function getEffectiveCashCost(baseCost) {
  const safeBaseCost = Math.max(0, Number(baseCost) || 0);
  return stabilizeNumber(safeBaseCost * getResearchDiscountMultiplier());
}

function getAntimatterExportBoostMultiplier() {
  const antimatter = clampNonNegative(Number(gameState.antimatterBananas) || 0);
  // Strong late-game reward curve for weird science progression.
  return stabilizeNumber(1 + Math.log10(antimatter + 1) * 4);
}

function getCeoLevelFromTotalBananas(totalBananasEarned) {
  const total = clampNonNegative(Number(totalBananasEarned) || 0);
  return Math.max(1, Math.floor(Math.log10(total + 1)) + 1);
}

function getCeoGlobalMultiplier() {
  const level = getCeoLevelFromTotalBananas(gameState.totalBananasEarned);
  return stabilizeNumber(CEO_LEVEL_MULTIPLIER_BASE ** Math.max(0, level - 1));
}

function getResearchCompletionMultipliers() {
  const purchased = new Set(gameState.purchasedUpgradeIds);
  const multipliers = {
    productionMultiplier: 1,
    clickMultiplier: 1,
    exportPriceMultiplier: 1,
  };

  const categories = ["Farming Tech", "Logistics", "Finance", "Weird Science"];
  categories.forEach((category) => {
    const nodes = upgrades.filter((node) => node.category === category);
    if (nodes.length === 0) {
      return;
    }

    const rows = Array.from(new Set(nodes.map((node) => Number(node.row) || 0)));
    let completedRows = 0;
    rows.forEach((row) => {
      const rowNodes = nodes.filter((node) => (Number(node.row) || 0) === row);
      if (rowNodes.length > 0 && rowNodes.every((node) => purchased.has(node.id))) {
        completedRows += 1;
      }
    });

    if (category === "Farming Tech") {
      multipliers.productionMultiplier *= 1.12 ** completedRows;
      if (completedRows === rows.length) {
        multipliers.productionMultiplier *= 1.25;
      }
    } else if (category === "Logistics") {
      multipliers.exportPriceMultiplier *= 1.12 ** completedRows;
      if (completedRows === rows.length) {
        multipliers.exportPriceMultiplier *= 1.25;
      }
    } else if (category === "Finance") {
      multipliers.exportPriceMultiplier *= 1.1 ** completedRows;
      multipliers.clickMultiplier *= 1.05 ** completedRows;
      if (completedRows === rows.length) {
        multipliers.exportPriceMultiplier *= 1.2;
      }
    } else if (category === "Weird Science") {
      multipliers.clickMultiplier *= 1.14 ** completedRows;
      multipliers.productionMultiplier *= 1.06 ** completedRows;
      if (completedRows === rows.length) {
        multipliers.clickMultiplier *= 1.25;
      }
    }
  });

  return {
    productionMultiplier: stabilizeNumber(multipliers.productionMultiplier),
    clickMultiplier: stabilizeNumber(multipliers.clickMultiplier),
    exportPriceMultiplier: stabilizeNumber(multipliers.exportPriceMultiplier),
  };
}

function getEffectiveShippingLaneCapacity(lane) {
  const safeLane = lane || shippingLanes[0];
  const baseCapacity = Math.max(1, Math.floor(Number(safeLane.capacity) || 1));
  const tierIndex = Math.max(0, Math.floor(Number(gameState.treeTierIndex) || 0));
  const tierMultiplier = 1 + tierIndex * SHIPPING_CAPACITY_PER_TIER;
  const pipModifiers = getPipModifiers();
  const challenge = resolveChallengeContext().resolved;
  const reward = resolveAscensionRewardContext().resolved;
  return Math.max(1, Math.floor(baseCapacity * tierMultiplier * pipModifiers.shippingCapacityMultiplier * challenge.shippingCapacityMultiplier * reward.shippingCapacityMultiplier));
}

function getTierPickerUpdateCaps() {
  const tierIndex = Math.max(0, Math.floor(Number(gameState.treeTierIndex) || 0));
  return {
    maxWorkerPicksPerUpdate: 2 + Math.floor(tierIndex / 2),
    maxOrchardPicksPerUpdate: 3 + Math.floor(tierIndex / 2),
    maxMonkeyPicksPerUpdate: 2 + Math.floor(tierIndex / 3),
  };
}

function getOrchardSystemBonuses() {
  const orchardsOwned = Math.max(0, Math.floor(Number(gameState.orchardsOwned) || 0));
  const challenge = resolveChallengeContext().resolved;
  const capacityBonus = orchardsOwned * ORCHARD_CAPACITY_BONUS_PER_ORCHARD;
  const spawnIntervalMultiplier = Math.max(
    ORCHARD_MIN_SPAWN_INTERVAL_MULTIPLIER,
    1 - orchardsOwned * ORCHARD_SPAWN_INTERVAL_STEP
  );
  const exportBonusMultiplier = Math.min(
    ORCHARD_MAX_EXPORT_BONUS,
    1 + orchardsOwned * ORCHARD_EXPORT_BONUS_PER_ORCHARD
  );
  return {
    orchardsOwned,
    capacityBonus: Math.max(0, Math.floor(capacityBonus * challenge.orchardCapacityMultiplier)),
    spawnIntervalMultiplier: stabilizeNumber(spawnIntervalMultiplier * challenge.orchardSpawnIntervalMultiplier),
    exportBonusMultiplier: stabilizeNumber(1 + (exportBonusMultiplier - 1) * challenge.orchardExportMultiplier),
  };
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
  const pipModifiers = getPipModifiers();
  const orchardBonuses = getOrchardSystemBonuses();
  const ceoGlobalMultiplier = getCeoGlobalMultiplier();
  const researchCompletionMultipliers = getResearchCompletionMultipliers();
  const challengeContext = resolveChallengeContext();
  const challengeModifiers = challengeContext.resolved;
  const rewardModifiers = resolveAscensionRewardContext().resolved;
  gameState.casino.unlocked = Boolean(pipModifiers.casinoUnlocked);

  gameState.productionMultiplier = Math.max(0, stabilizeNumber(upgradeModifiers.productionMultiplier * prestigeBonuses.productionMultiplier * gameState.evolutionProductionMultiplier * achievementMultipliers.productionMultiplier * pipModifiers.productionMultiplier * ceoGlobalMultiplier * researchCompletionMultipliers.productionMultiplier * challengeModifiers.productionMultiplier * rewardModifiers.productionMultiplier));
  gameState.clickMultiplier = Math.max(0, stabilizeNumber(upgradeModifiers.clickMultiplier * prestigeBonuses.clickMultiplier * achievementMultipliers.clickMultiplier * pipModifiers.clickMultiplier * researchCompletionMultipliers.clickMultiplier * challengeModifiers.clickMultiplier * rewardModifiers.clickMultiplier));
  gameState.exportPriceMultiplier = Math.max(
    0,
    stabilizeNumber(
      upgradeModifiers.exportPriceMultiplier *
        prestigeBonuses.exportPriceMultiplier *
        packingMultiplier *
        achievementMultipliers.exportPriceMultiplier *
        pipModifiers.exportPriceMultiplier *
        orchardBonuses.exportBonusMultiplier *
        ceoGlobalMultiplier *
        researchCompletionMultipliers.exportPriceMultiplier *
        challengeModifiers.exportPriceMultiplier *
        rewardModifiers.exportPriceMultiplier
    )
  );
  gameState.exportCooldownMultiplier = Math.max(0.1, stabilizeNumber(upgradeModifiers.exportCooldownMultiplier * pipModifiers.exportCooldownMultiplier * challengeModifiers.exportCooldownMultiplier * rewardModifiers.exportCooldownMultiplier));
  gameState.packedExportBonusMultiplier = stabilizeNumber(packingMultiplier);
  gameState.orchardExportBonusMultiplier = orchardBonuses.exportBonusMultiplier;

  const tier = treeTiers[gameState.treeTierIndex];
  const tierHarvest = tier?.harvest || {};
  gameState.bananasPerTreePerSecond = stabilizeNumber(tier.baseBananasPerSecondPerTree * gameState.productionMultiplier);

  const workerBase = clampNonNegative(Number(gameState.workersBasePerSecond) || DEFAULT_STATE.workersBasePerSecond);
  const workerPrestigeMultiplier = 1 + Math.max(0, gameState.pip) * 0.005;
  // Production multipliers must affect real active-income paths (workers + tree harvest),
  // not only legacy per-tree passive stats that are no longer used for earning.
  gameState.bananasPerWorkerPerSecond = stabilizeNumber(
    workerBase * workerPrestigeMultiplier * achievementMultipliers.workerMultiplier * gameState.productionMultiplier * challengeModifiers.workerOutputMultiplier
  );
  gameState.clickYield = stabilizeNumber(BASE_CLICK_YIELD * gameState.clickMultiplier);

  const ownedTrees = clampNonNegative(gameState.treesOwned);
  const treeCapacityBonusFromTrees = Math.floor(ownedTrees * 0.75);
  // Trees keep helping at high ownership while still using diminishing returns.
  const spawnIntervalMultiplierFromTrees = 1 / (1 + Math.log1p(ownedTrees) * 0.35);
  const fertilizerLabLevel = getBuildingLevel("fertilizer_lab");
  const fertilizerSpawnMultiplier = 1 / (1 + fertilizerLabLevel * 0.06);
  const fertilizerCapacityBonus = Math.floor(fertilizerLabLevel * 0.5);

  treeHarvestSystem.applyModifiers({
    spawnInterval:
      1.5 *
      (Number(tierHarvest.spawnIntervalMultiplier) || 1) *
      treeHarvestModifiers.spawnIntervalMultiplier *
      pipModifiers.spawnIntervalMultiplier *
      spawnIntervalMultiplierFromTrees *
      orchardBonuses.spawnIntervalMultiplier *
      fertilizerSpawnMultiplier *
      challengeModifiers.spawnIntervalMultiplier,
    maxBananasOnTree:
      12 +
      (Number(tierHarvest.maxBananasBonus) || 0) +
      treeHarvestModifiers.maxBananasFlat +
      pipModifiers.maxBananasFlat +
      treeCapacityBonusFromTrees +
      orchardBonuses.capacityBonus +
      fertilizerCapacityBonus +
      challengeModifiers.maxBananasAdd,
    clickHarvestYield:
      gameState.clickYield *
      gameState.productionMultiplier *
      (Number(tierHarvest.clickYieldMultiplier) || 1) *
      treeHarvestModifiers.clickYieldMultiplier *
      pipModifiers.clickYieldMultiplier *
      challengeModifiers.clickYieldMultiplier,
    goldenChance: 0.005 + (Number(tierHarvest.goldenChanceAdd) || 0) + treeHarvestModifiers.goldenChanceAdd + pipModifiers.goldenChanceAdd,
    goldenMultiplier: 35 + (Number(tierHarvest.goldenMultiplierAdd) || 0) + treeHarvestModifiers.goldenMultiplierAdd + pipModifiers.goldenMultiplierAdd,
    diamondChance: 0.0005 + (Number(tierHarvest.diamondChanceAdd) || 0) + treeHarvestModifiers.diamondChanceAdd,
    diamondMultiplier: 200 + (Number(tierHarvest.diamondMultiplierAdd) || 0) + treeHarvestModifiers.diamondMultiplierAdd,
    monkeyPickerInterval: treeHarvestModifiers.monkeyPickerInterval,
    shakeCooldownSeconds: 35 * (Number(tierHarvest.shakeCooldownMultiplier) || 1) * treeHarvestModifiers.shakeCooldownMultiplier * pipModifiers.shakeCooldownMultiplier,
    shakeDisabled: !challengeModifiers.shakeEnabled,
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
  return 1 + rep * 0.0025 + (rep * rep) * 0.00003;
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

function getPipUpgradeRank(upgradeId) {
  return clampNonNegative(Math.floor(Number(gameState.purchasedPipUpgrades?.[upgradeId]) || 0));
}

export function getPipModifiers() {
  const modifiers = {
    productionMultiplier: 1,
    clickMultiplier: 1,
    exportPriceMultiplier: 1,
    exportCooldownMultiplier: 1,
    workerPickMultiplier: 1,
    spawnIntervalMultiplier: 1,
    maxBananasFlat: 0,
    clickYieldMultiplier: 1,
    goldenChanceAdd: 0,
    goldenMultiplierAdd: 0,
    shakeCooldownMultiplier: 1,
    shippingCapacityMultiplier: 1,
    autoSellPriceMultiplier: 1,
    researchDiscountMultiplier: 1,
    orchardPickMultiplier: 1,
    casinoUnlocked: false,
    mississippiStudUnlocked: false,
    baccaratUnlocked: false,
  };

  pipUpgrades.forEach((upgrade) => {
    const rank = getPipUpgradeRank(upgrade.id);
    if (rank <= 0 || !upgrade.effect) {
      return;
    }
    const effect = upgrade.effect;
    if (effect.productionMultiplierPerRank) {
      modifiers.productionMultiplier *= effect.productionMultiplierPerRank ** rank;
    }
    if (effect.clickMultiplierPerRank) {
      modifiers.clickMultiplier *= effect.clickMultiplierPerRank ** rank;
    }
    if (effect.exportPriceMultiplierPerRank) {
      modifiers.exportPriceMultiplier *= effect.exportPriceMultiplierPerRank ** rank;
    }
    if (effect.exportCooldownMultiplierPerRank) {
      modifiers.exportCooldownMultiplier *= effect.exportCooldownMultiplierPerRank ** rank;
    }
    if (effect.workerPickMultiplierPerRank) {
      modifiers.workerPickMultiplier *= effect.workerPickMultiplierPerRank ** rank;
    }
    if (effect.spawnIntervalMultiplierPerRank) {
      modifiers.spawnIntervalMultiplier *= effect.spawnIntervalMultiplierPerRank ** rank;
    }
    if (effect.maxBananasFlatPerRank) {
      modifiers.maxBananasFlat += effect.maxBananasFlatPerRank * rank;
    }
    if (effect.clickYieldMultiplierPerRank) {
      modifiers.clickYieldMultiplier *= effect.clickYieldMultiplierPerRank ** rank;
    }
    if (effect.goldenChanceAddPerRank) {
      modifiers.goldenChanceAdd += effect.goldenChanceAddPerRank * rank;
    }
    if (effect.goldenMultiplierAddPerRank) {
      modifiers.goldenMultiplierAdd += effect.goldenMultiplierAddPerRank * rank;
    }
    if (effect.shakeCooldownMultiplierPerRank) {
      modifiers.shakeCooldownMultiplier *= effect.shakeCooldownMultiplierPerRank ** rank;
    }
    if (effect.shippingCapacityMultiplierPerRank) {
      modifiers.shippingCapacityMultiplier *= effect.shippingCapacityMultiplierPerRank ** rank;
    }
    if (effect.autoSellPriceMultiplierPerRank) {
      modifiers.autoSellPriceMultiplier *= effect.autoSellPriceMultiplierPerRank ** rank;
    }
    if (effect.researchDiscountMultiplierPerRank) {
      modifiers.researchDiscountMultiplier *= effect.researchDiscountMultiplierPerRank ** rank;
    }
    if (effect.orchardPickMultiplierPerRank) {
      modifiers.orchardPickMultiplier *= effect.orchardPickMultiplierPerRank ** rank;
    }
    if (effect.casinoUnlocked) {
      modifiers.casinoUnlocked = true;
    }
    if (effect.mississippiStudUnlocked) {
      modifiers.mississippiStudUnlocked = true;
    }
    if (effect.baccaratUnlocked) {
      modifiers.baccaratUnlocked = true;
    }
  });

  return {
    productionMultiplier: stabilizeNumber(modifiers.productionMultiplier),
    clickMultiplier: stabilizeNumber(modifiers.clickMultiplier),
    exportPriceMultiplier: stabilizeNumber(modifiers.exportPriceMultiplier),
    exportCooldownMultiplier: Math.max(0.2, stabilizeNumber(modifiers.exportCooldownMultiplier)),
    workerPickMultiplier: stabilizeNumber(modifiers.workerPickMultiplier),
    spawnIntervalMultiplier: Math.max(0.2, stabilizeNumber(modifiers.spawnIntervalMultiplier)),
    maxBananasFlat: Math.max(0, Math.floor(modifiers.maxBananasFlat)),
    clickYieldMultiplier: stabilizeNumber(modifiers.clickYieldMultiplier),
    goldenChanceAdd: Math.max(0, stabilizeNumber(modifiers.goldenChanceAdd)),
    goldenMultiplierAdd: Math.max(0, stabilizeNumber(modifiers.goldenMultiplierAdd)),
    shakeCooldownMultiplier: Math.max(0.2, stabilizeNumber(modifiers.shakeCooldownMultiplier)),
    shippingCapacityMultiplier: stabilizeNumber(modifiers.shippingCapacityMultiplier),
    autoSellPriceMultiplier: stabilizeNumber(modifiers.autoSellPriceMultiplier),
    researchDiscountMultiplier: Math.max(0.5, stabilizeNumber(modifiers.researchDiscountMultiplier)),
    orchardPickMultiplier: stabilizeNumber(modifiers.orchardPickMultiplier),
    casinoUnlocked: Boolean(modifiers.casinoUnlocked),
    mississippiStudUnlocked: Boolean(modifiers.mississippiStudUnlocked),
    baccaratUnlocked: Boolean(modifiers.baccaratUnlocked),
  };
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
  if (elapsedSinceGen >= CONTRACT_GENERATION_INTERVAL_SECONDS && gameState.activeContracts.length < getMaxActiveContracts()) {
    const newContract = createContract();
    if (newContract) {
      gameState.activeContracts = [...gameState.activeContracts, newContract];
    }
    gameState.lastContractGenerationTime = nowMs;
  }
}

function getMaxActiveContracts() {
  const reward = resolveAscensionRewardContext().resolved;
  return Math.max(1, MAX_ACTIVE_CONTRACTS + reward.maxActiveContractsAdd);
}

export function getResearchPointsPerSecond() {
  const achievementMultipliers = getAchievementMultipliers();
  const challenge = resolveChallengeContext().resolved;
  const reward = resolveAscensionRewardContext().resolved;
  return stabilizeNumber(gameState.researchLabLevel * 0.06 * achievementMultipliers.researchMultiplier * challenge.researchPointMultiplier * reward.researchPointMultiplier);
}

function hasResearchPrerequisites(upgrade) {
  const prereqs = Array.isArray(upgrade.prerequisites) ? upgrade.prerequisites : [];
  return prereqs.every((prereqId) => gameState.purchasedUpgradeIds.includes(prereqId));
}

function refreshUnlockedResearchNodes() {
  const unlocked = new Set(gameState.unlockedResearchNodeIds);
  upgrades.forEach((upgrade) => {
    const categoryUnlocked = gameState.unlockedUpgradeCategories.includes(getUpgradeCategory(upgrade));
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
  const pipSquared = pip * pip;
  return {
    productionMultiplier: 1 + pip * 0.02 + pipSquared * 0.0002,
    exportPriceMultiplier: 1 + pip * 0.015 + pipSquared * 0.00015,
    clickMultiplier: 1 + pip * 0.01 + pipSquared * 0.0001,
  };
}

export function isPrestigeUnlocked() {
  const unlockedByProgress = gameState.treeTierIndex >= PRESTIGE_UNLOCK_TIER_INDEX || gameState.totalBananasEarned >= PRESTIGE_UNLOCK_TOTAL_BANANAS;
  const challengeAllowsPrestige = resolveChallengeContext().resolved.prestigeEnabled;
  return unlockedByProgress && challengeAllowsPrestige;
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

function getCasinoBlackjackState() {
  if (!gameState.casino || typeof gameState.casino !== "object") {
    gameState.casino = getDefaultCasinoState();
  }
  if (!gameState.casino.blackjack || typeof gameState.casino.blackjack !== "object") {
    gameState.casino.blackjack = getDefaultBlackjackState();
  }
  return gameState.casino.blackjack;
}

function getCasinoMississippiStudState() {
  if (!gameState.casino || typeof gameState.casino !== "object") {
    gameState.casino = getDefaultCasinoState();
  }
  if (!gameState.casino.mississippiStud || typeof gameState.casino.mississippiStud !== "object") {
    gameState.casino.mississippiStud = getDefaultMississippiStudState();
  }
  return gameState.casino.mississippiStud;
}

function getCasinoBaccaratState() {
  if (!gameState.casino || typeof gameState.casino !== "object") {
    gameState.casino = getDefaultCasinoState();
  }
  if (!gameState.casino.baccarat || typeof gameState.casino.baccarat !== "object") {
    gameState.casino.baccarat = getDefaultBaccaratState();
  }
  return gameState.casino.baccarat;
}

function createBlackjackHand(cards, wager, options = {}) {
  return sanitizeBlackjackHand({
    id: options.id || `hand-${Math.random().toString(36).slice(2, 8)}`,
    cards,
    wager,
    doubled: false,
    splitFromAces: Boolean(options.splitFromAces),
    surrendered: false,
    stood: Boolean(options.stood),
    busted: false,
    resolved: false,
    result: null,
    payout: 0,
    actionCount: 0,
    insuranceResolved: false,
    isSplitHand: Boolean(options.isSplitHand),
  });
}

function drawBlackjackCard(blackjackState, faceUp = true) {
  if (!Array.isArray(blackjackState.deck) || blackjackState.deck.length <= 0) {
    blackjackState.deck = createShuffledBlackjackDeck();
  }
  const card = blackjackState.deck.shift();
  return { ...card, faceUp };
}

function getCurrentBlackjackHand(blackjackState = getCasinoBlackjackState()) {
  return blackjackState.playerHands[blackjackState.activeHandIndex] || null;
}

function getNextUnresolvedBlackjackHandIndex(blackjackState) {
  return blackjackState.playerHands.findIndex((hand) => !hand.resolved && !hand.stood && !hand.busted && !hand.surrendered);
}

function advanceBlackjackTurn(blackjackState) {
  const nextIndex = getNextUnresolvedBlackjackHandIndex(blackjackState);
  if (nextIndex >= 0) {
    blackjackState.activeHandIndex = nextIndex;
    blackjackState.tablePhase = BLACKJACK_PHASES.player_turn;
    blackjackState.canSurrender = Boolean(blackjackState.playerHands[nextIndex]?.actionCount === 0);
    return;
  }
  blackjackState.tablePhase = BLACKJACK_PHASES.dealer_turn;
  blackjackState.canSurrender = false;
}

function updateLargestSingleBet(stats, amount) {
  stats.largestSingleBet = Math.max(stats.largestSingleBet, Math.max(0, Number(amount) || 0));
}

function addCasinoWager(amount, gameKey = "blackjack") {
  const safeAmount = Math.max(0, Number(amount) || 0);
  if (safeAmount <= 0) {
    return;
  }
  if (gameKey === "mississippi_stud") {
    gameState.casino.mississippiStudStats.totalCashWagered = addStable(gameState.casino.mississippiStudStats.totalCashWagered, safeAmount);
    gameState.casino.mississippiStudStats.largestAnte = Math.max(gameState.casino.mississippiStudStats.largestAnte, safeAmount);
  } else if (gameKey === "baccarat") {
    gameState.casino.baccaratStats.totalCashWagered = addStable(gameState.casino.baccaratStats.totalCashWagered, safeAmount);
    updateLargestSingleBet(gameState.casino.baccaratStats, safeAmount);
  } else {
    gameState.casino.blackjackStats.totalCashWagered = addStable(gameState.casino.blackjackStats.totalCashWagered, safeAmount);
    updateLargestSingleBet(gameState.casino.blackjackStats, safeAmount);
  }
  gameState.casino.casinoStats.totalCasinoCashWagered = addStable(gameState.casino.casinoStats.totalCasinoCashWagered, safeAmount);
}

function finalizeBlackjackHandStats(hand, netChange) {
  const stats = gameState.casino.blackjackStats;
  stats.handsPlayed += 1;
  if (hand.result === "win" || hand.result === "blackjack") {
    stats.handsWon += 1;
    stats.currentWinStreak += 1;
    stats.bestWinStreak = Math.max(stats.bestWinStreak, stats.currentWinStreak);
  } else if (hand.result === "push") {
    stats.handsPushed += 1;
  } else if (hand.result === "surrender") {
    stats.handsSurrendered += 1;
    stats.currentWinStreak = 0;
  } else {
    stats.handsLost += 1;
    stats.currentWinStreak = 0;
  }
  if (hand.result === "blackjack") {
    stats.naturalBlackjacks += 1;
  }
  if (hand.busted) {
    stats.playerBusts += 1;
  }
  if (netChange > 0) {
    stats.totalCashWon = addStable(stats.totalCashWon, netChange);
    gameState.casino.casinoStats.totalCasinoCashWon = addStable(gameState.casino.casinoStats.totalCasinoCashWon, netChange);
    stats.largestSingleWin = Math.max(stats.largestSingleWin, netChange);
  } else if (netChange < 0) {
    stats.totalCashLost = addStable(stats.totalCashLost, Math.abs(netChange));
  }
}

function settleBlackjackHands(blackjackState) {
  const dealerValue = getBlackjackHandValue(blackjackState.dealerCards);
  if (dealerValue.isBust) {
    gameState.casino.blackjackStats.dealerBusts += 1;
  }

  const netResults = [];
  blackjackState.playerHands.forEach((hand) => {
    if (hand.resolved && (hand.result === "surrender" || hand.result === "bust")) {
      finalizeBlackjackHandStats(hand, hand.result === "surrender" ? -(hand.wager / 2) : -hand.wager);
      return;
    }

    const handValue = getBlackjackHandValue(hand.cards);
    const natural = isNaturalBlackjack(hand.cards) && !hand.isSplitHand;
    let payout = 0;
    let result = "loss";

    if (handValue.isBust) {
      result = "loss";
    } else if (dealerValue.isBust) {
      result = natural ? "blackjack" : "win";
      payout = natural ? hand.wager * 2.5 : hand.wager * 2;
    } else {
      const dealerNatural = isNaturalBlackjack(blackjackState.dealerCards);
      if (natural && !dealerNatural) {
        result = "blackjack";
        payout = hand.wager * 2.5;
      } else if (dealerNatural && natural) {
        result = "push";
        payout = hand.wager;
      } else if (handValue.total > dealerValue.total) {
        result = "win";
        payout = hand.wager * 2;
      } else if (handValue.total === dealerValue.total) {
        result = "push";
        payout = hand.wager;
      }
    }

    if (payout > 0) {
      addCash(payout);
    }
    hand.payout = stabilizeNumber(payout);
    hand.result = result;
    hand.resolved = true;
    const netChange = payout - hand.wager;
    netResults.push(netChange);
    finalizeBlackjackHandStats(hand, netChange);
  });

  blackjackState.handResultSummary = blackjackState.playerHands.map((hand, index) => `Hand ${index + 1}: ${hand.result || "loss"}`).join(" | ");
  blackjackState.tablePhase = BLACKJACK_PHASES.settled;
  blackjackState.activeHandIndex = 0;
  blackjackState.canSurrender = false;
}

function resolveDealerBlackjackPeek(blackjackState) {
  blackjackState.dealerHoleCardRevealed = true;
  blackjackState.dealerCards = blackjackState.dealerCards.map((card, index) => (index === 1 ? { ...card, faceUp: true } : card));
  const dealerNatural = isNaturalBlackjack(blackjackState.dealerCards);
  const insuranceBet = Math.max(0, Number(blackjackState.insuranceBet) || 0);
  if (!dealerNatural) {
    if (insuranceBet > 0) {
      gameState.casino.blackjackStats.totalCashLost = addStable(gameState.casino.blackjackStats.totalCashLost, insuranceBet);
      blackjackState.insuranceBet = 0;
    }
    const playerNatural = blackjackState.playerHands.some((hand) => isNaturalBlackjack(hand.cards) && !hand.isSplitHand);
    if (playerNatural) {
      settleBlackjackHands(blackjackState);
    } else {
      blackjackState.tablePhase = BLACKJACK_PHASES.player_turn;
      blackjackState.canSurrender = true;
    }
    return false;
  }

  if (insuranceBet > 0) {
    addCash(insuranceBet * 3);
    gameState.casino.blackjackStats.insuranceWins += 1;
    blackjackState.insuranceBet = 0;
  }
  settleBlackjackHands(blackjackState);
  return true;
}

function resetBlackjackRound(blackjackState, reasonText = "") {
  blackjackState.tablePhase = BLACKJACK_PHASES.idle;
  blackjackState.deck = [];
  blackjackState.dealerCards = [];
  blackjackState.dealerHoleCardRevealed = false;
  blackjackState.playerHands = [];
  blackjackState.activeHandIndex = 0;
  blackjackState.mainBet = 0;
  blackjackState.insuranceBet = 0;
  blackjackState.offeredInsurance = false;
  blackjackState.canSurrender = false;
  blackjackState.handResultSummary = reasonText;
  blackjackState.lastPlayedAt = Date.now();
}

function syncFavoriteCasinoGame(gameId = "blackjack") {
  gameState.casino.activeGameId = gameId;
  gameState.casino.casinoStats.favoriteGameId = gameId;
}

function resolveBlackjackDealerTurn(blackjackState) {
  blackjackState.dealerHoleCardRevealed = true;
  blackjackState.dealerCards = blackjackState.dealerCards.map((card, index) => (index === 1 ? { ...card, faceUp: true } : card));
  while (dealerShouldHit(blackjackState.dealerCards)) {
    blackjackState.dealerCards.push(drawBlackjackCard(blackjackState, true));
  }
  settleBlackjackHands(blackjackState);
}

function getOutstandingBlackjackStake(blackjackState) {
  const unresolvedHands = blackjackState.playerHands.filter((hand) => !hand.resolved).reduce((sum, hand) => sum + Math.max(0, Number(hand.wager) || 0), 0);
  return unresolvedHands + Math.max(0, Number(blackjackState.insuranceBet) || 0);
}

function canSurrenderCurrentBlackjackHand(blackjackState) {
  const hand = getCurrentBlackjackHand(blackjackState);
  return Boolean(
    blackjackState.tablePhase === BLACKJACK_PHASES.player_turn &&
    hand &&
    !hand.resolved &&
    !hand.isSplitHand &&
    hand.cards.length === 2 &&
    hand.actionCount === 0 &&
    blackjackState.canSurrender
  );
}

export function getCasinoStatus() {
  const casino = gameState.casino || getDefaultCasinoState();
  const pip = getPipModifiers();
  return {
    unlocked: Boolean(casino.unlocked),
    mississippiStudUnlocked: Boolean(pip.mississippiStudUnlocked),
    baccaratUnlocked: Boolean(pip.baccaratUnlocked),
    activeGameId: String(casino.activeGameId || "blackjack"),
    casinoStats: { ...casino.casinoStats },
    blackjackStats: { ...casino.blackjackStats },
    mississippiStudStats: { ...casino.mississippiStudStats },
    baccaratStats: { ...casino.baccaratStats },
  };
}

export function setCasinoActiveGame(gameId) {
  if (!gameState.casino.unlocked) {
    return false;
  }
  if (gameId === "mississippi_stud" && !getPipModifiers().mississippiStudUnlocked) {
    return false;
  }
  if (gameId === "baccarat" && !getPipModifiers().baccaratUnlocked) {
    return false;
  }
  if (!["blackjack", "mississippi_stud", "baccarat"].includes(gameId)) {
    return false;
  }
  syncFavoriteCasinoGame(gameId);
  notifyListeners();
  return true;
}

export function getBlackjackStatus() {
  const blackjackState = getCasinoBlackjackState();
  const currentHand = getCurrentBlackjackHand(blackjackState);
  const currentHandValue = currentHand ? getBlackjackHandValue(currentHand.cards) : null;
  return {
    unlocked: Boolean(gameState.casino.unlocked),
    activeGameId: gameState.casino.activeGameId,
    tablePhase: blackjackState.tablePhase,
    dealerCards: blackjackState.dealerCards.map((card, index) =>
      blackjackState.dealerHoleCardRevealed || index !== 1 ? { ...card, faceUp: true } : { ...card, faceUp: false }
    ),
    dealerValue: blackjackState.dealerHoleCardRevealed ? getBlackjackHandValue(blackjackState.dealerCards) : null,
    playerHands: blackjackState.playerHands.map((hand, index) => ({
      ...hand,
      displayValue: getBlackjackHandValue(hand.cards),
      isActive: index === blackjackState.activeHandIndex && blackjackState.tablePhase === BLACKJACK_PHASES.player_turn,
      canSplit: !hand.isSplitHand && canSplitBlackjackHand(hand) && hand.cards.length === 2,
      canDouble: hand.cards.length === 2 && !hand.resolved && !hand.splitFromAces,
    })),
    activeHandIndex: blackjackState.activeHandIndex,
    mainBet: blackjackState.mainBet,
    insuranceBet: blackjackState.insuranceBet,
    offeredInsurance: blackjackState.offeredInsurance,
    handResultSummary: blackjackState.handResultSummary,
    lastPlayedAt: blackjackState.lastPlayedAt,
    canDeal: gameState.casino.unlocked && (blackjackState.tablePhase === BLACKJACK_PHASES.idle || blackjackState.tablePhase === BLACKJACK_PHASES.settled),
    canHit: Boolean(currentHand && blackjackState.tablePhase === BLACKJACK_PHASES.player_turn && !currentHand.resolved && !currentHand.stood && !currentHand.splitFromAces && currentHandValue?.total < 21),
    canStand: Boolean(currentHand && blackjackState.tablePhase === BLACKJACK_PHASES.player_turn && !currentHand.resolved),
    canDouble: Boolean(currentHand && blackjackState.tablePhase === BLACKJACK_PHASES.player_turn && currentHand.cards.length === 2 && !currentHand.resolved && !currentHand.splitFromAces && gameState.cash >= currentHand.wager),
    canSplit: Boolean(currentHand && blackjackState.tablePhase === BLACKJACK_PHASES.player_turn && !currentHand.isSplitHand && canSplitBlackjackHand(currentHand) && gameState.cash >= currentHand.wager),
    canTakeInsurance: blackjackState.tablePhase === BLACKJACK_PHASES.insurance_offer && gameState.cash >= Math.floor(Math.max(0, blackjackState.mainBet) / 2),
    canDeclineInsurance: blackjackState.tablePhase === BLACKJACK_PHASES.insurance_offer,
    canSurrender: canSurrenderCurrentBlackjackHand(blackjackState),
    outstandingStake: getOutstandingBlackjackStake(blackjackState),
    blackjackStats: { ...gameState.casino.blackjackStats },
    casinoStats: { ...gameState.casino.casinoStats },
  };
}

export function cancelCasinoRound(reason = "round_cancelled") {
  if (gameState.casino.activeGameId === "mississippi_stud") {
    return cancelMississippiStudRound(reason);
  }
  if (gameState.casino.activeGameId === "baccarat") {
    return cancelBaccaratRound(reason);
  }
  const blackjackState = getCasinoBlackjackState();
  const outstandingStake = getOutstandingBlackjackStake(blackjackState);
  if (outstandingStake > 0) {
    addCash(outstandingStake);
  }
  resetBlackjackRound(blackjackState, `Round cancelled: ${String(reason).replace(/_/g, " ")}`);
  notifyListeners();
  return true;
}

export function startBlackjackHand(betCash) {
  if (!gameState.casino.unlocked) {
    return { success: false, reason: "casino_locked" };
  }
  const safeBet = Math.max(0, Math.floor(Number(betCash) || 0));
  if (safeBet <= 0 || safeBet > gameState.cash) {
    return { success: false, reason: "invalid_bet" };
  }
  const blackjackState = getCasinoBlackjackState();
  if (![BLACKJACK_PHASES.idle, BLACKJACK_PHASES.settled].includes(blackjackState.tablePhase)) {
    return { success: false, reason: "round_already_active" };
  }

  removeCash(safeBet);
  addCasinoWager(safeBet, "blackjack");
  syncFavoriteCasinoGame("blackjack");
  gameState.casino.casinoStats.totalGamesPlayed += 1;
  blackjackState.deck = createShuffledBlackjackDeck();
  blackjackState.dealerCards = [drawBlackjackCard(blackjackState, true), drawBlackjackCard(blackjackState, false)];
  blackjackState.playerHands = [
    createBlackjackHand([drawBlackjackCard(blackjackState, true), drawBlackjackCard(blackjackState, true)], safeBet),
  ];
  blackjackState.dealerHoleCardRevealed = false;
  blackjackState.activeHandIndex = 0;
  blackjackState.mainBet = safeBet;
  blackjackState.insuranceBet = 0;
  blackjackState.offeredInsurance = false;
  blackjackState.canSurrender = true;
  blackjackState.handResultSummary = "";
  blackjackState.lastPlayedAt = Date.now();
  blackjackState.tablePhase = BLACKJACK_PHASES.player_turn;

  const dealerUpcard = blackjackState.dealerCards[0];
  const playerNatural = isNaturalBlackjack(blackjackState.playerHands[0].cards);
  if (dealerUpcard?.rank === "A") {
    blackjackState.offeredInsurance = true;
    blackjackState.tablePhase = BLACKJACK_PHASES.insurance_offer;
  } else if (isTenValueCard(dealerUpcard)) {
    resolveDealerBlackjackPeek(blackjackState);
  } else if (playerNatural) {
    blackjackState.dealerHoleCardRevealed = true;
    blackjackState.dealerCards = blackjackState.dealerCards.map((card) => ({ ...card, faceUp: true }));
    settleBlackjackHands(blackjackState);
  }

  notifyListeners();
  return { success: true };
}

export function declineInsuranceBlackjack() {
  const blackjackState = getCasinoBlackjackState();
  if (blackjackState.tablePhase !== BLACKJACK_PHASES.insurance_offer) {
    return false;
  }
  blackjackState.offeredInsurance = false;
  resolveDealerBlackjackPeek(blackjackState);
  notifyListeners();
  return true;
}

export function takeInsuranceBlackjack() {
  const blackjackState = getCasinoBlackjackState();
  const insuranceStake = Math.floor(Math.max(0, Number(blackjackState.mainBet) || 0) / 2);
  if (blackjackState.tablePhase !== BLACKJACK_PHASES.insurance_offer || insuranceStake <= 0 || gameState.cash < insuranceStake) {
    return false;
  }
  removeCash(insuranceStake);
  addCasinoWager(insuranceStake, "blackjack");
  blackjackState.insuranceBet = insuranceStake;
  blackjackState.offeredInsurance = false;
  gameState.casino.blackjackStats.insuranceBetsPlaced += 1;
  resolveDealerBlackjackPeek(blackjackState);
  notifyListeners();
  return true;
}

export function hitBlackjack() {
  const blackjackState = getCasinoBlackjackState();
  const hand = getCurrentBlackjackHand(blackjackState);
  if (!hand || blackjackState.tablePhase !== BLACKJACK_PHASES.player_turn || hand.resolved || hand.splitFromAces) {
    return false;
  }
  hand.cards.push(drawBlackjackCard(blackjackState, true));
  hand.actionCount += 1;
  blackjackState.canSurrender = false;
  const value = getBlackjackHandValue(hand.cards);
  if (value.isBust) {
    hand.busted = true;
    hand.resolved = true;
    hand.result = "bust";
    advanceBlackjackTurn(blackjackState);
  } else if (value.total >= 21) {
    hand.stood = true;
    advanceBlackjackTurn(blackjackState);
  }
  if (blackjackState.tablePhase === BLACKJACK_PHASES.dealer_turn) {
    resolveBlackjackDealerTurn(blackjackState);
  }
  notifyListeners();
  return true;
}

export function standBlackjack() {
  const blackjackState = getCasinoBlackjackState();
  const hand = getCurrentBlackjackHand(blackjackState);
  if (!hand || blackjackState.tablePhase !== BLACKJACK_PHASES.player_turn || hand.resolved) {
    return false;
  }
  hand.stood = true;
  advanceBlackjackTurn(blackjackState);
  if (blackjackState.tablePhase === BLACKJACK_PHASES.dealer_turn) {
    resolveBlackjackDealerTurn(blackjackState);
  }
  notifyListeners();
  return true;
}

export function doubleDownBlackjack() {
  const blackjackState = getCasinoBlackjackState();
  const hand = getCurrentBlackjackHand(blackjackState);
  if (!hand || blackjackState.tablePhase !== BLACKJACK_PHASES.player_turn || hand.cards.length !== 2 || hand.resolved || hand.splitFromAces || gameState.cash < hand.wager) {
    return false;
  }
  removeCash(hand.wager);
  addCasinoWager(hand.wager, "blackjack");
  hand.wager = stabilizeNumber(hand.wager * 2);
  hand.doubled = true;
  hand.actionCount += 1;
  gameState.casino.blackjackStats.doubleDownHands += 1;
  hand.cards.push(drawBlackjackCard(blackjackState, true));
  const value = getBlackjackHandValue(hand.cards);
  if (value.isBust) {
    hand.busted = true;
    hand.resolved = true;
    hand.result = "bust";
  } else {
    hand.stood = true;
  }
  blackjackState.canSurrender = false;
  advanceBlackjackTurn(blackjackState);
  if (blackjackState.tablePhase === BLACKJACK_PHASES.dealer_turn) {
    resolveBlackjackDealerTurn(blackjackState);
  }
  notifyListeners();
  return true;
}

export function splitBlackjack() {
  const blackjackState = getCasinoBlackjackState();
  const hand = getCurrentBlackjackHand(blackjackState);
  if (!hand || blackjackState.tablePhase !== BLACKJACK_PHASES.player_turn || hand.isSplitHand || !canSplitBlackjackHand(hand) || gameState.cash < hand.wager) {
    return false;
  }

  const splitIndex = blackjackState.activeHandIndex;
  removeCash(hand.wager);
  addCasinoWager(hand.wager, "blackjack");
  gameState.casino.blackjackStats.splitHandsCreated += 1;
  const isAces = hand.cards[0]?.rank === "A";
  const leftHand = createBlackjackHand([hand.cards[0], drawBlackjackCard(blackjackState, true)], hand.wager, {
    id: hand.id,
    splitFromAces: isAces,
    stood: isAces,
    isSplitHand: true,
  });
  const rightHand = createBlackjackHand([hand.cards[1], drawBlackjackCard(blackjackState, true)], hand.wager, {
    splitFromAces: isAces,
    stood: isAces,
    isSplitHand: true,
  });
  if (isAces) {
    leftHand.actionCount = 1;
    rightHand.actionCount = 1;
  }
  blackjackState.playerHands.splice(splitIndex, 1, leftHand, rightHand);
  blackjackState.canSurrender = false;
  advanceBlackjackTurn(blackjackState);
  if (!isAces) {
    blackjackState.activeHandIndex = splitIndex;
    blackjackState.tablePhase = BLACKJACK_PHASES.player_turn;
  } else if (blackjackState.tablePhase === BLACKJACK_PHASES.dealer_turn) {
    resolveBlackjackDealerTurn(blackjackState);
  }
  notifyListeners();
  return true;
}

export function surrenderBlackjack() {
  const blackjackState = getCasinoBlackjackState();
  const hand = getCurrentBlackjackHand(blackjackState);
  if (!hand || !canSurrenderCurrentBlackjackHand(blackjackState)) {
    return false;
  }
  hand.surrendered = true;
  hand.resolved = true;
  hand.result = "surrender";
  hand.payout = stabilizeNumber(hand.wager / 2);
  addCash(hand.payout);
  advanceBlackjackTurn(blackjackState);
  if (blackjackState.tablePhase === BLACKJACK_PHASES.dealer_turn) {
    resolveBlackjackDealerTurn(blackjackState);
  }
  notifyListeners();
  return true;
}

function drawMississippiStudCard(studState, faceUp = true) {
  if (!Array.isArray(studState.deck) || studState.deck.length <= 0) {
    studState.deck = createShuffledMississippiStudDeck();
  }
  const card = studState.deck.shift();
  return { ...card, faceUp };
}

function resetMississippiStudRound(studState, reasonText = "") {
  studState.tablePhase = MISSISSIPPI_STUD_PHASES.idle;
  studState.deck = [];
  studState.playerCards = [];
  studState.communityCards = [];
  studState.revealedCommunityCount = 0;
  studState.anteBet = 0;
  studState.streetBets = [0, 0, 0];
  studState.currentDecisionIndex = 0;
  studState.handRank = "";
  studState.payoutMultiplier = 0;
  studState.totalPayout = 0;
  studState.resultText = reasonText;
  studState.lastPlayedAt = Date.now();
  studState.folded = false;
}

function getMississippiStudPhaseForDecision(index) {
  return [MISSISSIPPI_STUD_PHASES.first_decision, MISSISSIPPI_STUD_PHASES.second_decision, MISSISSIPPI_STUD_PHASES.third_decision][index] || MISSISSIPPI_STUD_PHASES.settled;
}

function finalizeMississippiStudStats(result, totalWager, netChange) {
  const stats = gameState.casino.mississippiStudStats;
  stats.handsPlayed += 1;
  if (result.qualifies) {
    stats.handsWon += 1;
    stats.currentWinStreak += 1;
    stats.bestWinStreak = Math.max(stats.bestWinStreak, stats.currentWinStreak);
  } else {
    stats.handsLost += 1;
    stats.currentWinStreak = 0;
  }
  if (netChange > 0) {
    stats.totalCashWon = addStable(stats.totalCashWon, netChange);
    gameState.casino.casinoStats.totalCasinoCashWon = addStable(gameState.casino.casinoStats.totalCasinoCashWon, netChange);
    stats.largestPayout = Math.max(stats.largestPayout, netChange + totalWager);
  } else if (netChange < 0) {
    stats.totalCashLost = addStable(stats.totalCashLost, Math.abs(netChange));
  }

  const rankStatKey = {
    royal_flush: "royalFlushes",
    straight_flush: "straightFlushes",
    four_kind: "fourKind",
    full_house: "fullHouses",
    flush: "flushes",
    straight: "straights",
    three_kind: "threeKind",
    two_pair: "twoPair",
    high_pair: "highPairs",
  }[result.rankId];
  if (rankStatKey) {
    stats[rankStatKey] += 1;
  }
}

function settleMississippiStudRound(studState) {
  const result = evaluateMississippiStudHand(studState);
  const totalWager = getMississippiStudCommittedWager(studState);
  const payoutMultiplier = Math.max(0, Number(result.payoutMultiplier) || 0);
  const totalReturn = result.qualifies ? stabilizeNumber(totalWager * (1 + payoutMultiplier)) : 0;
  if (totalReturn > 0) {
    addCash(totalReturn);
  }
  studState.revealedCommunityCount = 3;
  studState.handRank = result.rankName;
  studState.payoutMultiplier = payoutMultiplier;
  studState.totalPayout = totalReturn;
  studState.tablePhase = MISSISSIPPI_STUD_PHASES.settled;
  studState.resultText = result.qualifies
    ? `${result.rankName} pays ${payoutMultiplier}:1 on total action.`
    : `${result.rankName} does not qualify.`;
  const netChange = totalReturn - totalWager;
  finalizeMississippiStudStats(result, totalWager, netChange);
}

function advanceMississippiStudRound(studState) {
  if (studState.currentDecisionIndex >= 2) {
    settleMississippiStudRound(studState);
    return;
  }
  studState.revealedCommunityCount = Math.max(studState.revealedCommunityCount, studState.currentDecisionIndex + 1);
  studState.currentDecisionIndex += 1;
  if (studState.currentDecisionIndex >= 3) {
    settleMississippiStudRound(studState);
    return;
  }
  studState.tablePhase = getMississippiStudPhaseForDecision(studState.currentDecisionIndex);
  studState.resultText = `Street ${studState.currentDecisionIndex + 1}: choose 1x, 2x, or 3x ante.`;
}

export function getMississippiStudStatus() {
  const studState = getCasinoMississippiStudState();
  const fullHand = [...studState.playerCards, ...studState.communityCards];
  const evaluation = studState.tablePhase === MISSISSIPPI_STUD_PHASES.settled ? evaluateMississippiStudHand(studState) : null;
  const currentPhase = studState.tablePhase;
  const canDeal = gameState.casino.unlocked && [MISSISSIPPI_STUD_PHASES.idle, MISSISSIPPI_STUD_PHASES.settled, MISSISSIPPI_STUD_PHASES.folded].includes(currentPhase);
  const canBetStreet = [MISSISSIPPI_STUD_PHASES.first_decision, MISSISSIPPI_STUD_PHASES.second_decision, MISSISSIPPI_STUD_PHASES.third_decision].includes(currentPhase);
  const anteBet = Math.max(0, Number(studState.anteBet) || 0);
  return {
    unlocked: Boolean(gameState.casino.unlocked),
    activeGameId: gameState.casino.activeGameId,
    tablePhase: currentPhase,
    playerCards: studState.playerCards.map((card) => ({ ...card, faceUp: true })),
    communityCards: getVisibleMississippiStudCommunityCards(studState),
    anteBet,
    streetBets: [...studState.streetBets],
    currentDecisionIndex: studState.currentDecisionIndex,
    totalCommitted: getMississippiStudCommittedWager(studState),
    handRank: studState.handRank,
    payoutMultiplier: studState.payoutMultiplier,
    totalPayout: studState.totalPayout,
    resultText: studState.resultText,
    lastPlayedAt: studState.lastPlayedAt,
    canDeal,
    canBet1x: canBetStreet && gameState.cash >= anteBet,
    canBet2x: canBetStreet && gameState.cash >= anteBet * 2,
    canBet3x: canBetStreet && gameState.cash >= anteBet * 3,
    canFold: canBetStreet,
    evaluation,
    fullHand,
    stats: { ...gameState.casino.mississippiStudStats },
    paytable: MISSISSIPPI_STUD_PAYTABLE,
  };
}

export function startMississippiStudHand(anteBet) {
  const pip = getPipModifiers();
  if (!gameState.casino.unlocked || !pip.mississippiStudUnlocked) {
    return { success: false, reason: "casino_locked" };
  }
  const safeAnte = Math.max(0, Math.floor(Number(anteBet) || 0));
  if (safeAnte <= 0 || safeAnte > gameState.cash) {
    return { success: false, reason: "invalid_bet" };
  }
  const studState = getCasinoMississippiStudState();
  if (![MISSISSIPPI_STUD_PHASES.idle, MISSISSIPPI_STUD_PHASES.settled, MISSISSIPPI_STUD_PHASES.folded].includes(studState.tablePhase)) {
    return { success: false, reason: "round_already_active" };
  }
  removeCash(safeAnte);
  addCasinoWager(safeAnte, "mississippi_stud");
  syncFavoriteCasinoGame("mississippi_stud");
  gameState.casino.casinoStats.totalGamesPlayed += 1;
  studState.deck = createShuffledMississippiStudDeck();
  studState.playerCards = [drawMississippiStudCard(studState, true), drawMississippiStudCard(studState, true)];
  studState.communityCards = [drawMississippiStudCard(studState, false), drawMississippiStudCard(studState, false), drawMississippiStudCard(studState, false)];
  studState.revealedCommunityCount = 0;
  studState.anteBet = safeAnte;
  studState.streetBets = [0, 0, 0];
  studState.currentDecisionIndex = 0;
  studState.handRank = "";
  studState.payoutMultiplier = 0;
  studState.totalPayout = 0;
  studState.tablePhase = MISSISSIPPI_STUD_PHASES.first_decision;
  studState.resultText = "Street 1: choose 1x, 2x, or 3x ante.";
  studState.lastPlayedAt = Date.now();
  studState.folded = false;
  notifyListeners();
  return { success: true };
}

export function placeMississippiStudStreetBet(multiplier) {
  const studState = getCasinoMississippiStudState();
  if (![MISSISSIPPI_STUD_PHASES.first_decision, MISSISSIPPI_STUD_PHASES.second_decision, MISSISSIPPI_STUD_PHASES.third_decision].includes(studState.tablePhase)) {
    return false;
  }
  const safeMultiplier = [1, 2, 3].includes(Number(multiplier)) ? Number(multiplier) : 0;
  if (safeMultiplier <= 0) {
    return false;
  }
  const wager = Math.max(0, Number(studState.anteBet) || 0) * safeMultiplier;
  if (gameState.cash < wager) {
    return false;
  }
  removeCash(wager);
  addCasinoWager(wager, "mississippi_stud");
  studState.streetBets[studState.currentDecisionIndex] = wager;
  advanceMississippiStudRound(studState);
  notifyListeners();
  return true;
}

export function foldMississippiStud() {
  const studState = getCasinoMississippiStudState();
  if (![MISSISSIPPI_STUD_PHASES.first_decision, MISSISSIPPI_STUD_PHASES.second_decision, MISSISSIPPI_STUD_PHASES.third_decision].includes(studState.tablePhase)) {
    return false;
  }
  const totalWager = getMississippiStudCommittedWager(studState);
  studState.revealedCommunityCount = 3;
  studState.tablePhase = MISSISSIPPI_STUD_PHASES.folded;
  studState.handRank = "Folded";
  studState.payoutMultiplier = 0;
  studState.totalPayout = 0;
  studState.folded = true;
  studState.resultText = "Hand folded. All committed wagers lost.";
  finalizeMississippiStudStats({ qualifies: false, rankId: "folded" }, totalWager, -totalWager);
  notifyListeners();
  return true;
}

export function cancelMississippiStudRound(reason = "round_cancelled") {
  const studState = getCasinoMississippiStudState();
  const refund = getMississippiStudCommittedWager(studState);
  if (refund > 0 && ![MISSISSIPPI_STUD_PHASES.settled, MISSISSIPPI_STUD_PHASES.folded, MISSISSIPPI_STUD_PHASES.idle].includes(studState.tablePhase)) {
    addCash(refund);
  }
  resetMississippiStudRound(studState, `Round cancelled: ${String(reason).replace(/_/g, " ")}`);
  notifyListeners();
  return true;
}

function drawBaccaratCard(baccaratState) {
  if (!Array.isArray(baccaratState.deck) || baccaratState.deck.length <= 0) {
    baccaratState.deck = createShuffledBaccaratDeck();
  }
  return { ...baccaratState.deck.shift(), faceUp: true };
}

function resetBaccaratRound(baccaratState, reasonText = "") {
  baccaratState.tablePhase = BACCARAT_PHASES.idle;
  baccaratState.deck = [];
  baccaratState.playerCards = [];
  baccaratState.bankerCards = [];
  baccaratState.betChoice = "";
  baccaratState.betAmount = 0;
  baccaratState.result = "";
  baccaratState.resultText = reasonText;
  baccaratState.payoutAmount = 0;
  baccaratState.commissionPaid = 0;
  baccaratState.lastPlayedAt = Date.now();
}

function finalizeBaccaratStats({ betChoice, winner, betAmount, payoutAmount, commissionPaid, natural, usedThirdCard }) {
  const stats = gameState.casino.baccaratStats;
  stats.handsPlayed += 1;
  if (betChoice === BACCARAT_BET_CHOICES.player) {
    stats.playerBetsPlaced += 1;
  } else if (betChoice === BACCARAT_BET_CHOICES.banker) {
    stats.bankerBetsPlaced += 1;
  } else if (betChoice === BACCARAT_BET_CHOICES.tie) {
    stats.tieBetsPlaced += 1;
  }
  if (winner === BACCARAT_BET_CHOICES.player) {
    stats.playerWins += 1;
  } else if (winner === BACCARAT_BET_CHOICES.banker) {
    stats.bankerWins += 1;
  } else if (winner === BACCARAT_BET_CHOICES.tie) {
    stats.tieResults += 1;
  }
  if (natural) {
    stats.naturals += 1;
  }
  if (usedThirdCard) {
    stats.thirdCardRounds += 1;
  }

  const net = payoutAmount - betAmount;
  if (payoutAmount > 0) {
    stats.totalCashWon = addStable(stats.totalCashWon, Math.max(0, net));
    gameState.casino.casinoStats.totalCasinoCashWon = addStable(gameState.casino.casinoStats.totalCasinoCashWon, Math.max(0, net));
    stats.largestSingleWin = Math.max(stats.largestSingleWin, Math.max(0, net));
  }
  if (net < 0) {
    stats.totalCashLost = addStable(stats.totalCashLost, Math.abs(net));
  }
  stats.totalCommissionPaid = addStable(stats.totalCommissionPaid, commissionPaid);

  if (betChoice === winner) {
    stats.handsWon += 1;
    stats.currentWinStreak += 1;
    stats.bestWinStreak = Math.max(stats.bestWinStreak, stats.currentWinStreak);
  } else if (winner === BACCARAT_BET_CHOICES.tie && betChoice !== BACCARAT_BET_CHOICES.tie) {
    stats.handsPushed += 1;
  } else {
    stats.handsLost += 1;
    stats.currentWinStreak = 0;
  }
}

function resolveBaccaratPayout(betChoice, winner, betAmount) {
  if (winner === BACCARAT_BET_CHOICES.tie && betChoice !== BACCARAT_BET_CHOICES.tie) {
    return { payoutAmount: betAmount, commissionPaid: 0, resultText: "Tie pushes Player and Banker bets." };
  }
  if (betChoice !== winner) {
    return { payoutAmount: 0, commissionPaid: 0, resultText: `${winner === "tie" ? "Tie" : winner[0].toUpperCase() + winner.slice(1)} wins.` };
  }
  if (betChoice === BACCARAT_BET_CHOICES.player) {
    return {
      payoutAmount: stabilizeNumber(betAmount * (1 + BACCARAT_PAYOUTS.player)),
      commissionPaid: 0,
      resultText: "Player wins 1:1.",
    };
  }
  if (betChoice === BACCARAT_BET_CHOICES.banker) {
    const commissionPaid = stabilizeNumber(betAmount * BACCARAT_PAYOUTS.bankerCommissionRate);
    const netWin = stabilizeNumber(betAmount * BACCARAT_PAYOUTS.banker - commissionPaid);
    return {
      payoutAmount: stabilizeNumber(betAmount + netWin),
      commissionPaid,
      resultText: `Banker wins 1:1 minus ${Math.round(BACCARAT_PAYOUTS.bankerCommissionRate * 100)}% commission.`,
    };
  }
  return {
    payoutAmount: stabilizeNumber(betAmount * (1 + BACCARAT_PAYOUTS.tie)),
    commissionPaid: 0,
    resultText: `Tie pays ${BACCARAT_PAYOUTS.tie}:1.`,
  };
}

export function getBaccaratStatus() {
  const baccaratState = getCasinoBaccaratState();
  const playerTotal = baccaratState.playerCards.length ? getBaccaratHandTotal(baccaratState.playerCards) : null;
  const bankerTotal = baccaratState.bankerCards.length ? getBaccaratHandTotal(baccaratState.bankerCards) : null;
  return {
    unlocked: Boolean(gameState.casino.unlocked),
    activeGameId: gameState.casino.activeGameId,
    tablePhase: baccaratState.tablePhase,
    playerCards: baccaratState.playerCards.map((card) => ({ ...card, faceUp: true })),
    bankerCards: baccaratState.bankerCards.map((card) => ({ ...card, faceUp: true })),
    betChoice: baccaratState.betChoice,
    betAmount: baccaratState.betAmount,
    result: baccaratState.result,
    resultText: baccaratState.resultText,
    payoutAmount: baccaratState.payoutAmount,
    commissionPaid: baccaratState.commissionPaid,
    lastPlayedAt: baccaratState.lastPlayedAt,
    playerTotal,
    bankerTotal,
    canBet: Boolean(gameState.casino.unlocked),
    stats: { ...gameState.casino.baccaratStats },
    payouts: { ...BACCARAT_PAYOUTS },
  };
}

export function startBaccaratRound({ betChoice, betAmount }) {
  const pip = getPipModifiers();
  if (!gameState.casino.unlocked || !pip.baccaratUnlocked) {
    return { success: false, reason: "casino_locked" };
  }
  if (!Object.values(BACCARAT_BET_CHOICES).includes(betChoice)) {
    return { success: false, reason: "invalid_choice" };
  }
  const safeBet = Math.max(0, Math.floor(Number(betAmount) || 0));
  if (safeBet <= 0 || safeBet > gameState.cash) {
    return { success: false, reason: "invalid_bet" };
  }
  const baccaratState = getCasinoBaccaratState();
  removeCash(safeBet);
  addCasinoWager(safeBet, "baccarat");
  syncFavoriteCasinoGame("baccarat");
  gameState.casino.casinoStats.totalGamesPlayed += 1;

  baccaratState.deck = createShuffledBaccaratDeck();
  baccaratState.playerCards = [drawBaccaratCard(baccaratState), drawBaccaratCard(baccaratState)];
  baccaratState.bankerCards = [drawBaccaratCard(baccaratState), drawBaccaratCard(baccaratState)];
  baccaratState.betChoice = betChoice;
  baccaratState.betAmount = safeBet;
  baccaratState.result = "";
  baccaratState.payoutAmount = 0;
  baccaratState.commissionPaid = 0;
  baccaratState.lastPlayedAt = Date.now();

  let usedThirdCard = false;
  const natural = isBaccaratNatural(baccaratState.playerCards, baccaratState.bankerCards);
  if (!natural) {
    let playerThirdCard = null;
    if (shouldPlayerDrawBaccarat(baccaratState.playerCards)) {
      playerThirdCard = drawBaccaratCard(baccaratState);
      baccaratState.playerCards.push(playerThirdCard);
      usedThirdCard = true;
    }
    if (shouldBankerDrawBaccarat(baccaratState.bankerCards, playerThirdCard)) {
      baccaratState.bankerCards.push(drawBaccaratCard(baccaratState));
      usedThirdCard = true;
    }
  }

  const resolution = resolveBaccaratWinner(baccaratState.playerCards, baccaratState.bankerCards);
  const payout = resolveBaccaratPayout(betChoice, resolution.winner, safeBet);
  if (payout.payoutAmount > 0) {
    addCash(payout.payoutAmount);
  }
  baccaratState.result = resolution.winner;
  baccaratState.resultText = payout.resultText;
  baccaratState.payoutAmount = payout.payoutAmount;
  baccaratState.commissionPaid = payout.commissionPaid;
  baccaratState.tablePhase = BACCARAT_PHASES.settled;
  finalizeBaccaratStats({
    betChoice,
    winner: resolution.winner,
    betAmount: safeBet,
    payoutAmount: payout.payoutAmount,
    commissionPaid: payout.commissionPaid,
    natural,
    usedThirdCard,
  });
  notifyListeners();
  return { success: true };
}

export function cancelBaccaratRound(reason = "round_cancelled") {
  const baccaratState = getCasinoBaccaratState();
  if (baccaratState.betAmount > 0 && baccaratState.tablePhase !== BACCARAT_PHASES.settled) {
    addCash(baccaratState.betAmount);
  }
  resetBaccaratRound(baccaratState, `Round cancelled: ${String(reason).replace(/_/g, " ")}`);
  notifyListeners();
  return true;
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
  addCash(excess * getAutoSellPricePerBanana());
  return excess;
}

function performAutoExportOffline(elapsedSeconds) {
  if (!gameState.autoExportUnlocked || !gameState.autoExportEnabled) {
    return 0;
  }

  const elapsedMs = Math.max(0, Number(elapsedSeconds) || 0) * 1000;
  if (elapsedMs <= 0) {
    return 0;
  }

  const now = Date.now();
  const readyBuyers = buyers
    .filter((buyer) => isBuyerUnlocked(buyer.id))
    .sort((a, b) => getBuyerEffectivePricePerBanana(b) - getBuyerEffectivePricePerBanana(a));

  let shippedCount = 0;
  readyBuyers.forEach((buyer) => {
    const cooldownMs = Math.max(1000, buyer.cooldownSeconds * gameState.exportCooldownMultiplier * 1000);
    const cooldownEndAtLoad = Number(gameState.buyerCooldowns[buyer.id]) || 0;
    const remainingAtNowMs = Math.max(0, cooldownEndAtLoad - now);
    const remainingAtWindowStartMs = Math.max(0, remainingAtNowMs + elapsedMs);

    if (remainingAtWindowStartMs >= elapsedMs) {
      const remainingAtWindowEnd = remainingAtWindowStartMs - elapsedMs;
      if (remainingAtWindowEnd > 0) {
        gameState.buyerCooldowns[buyer.id] = now + remainingAtWindowEnd;
      }
      return;
    }

    const lane = getSelectedShippingLane();
    const maxAllowedShipment = Math.min(buyer.maxShipment, getEffectiveShippingLaneCapacity(lane));
    if (maxAllowedShipment < buyer.minShipment) {
      delete gameState.buyerCooldowns[buyer.id];
      return;
    }

    let nextShipmentAtMs = remainingAtWindowStartMs;
    let lastShipmentAtMs = -1;
    while (nextShipmentAtMs < elapsedMs) {
      const available = Math.floor(clampNonNegative(Number(gameState.bananas) || 0));
      const shipmentAmount = Math.min(maxAllowedShipment, available);
      if (shipmentAmount < buyer.minShipment) {
        break;
      }

      const revenue = shipmentAmount * getBuyerEffectivePricePerBanana(buyer);
      removeBananas(shipmentAmount);
      addCash(revenue);
      gameState.totalShipments += shipmentAmount;
      changeBuyerReputation(buyer.id, 0.9);
      const currentShipped = gameState.lifetimeBuyerShipmentTotals[buyer.id] || 0;
      gameState.lifetimeBuyerShipmentTotals[buyer.id] = addStable(currentShipped, shipmentAmount);
      applyShipmentToContracts(buyer.id, shipmentAmount);
      shippedCount += 1;
      lastShipmentAtMs = nextShipmentAtMs;
      nextShipmentAtMs += cooldownMs;
    }

    if (lastShipmentAtMs >= 0) {
      const nextReadyAtMs = lastShipmentAtMs + cooldownMs;
      const remainingAtWindowEnd = Math.max(0, nextReadyAtMs - elapsedMs);
      if (remainingAtWindowEnd > 0) {
        gameState.buyerCooldowns[buyer.id] = now + remainingAtWindowEnd;
      } else {
        delete gameState.buyerCooldowns[buyer.id];
      }
      return;
    }

    delete gameState.buyerCooldowns[buyer.id];
  });

  return shippedCount;
}

function tryShipToBuyerInternal(buyer, amount, options = {}) {
  if (!buyer || !isBuyerUnlocked(buyer.id)) {
    return false;
  }
  if (getBuyerCooldownRemainingSeconds(buyer.id) > 0) {
    return false;
  }

  const shipmentAmount = Math.floor(clampNonNegative(Number(amount) || 0));
  const lane = getSelectedShippingLane();
  const maxAllowedShipment = Math.min(buyer.maxShipment, getEffectiveShippingLaneCapacity(lane));
  if (shipmentAmount < buyer.minShipment || shipmentAmount > maxAllowedShipment) {
    return false;
  }

  if (gameState.bananas < shipmentAmount) {
    if (options.applyPenaltyOnInsufficient !== false) {
      changeBuyerReputation(buyer.id, -0.8);
      if (options.notify) {
        notifyListeners();
      }
    }
    return false;
  }

  const revenue = shipmentAmount * getBuyerEffectivePricePerBanana(buyer);
  removeBananas(shipmentAmount);
  addCash(revenue);
  gameState.totalShipments += shipmentAmount;
  changeBuyerReputation(buyer.id, 0.9);
  const currentShipped = gameState.lifetimeBuyerShipmentTotals[buyer.id] || 0;
  gameState.lifetimeBuyerShipmentTotals[buyer.id] = addStable(currentShipped, shipmentAmount);
  applyShipmentToContracts(buyer.id, shipmentAmount);

  const cooldownMs = buyer.cooldownSeconds * gameState.exportCooldownMultiplier * 1000;
  gameState.buyerCooldowns[buyer.id] = Date.now() + Math.max(1000, cooldownMs);

  if (options.notify) {
    notifyListeners();
  }
  return true;
}

function performAutoExport() {
  if (!gameState.autoExportUnlocked || !gameState.autoExportEnabled) {
    return 0;
  }

  const readyBuyers = buyers
    .filter((buyer) => isBuyerUnlocked(buyer.id) && getBuyerCooldownRemainingSeconds(buyer.id) <= 0)
    .sort((a, b) => getBuyerEffectivePricePerBanana(b) - getBuyerEffectivePricePerBanana(a));

  let shippedCount = 0;
  readyBuyers.forEach((buyer) => {
    const lane = getSelectedShippingLane();
    const maxAllowedShipment = Math.min(buyer.maxShipment, getEffectiveShippingLaneCapacity(lane));
    const available = Math.floor(clampNonNegative(Number(gameState.bananas) || 0));
    const shipmentAmount = Math.min(maxAllowedShipment, available);
    if (shipmentAmount < buyer.minShipment) {
      return;
    }
    if (tryShipToBuyerInternal(buyer, shipmentAmount, { applyPenaltyOnInsufficient: false, notify: false })) {
      shippedCount += 1;
    }
  });

  return shippedCount;
}

function getEstimatedAutoBananasPerSecond() {
  const snapshot = treeHarvestSystem.getSnapshot();
  const challenge = resolveChallengeContext().resolved;
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
  const pipModifiers = getPipModifiers();
  const workerPickRatePerSecondRaw = baseWorkerPickRatePerSecond * tierWorkerPickMultiplier * getTreeHarvestModifiers().workerPickMultiplier * pipModifiers.workerPickMultiplier * challenge.workerPickRateMultiplier;
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

export function getStatBreakdown() {
  const treeSnapshot = treeHarvestSystem.getSnapshot();
  const prestige = getPrestigeBonuses();
  const pip = getPipModifiers();
  const achievements = getAchievementMultipliers();
  const researchRows = getResearchCompletionMultipliers();
  const orchardPickRate = getOrchardPickRatePerSecond();
  const challengeContext = resolveChallengeContext();
  const challenge = challengeContext.resolved;
  const rewardContext = resolveAscensionRewardContext();
  const reward = rewardContext.resolved;

  return {
    final: {
      productionMultiplier: stabilizeNumber(gameState.productionMultiplier),
      clickMultiplier: stabilizeNumber(gameState.clickMultiplier),
      exportPriceMultiplier: stabilizeNumber(gameState.exportPriceMultiplier),
      exportCooldownMultiplier: stabilizeNumber(gameState.exportCooldownMultiplier),
      clickHarvestYield: stabilizeNumber(treeSnapshot.clickHarvestYield),
      spawnInterval: stabilizeNumber(treeSnapshot.spawnInterval),
      maxBananasOnTree: Math.max(1, Math.floor(Number(treeSnapshot.maxBananasOnTree) || 1)),
      workerOutputPerSecond: stabilizeNumber(gameState.workersOwned * gameState.bananasPerWorkerPerSecond),
      orchardPickRatePerSecond: stabilizeNumber(orchardPickRate),
      marketPricePerBanana: stabilizeNumber(getMarketPricePerBanana()),
      autoSellPricePerBanana: stabilizeNumber(getAutoSellPricePerBanana()),
    },
    sources: {
      prestigeProduction: stabilizeNumber(prestige.productionMultiplier),
      pipProduction: stabilizeNumber(pip.productionMultiplier),
      achievementProduction: stabilizeNumber(achievements.productionMultiplier),
      researchRowProduction: stabilizeNumber(researchRows.productionMultiplier),
      evolutionProduction: stabilizeNumber(gameState.evolutionProductionMultiplier),
      ceoGlobal: stabilizeNumber(getCeoGlobalMultiplier()),
      challengeProduction: stabilizeNumber(challenge.productionMultiplier),
      challengeClick: stabilizeNumber(challenge.clickMultiplier),
      challengeExportPrice: stabilizeNumber(challenge.exportPriceMultiplier),
      challengeExportCooldown: stabilizeNumber(challenge.exportCooldownMultiplier),
      challengeSpawnInterval: stabilizeNumber(challenge.spawnIntervalMultiplier),
      challengeWorkerPickRate: stabilizeNumber(challenge.workerPickRateMultiplier),
      challengeOrchardPickRate: stabilizeNumber(challenge.orchardPickRateMultiplier),
      challengeResearchRate: stabilizeNumber(challenge.researchPointMultiplier),
      challengeShippingCapacity: stabilizeNumber(challenge.shippingCapacityMultiplier),
      rewardProduction: stabilizeNumber(reward.productionMultiplier),
      rewardClick: stabilizeNumber(reward.clickMultiplier),
      rewardExportPrice: stabilizeNumber(reward.exportPriceMultiplier),
      rewardExportCooldown: stabilizeNumber(reward.exportCooldownMultiplier),
      rewardShippingCapacity: stabilizeNumber(reward.shippingCapacityMultiplier),
      rewardResearchRate: stabilizeNumber(reward.researchPointMultiplier),
      rewardContractsAdd: reward.maxActiveContractsAdd,
      researchLabRatePerSecBase: stabilizeNumber(gameState.researchLabLevel * 0.06),
      financeOfficeDiscountMultiplier: stabilizeNumber(Math.max(0.35, 1 - gameState.financeOfficeLevel * 0.03)),
    },
    challenge: {
      active: challengeContext.active,
      challengeId: challengeContext.challengeId,
      rulesApplied: challengeContext.modifiersApplied,
      flags: {
        shakeEnabled: challenge.shakeEnabled,
        offlineGainsEnabled: challenge.offlineGainsEnabled,
        prestigeEnabled: challenge.prestigeEnabled,
      },
    },
    rewards: {
      unlockedCount: rewardContext.unlockedRewardIds.length,
      unlockedRewardIds: rewardContext.unlockedRewardIds,
      appliedModifiers: rewardContext.modifiersApplied,
      cosmetics: rewardContext.unlockedCosmetics.map((item) => ({ id: item.id, title: item.title })),
      utility: rewardContext.unlockedUtility.map((item) => ({ id: item.id, title: item.title })),
      flags: {
        qolChallengeTelemetry: reward.qolChallengeTelemetry,
      },
    },
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
  if (!resolveChallengeContext().resolved.shakeEnabled) {
    return { success: false, reason: "disabled", cooldownRemaining: 0 };
  }
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
    const effectiveCostCash = getEffectiveCashCost(upgrade.costCash);
    return {
      ...upgrade,
      purchased,
      unlocked: requirementsMet,
      effectiveCostCash,
      canAfford: gameState.cash >= effectiveCostCash,
    };
  });
}

function getPipUpgradeNextCost(upgrade, rank) {
  const safeRank = Math.max(0, Math.floor(Number(rank) || 0));
  const maxRank = Math.max(1, Math.floor(Number(upgrade.maxRank) || 1));
  if (safeRank >= maxRank) {
    return 0;
  }
  const baseCost = Math.max(1, Number(upgrade.baseCostPip) || 1);
  const growth = Math.max(1.01, Number(upgrade.costGrowth) || 1.2);
  return Math.max(1, Math.ceil(baseCost * growth ** safeRank));
}

export function getPipUpgradeStatus() {
  return pipUpgrades.map((upgrade) => {
    const rank = getPipUpgradeRank(upgrade.id);
    const maxRank = Math.max(1, Math.floor(Number(upgrade.maxRank) || 1));
    const maxed = rank >= maxRank;
    const unlocked = isRequirementMet(upgrade.unlockCondition);
    const nextCost = maxed ? 0 : getPipUpgradeNextCost(upgrade, rank);
    return {
      ...upgrade,
      rank,
      nextCost,
      unlocked,
      canAfford: unlocked && !maxed && gameState.pip >= nextCost,
      maxed,
    };
  });
}

export function getAscensionChallengesStatus() {
  const activeRun = gameState.activeChallengeRun;
  const unlockedRewards = new Set(sanitizeChallengeRewardsUnlocked(gameState.challengeRewardsUnlocked));
  return ascensionChallenges.map((challenge) => {
    const history = gameState.challengeHistory?.[challenge.id] || null;
    const unlocked = isChallengeUnlocked(challenge);
    const active = Boolean(activeRun && activeRun.challengeId === challenge.id && activeRun.status === CHALLENGE_RUN_STATUS.active);
    const rewardsByRank = challenge.rewardsByRank && typeof challenge.rewardsByRank === "object" ? challenge.rewardsByRank : {};
    const rewardPreview = Object.entries(rewardsByRank).map(([rank, rewardIds]) => ({
      rank,
      rewards: (Array.isArray(rewardIds) ? rewardIds : [])
        .map((rewardId) => {
          const reward = ascensionRewardById.get(rewardId);
          if (!reward) {
            return null;
          }
          return {
            id: reward.id,
            title: reward.title,
            type: reward.type,
            unlocked: unlockedRewards.has(reward.id),
          };
        })
        .filter(Boolean),
    }));
    const rewardUnlocked = rewardPreview.some((rankSet) => rankSet.rewards.some((reward) => reward.unlocked));
    return {
      ...challenge,
      unlocked,
      active,
      rewardUnlocked,
      rewardPreview,
      history,
    };
  });
}

export function getActiveChallengeRunStatus() {
  const run = gameState.activeChallengeRun;
  if (!run || !ascensionChallengeById.has(run.challengeId)) {
    return null;
  }
  const challenge = ascensionChallengeById.get(run.challengeId);
  const objectives = (challenge.objectives || []).map((objective) => {
    const progress = Math.max(0, Number(run.objectiveProgress?.[objective.id]) || 0);
    const target = Math.max(0, Number(objective.target) || 0);
    const progressPct = target <= 0 ? 1 : Math.max(0, Math.min(1, progress / target));
    return {
      ...objective,
      progress,
      progressPct,
      complete: progress >= target,
    };
  });
  return {
    ...run,
    challengeName: challenge.name,
    challengeDescription: challenge.description,
    score: Math.max(0, Number(run.score) || 0),
    timeLimitMs: Math.max(0, Number(challenge.timeLimitMs) || 0),
    rankPreview: getChallengeRankFromElapsed(challenge, run.elapsedMs),
    objectives,
    allObjectivesComplete: areChallengeObjectivesMet(run),
  };
}

export function getChallengeLastResult() {
  return gameState.challengeLastResult ? cloneSerializable(gameState.challengeLastResult) : null;
}

export function getAscensionRewardsStatus() {
  const context = resolveAscensionRewardContext();
  return {
    unlockedRewardIds: context.unlockedRewardIds,
    modifiersApplied: context.modifiersApplied,
    cosmetics: context.unlockedCosmetics,
    utility: context.unlockedUtility,
    resolved: context.resolved,
    maxActiveContracts: getMaxActiveContracts(),
  };
}

export function clearChallengeLastResult() {
  if (!gameState.challengeLastResult) {
    return false;
  }
  gameState.challengeLastResult = null;
  notifyListeners();
  return true;
}

export function startChallengeRun(challengeId) {
  if (gameState.activeChallengeRun) {
    return { success: false, reason: "challenge_already_active" };
  }

  const challenge = ascensionChallengeById.get(challengeId);
  if (!challenge) {
    return { success: false, reason: "challenge_not_found" };
  }
  if (!isChallengeUnlocked(challenge)) {
    return { success: false, reason: "challenge_locked" };
  }

  cancelCasinoRound("challenge_start");
  const preRunSnapshot = createChallengePreRunSnapshot();
  prepareStateForChallengeRun();

  gameState.activeChallengeRun = {
    challengeId: challenge.id,
    startedAt: Date.now(),
    seed: Math.floor(Math.random() * 1_000_000_000),
    status: CHALLENGE_RUN_STATUS.active,
    elapsedMs: 0,
    score: 0,
    objectiveProgress: buildDefaultObjectiveProgress(challenge),
    appliedRuleIds: Array.isArray(challenge.ruleIds) ? [...challenge.ruleIds] : [],
    preRunSnapshot,
  };
  gameState.challengeLastResult = null;
  updateChallengeObjectiveProgress(gameState.activeChallengeRun);

  treeHarvestSystem.deserialize(gameState.tree);
  recomputeDerivedStats();
  notifyListeners();
  return { success: true, challengeId: challenge.id };
}

export function resumeChallengeRun() {
  const run = gameState.activeChallengeRun;
  if (!run || !ascensionChallengeById.has(run.challengeId)) {
    return { success: false, reason: "no_active_challenge" };
  }
  run.status = CHALLENGE_RUN_STATUS.active;
  run.startedAt = Number(run.startedAt) || Date.now();
  notifyListeners();
  return { success: true, challengeId: run.challengeId };
}

export function abandonChallengeRun() {
  const run = gameState.activeChallengeRun;
  if (!run) {
    return { success: false, reason: "no_active_challenge" };
  }
  return finalizeChallengeRun(CHALLENGE_RUN_STATUS.abandoned);
}

export function completeChallengeRun() {
  const run = gameState.activeChallengeRun;
  if (!run) {
    return { success: false, reason: "no_active_challenge" };
  }
  updateChallengeObjectiveProgress(run);
  if (!areChallengeObjectivesMet(run)) {
    return { success: false, reason: "objectives_not_complete" };
  }
  return finalizeChallengeRun(CHALLENGE_RUN_STATUS.completed);
}

export function failChallengeRun() {
  const run = gameState.activeChallengeRun;
  if (!run) {
    return { success: false, reason: "no_active_challenge" };
  }
  return finalizeChallengeRun(CHALLENGE_RUN_STATUS.failed);
}

export function purchasePipUpgrade(upgradeId) {
  const upgrade = pipUpgradeById.get(upgradeId);
  if (!upgrade) {
    return false;
  }

  const rank = getPipUpgradeRank(upgrade.id);
  const maxRank = Math.max(1, Math.floor(Number(upgrade.maxRank) || 1));
  if (rank >= maxRank || !isRequirementMet(upgrade.unlockCondition)) {
    return false;
  }

  const nextCost = getPipUpgradeNextCost(upgrade, rank);
  if (gameState.pip < nextCost) {
    return false;
  }

  gameState.pip = clampNonNegative(Math.floor(gameState.pip - nextCost));
  gameState.purchasedPipUpgrades = {
    ...gameState.purchasedPipUpgrades,
    [upgrade.id]: rank + 1,
  };
  gameState.pipSpentTotal = clampNonNegative(Math.floor(Number(gameState.pipSpentTotal) || 0) + nextCost);
  recomputeDerivedStats();
  notifyListeners();
  return true;
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
  const effectiveCostCash = getEffectiveCashCost(upgrade.costCash);
  if (!requirementsMet || gameState.cash < effectiveCostCash) {
    return false;
  }
  removeCash(effectiveCostCash);
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
  const maxLevel = Number.isFinite(Number(config.maxLevel)) ? Math.max(0, Math.floor(Number(config.maxLevel))) : null;
  if (maxLevel != null && level >= maxLevel) {
    return 0;
  }
  const cost = config.baseCost * config.growth ** level;
  return stabilizeNumber(cost);
}

export function getBuildingMaxLevel(buildingType) {
  const config = BUILDING_TYPES[buildingType];
  if (!config) {
    return null;
  }
  const maxLevel = Number(config.maxLevel);
  return Number.isFinite(maxLevel) ? Math.max(0, Math.floor(maxLevel)) : null;
}

export function buyBuilding(buildingType) {
  const config = BUILDING_TYPES[buildingType];
  if (!config) {
    return false;
  }

  const level = getBuildingLevel(buildingType);
  const maxLevel = getBuildingMaxLevel(buildingType);
  if (maxLevel != null && level >= maxLevel) {
    return false;
  }

  const cost = getBuildingCost(buildingType);
  if (gameState.cash < cost) {
    return false;
  }

  removeCash(cost);
  gameState[config.stateKey] = level + 1;
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

export function getAutoExportStatus() {
  return {
    unlocked: Boolean(gameState.autoExportUnlocked),
    enabled: Boolean(gameState.autoExportEnabled),
    unlockCost: AUTO_EXPORT_UNLOCK_CASH,
    canUnlock: gameState.cash >= AUTO_EXPORT_UNLOCK_CASH,
  };
}

export function setAutoExportEnabled(enabled) {
  if (!gameState.autoExportUnlocked) {
    return false;
  }
  gameState.autoExportEnabled = Boolean(enabled);
  notifyListeners();
  return true;
}

export function unlockAutoExport() {
  if (gameState.autoExportUnlocked) {
    return true;
  }
  if (gameState.cash < AUTO_EXPORT_UNLOCK_CASH) {
    return false;
  }
  removeCash(AUTO_EXPORT_UNLOCK_CASH);
  gameState.autoExportUnlocked = true;
  gameState.autoExportEnabled = true;
  notifyListeners();
  return true;
}

export function isUpgradeUnlocked(upgradeId) {
  const upgrade = upgradeById.get(upgradeId);
  if (!upgrade) {
    return false;
  }

  if (!gameState.unlockedUpgradeCategories.includes(getUpgradeCategory(upgrade))) {
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
    cash: getEffectiveCashCost(upgrade.costCash || 0),
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
  gameState.purchasedPipUpgrades = sanitizePipUpgradeRanks(gameState.purchasedPipUpgrades);
  gameState.pipSpentTotal = clampNonNegative(Math.floor(Number(gameState.pipSpentTotal) || 0));
  gameState.pipRespecCount = clampNonNegative(Math.floor(Number(gameState.pipRespecCount) || 0));
  gameState.prestigeCount = clampNonNegative(Math.floor(Number(gameState.prestigeCount) || 0));
  gameState.challengeHistory = sanitizeChallengeHistory(gameState.challengeHistory);
  gameState.challengeRewardsUnlocked = sanitizeChallengeRewardsUnlocked(gameState.challengeRewardsUnlocked);
  gameState.activeChallengeRun = sanitizeActiveChallengeRun(gameState.activeChallengeRun);
  gameState.challengeLastResult = sanitizeChallengeLastResult(gameState.challengeLastResult);
  gameState.casino = sanitizeCasinoState(gameState.casino);

  gameState.evolutionProductionMultiplier = Math.max(1, Number(gameState.evolutionProductionMultiplier) || 1);
  gameState.packingShedLevel = clampNonNegative(Math.floor(Number(gameState.packingShedLevel) || 0));
  gameState.fertilizerLabLevel = clampNonNegative(Math.floor(Number(gameState.fertilizerLabLevel) || 0));
  gameState.researchLabLevel = clampNonNegative(Math.floor(Number(gameState.researchLabLevel) || 0));
  gameState.financeOfficeLevel = clampNonNegative(Math.floor(Number(gameState.financeOfficeLevel) || 0));
  gameState.researchPoints = clampNonNegative(Number(gameState.researchPoints) || 0);
  gameState.bananaMatter = clampNonNegative(Number(gameState.bananaMatter) || 0);
  gameState.exoticPeelParticles = clampNonNegative(Number(gameState.exoticPeelParticles) || 0);
  gameState.antimatterBananas = clampNonNegative(Number(gameState.antimatterBananas) || 0);
  gameState.quantumReactorLevel = clampNonNegative(Math.floor(Number(gameState.quantumReactorLevel) || 0));
  gameState.colliderLevel = clampNonNegative(Math.floor(Number(gameState.colliderLevel) || 0));
  gameState.containmentLevel = clampNonNegative(Math.floor(Number(gameState.containmentLevel) || 0));
  gameState.autoSellEnabled = Boolean(gameState.autoSellEnabled);
  gameState.autoSellThreshold = clampNonNegative(Math.floor(Number(gameState.autoSellThreshold) || 0));
  gameState.autoExportUnlocked = Boolean(gameState.autoExportUnlocked);
  gameState.autoExportEnabled = Boolean(gameState.autoExportEnabled) && gameState.autoExportUnlocked;

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
  gameState.casino.unlocked = Boolean(getPipModifiers().casinoUnlocked);

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
  const challengeModifiers = resolveChallengeContext().resolved;
  if (!challengeModifiers.offlineGainsEnabled) {
    if (gameState.activeChallengeRun?.status === CHALLENGE_RUN_STATUS.active) {
      gameState.activeChallengeRun.elapsedMs = Math.max(
        0,
        Math.floor(Number(gameState.activeChallengeRun.elapsedMs) || 0) + Math.floor(safeElapsedSeconds * 1000)
      );
      evaluateActiveChallengeRunCompletion();
    }
    gameState.lastTickTime = Date.now();
    notifyListeners();
    return 0;
  }
  updateTimedEvents(Date.now());
  const earned = addPassiveBananas(safeElapsedSeconds);
  addPassiveResearchPoints(safeElapsedSeconds);
  const tierHarvest = treeTiers[gameState.treeTierIndex]?.harvest || {};
  const tierWorkerPickMultiplier = Math.max(0.1, Number(tierHarvest.workerPickMultiplier) || 1);
  const treeClickYield = Math.max(1, Number(gameState.tree?.clickHarvestYield) || 1);
  const baseWorkerPickRatePerSecond = gameState.workersOwned * (Math.max(0, Number(gameState.bananasPerWorkerPerSecond) || 0) / treeClickYield);
  const workerPickRatePerSecond = baseWorkerPickRatePerSecond * tierWorkerPickMultiplier * getTreeHarvestModifiers().workerPickMultiplier * getPipModifiers().workerPickMultiplier * challengeModifiers.workerPickRateMultiplier;
  const orchardPickRatePerSecond = getOrchardPickRatePerSecond();
  const pickerCaps = getTierPickerUpdateCaps();
  treeHarvestSystem.update(safeElapsedSeconds, {
    workerPickRatePerSecond,
    orchardPickRatePerSecond,
    maxWorkerPicksPerUpdate: pickerCaps.maxWorkerPicksPerUpdate,
    maxOrchardPicksPerUpdate: pickerCaps.maxOrchardPicksPerUpdate,
    maxMonkeyPicksPerUpdate: pickerCaps.maxMonkeyPicksPerUpdate,
    simulateOffline: true,
  });
  gameState.tree = treeHarvestSystem.serialize();
  processWeirdScienceConverters(safeElapsedSeconds);
  gameState.lastTickTime = Date.now();
  performAutoExportOffline(safeElapsedSeconds);
  performAutoSell();
  if (gameState.activeChallengeRun?.status === CHALLENGE_RUN_STATUS.active) {
    gameState.activeChallengeRun.elapsedMs = Math.max(
      0,
      Math.floor(Number(gameState.activeChallengeRun.elapsedMs) || 0) + Math.floor(safeElapsedSeconds * 1000)
    );
    evaluateActiveChallengeRunCompletion();
  }
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
  const challengeModifiers = resolveChallengeContext().resolved;
  const workerPickRatePerSecond = baseWorkerPickRatePerSecond * tierWorkerPickMultiplier * getTreeHarvestModifiers().workerPickMultiplier * getPipModifiers().workerPickMultiplier * challengeModifiers.workerPickRateMultiplier;
  const orchardPickRatePerSecond = getOrchardPickRatePerSecond();
  const pickerCaps = getTierPickerUpdateCaps();
  treeHarvestSystem.update(elapsedSeconds, {
    workerPickRatePerSecond,
    orchardPickRatePerSecond,
    maxWorkerPicksPerUpdate: pickerCaps.maxWorkerPicksPerUpdate,
    maxOrchardPicksPerUpdate: pickerCaps.maxOrchardPicksPerUpdate,
    maxMonkeyPicksPerUpdate: pickerCaps.maxMonkeyPicksPerUpdate,
  });
  gameState.tree = treeHarvestSystem.serialize();
  processWeirdScienceConverters(elapsedSeconds);
  performAutoExport();
  performAutoSell();
  if (gameState.activeChallengeRun?.status === CHALLENGE_RUN_STATUS.active) {
    gameState.activeChallengeRun.elapsedMs = Math.max(
      0,
      Math.floor(Number(gameState.activeChallengeRun.elapsedMs) || 0) + Math.max(0, Math.floor(elapsedMs))
    );
    evaluateActiveChallengeRunCompletion();
  }
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
  const workersOwned = Math.max(0, Number(input.workersOwned) || 0);
  const bananasPerWorkerPerSecond = Math.max(0, Number(input.bananasPerWorkerPerSecond) || 0);
  const elapsedSeconds = Math.max(0, Number(input.elapsedSeconds) || 0);
  // The live economy no longer grants passive tree/sec income.
  return stabilizeNumber((workersOwned * bananasPerWorkerPerSecond) * elapsedSeconds);
}

export function getMarketPricePerBanana(bananaTypeId = null) {
  const tierIndex = Math.max(0, Math.min(TREE_TIER_VALUE_MULTIPLIERS.length - 1, Math.floor(Number(gameState.treeTierIndex) || 0)));
  const valueMultiplier = TREE_TIER_VALUE_MULTIPLIERS[tierIndex] || 1;
  return stabilizeNumber(MARKET_PRICE_PER_BANANA * valueMultiplier);
}

export function getAutoSellPricePerBanana() {
  return stabilizeNumber(AUTO_SELL_PRICE_PER_BANANA * getPipModifiers().autoSellPriceMultiplier);
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
  const baseCost = gameState.treeBaseCost * gameState.treeCostGrowth ** gameState.treesOwned;
  return getEffectiveCashCost(baseCost);
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
  const challenge = resolveChallengeContext().resolved;
  const owned = Math.max(0, Math.floor(Number(gameState.orchardsOwned) || 0));
  if (owned <= 0) {
    return 0;
  }
  const per = Math.max(0, Number(gameState.orchardPickRatePerSecondPerOrchard) || DEFAULT_STATE.orchardPickRatePerSecondPerOrchard);
  const tierIndex = Math.max(0, Math.floor(Number(gameState.treeTierIndex) || 0));
  const tierMultiplier = 1 + tierIndex * 0.05;
  const scaleExponent = 0.9;
  return stabilizeNumber((owned ** scaleExponent) * per * tierMultiplier * getPipModifiers().orchardPickMultiplier * challenge.orchardPickRateMultiplier);
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
  const orchardBonuses = getOrchardSystemBonuses();
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
    capacityBonus: orchardBonuses.capacityBonus,
    spawnIntervalMultiplier: orchardBonuses.spawnIntervalMultiplier,
    exportBonusMultiplier: orchardBonuses.exportBonusMultiplier,
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
  const unlockCost = getEffectiveTreeTierUnlockCost(nextTier);

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

export function getEffectiveTreeTierUnlockCost(tier = null) {
  const targetTier = tier || getNextTreeTier();
  const baseUnlockCost = Number(targetTier?.unlockCostCash) || 0;
  return getEffectiveCashCost(baseUnlockCost);
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
    baseCapacity: Math.max(1, Math.floor(Number(lane.capacity) || 1)),
    capacity: getEffectiveShippingLaneCapacity(lane),
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
  return tryShipToBuyerInternal(buyer, amount, { applyPenaltyOnInsufficient: true, notify: true });
}

export function prestigeReset() {
  if (!isPrestigeUnlocked()) {
    return false;
  }

  const pipGain = getPrestigeGainPreview();
  if (pipGain <= 0) {
    return false;
  }

  cancelCasinoRound("prestige_reset");
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
  gameState.researchLabLevel = 0;
  gameState.financeOfficeLevel = 0;
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
  gameState.autoExportUnlocked = false;
  gameState.autoExportEnabled = false;
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
