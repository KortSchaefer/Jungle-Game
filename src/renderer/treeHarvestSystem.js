const DEFAULT_TREE_STATE = Object.freeze({
  bananasOnTree: [],
  spawnAccumulator: 0,
  nextBananaId: 1,
  maxBananasOnTree: 12,
  spawnInterval: 1.5,
  clickHarvestYield: 1,
  goldenChance: 0.005,
  goldenMultiplier: 35,
  diamondChance: 0.0005,
  diamondMultiplier: 200,
  monkeyPickerInterval: 0,
  monkeyPickerAccumulator: 0,
  workerPickerAccumulator: 0,
  orchardPickerAccumulator: 0,
  shakeCooldownSeconds: 35,
  shakeCooldownRemaining: 0,
  shakeDisabled: false,
});

const REGION_WIDTH = 100;
const REGION_HEIGHT = 100;
const MIN_DIST = 8;
const MAX_SPAWNS_PER_UPDATE = 32;
const MAX_OFFLINE_SPAWNS_PER_UPDATE = 1000;
const SPAWN_X_MIN = REGION_WIDTH / 3;
const SPAWN_X_MAX = (REGION_WIDTH * 2) / 3;
const SPAWN_Y_MIN = 0;
const SPAWN_Y_MAX = (REGION_HEIGHT * 2) / 5;
const AUTO_PICK_MIN_AGE_MS = 450; // Let bananas visibly grow before workers/orchards/monkeys can pick them.
const WORKER_MAX_PICK_FRACTION_OF_SPAWN = 0.8; // Keeps canopy from staying empty when worker count is high.
const MAX_WORKER_PICKS_PER_UPDATE = 2; // Prevents workers from draining the whole canopy instantly on dt spikes.
const MAX_ORCHARD_PICKS_PER_UPDATE = 3;
const MAX_MONKEY_PICKS_PER_UPDATE = 2;
const MAX_PICKER_ACCUMULATOR = 12; // Safety: avoid enormous backlogs that cause bursty catching up.

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sanitizeNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeBanana(rawBanana) {
  if (!rawBanana || typeof rawBanana !== "object") {
    return null;
  }

  const x = clamp(sanitizeNumber(rawBanana.x, 50), 0, 100);
  const y = clamp(sanitizeNumber(rawBanana.y, 50), 0, 100);
  const size = clamp(sanitizeNumber(rawBanana.size, 1), 0.75, 1.35);
  const rotation = clamp(sanitizeNumber(rawBanana.rotation, 0), -36, 36);
  const spawnTime = sanitizeNumber(rawBanana.spawnTime, Date.now());
  const type = rawBanana.type === "diamond" ? "diamond" : rawBanana.type === "golden" ? "golden" : "standard";
  const id = String(rawBanana.id || "");
  if (!id) {
    return null;
  }

  return { id, x, y, size, rotation, spawnTime, type };
}

export function getDefaultTreeState() {
  return JSON.parse(JSON.stringify(DEFAULT_TREE_STATE));
}

export class TreeHarvestSystem {
  constructor(options = {}) {
    this.random = typeof options.random === "function" ? options.random : Math.random;
    this.now = typeof options.now === "function" ? options.now : () => Date.now();
    this.onHarvest = typeof options.onHarvest === "function" ? options.onHarvest : () => {};
    this.state = getDefaultTreeState();
    this._changed = true;
  }

  hasChanges() {
    return this._changed;
  }

  consumeChangedFlag() {
    this._changed = false;
  }

