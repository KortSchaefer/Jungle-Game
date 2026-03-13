import { getCasinoCardAsset, getCardDisplayLabel } from "./blackjack.js";

function renderCardMarkup(card, animate = false) {
  const asset = getCasinoCardAsset(card, "classic");
  const animClass = animate ? " casino-anim-card" : "";
  if (card?.faceUp === false) {
    if (asset.backSrc) {
      return `<div class="blackjack-card${animClass} is-face-down"><img class="blackjack-card-image" src="${asset.backSrc}" alt="Face-down card" draggable="false" /></div>`;
    }
    return `<div class="blackjack-card${animClass} is-face-down"><div class="blackjack-card-back">BACK</div></div>`;
  }
  if (asset.src) {
    return `<div class="blackjack-card${animClass}" data-asset-key="${asset.assetKey}"><img class="blackjack-card-image" src="${asset.src}" alt="${asset.label}" draggable="false" /></div>`;
  }
  return `<div class="blackjack-card${animClass}" data-asset-key="${asset.assetKey}"><div class="blackjack-card-face">${getCardDisplayLabel(card)}</div></div>`;
}

export function renderMississippiStudCardsMarkup(cards, options = {}) {
  const safeCards = Array.isArray(cards) ? cards : [];
  const animateLast = Boolean(options.animateLastCard);
  return `<div class="blackjack-card-strip">${safeCards.map((card, index) => renderCardMarkup(card, animateLast && index === safeCards.length - 1)).join("")}</div>`;
}
