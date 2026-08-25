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

  test("PATCH /api/servers/:serverId returns 401 without token", async () => {
    const res = await request(app)
      .patch("/api/servers/1")
      .send({ server_name: "Renamed server", description: "Updated" });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBeTruthy();
  });

  test("PATCH /api/channels/:channelId returns 401 without token", async () => {
    const res = await request(app)
      .patch("/api/channels/1")
      .send({ channel_name: "renamed-channel" });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBeTruthy();
  });

  test("PATCH /api/auth/password returns 401 without token", async () => {
    const res = await request(app)
      .patch("/api/auth/password")
      .send({
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!"
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBeTruthy();
  });

  test("DELETE /api/auth/account returns 401 without token", async () => {
    const res = await request(app)
      .delete("/api/auth/account")
      .send({ password: "Password123!" });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBeTruthy();
  });

  test("POST /api/server-members/:serverId/members/:memberId/ban returns 401 without token", async () => {
    const res = await request(app)
      .post("/api/server-members/1/members/2/ban")
      .send({ reason: "Test" });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBeTruthy();
  });

  test("DELETE /api/server-members/:serverId/bans/:userId returns 401 without token", async () => {
    const res = await request(app).delete("/api/server-members/1/bans/2");

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBeTruthy();
  });
});