  deserialize(rawTreeState) {
    const merged = { ...getDefaultTreeState(), ...(rawTreeState || {}) };
    const bananas = Array.isArray(merged.bananasOnTree)
      ? merged.bananasOnTree.map((banana) => normalizeBanana(banana)).filter(Boolean)
      : [];
    this.state = {
      bananasOnTree: bananas.slice(0, Math.max(1, Math.floor(sanitizeNumber(merged.maxBananasOnTree, DEFAULT_TREE_STATE.maxBananasOnTree)))),
      spawnAccumulator: Math.max(0, sanitizeNumber(merged.spawnAccumulator, 0)),
      nextBananaId: Math.max(1, Math.floor(sanitizeNumber(merged.nextBananaId, 1))),
      maxBananasOnTree: clamp(Math.floor(sanitizeNumber(merged.maxBananasOnTree, DEFAULT_TREE_STATE.maxBananasOnTree)), 1, 40),
      spawnInterval: clamp(sanitizeNumber(merged.spawnInterval, DEFAULT_TREE_STATE.spawnInterval), 0.15, 12),
      clickHarvestYield: Math.max(1, sanitizeNumber(merged.clickHarvestYield, DEFAULT_TREE_STATE.clickHarvestYield)),
      goldenChance: clamp(sanitizeNumber(merged.goldenChance, DEFAULT_TREE_STATE.goldenChance), 0, 0.95),
      goldenMultiplier: Math.max(1, sanitizeNumber(merged.goldenMultiplier, DEFAULT_TREE_STATE.goldenMultiplier)),
      diamondChance: clamp(sanitizeNumber(merged.diamondChance, DEFAULT_TREE_STATE.diamondChance), 0, 0.2),
      diamondMultiplier: Math.max(1, sanitizeNumber(merged.diamondMultiplier, DEFAULT_TREE_STATE.diamondMultiplier)),
      monkeyPickerInterval: Math.max(0, sanitizeNumber(merged.monkeyPickerInterval, DEFAULT_TREE_STATE.monkeyPickerInterval)),
      monkeyPickerAccumulator: Math.max(0, sanitizeNumber(merged.monkeyPickerAccumulator, DEFAULT_TREE_STATE.monkeyPickerAccumulator)),
      workerPickerAccumulator: Math.max(0, sanitizeNumber(merged.workerPickerAccumulator, 0)),
      orchardPickerAccumulator: Math.max(0, sanitizeNumber(merged.orchardPickerAccumulator, 0)),
      shakeCooldownSeconds: clamp(sanitizeNumber(merged.shakeCooldownSeconds, DEFAULT_TREE_STATE.shakeCooldownSeconds), 3, 180),
      shakeCooldownRemaining: Math.max(0, sanitizeNumber(merged.shakeCooldownRemaining, 0)),
      shakeDisabled: Boolean(merged.shakeDisabled),
    };
    this._changed = true;
  }

  serialize() {
    return {
      bananasOnTree: this.state.bananasOnTree.map((banana) => ({ ...banana })),
      spawnAccumulator: this.state.spawnAccumulator,
      nextBananaId: this.state.nextBananaId,
      maxBananasOnTree: this.state.maxBananasOnTree,
      spawnInterval: this.state.spawnInterval,
      clickHarvestYield: this.state.clickHarvestYield,
      goldenChance: this.state.goldenChance,
      goldenMultiplier: this.state.goldenMultiplier,
      diamondChance: this.state.diamondChance,
      diamondMultiplier: this.state.diamondMultiplier,
      monkeyPickerInterval: this.state.monkeyPickerInterval,
      monkeyPickerAccumulator: this.state.monkeyPickerAccumulator,
      workerPickerAccumulator: this.state.workerPickerAccumulator,
      orchardPickerAccumulator: this.state.orchardPickerAccumulator,
      shakeCooldownSeconds: this.state.shakeCooldownSeconds,
      shakeCooldownRemaining: this.state.shakeCooldownRemaining,
      shakeDisabled: this.state.shakeDisabled,
    };
  }

  applyModifiers(modifiers = {}) {
    const nextMax = clamp(Math.floor(sanitizeNumber(modifiers.maxBananasOnTree, this.state.maxBananasOnTree)), 1, 40);
    this.state.maxBananasOnTree = nextMax;
    this.state.spawnInterval = clamp(sanitizeNumber(modifiers.spawnInterval, this.state.spawnInterval), 0.15, 12);
    this.state.clickHarvestYield = Math.max(1, sanitizeNumber(modifiers.clickHarvestYield, this.state.clickHarvestYield));
    this.state.goldenChance = clamp(sanitizeNumber(modifiers.goldenChance, this.state.goldenChance), 0, 0.95);
    this.state.goldenMultiplier = Math.max(1, sanitizeNumber(modifiers.goldenMultiplier, this.state.goldenMultiplier));
    this.state.diamondChance = clamp(sanitizeNumber(modifiers.diamondChance, this.state.diamondChance), 0, 0.2);
    this.state.diamondMultiplier = Math.max(1, sanitizeNumber(modifiers.diamondMultiplier, this.state.diamondMultiplier));
    this.state.monkeyPickerInterval = Math.max(0, sanitizeNumber(modifiers.monkeyPickerInterval, this.state.monkeyPickerInterval));
    this.state.shakeCooldownSeconds = clamp(sanitizeNumber(modifiers.shakeCooldownSeconds, this.state.shakeCooldownSeconds), 3, 180);
    this.state.shakeDisabled = Boolean(modifiers.shakeDisabled);
    if (this.state.bananasOnTree.length > this.state.maxBananasOnTree) {
      this.state.bananasOnTree = this.state.bananasOnTree.slice(0, this.state.maxBananasOnTree);
    }
    this._changed = true;
  }

