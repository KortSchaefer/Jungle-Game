import {
  getDefaultMississippiStudState,
  getDefaultMississippiStudStats,
  sanitizeMississippiStudState,
  sanitizeMississippiStudStats,
} from "./mississippiStud.js";
import {
  getDefaultBaccaratState,
  getDefaultBaccaratStats,
  sanitizeBaccaratState,
  sanitizeBaccaratStats,
} from "./baccarat.js";

const SUITS = Object.freeze([
  { id: "spades", symbol: "S" },
  { id: "hearts", symbol: "H" },
  { id: "diamonds", symbol: "D" },
  { id: "clubs", symbol: "C" },
]);

const CARD_ASSET_MODULES = import.meta.glob("../main/PNG-cards-1.3/*.png", {
  eager: true,
  import: "default",
});

const RANK_ASSET_NAMES = Object.freeze({
  A: "ace",
  J: "jack",
  Q: "queen",
  K: "king",
});

const CARD_ASSET_LOOKUP = Object.entries(CARD_ASSET_MODULES).reduce((acc, [path, src]) => {
  const filename = String(path).split("/").pop() || "";
  acc[filename.toLowerCase()] = src;
  return acc;
}, {});

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

export const BLACKJACK_PHASES = Object.freeze({
  idle: "idle",
  insurance_offer: "insurance_offer",
  player_turn: "player_turn",
  dealer_turn: "dealer_turn",
  settled: "settled",
});

