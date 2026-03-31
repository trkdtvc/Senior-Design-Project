const request = require("supertest");
const app = require("../src/app");

describe("Auth validation routes", () => {
  test("POST /api/auth/register returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBeTruthy();
  });

  test("POST /api/auth/register returns 400 when passwords do not match", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        username: "testuser123",
        email: "testuser123@example.com",
        password: "Password123",
        confirmPassword: "DifferentPassword123"
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBeTruthy();
  });

  test("POST /api/auth/login returns 400 when login and password are missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBeTruthy();
  });

  test("POST /api/auth/login returns 400 when password is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        login: "someone@example.com"
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBeTruthy();
  });
});