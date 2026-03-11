export const CHALLENGE_RUN_STATUS = Object.freeze({
  active: "active",
  paused: "paused",
  completed: "completed",
  failed: "failed",
  abandoned: "abandoned",
});

export const CHALLENGE_RANK_ORDER = Object.freeze(["Bronze", "Silver", "Gold"]);

export const ascensionRewardCatalog = Object.freeze([
  {
    id: "asc_badge_click_sprint",
    type: "badge",
    title: "Sprint Broker",
    description: "Proof you can execute a high-speed manual run.",
  },
  {
    id: "asc_prod_boost_1",
    type: "permanent_percent_boost",
    title: "Operational Throughput I",
    description: "+2% global production multiplier.",
    modifiers: [{ stat: "productionMultiplier", op: "mul", value: 1.02, category: "ascension_reward" }],
  },
  {
    id: "asc_export_boost_1",
    type: "permanent_percent_boost",
    title: "Premium Fulfillment I",
    description: "+2% export value multiplier.",
    modifiers: [{ stat: "exportPriceMultiplier", op: "mul", value: 1.02, category: "ascension_reward" }],
  },
  {
    id: "asc_badge_worker_discipline",
    type: "badge",
    title: "Operations Chief",
    description: "You ran disciplined worker-heavy operations.",
  },
  {
    id: "asc_shipping_capacity_1",
    type: "utility_unlock",
    title: "Freight Buffer I",
    description: "+6% shipping lane capacity.",
    modifiers: [{ stat: "shippingCapacityMultiplier", op: "mul", value: 1.06, category: "ascension_reward" }],
  },
  {
    id: "asc_extra_contract_slot_1",
    type: "utility_unlock",
    title: "Contracts Desk I",
    description: "+1 max active contract.",
    modifiers: [{ stat: "maxActiveContractsAdd", op: "add", value: 1, category: "ascension_reward" }],
  },
  {
    id: "asc_qol_tracker_title",
    type: "qol_toggle",
    title: "Challenge Telemetry",
    description: "Unlocks additional challenge telemetry context in stat breakdown.",
    modifiers: [{ stat: "qolChallengeTelemetry", op: "set", value: true, category: "ascension_reward" }],
  },
  {
    id: "asc_badge_export_pressure",
    type: "badge",
    title: "Lane Strategist",
    description: "Top-tier export desk performance under pressure.",
  },
  {
    id: "asc_click_boost_1",
    type: "permanent_percent_boost",
    title: "Executive Precision I",
    description: "+2% click multiplier.",
    modifiers: [{ stat: "clickMultiplier", op: "mul", value: 1.02, category: "ascension_reward" }],
  },
  {
    id: "asc_cooldown_tune_1",
    type: "utility_unlock",
    title: "Dispatch Timing I",
    description: "-3% export cooldown multiplier.",
    modifiers: [{ stat: "exportCooldownMultiplier", op: "mul", value: 0.97, category: "ascension_reward" }],
  },
  {
    id: "asc_research_boost_1",
    type: "permanent_percent_boost",
    title: "R&D Discipline I",
    description: "+5% research point gain.",
    modifiers: [{ stat: "researchPointMultiplier", op: "mul", value: 1.05, category: "ascension_reward" }],
  },
  {
    id: "asc_title_crisis_director",
    type: "cosmetic_title",
    title: "Crisis Director",
    description: "Elite title for survival drill completion.",
  },
  {
    id: "asc_badge_labor_strike",
    type: "badge",
    title: "Hands-On Director",
    description: "Completed an anti-automation run with manual operations.",
  },
  {
    id: "asc_badge_clockwork",
    type: "badge",
    title: "Clockwork Executor",
    description: "Won a strict-timer efficiency challenge.",
  },
  {
    id: "asc_prod_boost_2",
    type: "permanent_percent_boost",
    title: "Operational Throughput II",
    description: "+3% global production multiplier.",
    modifiers: [{ stat: "productionMultiplier", op: "mul", value: 1.03, category: "ascension_reward" }],
  },
  {
    id: "asc_export_boost_2",
    type: "permanent_percent_boost",
    title: "Premium Fulfillment II",
    description: "+3% export value multiplier.",
    modifiers: [{ stat: "exportPriceMultiplier", op: "mul", value: 1.03, category: "ascension_reward" }],
  },
  {
    id: "asc_click_boost_2",
    type: "permanent_percent_boost",
    title: "Executive Precision II",
    description: "+3% click multiplier.",
    modifiers: [{ stat: "clickMultiplier", op: "mul", value: 1.03, category: "ascension_reward" }],
  },
  {
    id: "asc_shipping_capacity_2",
    type: "utility_unlock",
    title: "Freight Buffer II",
    description: "+8% shipping lane capacity.",
    modifiers: [{ stat: "shippingCapacityMultiplier", op: "mul", value: 1.08, category: "ascension_reward" }],
  },
  {
    id: "asc_extra_contract_slot_2",
    type: "utility_unlock",
    title: "Contracts Desk II",
    description: "+1 max active contract.",
    modifiers: [{ stat: "maxActiveContractsAdd", op: "add", value: 1, category: "ascension_reward" }],
  },
  {
    id: "asc_cooldown_tune_2",
    type: "utility_unlock",
    title: "Dispatch Timing II",
    description: "-4% export cooldown multiplier.",
    modifiers: [{ stat: "exportCooldownMultiplier", op: "mul", value: 0.96, category: "ascension_reward" }],
  },
  {
    id: "asc_research_boost_2",
    type: "permanent_percent_boost",
    title: "R&D Discipline II",
    description: "+8% research point gain.",
    modifiers: [{ stat: "researchPointMultiplier", op: "mul", value: 1.08, category: "ascension_reward" }],
  },
  {
    id: "asc_title_quantum_cfo",
    type: "cosmetic_title",
    title: "Quantum CFO",
    description: "Prestige-era title for high-pressure late-game challenge clears.",
  },
]);

