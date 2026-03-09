import modernTree1 from "../main/graphics/newTree1.png";
import modernTree2 from "../main/graphics/newTree2.png";
import modernTree3 from "../main/graphics/newTree3.png";
import modernTree4 from "../main/graphics/newTree4.png";
import modernTree5 from "../main/graphics/newTree5.png";
import modernTree6 from "../main/graphics/newTree6.png";
import modernTree7 from "../main/graphics/newTree7.png";

import modernBanana1 from "../main/graphics/newBanana1.png";
import modernBanana2 from "../main/graphics/newBanana2.png";
import modernBanana3 from "../main/graphics/newBanana3.png";
import modernBanana4 from "../main/graphics/newBanana4.png";
import modernBanana5 from "../main/graphics/newBanana5.png";
import modernBanana6 from "../main/graphics/newBanana6.png";
import modernBanana7 from "../main/graphics/newBanana7.png";

import legacyTree1 from "../main/legacy graphics/tree1.png";
import legacyTree2 from "../main/legacy graphics/tree2.png";
import legacyTree3 from "../main/legacy graphics/tree3.png";
import legacyTree4 from "../main/legacy graphics/tree4.png";
import legacyTree5 from "../main/legacy graphics/tree5.png";
import legacyTree6 from "../main/legacy graphics/tree6.png";
import legacyTree7 from "../main/legacy graphics/tree7.png";
import legacyTree8 from "../main/legacy graphics/tree8.png";

import legacyBanana1 from "../main/legacy graphics/Banana1.png";
import legacyBanana2 from "../main/legacy graphics/Banana2.png";
import legacyBanana3 from "../main/legacy graphics/Banana3.png";

export const GRAPHICS_MODES = Object.freeze({
  MODERN: "modern",
  LEGACY: "legacy",
});

const TEXTURE_SETS = Object.freeze({
  [GRAPHICS_MODES.MODERN]: Object.freeze({
    // The new art pack currently has 7 tree stages, so tier 8 reuses the final texture.
    trees: Object.freeze([modernTree1, modernTree2, modernTree3, modernTree4, modernTree5, modernTree6, modernTree7, modernTree7]),
    bananas: Object.freeze([modernBanana1, modernBanana2, modernBanana3, modernBanana4, modernBanana5, modernBanana6, modernBanana7]),
  }),
  [GRAPHICS_MODES.LEGACY]: Object.freeze({
    trees: Object.freeze([legacyTree1, legacyTree2, legacyTree3, legacyTree4, legacyTree5, legacyTree6, legacyTree7, legacyTree8]),
    bananas: Object.freeze([legacyBanana1, legacyBanana2, legacyBanana3]),
  }),
});

export function sanitizeGraphicsMode(mode) {
  return mode === GRAPHICS_MODES.LEGACY ? GRAPHICS_MODES.LEGACY : GRAPHICS_MODES.MODERN;
}

export function getTextureSet(mode) {
  return TEXTURE_SETS[sanitizeGraphicsMode(mode)];
}

export function getTreeTextures(mode) {
  return getTextureSet(mode).trees;
}

export function getBananaTextures(mode) {
  return getTextureSet(mode).bananas;
}

export const treeTextures = TEXTURE_SETS[GRAPHICS_MODES.MODERN].trees;
export const bananaTextures = TEXTURE_SETS[GRAPHICS_MODES.MODERN].bananas;