  getSnapshot() {
    return {
      bananasOnTree: this.state.bananasOnTree.map((banana) => ({ ...banana })),
      spawnAccumulator: this.state.spawnAccumulator,
      maxBananasOnTree: this.state.maxBananasOnTree,
      spawnInterval: this.state.spawnInterval,
      clickHarvestYield: this.state.clickHarvestYield,
      goldenChance: this.state.goldenChance,
      goldenMultiplier: this.state.goldenMultiplier,
      diamondChance: this.state.diamondChance,
      diamondMultiplier: this.state.diamondMultiplier,
      monkeyPickerInterval: this.state.monkeyPickerInterval,
      workerPickerAccumulator: this.state.workerPickerAccumulator,
      orchardPickerAccumulator: this.state.orchardPickerAccumulator,
      shakeCooldownSeconds: this.state.shakeCooldownSeconds,
      shakeCooldownRemaining: this.state.shakeCooldownRemaining,
      shakeDisabled: this.state.shakeDisabled,
    };
  }

  update(dtSeconds, options = {}) {
    const dt = Number(dtSeconds);
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }

    const simulateOffline = Boolean(options.simulateOffline);
    if (this.state.shakeCooldownRemaining > 0) {
      this.state.shakeCooldownRemaining = Math.max(0, this.state.shakeCooldownRemaining - dt);
    }

    this.state.spawnAccumulator += dt;
    const maxSpawnsThisUpdate = simulateOffline ? MAX_OFFLINE_SPAWNS_PER_UPDATE : MAX_SPAWNS_PER_UPDATE;
    let loops = 0;
    while (
      this.state.spawnAccumulator >= this.state.spawnInterval &&
      this.state.bananasOnTree.length < this.state.maxBananasOnTree &&
      loops < maxSpawnsThisUpdate
    ) {
      this.state.spawnAccumulator -= this.state.spawnInterval;
      this.spawnBanana();
      loops += 1;
    }

