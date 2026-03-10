const MAX_PIP = 10n ** 18n;
const MAX_TOTAL_BANANAS = 1e34;
const MAX_PRESTIGE_PER_10_MIN = 25;
const MAX_PIP_GAIN_PER_MIN = 5_000_000n;
const MAX_BANANAS_GAIN_PER_MIN = 5e14;

function minutesBetween(fromDate, toDate) {
  const ms = Math.max(1, toDate.getTime() - fromDate.getTime());
  return ms / 60_000;
}

export function validateSubmissionDelta({
  incomingPrestigeCount,
  incomingPip,
  incomingTotalBananas,
  previousStats,
  now,
}) {
  if (incomingPip > MAX_PIP) {
    return { ok: false, reason: "pip_above_max" };
  }
  if (!Number.isFinite(incomingTotalBananas) || incomingTotalBananas > MAX_TOTAL_BANANAS) {
    return { ok: false, reason: "total_bananas_above_max" };
  }
  if (!previousStats) {
    return { ok: true };
  }

  const prevPrestige = Number(previousStats.prestige_count);
  const prevPip = BigInt(previousStats.pip);
  const prevBananas = Number(previousStats.total_bananas_earned);
  const prevUpdatedAt = new Date(previousStats.updated_at);
  const deltaMinutes = minutesBetween(prevUpdatedAt, now);
  const prestigedSinceLastSubmit = incomingPrestigeCount > prevPrestige;

  if (incomingPrestigeCount < prevPrestige) {
    return { ok: false, reason: "prestige_decrease_not_allowed" };
  }
  // Some game designs reset run-based banana counters on prestige.
  // Only allow a banana decrease when prestige has increased since last submit.
  if (incomingTotalBananas < prevBananas && !prestigedSinceLastSubmit) {
    return { ok: false, reason: "total_bananas_decrease_not_allowed" };
  }

  const prestigeDelta = incomingPrestigeCount - prevPrestige;
  const prestigeLimit = Math.max(1, Math.floor((deltaMinutes / 10) * MAX_PRESTIGE_PER_10_MIN));
  if (prestigeDelta > prestigeLimit) {
    return { ok: false, reason: "prestige_jump_too_large" };
  }

  if (incomingPip >= prevPip) {
    const pipGain = incomingPip - prevPip;
    const pipLimit = BigInt(Math.floor(deltaMinutes)) * MAX_PIP_GAIN_PER_MIN + 2_000_000n;
    if (pipGain > pipLimit) {
      return { ok: false, reason: "pip_gain_too_large" };
    }
  }

  const bananaGain = incomingTotalBananas - prevBananas;
  if (bananaGain >= 0) {
    const bananaLimit = deltaMinutes * MAX_BANANAS_GAIN_PER_MIN + 5e12;
    if (bananaGain > bananaLimit) {
      return { ok: false, reason: "banana_gain_too_large" };
    }
  }

  return { ok: true };
}
