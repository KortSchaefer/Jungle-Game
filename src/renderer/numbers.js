const SUFFIXES = [
  { value: 1e12, suffix: "T" },
  { value: 1e9, suffix: "B" },
  { value: 1e6, suffix: "M" },
  { value: 1e3, suffix: "K" },
];

const SCI_THRESHOLD = 1e15;
const STATE_DECIMALS = 6;
const SCI_TAG = "__sci__";

function toFiniteNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }

  return n;
}

export function stabilizeNumber(value, decimals = STATE_DECIMALS) {
  const n = toFiniteNumber(value);
  const factor = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * factor) / factor;
}

export function addStable(a, b, decimals = STATE_DECIMALS) {
  return stabilizeNumber(toFiniteNumber(a) + toFiniteNumber(b), decimals);
}

export function formatGameNumber(value, mode = "short") {
  const n = toFiniteNumber(value);
  const abs = Math.abs(n);

  if (mode === "scientific") {
    if (abs === 0) {
      return "0";
    }

    return n.toExponential(2).replace("+", "");
  }

  if (abs >= SCI_THRESHOLD) {
    return n.toExponential(2).replace("+", "");
  }

  if (abs >= 1000 && abs < 10000) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  for (const { value: threshold, suffix } of SUFFIXES) {
    if (abs >= threshold) {
      return `${(n / threshold).toFixed(2)}${suffix}`;
    }
  }

  if (abs >= 100) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  if (abs >= 1) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function serializeBigNumbers(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return 0;
    }

    if (Math.abs(value) >= SCI_THRESHOLD) {
      return { [SCI_TAG]: value.toExponential(15) };
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeBigNumbers(item));
  }

  if (value && typeof value === "object") {
    const output = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = serializeBigNumbers(nested);
    }
    return output;
  }

  return value;
}

export function deserializeBigNumbers(value) {
  if (Array.isArray(value)) {
    return value.map((item) => deserializeBigNumbers(item));
  }

  if (value && typeof value === "object") {
    if (SCI_TAG in value && typeof value[SCI_TAG] === "string") {
      return toFiniteNumber(value[SCI_TAG]);
    }

    const output = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = deserializeBigNumbers(nested);
    }
    return output;
  }

  return value;
}
