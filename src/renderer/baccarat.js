const SUITS = Object.freeze(["spades", "hearts", "diamonds", "clubs"]);
const RANKS = Object.freeze([
  { id: "A", value: 1 },
  { id: "2", value: 2 },
  { id: "3", value: 3 },
  { id: "4", value: 4 },
  { id: "5", value: 5 },
  { id: "6", value: 6 },
  { id: "7", value: 7 },
  { id: "8", value: 8 },
  { id: "9", value: 9 },
  { id: "10", value: 0 },
  { id: "J", value: 0 },
  { id: "Q", value: 0 },
  { id: "K", value: 0 },
]);

export const BACCARAT_PHASES = Object.freeze({
  idle: "idle",
  settled: "settled",
});

export const BACCARAT_BET_CHOICES = Object.freeze({
  player: "player",
  banker: "banker",
  tie: "tie",
});

export const BACCARAT_PAYOUTS = Object.freeze({
  player: 1,
  banker: 1,
  tie: 8,
  bankerCommissionRate: 0.05,
});

function createBaccaratCard(rank, suit) {
  return {
    id: `${rank.id}-${suit}-${Math.random().toString(36).slice(2, 8)}`,
    rank: rank.id,
    suit,
    valueOptions: [rank.value],
    faceUp: true,
    assetKey: `${rank.id.toLowerCase()}_of_${suit}`,
  };
}

export function createShuffledBaccaratDeck() {
  const deck = [];
  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      deck.push(createBaccaratCard(rank, suit));
    });
  });
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = deck[index];
    deck[index] = deck[swapIndex];
    deck[swapIndex] = temp;
  }
  return deck;
}

export function getDefaultBaccaratState() {
  return {
    tablePhase: BACCARAT_PHASES.idle,
    deck: [],
    playerCards: [],
    bankerCards: [],
    betChoice: "",
    betAmount: 0,
    result: "",
    resultText: "",
    payoutAmount: 0,
    commissionPaid: 0,
    lastPlayedAt: 0,
  };
}

export function getDefaultBaccaratStats() {
  return {
    handsPlayed: 0,
    handsWon: 0,
    handsLost: 0,
    handsPushed: 0,
    playerBetsPlaced: 0,
    bankerBetsPlaced: 0,
    tieBetsPlaced: 0,
    playerWins: 0,
    bankerWins: 0,
    tieResults: 0,
    naturals: 0,
    thirdCardRounds: 0,
    totalCashWagered: 0,
    totalCashWon: 0,
    totalCashLost: 0,
    totalCommissionPaid: 0,
    largestSingleBet: 0,
    largestSingleWin: 0,
    bestWinStreak: 0,
    currentWinStreak: 0,
  };
}

export function sanitizeBaccaratCard(rawCard) {
  return {
    id: String(rawCard?.id || `baccarat-card-${Math.random().toString(36).slice(2, 8)}`),
    rank: String(rawCard?.rank || "?"),
    suit: String(rawCard?.suit || "spades"),
    valueOptions: Array.isArray(rawCard?.valueOptions) ? [...rawCard.valueOptions] : [0],
    faceUp: rawCard?.faceUp !== false,
    assetKey: String(rawCard?.assetKey || "card_back"),
  };
}

export function sanitizeBaccaratState(rawState) {
  const defaults = getDefaultBaccaratState();
  return {
    tablePhase: Object.values(BACCARAT_PHASES).includes(rawState?.tablePhase) ? rawState.tablePhase : defaults.tablePhase,
    deck: Array.isArray(rawState?.deck) ? rawState.deck.map(sanitizeBaccaratCard) : [],
    playerCards: Array.isArray(rawState?.playerCards) ? rawState.playerCards.map(sanitizeBaccaratCard) : [],
    bankerCards: Array.isArray(rawState?.bankerCards) ? rawState.bankerCards.map(sanitizeBaccaratCard) : [],
    betChoice: Object.values(BACCARAT_BET_CHOICES).includes(rawState?.betChoice) ? rawState.betChoice : defaults.betChoice,
    betAmount: Math.max(0, Number(rawState?.betAmount) || 0),
    result: ["player", "banker", "tie", ""].includes(rawState?.result) ? rawState.result : defaults.result,
    resultText: String(rawState?.resultText || ""),
    payoutAmount: Math.max(0, Number(rawState?.payoutAmount) || 0),
    commissionPaid: Math.max(0, Number(rawState?.commissionPaid) || 0),
    lastPlayedAt: Math.max(0, Number(rawState?.lastPlayedAt) || 0),
  };
}

export function sanitizeBaccaratStats(rawStats) {
  const defaults = getDefaultBaccaratStats();
  const next = { ...defaults, ...(rawStats || {}) };
  Object.keys(defaults).forEach((key) => {
    next[key] = Math.max(0, Number(next[key]) || 0);
  });
  return next;
}

export function getBaccaratCardValue(card) {
  const raw = Array.isArray(card?.valueOptions) ? Number(card.valueOptions[0]) : NaN;
  if (Number.isFinite(raw)) {
    return Math.max(0, raw) % 10;
  }
  const rank = String(card?.rank || "");
  if (rank === "A") {
    return 1;
  }
  const asNumber = Number(rank);
  if (Number.isFinite(asNumber) && asNumber >= 2 && asNumber <= 9) {
    return asNumber;
  }
  return 0;
}

export function getBaccaratHandTotal(cards) {
  const sum = (Array.isArray(cards) ? cards : []).reduce((total, card) => total + getBaccaratCardValue(card), 0);
  return sum % 10;
}

export function isBaccaratNatural(playerCards, bankerCards) {
  const playerTotal = getBaccaratHandTotal(playerCards);
  const bankerTotal = getBaccaratHandTotal(bankerCards);
  return playerTotal >= 8 || bankerTotal >= 8;
}

export function shouldPlayerDrawBaccarat(playerCards) {
  return getBaccaratHandTotal(playerCards) <= 5;
}

export function shouldBankerDrawBaccarat(bankerCards, playerThirdCard) {
  const bankerTotal = getBaccaratHandTotal(bankerCards);
  if (!playerThirdCard) {
    return bankerTotal <= 5;
  }
  const playerThirdValue = getBaccaratCardValue(playerThirdCard);
  if (bankerTotal <= 2) {
    return true;
  }
  if (bankerTotal === 3) {
    return playerThirdValue !== 8;
  }
  if (bankerTotal === 4) {
    return playerThirdValue >= 2 && playerThirdValue <= 7;
  }
  if (bankerTotal === 5) {
    return playerThirdValue >= 4 && playerThirdValue <= 7;
  }
  if (bankerTotal === 6) {
    return playerThirdValue === 6 || playerThirdValue === 7;
  }
  return false;
}

export function resolveBaccaratWinner(playerCards, bankerCards) {
  const playerTotal = getBaccaratHandTotal(playerCards);
  const bankerTotal = getBaccaratHandTotal(bankerCards);
  if (playerTotal > bankerTotal) {
    return { winner: BACCARAT_BET_CHOICES.player, playerTotal, bankerTotal };
  }
  if (bankerTotal > playerTotal) {
    return { winner: BACCARAT_BET_CHOICES.banker, playerTotal, bankerTotal };
  }
  return { winner: BACCARAT_BET_CHOICES.tie, playerTotal, bankerTotal };
}
