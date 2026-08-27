jest.mock("../../src/models/userModel", () => ({
  findUserById: jest.fn()
}));

const jwt = require("jsonwebtoken");
const { findUserById } = require("../../src/models/userModel");
const { protect } = require("../../src/middleware/authMiddleware");

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("auth middleware", () => {
  beforeEach(() => {
    findUserById.mockReset();
  });

  test("rejects a request without a bearer token", async () => {
    const req = { headers: {} };
    const res = makeRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Not authorized, no token" });
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects an invalid token", async () => {
    const req = { headers: { authorization: "Bearer definitely-not-valid" } };
    const res = makeRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Not authorized, invalid token" });
  });

  test("rejects a token whose account no longer exists", async () => {
    const token = jwt.sign({ user_id: 5 }, process.env.JWT_SECRET);
    findUserById.mockResolvedValue(null);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Not authorized, account not found"
    });
  });

  test("rejects an unverified account even with a valid token", async () => {
    const token = jwt.sign({ user_id: 5 }, process.env.JWT_SECRET);
    findUserById.mockResolvedValue({
      user_id: 5,
      username: "pending",
      email: "pending@example.com",
      is_verified: 0
    });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Please verify your email before logging in",
      email: "pending@example.com"
    });
  });

  test("hydrates req.user from the current verified database record", async () => {
    const token = jwt.sign(
      { user_id: 5, username: "oldname", email: "old@example.com" },
      process.env.JWT_SECRET
    );
    findUserById.mockResolvedValue({
      user_id: 5,
      username: "newname",
      email: "new@example.com",
      avatar_url: "/uploads/avatars/a.png",
      is_verified: 1
    });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({
      user_id: 5,
      username: "newname",
      email: "new@example.com",
      avatar_url: "/uploads/avatars/a.png",
      is_verified: 1
    });
  });
});