export const ascensionRewardById = new Map(ascensionRewardCatalog.map((reward) => [reward.id, reward]));

export const ascensionChallenges = Object.freeze([
  {
    id: "asc_click_sprint",
    name: "Manual Market Sprint",
    description: "Click-heavy opener. Move fast before exports stabilize.",
    flavorText: "The board wants speed. No excuses.",
    category: "Starter",
    unlockCondition: { type: "totalBananasEarned", value: 6000 },
    ruleIds: ["no_orchard_bonus", "reduced_export_value"],
    rankThresholds: {
      goldMaxElapsedMs: 5 * 60 * 1000,
      silverMaxElapsedMs: 9 * 60 * 1000,
      bronzeMaxElapsedMs: 14 * 60 * 1000,
    },
    timeLimitMs: 14 * 60 * 1000,
    objectives: [
      { id: "cash_target", type: "cash", target: 5000 },
      { id: "shipment_target", type: "shipments_total", target: 12 },
      { id: "bananas_target", type: "total_bananas_earned", target: 6000 },
    ],
    rewardsByRank: {
      Bronze: ["asc_badge_click_sprint"],
      Silver: ["asc_prod_boost_1"],
      Gold: ["asc_export_boost_1"],
    },
  },
  {
    id: "asc_labor_strike",
    name: "Labor Strike Drill",
    description: "Automation goes dark. Deliver results by raw manual control.",
    flavorText: "No workers, no orchards, no shake. Just leadership.",
    category: "Starter",
    unlockCondition: { type: "totalBananasEarned", value: 18000 },
    ruleIds: ["no_workers", "no_orchards", "disabled_shake"],
    rankThresholds: {
      goldMaxElapsedMs: 7 * 60 * 1000,
      silverMaxElapsedMs: 10 * 60 * 1000,
      bronzeMaxElapsedMs: 15 * 60 * 1000,
    },
    timeLimitMs: 15 * 60 * 1000,
    objectives: [
      { id: "strike_cash", type: "cash", target: 9000 },
      { id: "strike_shipments", type: "shipments_total", target: 14 },
      { id: "strike_stock", type: "bananas", target: 750 },
    ],
    rewardsByRank: {
      Bronze: ["asc_badge_labor_strike"],
      Silver: ["asc_click_boost_1"],
      Gold: ["asc_prod_boost_2"],
    },
  },
  {
    id: "asc_worker_discipline",
    name: "Worker Discipline",
    description: "Worker execution under lane pressure and tight capacity.",
    flavorText: "Ops scale only if dispatch stays disciplined.",
    category: "Core",
    unlockCondition: { type: "treesOwned", value: 25 },
    ruleIds: ["tighter_lane_capacity"],
    rankThresholds: {
      goldMaxElapsedMs: 8 * 60 * 1000,
      silverMaxElapsedMs: 12 * 60 * 1000,
      bronzeMaxElapsedMs: 18 * 60 * 1000,
    },
    timeLimitMs: 18 * 60 * 1000,
    objectives: [
      { id: "banana_stock", type: "bananas", target: 1500 },
      { id: "tier_target", type: "tree_tier_index", target: 3 },
      { id: "shipment_total", type: "shipments_total", target: 18 },
    ],
    rewardsByRank: {
      Bronze: ["asc_badge_worker_discipline"],
      Silver: ["asc_shipping_capacity_1"],
      Gold: ["asc_extra_contract_slot_1", "asc_qol_tracker_title"],
    },
  },
  {
    id: "asc_clockwork_efficiency",
    name: "Clockwork Efficiency",
    description: "Beat the clock in a no-offline, reduced-click execution test.",
    flavorText: "The timer is the opponent.",
    category: "Core",
    unlockCondition: { type: "totalBananasEarned", value: 45000 },
    ruleIds: ["no_offline_gains", "reduced_click_yield", "tighter_lane_capacity"],
    rankThresholds: {
      goldMaxElapsedMs: 6 * 60 * 1000,
      silverMaxElapsedMs: 8 * 60 * 1000,
      bronzeMaxElapsedMs: 11 * 60 * 1000,
    },
    timeLimitMs: 11 * 60 * 1000,
    objectives: [
      { id: "clock_cash", type: "cash", target: 24000 },
      { id: "clock_tier", type: "tree_tier_index", target: 4 },
      { id: "clock_score", type: "score", target: 2800 },
    ],
    rewardsByRank: {
      Bronze: ["asc_badge_clockwork"],
      Silver: ["asc_cooldown_tune_1"],
      Gold: ["asc_export_boost_2"],
    },
  },
  {
    id: "asc_export_pressure",
    name: "Export Pressure Test",
    description: "Push contract flow and cash throughput under pressure.",
    flavorText: "Cash flow wins. Idle stockpiles lose.",
    category: "Core",
    unlockCondition: { type: "totalBananasEarned", value: 75000 },
    ruleIds: ["contract_focus", "reduced_click_yield"],
    rankThresholds: {
      goldMaxElapsedMs: 10 * 60 * 1000,
      silverMaxElapsedMs: 15 * 60 * 1000,
      bronzeMaxElapsedMs: 22 * 60 * 1000,
    },
    timeLimitMs: 22 * 60 * 1000,
    objectives: [
      { id: "contracts_target", type: "contracts_completed", target: 8 },
      { id: "cash_target", type: "cash", target: 30000 },
    ],
    rewardsByRank: {
      Bronze: ["asc_badge_export_pressure"],
      Silver: ["asc_click_boost_1"],
      Gold: ["asc_cooldown_tune_1"],
    },
  },
  {
    id: "asc_contract_gauntlet",
    name: "Contract Gauntlet",
    description: "Sustain high-value contract throughput under weaker production.",
    flavorText: "You are the logistics algorithm now.",
    category: "Advanced",
    unlockCondition: { type: "totalBananasEarned", value: 220000 },
    ruleIds: ["contract_focus", "tighter_lane_capacity", "reduced_export_value"],
    rankThresholds: {
      goldMaxElapsedMs: 11 * 60 * 1000,
      silverMaxElapsedMs: 15 * 60 * 1000,
      bronzeMaxElapsedMs: 20 * 60 * 1000,
    },
    timeLimitMs: 20 * 60 * 1000,
    objectives: [
      { id: "gauntlet_contracts", type: "contracts_completed", target: 10 },
      { id: "gauntlet_shipments", type: "shipments_total", target: 26 },
      { id: "gauntlet_cash", type: "cash", target: 140000 },
    ],
    rewardsByRank: {
      Bronze: ["asc_shipping_capacity_2"],
      Silver: ["asc_extra_contract_slot_2"],
      Gold: ["asc_cooldown_tune_2"],
    },
  },
  {
    id: "asc_survival_desk",
    name: "Executive Survival Drill",
    description: "Hold operations steady and survive the full drill window.",
    flavorText: "Endurance first. Panic later.",
    category: "Core",
    unlockCondition: { type: "totalBananasEarned", value: 120000 },
    ruleIds: ["slower_spawn_rate", "disable_prestige"],
    rankThresholds: {
      goldMaxElapsedMs: 6 * 60 * 1000,
      silverMaxElapsedMs: 8 * 60 * 1000,
      bronzeMaxElapsedMs: 10 * 60 * 1000,
    },
    timeLimitMs: 10 * 60 * 1000,
    objectives: [
      { id: "survive_window", type: "survive_time_ms", target: 6 * 60 * 1000 },
      { id: "cash_floor", type: "cash", target: 20000 },
    ],
    rewardsByRank: {
      Bronze: ["asc_title_crisis_director"],
      Silver: ["asc_research_boost_1"],
      Gold: ["asc_research_boost_2"],
    },
  },
  {
    id: "asc_quantum_audit",
    name: "Quantum Audit",
    description: "Late-game pressure run requiring tier, contracts, and score with prestige locked.",
    flavorText: "Board auditors arrive when margins get strange.",
    category: "Expert",
    unlockCondition: { type: "antimatterBananas", value: 40 },
    ruleIds: ["disable_prestige", "no_offline_gains", "contract_focus", "slower_spawn_rate"],
    rankThresholds: {
      goldMaxElapsedMs: 13 * 60 * 1000,
      silverMaxElapsedMs: 18 * 60 * 1000,
      bronzeMaxElapsedMs: 25 * 60 * 1000,
    },
    timeLimitMs: 25 * 60 * 1000,
    objectives: [
      { id: "quantum_tier", type: "tree_tier_index", target: 6 },
      { id: "quantum_contracts", type: "contracts_completed", target: 14 },
      { id: "quantum_cash", type: "cash", target: 1_500_000 },
      { id: "quantum_score", type: "score", target: 3600 },
    ],
    rewardsByRank: {
      Bronze: ["asc_title_quantum_cfo"],
      Silver: ["asc_prod_boost_2", "asc_export_boost_2"],
      Gold: ["asc_click_boost_2"],
    },
  },
]);