    if (options.enablePickers !== false) {
      const maxWorkerPicksPerUpdate = Math.max(1, Math.floor(Number(options.maxWorkerPicksPerUpdate) || MAX_WORKER_PICKS_PER_UPDATE));
      const maxOrchardPicksPerUpdate = Math.max(1, Math.floor(Number(options.maxOrchardPicksPerUpdate) || MAX_ORCHARD_PICKS_PER_UPDATE));
      const maxMonkeyPicksPerUpdate = Math.max(1, Math.floor(Number(options.maxMonkeyPicksPerUpdate) || MAX_MONKEY_PICKS_PER_UPDATE));
      const spawnRatePerSecond = 1 / Math.max(0.001, Number(this.state.spawnInterval) || DEFAULT_TREE_STATE.spawnInterval);
      const workerPickRatePerSecondRaw = Math.max(0, Number(options.workerPickRatePerSecond) || 0);
      const workerPickRatePerSecond = Math.min(workerPickRatePerSecondRaw, spawnRatePerSecond * WORKER_MAX_PICK_FRACTION_OF_SPAWN);
      if (workerPickRatePerSecond > 0) {
        this.state.workerPickerAccumulator += dt * workerPickRatePerSecond;
        if (!simulateOffline) {
          this.state.workerPickerAccumulator = Math.min(this.state.workerPickerAccumulator, MAX_PICKER_ACCUMULATOR);
        }
        let picksThisUpdate = 0;
        while (this.state.workerPickerAccumulator >= 1 && (simulateOffline || picksThisUpdate < maxWorkerPicksPerUpdate)) {
          this.state.workerPickerAccumulator -= 1;
          picksThisUpdate += 1;
          if (!this.#autoPickOne("worker_picker", { ignoreMinAge: simulateOffline })) {
            break;
          }
        }
      }

      const orchardPickRatePerSecond = Math.max(0, Number(options.orchardPickRatePerSecond) || 0);
      if (orchardPickRatePerSecond > 0) {
        this.state.orchardPickerAccumulator += dt * orchardPickRatePerSecond;
        if (!simulateOffline) {
          this.state.orchardPickerAccumulator = Math.min(this.state.orchardPickerAccumulator, MAX_PICKER_ACCUMULATOR);
        }
        let picksThisUpdate = 0;
        while (this.state.orchardPickerAccumulator >= 1 && (simulateOffline || picksThisUpdate < maxOrchardPicksPerUpdate)) {
          this.state.orchardPickerAccumulator -= 1;
          picksThisUpdate += 1;
          if (!this.#autoPickOne("orchard_picker", { ignoreMinAge: simulateOffline })) {
            break;
          }
        }
      }

      const monkeyPickRatePerSecond = this.state.monkeyPickerInterval > 0 ? 1 / this.state.monkeyPickerInterval : 0;
      if (monkeyPickRatePerSecond > 0) {
        this.state.monkeyPickerAccumulator += dt * monkeyPickRatePerSecond;
        if (!simulateOffline) {
          this.state.monkeyPickerAccumulator = Math.min(this.state.monkeyPickerAccumulator, MAX_PICKER_ACCUMULATOR);
        }
        let picksThisUpdate = 0;
        while (this.state.monkeyPickerAccumulator >= 1 && (simulateOffline || picksThisUpdate < maxMonkeyPicksPerUpdate)) {
          this.state.monkeyPickerAccumulator -= 1;
          picksThisUpdate += 1;
          if (!this.#autoPickOne("monkey_picker", { ignoreMinAge: simulateOffline })) {
            break;
          }
        }
      }
    }
  }

  spawnBanana() {
    if (this.state.bananasOnTree.length >= this.state.maxBananasOnTree) {
      return null;
    }

    const position = this.#generatePosition();
    if (!position) {
      return null;
    }

    const roll = this.random();
    let bananaType = "standard";
    if (roll < this.state.diamondChance) {
      bananaType = "diamond";
    } else if (roll < this.state.diamondChance + this.state.goldenChance) {
      bananaType = "golden";
    }
    const banana = {
      id: `tree-banana-${this.state.nextBananaId}`,
      x: position.x,
      y: position.y,
      size: 1.04 + this.random() * 0.46,
      rotation: -28 + this.random() * 56,
      spawnTime: this.now(),
      type: bananaType,
    };
    this.state.nextBananaId += 1;
    this.state.bananasOnTree.push(banana);
    this._changed = true;
    return banana;
  }

  clickBanana(bananaId, context = {}) {
    const index = this.state.bananasOnTree.findIndex((banana) => banana.id === bananaId);
    if (index < 0) {
      return null;
    }

    const [banana] = this.state.bananasOnTree.splice(index, 1);
    const multiplier = banana.type === "diamond" ? this.state.diamondMultiplier : banana.type === "golden" ? this.state.goldenMultiplier : 1;
    const harvestAmount = this.state.clickHarvestYield * multiplier;
    this.onHarvest(harvestAmount, banana, context);
    this._changed = true;
    return { banana, harvestAmount };
  }

  shakeTree() {
    if (this.state.shakeDisabled) {
      return { success: false, reason: "disabled", cooldownRemaining: 0 };
    }
    if (this.state.shakeCooldownRemaining > 0) {
      return { success: false, reason: "cooldown", cooldownRemaining: this.state.shakeCooldownRemaining };
    }

    let totalHarvest = 0;
    let harvested = 0;
    const bananas = [...this.state.bananasOnTree];
    bananas.forEach((banana) => {
      const result = this.clickBanana(banana.id, { source: "shake_tree" });
      if (!result) {
        return;
      }
      totalHarvest += result.harvestAmount;
      harvested += 1;
    });

    this.state.shakeCooldownRemaining = this.state.shakeCooldownSeconds;
    this._changed = true;
    return { success: true, harvested, totalHarvest };
  }

  #autoPickOne(source, options = {}) {
    if (this.state.bananasOnTree.length <= 0) {
      return false;
    }

    const nowMs = this.now();
    const ignoreMinAge = Boolean(options.ignoreMinAge);
    const minSpawnTime = ignoreMinAge ? nowMs : nowMs - AUTO_PICK_MIN_AGE_MS;
    const targetBanana = this.state.bananasOnTree.find((banana) => (Number(banana.spawnTime) || 0) <= minSpawnTime);
    if (!targetBanana) {
      return false;
    }

    const result = this.clickBanana(targetBanana.id, { source });
    return Boolean(result);
  }

  #generatePosition() {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const x = SPAWN_X_MIN + this.random() * (SPAWN_X_MAX - SPAWN_X_MIN);
      const y = SPAWN_Y_MIN + this.random() * (SPAWN_Y_MAX - SPAWN_Y_MIN);
      const overlaps = this.state.bananasOnTree.some((banana) => {
        const dx = banana.x - x;
        const dy = banana.y - y;
        return Math.sqrt(dx * dx + dy * dy) < MIN_DIST;
      });
      if (!overlaps) {
        return { x, y };
      }
    }
    return null;
  }
}
