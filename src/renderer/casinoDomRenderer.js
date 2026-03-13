import { getCasinoCardAsset, getCardDisplayLabel } from "./blackjack.js";

function ensureCardNode(cardId) {
  const slot = document.createElement("div");
  slot.className = "blackjack-card-slot";
  slot.dataset.cardId = String(cardId);

  const card = document.createElement("div");
  card.className = "blackjack-card";

  const image = document.createElement("img");
  image.className = "blackjack-card-image";
  image.draggable = false;

  const face = document.createElement("div");
  face.className = "blackjack-card-face";

  card.appendChild(image);
  card.appendChild(face);
  slot.appendChild(card);
  slot.__refs = { card, image, face };
  return slot;
}

function syncCardSlot(slot, card, revealed) {
  const refs = slot.__refs;
  const asset = getCasinoCardAsset(card, "classic");
  const faceUp = revealed ? card?.faceUp !== false : false;

  slot.classList.toggle("is-revealed", revealed);
  slot.classList.toggle("is-hidden-card", !revealed);
  refs.card.classList.toggle("is-face-down", !faceUp);

  if (asset.src && faceUp) {
    if (refs.image.getAttribute("src") !== asset.src) {
      refs.image.setAttribute("src", asset.src);
    }
    refs.image.setAttribute("alt", asset.label);
    refs.image.hidden = false;
    refs.face.hidden = true;
  } else if (asset.backSrc && !faceUp) {
    if (refs.image.getAttribute("src") !== asset.backSrc) {
      refs.image.setAttribute("src", asset.backSrc);
    }
    refs.image.setAttribute("alt", "Face-down card");
    refs.image.hidden = false;
    refs.face.hidden = true;
  } else {
    refs.image.hidden = true;
    refs.face.hidden = false;
    refs.face.textContent = faceUp ? getCardDisplayLabel(card) : "";
  }
  const previous = slot.dataset.revealed === "true";
  slot.dataset.revealed = String(revealed);
  if (revealed && !previous) {
    slot.classList.remove("is-revealing");
    // force reflow to restart the transition only for newly revealed cards
    void slot.offsetWidth;
    slot.classList.add("is-revealing");
  }
}

function trimChildrenByKeys(container, activeKeys) {
  Array.from(container.children).forEach((child) => {
    if (!activeKeys.has(child.dataset.cardId) && !activeKeys.has(child.dataset.handId)) {
      child.remove();
    }
  });
}

function ensureStrip(container) {
  if (!container) {
    return null;
  }
  if (container.classList?.contains("blackjack-card-strip")) {
    return container;
  }
  let strip = container.querySelector(":scope > .blackjack-card-strip");
  if (!strip) {
    strip = document.createElement("div");
    strip.className = "blackjack-card-strip";
    container.replaceChildren(strip);
  }
  return strip;
}

export function syncCardStrip(container, cards, options = {}) {
  const strip = ensureStrip(container);
  if (!strip) {
    return;
  }
  const safeCards = Array.isArray(cards) ? cards : [];
  const revealedCount = options.revealedCount == null ? safeCards.length : Math.max(0, Math.min(safeCards.length, options.revealedCount));
  const activeKeys = new Set();
  safeCards.forEach((card, index) => {
    const key = String(card?.id || `slot-${index}`);
    activeKeys.add(key);
    let slot = strip.querySelector(`:scope > .blackjack-card-slot[data-card-id="${CSS.escape(key)}"]`);
    if (!slot) {
      slot = ensureCardNode(key);
      strip.appendChild(slot);
    }
    syncCardSlot(slot, card, index < revealedCount);
  });
  trimChildrenByKeys(strip, activeKeys);
}

function ensureHandRow(container, hand, index) {
  const key = String(hand?.id || `hand-${index}`);
  let row = container.querySelector(`:scope > .blackjack-hand-row[data-hand-id="${CSS.escape(key)}"]`);
  if (!row) {
    row = document.createElement("div");
    row.className = "blackjack-hand-row";
    row.dataset.handId = key;
    const label = document.createElement("p");
    label.className = "buyer-name";
    const strip = document.createElement("div");
    strip.className = "blackjack-card-strip";
    row.appendChild(label);
    row.appendChild(strip);
    container.appendChild(row);
  }
  return row;
}

export function syncBlackjackDealer(container, status) {
  syncCardStrip(container, status.dealerCards, { revealedCount: status.visibleDealerCount });
}

export function syncBlackjackPlayerHands(container, status) {
  if (!container) {
    return;
  }
  const hands = Array.isArray(status.playerHands) ? status.playerHands : [];
  const activeKeys = new Set();
  hands.forEach((hand, index) => {
    const row = ensureHandRow(container, hand, index);
    activeKeys.add(row.dataset.handId);
    row.classList.toggle("is-active", Boolean(hand.isActive));
    const value = hand.displayValue?.total ?? 0;
    const stateBits = [];
    if (hand.doubled) {
      stateBits.push("Doubled");
    }
    if (hand.surrendered) {
      stateBits.push("Surrendered");
    }
    if (hand.result) {
      stateBits.push(hand.result);
    }
    row.firstElementChild.textContent = `Hand ${index + 1} | Total ${value}${stateBits.length ? ` | ${stateBits.join(", ")}` : ""}`;
    syncCardStrip(row.lastElementChild, hand.cards, {
      revealedCount: Array.isArray(status.visiblePlayerHandCounts) ? status.visiblePlayerHandCounts[index] : hand.cards.length,
    });
  });
  trimChildrenByKeys(container, activeKeys);
}

export function syncStudCards(container, cards, revealedCount) {
  syncCardStrip(container, cards, { revealedCount });
}

export function syncBaccaratCards(container, cards, revealedCount) {
  syncCardStrip(container, cards, { revealedCount });
}