export const ascensionChallengeById = new Map(ascensionChallenges.map((challenge) => [challenge.id, challenge]));

export function getRankIndex(rank) {
  const idx = CHALLENGE_RANK_ORDER.indexOf(String(rank || ""));
  return idx >= 0 ? idx : 0;
}

export function getRewardsForChallengeRank(challenge, rank) {
  const rewardsByRank = challenge?.rewardsByRank && typeof challenge.rewardsByRank === "object" ? challenge.rewardsByRank : {};
  const targetIdx = getRankIndex(rank);
  const rewards = [];
  CHALLENGE_RANK_ORDER.forEach((tierRank) => {
    if (getRankIndex(tierRank) > targetIdx) {
      return;
    }
    const ids = Array.isArray(rewardsByRank[tierRank]) ? rewardsByRank[tierRank] : [];
    ids.forEach((id) => {
      if (ascensionRewardById.has(id)) {
        rewards.push(id);
      }
    });
  });
  return Array.from(new Set(rewards));
}

export function getDefaultChallengeHistory() {
  return {};
}

export function getDefaultChallengeRewardsUnlocked() {
  return [];
}

export function getDefaultActiveChallengeRun() {
  return null;
}

export function getDefaultChallengeLastResult() {
  return null;
}

export function buildDefaultObjectiveProgress(challenge) {
  const progress = {};
  const objectives = Array.isArray(challenge?.objectives) ? challenge.objectives : [];
  objectives.forEach((objective) => {
    progress[objective.id] = 0;
  });
  return progress;
}

