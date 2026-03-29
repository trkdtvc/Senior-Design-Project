const request = require("supertest");
const app = require("../src/app");

describe("Test Routes", () => {
  it("should return the test message", async () => {
    const response = await request(app).get("/api/test");

    expect(response.statusCode).toBe(200);
    expect(response.body).toBeDefined();
  });
});