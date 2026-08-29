jest.mock("../../src/config/db", () => {
  const connectDB = jest.fn();

  connectDB.pool = {
    query: jest.fn()
  };
  connectDB.withTransaction = jest.fn();
  connectDB.closeDB = jest.fn();

  return connectDB;
});

const request = require("supertest");
const app = require("../../src/app");
const { pool } = require("../../src/config/db");

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe("deployment health endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockResolvedValue([[{ ok: 1 }]]);
  });

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  test("liveness endpoint is public and does not cache its response", async () => {
    const response = await request(app).get("/api/health/live");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  test("readiness endpoint verifies the database before reporting ready", async () => {
    const response = await request(app).get("/api/health/ready");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ status: "ready" });
    expect(pool.query).toHaveBeenCalledWith("SELECT 1");
  });

  test("readiness endpoint returns 503 without exposing internal details", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    pool.query.mockRejectedValue(new Error("database host 10.0.0.12 unavailable"));

    const response = await request(app).get("/api/health/ready");

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({ status: "unavailable" });
    expect(JSON.stringify(response.body)).not.toContain("10.0.0.12");
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  test("production responses include HSTS", async () => {
    process.env.NODE_ENV = "production";

    const response = await request(app).get("/api/health/live");

    expect(response.headers["strict-transport-security"]).toBe("max-age=31536000");
  });
});
