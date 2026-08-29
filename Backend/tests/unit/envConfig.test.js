const {
  getAllowedOrigins,
  isSwaggerEnabled,
  validateEnvironment
} = require("../../src/config/env");

const ORIGINAL_ENV = { ...process.env };

const setValidEnvironment = (overrides = {}) => {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: "development",
    PORT: "5000",
    FRONTEND_URL: "http://localhost:5173",
    CORS_ORIGINS: "http://localhost:5173,http://127.0.0.1:5173",
    API_PUBLIC_URL: "http://localhost:5000",
    SWAGGER_ENABLED: "true",
    TRUST_PROXY_HOPS: "0",
    UPLOAD_DIR: "uploads",
    DB_HOST: "127.0.0.1",
    DB_PORT: "3306",
    DB_USER: "app_user",
    DB_PASSWORD: "app_password",
    DB_NAME: "chatster_test",
    JWT_SECRET: "12345678901234567890123456789012",
    MAIL_HOST: "smtp.example.com",
    MAIL_PORT: "587",
    MAIL_SECURE: "false",
    MAIL_USER: "sender@example.com",
    MAIL_PASS: "mail_password",
    MAIL_FROM: "Chatster <sender@example.com>",
    AI_PROVIDER: "local",
    ...overrides
  };
};

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("environment configuration", () => {
  test("accepts a valid application environment", () => {
    setValidEnvironment();

    expect(validateEnvironment()).toBe(true);
  });

  test("reports missing required application variables together", () => {
    setValidEnvironment({
      DB_HOST: "",
      JWT_SECRET: "",
      MAIL_HOST: ""
    });

    expect(() => validateEnvironment()).toThrow(/DB_HOST is required/);
    expect(() => validateEnvironment()).toThrow(/JWT_SECRET is required/);
    expect(() => validateEnvironment()).toThrow(/MAIL_HOST is required/);
  });

  test("requires a public API URL in production", () => {
    setValidEnvironment({ NODE_ENV: "production", API_PUBLIC_URL: "" });

    expect(() => validateEnvironment()).toThrow(/API_PUBLIC_URL is required/);
  });

  test("requires the matching provider key for hosted AI providers", () => {
    setValidEnvironment({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "" });

    expect(() => validateEnvironment()).toThrow(/GEMINI_API_KEY is required/);
  });

  test("rejects wildcard CORS origins with credentialed requests", () => {
    setValidEnvironment({ CORS_ORIGINS: "*" });

    expect(() => validateEnvironment()).toThrow(/must not use wildcard/);
  });

  test("database validation profile only requires database configuration", () => {
    setValidEnvironment({ JWT_SECRET: "", MAIL_HOST: "", FRONTEND_URL: "" });

    expect(validateEnvironment({ profile: "database" })).toBe(true);
  });

  test("parses configured CORS origins consistently", () => {
    setValidEnvironment({
      CORS_ORIGINS: " https://app.example.com, https://admin.example.com "
    });

    expect(getAllowedOrigins()).toEqual([
      "https://app.example.com",
      "https://admin.example.com"
    ]);
  });

  test("Swagger defaults off in production and can be enabled explicitly", () => {
    setValidEnvironment({ NODE_ENV: "production", SWAGGER_ENABLED: "" });
    expect(isSwaggerEnabled()).toBe(false);

    process.env.SWAGGER_ENABLED = "true";
    expect(isSwaggerEnabled()).toBe(true);
  });
});