export function createShuffledBlackjackDeck() {
  const deck = [];
  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      deck.push({
        id: `${rank.id}-${suit.id}-${Math.random().toString(36).slice(2, 8)}`,
        rank: rank.id,
        suit: suit.id,
        valueOptions: [...rank.valueOptions],
        faceUp: true,
        assetKey: `${rank.id.toLowerCase()}_of_${suit.id}`,
      });
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

export function getDefaultBlackjackStats() {
  return {
    handsPlayed: 0,
    handsWon: 0,
    handsLost: 0,
    handsPushed: 0,
    handsSurrendered: 0,
    naturalBlackjacks: 0,
    playerBusts: 0,
    dealerBusts: 0,
    splitHandsCreated: 0,
    doubleDownHands: 0,
    insuranceBetsPlaced: 0,
    insuranceWins: 0,
    totalCashWagered: 0,
    totalCashWon: 0,
    totalCashLost: 0,
    largestSingleBet: 0,
    largestSingleWin: 0,
    bestWinStreak: 0,
    currentWinStreak: 0,
    wageredByCurrency: { cash: 0, bananas: 0, pip: 0 },
    wonByCurrency: { cash: 0, bananas: 0, pip: 0 },
    lostByCurrency: { cash: 0, bananas: 0, pip: 0 },
  };
}

export function getDefaultCasinoStats() {
  return {
    totalGamesPlayed: 0,
    totalCasinoCashWagered: 0,
    totalCasinoCashWon: 0,
    favoriteGameId: "blackjack",
    totalCasinoWageredByCurrency: { cash: 0, bananas: 0, pip: 0 },
    totalCasinoWonByCurrency: { cash: 0, bananas: 0, pip: 0 },
  };
}

export function getDefaultBlackjackState() {
  return {
    tablePhase: BLACKJACK_PHASES.idle,
    deck: [],
    dealerCards: [],
    dealerHoleCardRevealed: false,
    playerHands: [],
    activeHandIndex: 0,
    mainBet: 0,
    insuranceBet: 0,
    offeredInsurance: false,
    canSurrender: false,
    handResultSummary: "",
    lastPlayedAt: 0,
    wagerCurrency: "cash",
  };
}

export function getDefaultCasinoState() {
  return {
    unlocked: false,
    activeGameId: "blackjack",
    selectedWagerCurrency: "cash",
    blackjack: getDefaultBlackjackState(),
    mississippiStud: getDefaultMississippiStudState(),
    baccarat: getDefaultBaccaratState(),
    casinoStats: getDefaultCasinoStats(),
    blackjackStats: getDefaultBlackjackStats(),
    mississippiStudStats: getDefaultMississippiStudStats(),
    baccaratStats: getDefaultBaccaratStats(),
  };
}

export function getCardDisplayLabel(card) {
  const suitSymbol = SUITS.find((suit) => suit.id === card?.suit)?.symbol || "?";
  return `${card?.rank || "?"}${suitSymbol}`;
}

export function cloneBlackjackCard(card, overrides = {}) {
  return {
    id: String(card?.id || `card-${Math.random().toString(36).slice(2, 8)}`),
    rank: String(card?.rank || "?"),
    suit: String(card?.suit || "spades"),
    valueOptions: Array.isArray(card?.valueOptions) ? [...card.valueOptions] : [0],
    faceUp: card?.faceUp !== false,
    assetKey: String(card?.assetKey || "card_back"),
    ...overrides,
  };
}

export function getBlackjackHandValue(cards) {
  const safeCards = Array.isArray(cards) ? cards : [];
  let total = 0;
  let aceCount = 0;

  safeCards.forEach((card) => {
    const values = Array.isArray(card?.valueOptions) ? card.valueOptions : [0];
    const base = Number(values[0]) || 0;
    total += base;
    if (values.includes(11)) {
      aceCount += 1;
    }
  });

  let bestTotal = total;
  let isSoft = false;
  while (aceCount > 0 && bestTotal + 10 <= 21) {
    bestTotal += 10;
    aceCount -= 1;
    isSoft = true;
  }

  return {
    total: bestTotal,
    isSoft,
    isBust: bestTotal > 21,
  };
}

export function isNaturalBlackjack(cards) {
  const safeCards = Array.isArray(cards) ? cards : [];
  return safeCards.length === 2 && getBlackjackHandValue(safeCards).total === 21;
}

export function isTenValueCard(card) {
  const values = Array.isArray(card?.valueOptions) ? card.valueOptions : [0];
  return values.includes(10);
}

export function canSplitBlackjackHand(hand) {
  const cards = Array.isArray(hand?.cards) ? hand.cards : [];
  return cards.length === 2 && cards[0]?.rank === cards[1]?.rank;
}

export function dealerShouldHit(cards) {
  const value = getBlackjackHandValue(cards);
  if (value.total < 17) {
    return true;
  }
  return value.total === 17 && !value.isSoft ? false : false;
}

export function getCasinoCardAsset(card, theme = "default") {
  const rankKey = RANK_ASSET_NAMES[card?.rank] || String(card?.rank || "").toLowerCase();
  const filename = `${rankKey}_of_${String(card?.suit || "").toLowerCase()}.png`;
  const fallbackFilename = `${rankKey}_of_${String(card?.suit || "").toLowerCase()}2.png`;
  const src = CARD_ASSET_LOOKUP[filename] || CARD_ASSET_LOOKUP[fallbackFilename] || null;
  const backSrc = CARD_ASSET_LOOKUP["monkey_card_back.png"] || null;
  return {
    theme,
    assetKey: String(card?.assetKey || "card_back"),
    label: getCardDisplayLabel(card),
    src,
    backSrc,
  };
}

function sanitizeCasinoWagerCurrency(rawCurrency) {
  return ["cash", "bananas", "pip"].includes(rawCurrency) ? rawCurrency : "cash";
}

export function sanitizeBlackjackState(rawState) {
  const defaults = getDefaultBlackjackState();
  const playerHands = Array.isArray(rawState?.playerHands) ? rawState.playerHands.map((hand) => sanitizeBlackjackHand(hand)) : [];
  return {
    tablePhase: Object.values(BLACKJACK_PHASES).includes(rawState?.tablePhase) ? rawState.tablePhase : defaults.tablePhase,
    deck: Array.isArray(rawState?.deck) ? rawState.deck.map((card) => cloneBlackjackCard(card)) : [],
    dealerCards: Array.isArray(rawState?.dealerCards) ? rawState.dealerCards.map((card) => cloneBlackjackCard(card)) : [],
    dealerHoleCardRevealed: Boolean(rawState?.dealerHoleCardRevealed),
    playerHands,
    activeHandIndex: Math.max(0, Math.min(playerHands.length > 0 ? playerHands.length - 1 : 0, Math.floor(Number(rawState?.activeHandIndex) || 0))),
    mainBet: Math.max(0, Number(rawState?.mainBet) || 0),
    insuranceBet: Math.max(0, Number(rawState?.insuranceBet) || 0),
    offeredInsurance: Boolean(rawState?.offeredInsurance),
    canSurrender: Boolean(rawState?.canSurrender),
    handResultSummary: String(rawState?.handResultSummary || ""),
    lastPlayedAt: Math.max(0, Number(rawState?.lastPlayedAt) || 0),
    wagerCurrency: sanitizeCasinoWagerCurrency(rawState?.wagerCurrency),
  };
}

export function sanitizeCasinoState(rawState) {
  const defaults = getDefaultCasinoState();
  return {
    unlocked: Boolean(rawState?.unlocked),
    activeGameId: ["blackjack", "mississippi_stud", "baccarat"].includes(rawState?.activeGameId) ? rawState.activeGameId : defaults.activeGameId,
    selectedWagerCurrency: sanitizeCasinoWagerCurrency(rawState?.selectedWagerCurrency),
    blackjack: sanitizeBlackjackState(rawState?.blackjack),
    mississippiStud: sanitizeMississippiStudState(rawState?.mississippiStud),
    baccarat: sanitizeBaccaratState(rawState?.baccarat),
    casinoStats: sanitizeCasinoStats(rawState?.casinoStats),
    blackjackStats: sanitizeBlackjackStats(rawState?.blackjackStats),
    mississippiStudStats: sanitizeMississippiStudStats(rawState?.mississippiStudStats),
    baccaratStats: sanitizeBaccaratStats(rawState?.baccaratStats),
  };
}

export function sanitizeBlackjackCard(rawCard) {
  return cloneBlackjackCard(rawCard, {
    faceUp: rawCard?.faceUp !== false,
  });
}

export function sanitizeBlackjackHand(rawHand) {
  const cards = Array.isArray(rawHand?.cards) ? rawHand.cards.map(sanitizeBlackjackCard) : [];
  return {
    id: String(rawHand?.id || `hand-${Math.random().toString(36).slice(2, 8)}`),
    cards,
    wager: Math.max(0, Number(rawHand?.wager) || 0),
    doubled: Boolean(rawHand?.doubled),
    splitFromAces: Boolean(rawHand?.splitFromAces),
    surrendered: Boolean(rawHand?.surrendered),
    stood: Boolean(rawHand?.stood),
    busted: Boolean(rawHand?.busted),
    resolved: Boolean(rawHand?.resolved),
    result: rawHand?.result ? String(rawHand.result) : null,
    payout: Math.max(0, Number(rawHand?.payout) || 0),
    actionCount: Math.max(0, Math.floor(Number(rawHand?.actionCount) || 0)),
    insuranceResolved: Boolean(rawHand?.insuranceResolved),
    isSplitHand: Boolean(rawHand?.isSplitHand),
  };
}

export function sanitizeBlackjackStats(rawStats) {
  const defaults = getDefaultBlackjackStats();
  const next = { ...defaults, ...(rawStats || {}) };
  Object.keys(defaults).forEach((key) => {
    if (typeof defaults[key] === "object" && defaults[key] !== null) {
      next[key] = {
        cash: Math.max(0, Number(next[key]?.cash) || 0),
        bananas: Math.max(0, Number(next[key]?.bananas) || 0),
        pip: Math.max(0, Number(next[key]?.pip) || 0),
      };
      return;
    }
    next[key] = Math.max(0, Number(next[key]) || 0);
  });
  return next;
}

export function sanitizeCasinoStats(rawStats) {
  const defaults = getDefaultCasinoStats();
  return {
    totalGamesPlayed: Math.max(0, Number(rawStats?.totalGamesPlayed) || defaults.totalGamesPlayed),
    totalCasinoCashWagered: Math.max(0, Number(rawStats?.totalCasinoCashWagered) || defaults.totalCasinoCashWagered),
    totalCasinoCashWon: Math.max(0, Number(rawStats?.totalCasinoCashWon) || defaults.totalCasinoCashWon),
    favoriteGameId: String(rawStats?.favoriteGameId || defaults.favoriteGameId),
    totalCasinoWageredByCurrency: {
      cash: Math.max(0, Number(rawStats?.totalCasinoWageredByCurrency?.cash) || 0),
      bananas: Math.max(0, Number(rawStats?.totalCasinoWageredByCurrency?.bananas) || 0),
      pip: Math.max(0, Number(rawStats?.totalCasinoWageredByCurrency?.pip) || 0),
    },
    totalCasinoWonByCurrency: {
      cash: Math.max(0, Number(rawStats?.totalCasinoWonByCurrency?.cash) || 0),
      bananas: Math.max(0, Number(rawStats?.totalCasinoWonByCurrency?.bananas) || 0),
      pip: Math.max(0, Number(rawStats?.totalCasinoWonByCurrency?.pip) || 0),
    },
  };
}
