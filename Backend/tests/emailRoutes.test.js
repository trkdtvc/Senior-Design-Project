const request = require("supertest");
const app = require("../src/app");

describe("Email routes", () => {
  test("POST /api/email/test returns 400 when body is missing", async () => {
    const res = await request(app)
      .post("/api/email/test");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Recipient email is required");
  });

  test("POST /api/email/test returns 400 when to is missing", async () => {
    const res = await request(app)
      .post("/api/email/test")
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Recipient email is required");
  });

  test("POST /api/email/test returns 400 when to is empty", async () => {
    const res = await request(app)
      .post("/api/email/test")
      .send({
        to: ""
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Recipient email is required");
  });
});