const request = require("supertest");
const app = require("../src/app");

describe("AI routes", () => {
  test("POST /api/ai/channels/:channelId/ask returns 401 without token", async () => {
    const res = await request(app)
      .post("/api/ai/channels/1/ask")
      .send({ prompt: "Summarize this channel" });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBeTruthy();
  });

  test("POST /api/ai/channels/:channelId/intelligence returns 401 without token", async () => {
    const res = await request(app)
      .post("/api/ai/channels/1/intelligence")
      .send({});

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBeTruthy();
  });

  test("POST /api/ai/direct/:conversationId/ask returns 401 without token", async () => {
    const res = await request(app)
      .post("/api/ai/direct/1/ask")
      .send({ prompt: "What did we decide?" });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBeTruthy();
  });
});
