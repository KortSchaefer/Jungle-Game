export function getDefaultLifetimeStats() {
  return {
    bananasEarned: 0,
    cashEarned: 0,
    totalClicks: 0,
    totalShipments: 0,
    contractsCompleted: 0,
    pipEarned: 0,
    pipSpent: 0,
    researchPurchased: 0,
    achievementsUnlocked: 0,
    antimatterBananasGenerated: 0,
    weirdScienceStructuresBuilt: 0,
    highestTreeTierReached: 0,
  };
}

export function sanitizeLifetimeStats(raw) {
  const safe = raw && typeof raw === "object" ? raw : {};
  const defaults = getDefaultLifetimeStats();
  const next = {};
  Object.keys(defaults).forEach((key) => {
    const value = Number(safe[key]);
    next[key] = Number.isFinite(value) ? Math.max(0, value) : defaults[key];
  });
  return next;
}

const ACCOUNT_TITLES = Object.freeze([
  "Sapling Clerk",
  "Grove Supervisor",
  "Orchard Director",
  "Port Strategist",
  "Quantum Broker",
  "Exotic Archivist",
  "Antimatter Chairape",
  "Reality Merger Officer",
]);

function logContribution(weight, value) {
  const safe = Math.max(0, Number(value) || 0);
  return weight * Math.log10(safe + 1);
}

function sqrtContribution(weight, value) {
  const safe = Math.max(0, Number(value) || 0);
  return weight * Math.sqrt(safe);
}

function linearContribution(weight, value) {
  const safe = Math.max(0, Number(value) || 0);
  return weight * safe;
}

export function getAccountTitle(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  const bucket = Math.min(ACCOUNT_TITLES.length - 1, Math.floor((safeLevel - 1) / 10));
  return ACCOUNT_TITLES[bucket];
}

export function getAccountRewardSteps(level) {
  const milestoneCount = Math.max(0, Math.floor((Math.max(1, Math.floor(Number(level) || 1)) - 1) / 5));
  return {
    production: Math.floor((milestoneCount + 2) / 3),
    export: Math.floor((milestoneCount + 1) / 3),
    click: Math.floor(milestoneCount / 3),
    totalMilestones: milestoneCount,
  };
}

export function getAccountRewardMultipliers(level) {
  const steps = getAccountRewardSteps(level);
  return {
    productionMultiplier: 1.01 ** steps.production,
    exportPriceMultiplier: 1.01 ** steps.export,
    clickMultiplier: 1.01 ** steps.click,
    profileStars: Math.max(0, Math.floor(Number(level) || 1) - 1),
    rewardSteps: steps,
  };
}

function getXpRequiredForNextLevel(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  return Math.floor(80 + (safeLevel ** 1.35) * 55 + safeLevel * 12);
}

export function getNextAccountRewardPreview(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  const nextLevel = safeLevel + 1;
  const preview = [`Lv ${nextLevel}: +1 Profile Star`];
  if (nextLevel % 5 === 0) {
    const milestoneIndex = Math.floor(nextLevel / 5);
    const rewardType = ["production", "export", "click"][(milestoneIndex - 1) % 3];
    if (rewardType === "production") {
      preview.push("+1% permanent production");
    } else if (rewardType === "export") {
      preview.push("+1% permanent export price");
    } else {
      preview.push("+1% permanent click yield");
    }
  }
  if (Math.floor((safeLevel - 1) / 10) !== Math.floor((nextLevel - 1) / 10)) {
    preview.push(`New title: ${getAccountTitle(nextLevel)}`);
  }
  return preview.join(" | ");
}

export function buildAccountProgressionStatus(metrics = {}) {
  const safeMetrics = {
    bananasEarned: Math.max(0, Number(metrics.bananasEarned) || 0),
    cashEarned: Math.max(0, Number(metrics.cashEarned) || 0),
    totalClicks: Math.max(0, Number(metrics.totalClicks) || 0),
    totalShipments: Math.max(0, Number(metrics.totalShipments) || 0),
    contractsCompleted: Math.max(0, Number(metrics.contractsCompleted) || 0),
    prestigeCount: Math.max(0, Number(metrics.prestigeCount) || 0),
    pipEarned: Math.max(0, Number(metrics.pipEarned) || 0),
    pipSpent: Math.max(0, Number(metrics.pipSpent) || 0),
    researchPurchased: Math.max(0, Number(metrics.researchPurchased) || 0),
    achievementsUnlocked: Math.max(0, Number(metrics.achievementsUnlocked) || 0),
    antimatterBananasGenerated: Math.max(0, Number(metrics.antimatterBananasGenerated) || 0),
    weirdScienceStructuresBuilt: Math.max(0, Number(metrics.weirdScienceStructuresBuilt) || 0),
    highestTreeTierReached: Math.max(0, Number(metrics.highestTreeTierReached) || 0),
    casinoHandsPlayed: Math.max(0, Number(metrics.casinoHandsPlayed) || 0),
  };

  const contributionEntries = [
    ["Bananas Earned", logContribution(40, safeMetrics.bananasEarned)],
    ["Cash Earned", logContribution(30, safeMetrics.cashEarned)],
    ["Clicks", sqrtContribution(0.55, safeMetrics.totalClicks)],
    ["Shipments", linearContribution(0.08, safeMetrics.totalShipments)],
    ["Contracts", linearContribution(4, safeMetrics.contractsCompleted)],
    ["Prestige", linearContribution(25, safeMetrics.prestigeCount)],
    ["PIP Earned", sqrtContribution(18, safeMetrics.pipEarned)],
    ["PIP Spent", sqrtContribution(12, safeMetrics.pipSpent)],
    ["Research", linearContribution(7, safeMetrics.researchPurchased)],
    ["Achievements", linearContribution(10, safeMetrics.achievementsUnlocked)],
    ["Antimatter", sqrtContribution(6, safeMetrics.antimatterBananasGenerated)],
    ["Weird Science", linearContribution(5, safeMetrics.weirdScienceStructuresBuilt)],
    ["Tree Tier", linearContribution(20, safeMetrics.highestTreeTierReached)],
    ["Casino", sqrtContribution(1.2, safeMetrics.casinoHandsPlayed)],
  ].map(([label, value]) => ({ label, value }));

  const xpTotal = contributionEntries.reduce((sum, entry) => sum + entry.value, 0);
  let level = 1;
  let currentLevelXpStart = 0;
  let nextLevelXp = getXpRequiredForNextLevel(level);
  let remainingXp = xpTotal;
  while (remainingXp >= nextLevelXp) {
    remainingXp -= nextLevelXp;
    currentLevelXpStart += nextLevelXp;
    level += 1;
    nextLevelXp = getXpRequiredForNextLevel(level);
  }

  const progress = nextLevelXp <= 0 ? 1 : Math.max(0, Math.min(1, remainingXp / nextLevelXp));
  const rewardMultipliers = getAccountRewardMultipliers(level);

  return {
    level,
    xpTotal,
    currentLevelXpStart,
    xpIntoLevel: remainingXp,
    nextLevelXp,
    progress,
    title: getAccountTitle(level),
    nextRewardPreview: getNextAccountRewardPreview(level),
    profileStars: rewardMultipliers.profileStars,
    rewardMultipliers,
    contributionEntries,
  };
}
