/**
 * Rate-limit placeholder. In-memory only; not suitable for multi-instance production.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, rpm: number): { ok: boolean; remaining: number } {
  const now = Date.now();
  const windowMs = 60_000;
  const current = buckets.get(key);

  if (!current || now > current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: rpm - 1 };
  }

  if (current.count >= rpm) {
    return { ok: false, remaining: 0 };
  }

  current.count += 1;
  return { ok: true, remaining: rpm - current.count };
}
