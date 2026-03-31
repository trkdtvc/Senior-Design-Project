const request = require("supertest");
const app = require("../src/app");

describe("Protected write routes without token", () => {
  test("POST /api/servers returns 401 without token", async () => {
    const res = await request(app)
      .post("/api/servers")
      .send({
        server_name: "Unauthorized Test Server"
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBeTruthy();
  });

  test("POST /api/channels returns 401 without token", async () => {
    const res = await request(app)
      .post("/api/channels")
      .send({
        server_id: 1,
        channel_name: "general"
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBeTruthy();
  });

  test("POST /api/roles returns 401 without token", async () => {
    const res = await request(app)
      .post("/api/roles")
      .send({
        server_id: 1,
        role_name: "Moderator"
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBeTruthy();
  });

  test("POST /api/member-roles returns 401 without token", async () => {
    const res = await request(app)
      .post("/api/member-roles")
      .send({
        member_id: 1,
        role_id: 1
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBeTruthy();
  });

  test("POST /api/messages returns 401 without token", async () => {
    const res = await request(app)
      .post("/api/messages")
      .send({
        channel_id: 1,
        content: "Unauthorized message"
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBeTruthy();
  });
});