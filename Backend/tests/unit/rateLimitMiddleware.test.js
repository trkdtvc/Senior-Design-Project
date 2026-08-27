const makeRes = () => {
  const res = {};
  res.set = jest.fn(() => res);
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("rate limiting middleware", () => {
  test("blocks the 11th login attempt from the same IP and returns Retry-After", () => {
    jest.resetModules();
    const { loginRateLimiter } = require("../../src/middleware/rateLimitMiddleware");
    const req = { ip: "198.51.100.20" };

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const res = makeRes();
      const next = jest.fn();
      loginRateLimiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    }

    const blockedRes = makeRes();
    const blockedNext = jest.fn();
    loginRateLimiter(req, blockedRes, blockedNext);

    expect(blockedNext).not.toHaveBeenCalled();
    expect(blockedRes.status).toHaveBeenCalledWith(429);
    expect(blockedRes.set).toHaveBeenCalledWith(
      "Retry-After",
      expect.any(String)
    );
    expect(blockedRes.json).toHaveBeenCalledWith({
      message: "Too many login attempts. Please try again in 15 minutes."
    });
  });

  test("AI limits are keyed per authenticated user", () => {
    jest.resetModules();
    const { aiRateLimiter } = require("../../src/middleware/rateLimitMiddleware");

    for (let attempt = 1; attempt <= 30; attempt += 1) {
      const next = jest.fn();
      aiRateLimiter(
        { ip: "198.51.100.20", user: { user_id: 1 } },
        makeRes(),
        next
      );
      expect(next).toHaveBeenCalled();
    }

    const userOneRes = makeRes();
    aiRateLimiter(
      { ip: "198.51.100.20", user: { user_id: 1 } },
      userOneRes,
      jest.fn()
    );
    expect(userOneRes.status).toHaveBeenCalledWith(429);

    const userTwoNext = jest.fn();
    aiRateLimiter(
      { ip: "198.51.100.20", user: { user_id: 2 } },
      makeRes(),
      userTwoNext
    );
    expect(userTwoNext).toHaveBeenCalledTimes(1);
  });
});
