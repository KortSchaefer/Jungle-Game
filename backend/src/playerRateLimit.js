import { config } from "./config.js";

const bucketMap = new Map();

function getBucketKey(playerId, now = Date.now()) {
  const minuteBucket = Math.floor(now / 60_000);
  return `${playerId}:${minuteBucket}`;
}

export function checkPlayerSubmitRateLimit(playerId) {
  const key = getBucketKey(playerId);
  const current = bucketMap.get(key) || 0;
  if (current >= config.submitRateLimitPerPlayerPerMinute) {
    return false;
  }
  bucketMap.set(key, current + 1);
  return true;
}

export function prunePlayerRateLimitBuckets(now = Date.now()) {
  const minBucketToKeep = Math.floor(now / 60_000) - 2;
  for (const key of bucketMap.keys()) {
    const bucket = Number(key.split(":").at(-1));
    if (!Number.isFinite(bucket) || bucket < minBucketToKeep) {
      bucketMap.delete(key);
    }
  }
}
