const RANK_ORDER = Object.freeze({
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
});

function getSortedRankValues(cards) {
  return (Array.isArray(cards) ? cards : [])
    .map((card) => RANK_ORDER[card?.rank] || 0)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
}

function getRankCounts(cards) {
  const counts = new Map();
  (Array.isArray(cards) ? cards : []).forEach((card) => {
    const rank = String(card?.rank || "");
    if (!RANK_ORDER[rank]) {
      return;
    }
    counts.set(rank, (counts.get(rank) || 0) + 1);
  });
  return counts;
}

function isFlush(cards) {
  const suits = new Set((Array.isArray(cards) ? cards : []).map((card) => String(card?.suit || "")));
  return suits.size === 1;
}

function getStraightHighValue(rankValues) {
  if (rankValues.length !== 5) {
    return 0;
  }
  const unique = Array.from(new Set(rankValues));
  if (unique.length !== 5) {
    return 0;
  }
  const min = unique[0];
  const max = unique[4];
  if (max - min === 4) {
    return max;
  }
  const wheel = [2, 3, 4, 5, 14];
  if (wheel.every((value, index) => unique[index] === value)) {
    return 5;
  }
  return 0;
}

export function evaluatePokerHand(cards) {
  const safeCards = Array.isArray(cards) ? cards.filter(Boolean) : [];
  if (safeCards.length !== 5) {
    return {
      rankId: "invalid",
      rankName: "Incomplete Hand",
      payoutKey: "invalid",
      payoutMultiplier: 0,
      qualifies: false,
      pairRankValue: 0,
    };
  }

  const rankValues = getSortedRankValues(safeCards);
  const rankCounts = Array.from(getRankCounts(safeCards).entries()).sort((a, b) => {
    const countDelta = b[1] - a[1];
    if (countDelta !== 0) {
      return countDelta;
    }
    return (RANK_ORDER[b[0]] || 0) - (RANK_ORDER[a[0]] || 0);
  });
  const flush = isFlush(safeCards);
  const straightHighValue = getStraightHighValue(rankValues);
  const isStraight = straightHighValue > 0;

  if (flush && isStraight && straightHighValue === 14) {
    return { rankId: "royal_flush", rankName: "Royal Flush", payoutKey: "royal_flush", payoutMultiplier: 500, qualifies: true, pairRankValue: 0 };
  }
  if (flush && isStraight) {
    return { rankId: "straight_flush", rankName: "Straight Flush", payoutKey: "straight_flush", payoutMultiplier: 100, qualifies: true, pairRankValue: 0 };
  }
  if (rankCounts[0]?.[1] === 4) {
    return { rankId: "four_kind", rankName: "Four of a Kind", payoutKey: "four_kind", payoutMultiplier: 40, qualifies: true, pairRankValue: 0 };
  }
  if (rankCounts[0]?.[1] === 3 && rankCounts[1]?.[1] === 2) {
    return { rankId: "full_house", rankName: "Full House", payoutKey: "full_house", payoutMultiplier: 10, qualifies: true, pairRankValue: 0 };
  }
  if (flush) {
    return { rankId: "flush", rankName: "Flush", payoutKey: "flush", payoutMultiplier: 6, qualifies: true, pairRankValue: 0 };
  }
  if (isStraight) {
    return { rankId: "straight", rankName: "Straight", payoutKey: "straight", payoutMultiplier: 4, qualifies: true, pairRankValue: 0 };
  }
  if (rankCounts[0]?.[1] === 3) {
    return { rankId: "three_kind", rankName: "Three of a Kind", payoutKey: "three_kind", payoutMultiplier: 3, qualifies: true, pairRankValue: 0 };
  }
  if (rankCounts[0]?.[1] === 2 && rankCounts[1]?.[1] === 2) {
    return { rankId: "two_pair", rankName: "Two Pair", payoutKey: "two_pair", payoutMultiplier: 2, qualifies: true, pairRankValue: 0 };
  }
  if (rankCounts[0]?.[1] === 2) {
    const pairRankValue = RANK_ORDER[rankCounts[0][0]] || 0;
    const qualifies = pairRankValue >= 6;
    return {
      rankId: qualifies ? "high_pair" : "low_pair",
      rankName: qualifies ? "Pair of 6s or Better" : "Low Pair",
      payoutKey: qualifies ? "high_pair" : "low_pair",
      payoutMultiplier: qualifies ? 1 : 0,
      qualifies,
      pairRankValue,
    };
  }
  return { rankId: "high_card", rankName: "High Card", payoutKey: "high_card", payoutMultiplier: 0, qualifies: false, pairRankValue: 0 };
}
