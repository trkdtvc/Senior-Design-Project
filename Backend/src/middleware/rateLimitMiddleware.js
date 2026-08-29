const DEFAULT_MAX_KEYS = 10000;

const getAuthenticatedUserKey = (req) =>
  req.user?.user_id || req.user?.id
    ? `user:${req.user.user_id || req.user.id}`
    : `ip:${req.ip || "unknown"}`;

const createRateLimiter = ({
  windowMs,
  max,
  message,
  keyGenerator,
  skip,
  maxKeys = DEFAULT_MAX_KEYS
}) => {
  const requests = new Map();
  const cleanupIntervalMs = Math.min(windowMs, 60 * 1000);

  const removeExpiredEntries = (now = Date.now()) => {
    for (const [key, entry] of requests.entries()) {
      if (entry.resetAt <= now) {
        requests.delete(key);
      }
    }
  };

  const cleanupTimer = setInterval(removeExpiredEntries, cleanupIntervalMs);
  cleanupTimer.unref?.();

  return (req, res, next) => {
    if (skip?.(req)) {
      next();
      return;
    }

    const generatedKey = keyGenerator ? keyGenerator(req) : req.ip;
    const key = String(generatedKey || req.ip || "unknown");
    const now = Date.now();
    let entry = requests.get(key);

    if (!entry || entry.resetAt <= now) {
      if (!entry && requests.size >= maxKeys) {
        removeExpiredEntries(now);

        if (requests.size >= maxKeys) {
          const oldestKey = requests.keys().next().value;
          if (oldestKey !== undefined) {
            requests.delete(oldestKey);
          }
        }
      }

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
  keyGenerator: getAuthenticatedUserKey
});

const messageWriteRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "You are sending messages too quickly. Please wait a moment and try again.",
  keyGenerator: getAuthenticatedUserKey
});

const attachmentUploadRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: "Too many attachment uploads. Please wait before uploading more files.",
  keyGenerator: getAuthenticatedUserKey,
  skip: (req) => !req.file
});

const avatarUploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "Too many profile picture uploads. Please try again later.",
  keyGenerator: getAuthenticatedUserKey
});

module.exports = {
  createRateLimiter,
  loginRateLimiter,
  registrationRateLimiter,
  emailActionRateLimiter,
  passwordResetRateLimiter,
  aiRateLimiter,
  messageWriteRateLimiter,
  attachmentUploadRateLimiter,
  avatarUploadRateLimiter
};