function sanitizeRunStatus(rawStatus) {
  const values = new Set(Object.values(CHALLENGE_RUN_STATUS));
  const status = String(rawStatus || CHALLENGE_RUN_STATUS.active);
  return values.has(status) ? status : CHALLENGE_RUN_STATUS.active;
}

export function sanitizeChallengeHistory(rawHistory) {
  const next = {};
  const source = rawHistory && typeof rawHistory === "object" ? rawHistory : {};

  for (const [challengeId, rawEntry] of Object.entries(source)) {
    if (!ascensionChallengeById.has(challengeId) || !rawEntry || typeof rawEntry !== "object") {
      continue;
    }
    const completions = Math.max(0, Math.floor(Number(rawEntry.completions) || 0));
    const bestTimeMsRaw = Number(rawEntry.bestTimeMs);
    const bestTimeMs = Number.isFinite(bestTimeMsRaw) && bestTimeMsRaw > 0 ? Math.floor(bestTimeMsRaw) : null;
    const bestRank = String(rawEntry.bestRank || "");
    const lastCompletedAt = Math.max(0, Number(rawEntry.lastCompletedAt) || 0);

    next[challengeId] = {
      completions,
      bestRank: bestRank || null,
      bestTimeMs,
      lastCompletedAt: lastCompletedAt || null,
    };
  }

  return next;
}

