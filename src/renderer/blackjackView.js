import { getBlackjackHandValue, getCardDisplayLabel, getCasinoCardAsset } from "./blackjack.js";

function renderCardMarkup(card) {
  const asset = getCasinoCardAsset(card, "classic");
  if (card?.faceUp === false) {
    if (asset.backSrc) {
      return `<div class="blackjack-card is-face-down"><img class="blackjack-card-image" src="${asset.backSrc}" alt="Face-down card" draggable="false" /></div>`;
    }
    return `<div class="blackjack-card is-face-down"><div class="blackjack-card-back">BACK</div></div>`;
  }
  if (asset.src) {
    return `<div class="blackjack-card" data-asset-key="${asset.assetKey}"><img class="blackjack-card-image" src="${asset.src}" alt="${asset.label}" draggable="false" /></div>`;
  }
  return `<div class="blackjack-card" data-asset-key="${asset.assetKey}"><div class="blackjack-card-face">${getCardDisplayLabel(card)}</div></div>`;
}

export function renderBlackjackDealerMarkup(cards) {
  const safeCards = Array.isArray(cards) ? cards : [];
  return `<div class="blackjack-card-strip">${safeCards.map((card) => renderCardMarkup(card)).join("")}</div>`;
}

export function renderBlackjackPlayerHandsMarkup(hands) {
  const safeHands = Array.isArray(hands) ? hands : [];
  return safeHands
    .map((hand, index) => {
      const value = getBlackjackHandValue(hand.cards);
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
      return `<div class="blackjack-hand-row ${hand.isActive ? "is-active" : ""}">
        <p class="buyer-name">Hand ${index + 1} | Total ${value.total}${stateBits.length ? ` | ${stateBits.join(", ")}` : ""}</p>
        <div class="blackjack-card-strip">${hand.cards.map((card) => renderCardMarkup(card)).join("")}</div>
      </div>`;
    })
    .join("");
}
