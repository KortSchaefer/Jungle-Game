import { bananaTextures } from "./textureAssets.js";

function toPercent(value) {
  return `${Math.max(0, Math.min(100, Number(value) || 0)).toFixed(3)}%`;
}

export class TreeHarvestView {
  constructor(options = {}) {
    this.container = options.container;
    this.bananaLayer = options.bananaLayer;
    this.fxLayer = options.fxLayer;
    this.onBananaClick = typeof options.onBananaClick === "function" ? options.onBananaClick : () => null;
    this.bananaNodes = new Map();
  }

  dropAllBananas() {
    Array.from(this.bananaNodes.entries()).forEach(([id, node]) => {
      this.#dropNode(id, node);
    });
  }

  render(snapshot) {
    const bananas = Array.isArray(snapshot?.bananasOnTree) ? snapshot.bananasOnTree : [];
    const nextIds = new Set();

    bananas.forEach((banana) => {
      nextIds.add(banana.id);
      let node = this.bananaNodes.get(banana.id);
      if (!node) {
        node = this.#createBananaNode(banana);
        this.bananaLayer.appendChild(node);
        this.bananaNodes.set(banana.id, node);
      }
      if (node.dataset.dropping !== "1") {
        this.#syncBananaNode(node, banana);
      }
    });

    Array.from(this.bananaNodes.entries()).forEach(([id, node]) => {
      if (nextIds.has(id)) {
        return;
      }
      this.#dropNode(id, node);
    });
  }

  destroy() {
    this.bananaNodes.forEach((node) => node.remove());
    this.bananaNodes.clear();
    if (this.fxLayer) {
      this.fxLayer.innerHTML = "";
    }
  }

  #createBananaNode(banana) {
    const node = document.createElement("div");
    node.className = `tree-banana ${banana.type === "golden" ? "is-golden" : ""} ${banana.type === "diamond" ? "is-diamond" : ""}`.trim();
    node.dataset.bananaId = banana.id;
    node.setAttribute("role", "button");
    node.setAttribute("tabindex", "0");
    node.setAttribute("aria-label", banana.type === "diamond" ? "Diamond banana" : banana.type === "golden" ? "Golden banana" : "Banana");
    const textureIndex = Math.abs(this.#hashId(banana.id)) % bananaTextures.length;
    node.style.setProperty("--banana-texture", `url("${bananaTextures[textureIndex]}")`);
    node.title = banana.type === "diamond" ? "Diamond Banana" : banana.type === "golden" ? "Golden Banana" : "Banana";
    const handleHarvest = () => {
      const result = this.onBananaClick(banana.id, banana);
      if (!result?.harvestAmount) {
        return;
      }
      node.classList.add("is-popping");
      this.#spawnHarvestText(result.harvestAmount, banana, banana.type === "golden", banana.type === "diamond");
      window.setTimeout(() => {
        if (node.parentElement) {
          node.remove();
        }
      }, 140);
    };
    node.addEventListener("click", handleHarvest);
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleHarvest();
      }
    });
    return node;
  }

  #hashId(value) {
    let hash = 0;
    const str = String(value || "");
    for (let i = 0; i < str.length; i += 1) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  #syncBananaNode(node, banana) {
    node.style.left = toPercent(banana.x);
    node.style.top = toPercent(banana.y);
    const baseTransform = `translate(-50%, -50%) rotate(${Number(banana.rotation || 0).toFixed(2)}deg) scale(${Number(banana.size || 1).toFixed(3)})`;
    node.style.transform = baseTransform;
    node.dataset.baseTransform = baseTransform;
    if (!node.dataset.grown) {
      node.classList.add("is-growing");
      requestAnimationFrame(() => {
        node.classList.add("is-grown");
      });
      node.dataset.grown = "1";
    }
  }

  #dropNode(id, node) {
    if (!node || node.dataset.dropping === "1") {
      return;
    }

    node.dataset.dropping = "1";
    node.style.pointerEvents = "none";
    node.classList.remove("is-popping");
    node.classList.add("is-dropping");

    const baseTransform = node.dataset.baseTransform || node.style.transform || "translate(-50%, -50%)";
    node.dataset.baseTransform = baseTransform;

    // Let the browser paint once before we animate out.
    requestAnimationFrame(() => {
      node.style.opacity = "0";
      node.style.transform = `${baseTransform} translateY(170px) rotate(18deg)`;
    });

    window.setTimeout(() => {
      if (node.parentElement) {
        node.remove();
      }
      this.bananaNodes.delete(id);
    }, 360);
  }

  #spawnHarvestText(amount, banana, isGolden, isDiamond) {
    if (!this.fxLayer) {
      return;
    }
    const text = document.createElement("div");
    text.className = `tree-harvest-float ${isDiamond ? "is-diamond" : isGolden ? "is-golden" : ""}`.trim();
    text.style.left = toPercent(banana.x);
    text.style.top = toPercent(Math.max(0, banana.y - 4));
    text.textContent = `+${Number(amount).toFixed(2).replace(/\.00$/, "")}`;
    this.fxLayer.appendChild(text);
    window.setTimeout(() => {
      text.remove();
    }, 700);
  }
}
