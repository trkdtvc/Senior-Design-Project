const request = require("supertest");
const app = require("../src/app");

describe("Auth Routes", () => {
  it("should block access to /api/auth/me without a token", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.statusCode).toBe(401);
    expect(response.body).toBeDefined();
  });
});