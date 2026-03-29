const request = require("supertest");
const app = require("../src/app");

describe("Server Routes", () => {
  it("should block access to /api/servers without a token", async () => {
    const response = await request(app).get("/api/servers");

    expect(response.statusCode).toBe(401);
    expect(response.body).toBeDefined();
  });
});