export function sanitizeChallengeRewardsUnlocked(rawRewards) {
  const values = Array.isArray(rawRewards) ? rawRewards : [];
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

export function sanitizeActiveChallengeRun(rawRun) {
  if (!rawRun || typeof rawRun !== "object") {
    return null;
  }

  const challengeId = String(rawRun.challengeId || "");
  const challenge = ascensionChallengeById.get(challengeId);
  if (!challenge) {
    return null;
  }

  const startedAt = Math.max(0, Number(rawRun.startedAt) || 0);
  const seed = Math.max(0, Number(rawRun.seed) || 0);
  const status = sanitizeRunStatus(rawRun.status);
  const elapsedMs = Math.max(0, Math.floor(Number(rawRun.elapsedMs) || 0));
  const appliedRuleIds = Array.isArray(rawRun.appliedRuleIds) ? rawRun.appliedRuleIds.map((id) => String(id)) : [];
  const preRunSnapshot =
    rawRun.preRunSnapshot && typeof rawRun.preRunSnapshot === "object" ? rawRun.preRunSnapshot : null;

  const defaultProgress = buildDefaultObjectiveProgress(challenge);
  const incomingProgress = rawRun.objectiveProgress && typeof rawRun.objectiveProgress === "object" ? rawRun.objectiveProgress : {};
  const objectiveProgress = { ...defaultProgress };
  for (const objectiveId of Object.keys(defaultProgress)) {
    objectiveProgress[objectiveId] = Math.max(0, Number(incomingProgress[objectiveId]) || 0);
  }

  if (!preRunSnapshot) {
    return null;
  }

  return {
    challengeId,
    startedAt: startedAt || Date.now(),
    seed,
    status,
    elapsedMs,
    objectiveProgress,
    appliedRuleIds,
    preRunSnapshot,
    score: Math.max(0, Number(rawRun.score) || 0),
  };
}

export function sanitizeChallengeLastResult(rawResult) {
  if (!rawResult || typeof rawResult !== "object") {
    return null;
  }

  const challengeId = String(rawResult.challengeId || "");
  if (!ascensionChallengeById.has(challengeId)) {
    return null;
  }

  const status = sanitizeRunStatus(rawResult.status);
  const rank = String(rawResult.rank || "Bronze");
  const elapsedMs = Math.max(0, Math.floor(Number(rawResult.elapsedMs) || 0));
  const score = Math.max(0, Number(rawResult.score) || 0);
  const completedAt = Math.max(0, Number(rawResult.completedAt) || 0);
  const objectiveProgress = rawResult.objectiveProgress && typeof rawResult.objectiveProgress === "object" ? rawResult.objectiveProgress : {};
  const rewardsGranted = Array.isArray(rawResult.rewardsGranted) ? rawResult.rewardsGranted.map((item) => String(item)) : [];

  return {
    challengeId,
    status,
    rank,
    elapsedMs,
    score,
    completedAt: completedAt || Date.now(),
    objectiveProgress,
    rewardsGranted,
  };
}
