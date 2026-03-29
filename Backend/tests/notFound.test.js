const request = require("supertest");
const app = require("../src/app");

describe("Not Found Middleware", () => {
  it("should return 404 for an unknown route", async () => {
    const response = await request(app).get("/api/this-route-does-not-exist");

    expect(response.statusCode).toBe(404);
    expect(response.body).toBeDefined();
  });
});