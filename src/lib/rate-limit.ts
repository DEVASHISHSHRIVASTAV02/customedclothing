type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redisPrefix = process.env.RATE_LIMIT_REDIS_PREFIX?.trim() || "cc_rl";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

function checkRateLimitInMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  buckets.set(key, current);

  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}

function unwrapRedisResult(item: unknown) {
  if (!item || typeof item !== "object") {
    return item;
  }

  if ("result" in item) {
    return (item as { result?: unknown }).result;
  }

  return item;
}

async function checkRateLimitInRedis(key: string, limit: number, windowMs: number): Promise<RateLimitResult | null> {
  if (!redisUrl || !redisToken) {
    return null;
  }

  const now = Date.now();
  const windowIndex = Math.floor(now / windowMs);
  const resetAt = (windowIndex + 1) * windowMs;
  const redisKey = `${redisPrefix}:${key}:${windowIndex}`;
  const ttlMs = Math.max(1_000, resetAt - now + 1_000);

  const response = await fetch(`${redisUrl.replace(/\/+$/, "")}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["PEXPIRE", redisKey, String(ttlMs)],
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Redis rate limit request failed with status ${response.status}.`);
  }

  const payload = await response.json() as unknown;
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("Unexpected Redis rate limit response.");
  }

  const countValue = unwrapRedisResult(payload[0]);
  const count = Number(countValue);
  if (!Number.isFinite(count)) {
    throw new Error("Invalid Redis counter response.");
  }

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}

export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  try {
    const redisResult = await checkRateLimitInRedis(key, limit, windowMs);
    if (redisResult) {
      return redisResult;
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      const detail = error instanceof Error ? error.message : "Unknown Redis rate limit failure.";
      console.warn(`[rate-limit] Falling back to memory store: ${detail}`);
    }
  }

  return checkRateLimitInMemory(key, limit, windowMs);
}

