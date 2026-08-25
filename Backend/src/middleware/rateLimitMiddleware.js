const createRateLimiter = ({ windowMs, max, message, keyGenerator }) => {
  const requests = new Map();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();

    for (const [key, entry] of requests.entries()) {
      if (entry.resetAt <= now) {
        requests.delete(key);
      }
    }
  }, windowMs);

  cleanupTimer.unref?.();

  return (req, res, next) => {
    const key = keyGenerator ? keyGenerator(req) : req.ip;
    const now = Date.now();
    let entry = requests.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = {
        count: 0,
        resetAt: now + windowMs
      };
      requests.set(key, entry);
    }

    if (entry.count >= max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((entry.resetAt - now) / 1000)
      );

      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ message });
    }

    entry.count += 1;
    next();
  };
};

const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please try again in 15 minutes."
});

const registrationRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many registration attempts. Please try again later."
});

const emailActionRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many email requests. Please try again later."
});

const passwordResetRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many password reset attempts. Please try again in 15 minutes."
});

const aiRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: "Too many AI requests. Please try again in a few minutes.",
  keyGenerator: (req) => String(req.user?.user_id || req.user?.id || req.ip)
});

module.exports = {
  loginRateLimiter,
  registrationRateLimiter,
  emailActionRateLimiter,
  passwordResetRateLimiter,
  aiRateLimiter
};
