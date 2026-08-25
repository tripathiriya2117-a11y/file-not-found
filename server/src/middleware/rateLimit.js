const buckets = new Map();

export function rateLimit({ windowMs, max, name }) {
  return (req, res, next) => {
    const key = `${name}:${req.user?.id || req.ip}`;
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || now - current.startedAt >= windowMs) {
      buckets.set(key, { startedAt: now, count: 1 });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      const retryAfter = Math.ceil((windowMs - (now - current.startedAt)) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'RateLimitExceeded',
        message: 'Too many requests. Please try again shortly.',
      });
    }

    return next();
  };
}
