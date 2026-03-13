import { evaluatePokerHand } from "./pokerHands.js";

const SUITS = Object.freeze(["spades", "hearts", "diamonds", "clubs"]);
const RANKS = Object.freeze([
  { id: "A", valueOptions: [1, 11] },
  { id: "2", valueOptions: [2] },
  { id: "3", valueOptions: [3] },
  { id: "4", valueOptions: [4] },
  { id: "5", valueOptions: [5] },
  { id: "6", valueOptions: [6] },
  { id: "7", valueOptions: [7] },
  { id: "8", valueOptions: [8] },
  { id: "9", valueOptions: [9] },
  { id: "10", valueOptions: [10] },
  { id: "J", valueOptions: [10] },
  { id: "Q", valueOptions: [10] },
  { id: "K", valueOptions: [10] },
]);

export const MISSISSIPPI_STUD_PHASES = Object.freeze({
  idle: "idle",
  first_decision: "first_decision",
  second_decision: "second_decision",
  third_decision: "third_decision",
  settled: "settled",
  folded: "folded",
});

export const MISSISSIPPI_STUD_PAYTABLE = Object.freeze([
  { rankId: "royal_flush", label: "Royal Flush", payoutMultiplier: 500 },
  { rankId: "straight_flush", label: "Straight Flush", payoutMultiplier: 100 },
  { rankId: "four_kind", label: "Four of a Kind", payoutMultiplier: 40 },
  { rankId: "full_house", label: "Full House", payoutMultiplier: 10 },
  { rankId: "flush", label: "Flush", payoutMultiplier: 6 },
  { rankId: "straight", label: "Straight", payoutMultiplier: 4 },
  { rankId: "three_kind", label: "Three of a Kind", payoutMultiplier: 3 },
  { rankId: "two_pair", label: "Two Pair", payoutMultiplier: 2 },
  { rankId: "high_pair", label: "Pair of 6s or Better", payoutMultiplier: 1 },
]);

function createStudCard(rank, suit) {
  return {
    id: `${rank.id}-${suit}-${Math.random().toString(36).slice(2, 8)}`,
    rank: rank.id,
    suit,
    valueOptions: [...rank.valueOptions],
    faceUp: true,
    assetKey: `${rank.id.toLowerCase()}_of_${suit}`,
  };
}

export function createShuffledMississippiStudDeck() {
  const deck = [];
  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      deck.push(createStudCard(rank, suit));
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

export function getDefaultMississippiStudState() {
  return {
    tablePhase: MISSISSIPPI_STUD_PHASES.idle,
    deck: [],
    playerCards: [],
    communityCards: [],
    revealedCommunityCount: 0,
    anteBet: 0,
    streetBets: [0, 0, 0],
    currentDecisionIndex: 0,
    handRank: "",
    payoutMultiplier: 0,
    totalPayout: 0,
    resultText: "",
    lastPlayedAt: 0,
    folded: false,
  };
}

export function getDefaultMississippiStudStats() {
  return {
    handsPlayed: 0,
    handsWon: 0,
    handsLost: 0,
    totalCashWagered: 0,
    totalCashWon: 0,
    totalCashLost: 0,
    largestAnte: 0,
    largestPayout: 0,
    bestWinStreak: 0,
    currentWinStreak: 0,
    royalFlushes: 0,
    straightFlushes: 0,
    fourKind: 0,
    fullHouses: 0,
    flushes: 0,
    straights: 0,
    threeKind: 0,
    twoPair: 0,
    highPairs: 0,
  };
}

export function sanitizeMississippiStudCard(rawCard) {
  return {
    id: String(rawCard?.id || `stud-card-${Math.random().toString(36).slice(2, 8)}`),
    rank: String(rawCard?.rank || "?"),
    suit: String(rawCard?.suit || "spades"),
    valueOptions: Array.isArray(rawCard?.valueOptions) ? [...rawCard.valueOptions] : [0],
    faceUp: rawCard?.faceUp !== false,
    assetKey: String(rawCard?.assetKey || "card_back"),
  };
}

export function sanitizeMississippiStudState(rawState) {
  const defaults = getDefaultMississippiStudState();
  return {
    tablePhase: Object.values(MISSISSIPPI_STUD_PHASES).includes(rawState?.tablePhase) ? rawState.tablePhase : defaults.tablePhase,
    deck: Array.isArray(rawState?.deck) ? rawState.deck.map(sanitizeMississippiStudCard) : [],
    playerCards: Array.isArray(rawState?.playerCards) ? rawState.playerCards.map(sanitizeMississippiStudCard) : [],
    communityCards: Array.isArray(rawState?.communityCards) ? rawState.communityCards.map(sanitizeMississippiStudCard) : [],
    revealedCommunityCount: Math.max(0, Math.min(3, Math.floor(Number(rawState?.revealedCommunityCount) || 0))),
    anteBet: Math.max(0, Number(rawState?.anteBet) || 0),
    streetBets: Array.isArray(rawState?.streetBets)
      ? [0, 1, 2].map((index) => Math.max(0, Number(rawState.streetBets[index]) || 0))
      : [...defaults.streetBets],
    currentDecisionIndex: Math.max(0, Math.min(2, Math.floor(Number(rawState?.currentDecisionIndex) || 0))),
    handRank: String(rawState?.handRank || ""),
    payoutMultiplier: Math.max(0, Number(rawState?.payoutMultiplier) || 0),
    totalPayout: Math.max(0, Number(rawState?.totalPayout) || 0),
    resultText: String(rawState?.resultText || ""),
    lastPlayedAt: Math.max(0, Number(rawState?.lastPlayedAt) || 0),
    folded: Boolean(rawState?.folded),
  };
}

export function sanitizeMississippiStudStats(rawStats) {
  const defaults = getDefaultMississippiStudStats();
  const next = { ...defaults, ...(rawStats || {}) };
  Object.keys(defaults).forEach((key) => {
    next[key] = Math.max(0, Number(next[key]) || 0);
  });
  return next;
}

export function getMississippiStudCommittedWager(state) {
  const streetTotal = (Array.isArray(state?.streetBets) ? state.streetBets : []).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  return Math.max(0, Number(state?.anteBet) || 0) + streetTotal;
}

export function getVisibleMississippiStudCommunityCards(state) {
  const cards = Array.isArray(state?.communityCards) ? state.communityCards : [];
  const revealed = Math.max(0, Math.min(cards.length, Math.floor(Number(state?.revealedCommunityCount) || 0)));
  return cards.map((card, index) => ({
    ...card,
    faceUp: index < revealed,
  }));
}

export function getMississippiStudFullHand(state) {
  return [
    ...(Array.isArray(state?.playerCards) ? state.playerCards : []),
    ...(Array.isArray(state?.communityCards) ? state.communityCards : []),
  ];
}

export function evaluateMississippiStudHand(state) {
  return evaluatePokerHand(getMississippiStudFullHand(state));
}
