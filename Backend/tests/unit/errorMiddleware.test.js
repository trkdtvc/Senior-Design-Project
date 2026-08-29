const { errorHandler, notFound } = require("../../src/middleware/errorMiddleware");

const makeRes = () => {
  const res = { statusCode: 200 };
  res.status = jest.fn((statusCode) => {
    res.statusCode = statusCode;
    return res;
  });
  res.json = jest.fn(() => res);
  return res;
};

describe("error middleware", () => {
  test("hides internal 500-error details in production while logging them server-side", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = makeRes();
    const error = new Error("database host 10.0.0.12 rejected the query");

    errorHandler(
      error,
      { method: "GET", originalUrl: "/api/example" },
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    process.env.NODE_ENV = previousNodeEnv;
  });

  test("does not write query-string secrets into server-error logs", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = makeRes();
    const rawToken = "a".repeat(64);

    errorHandler(
      new Error("database unavailable"),
      {
        method: "GET",
        originalUrl: `/api/auth/reset-password/validate?token=${rawToken}`
      },
      res,
      jest.fn()
    );

    const loggedText = consoleErrorSpy.mock.calls.flat().join(" ");
    expect(loggedText).toContain("GET /api/auth/reset-password/validate");
    expect(loggedText).not.toContain(rawToken);

    consoleErrorSpy.mockRestore();
    process.env.NODE_ENV = previousNodeEnv;
  });

  test("preserves intentional client-facing messages for 4xx errors", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const res = makeRes();
    const error = new Error("Invalid request value");
    error.statusCode = 400;

    errorHandler(error, { method: "POST", originalUrl: "/api/example" }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid request value" });

    process.env.NODE_ENV = previousNodeEnv;
  });

  test("not-found errors are explicitly classified as 404", () => {
    const req = { originalUrl: "/missing" };
    const next = jest.fn();

    notFound(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Not Found - /missing",
        statusCode: 404
      })
    );
  });
});
