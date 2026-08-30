const VALID_NODE_ENVS = new Set(["development", "test", "production"]);
const VALID_AI_PROVIDERS = new Set(["local", "gemini", "openai"]);
const VALID_EMAIL_PROVIDERS = new Set(["smtp", "resend"]);

const isBlank = (value) => value === undefined || value === null || String(value).trim() === "";

const requireValue = (name, errors) => {
  const value = process.env[name];

  if (isBlank(value)) {
    errors.push(`${name} is required.`);
    return "";
  }

  return String(value).trim();
};

const validateInteger = (name, errors, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  if (isBlank(process.env[name])) {
    return null;
  }

  const value = Number(process.env[name]);

  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${name} must be an integer between ${min} and ${max}.`);
    return null;
  }

  return value;
};

const validateBoolean = (name, errors) => {
  if (isBlank(process.env[name])) {
    return null;
  }

  const normalized = String(process.env[name]).trim().toLowerCase();

  if (normalized !== "true" && normalized !== "false") {
    errors.push(`${name} must be either true or false.`);
    return null;
  }

  return normalized === "true";
};

const validateHttpUrl = (name, value, errors) => {
  if (isBlank(value)) {
    return;
  }

  try {
    const parsed = new URL(String(value).trim());

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      errors.push(`${name} must use http:// or https://.`);
    }
  } catch (error) {
    errors.push(`${name} must be a valid absolute URL.`);
  }
};

const validateOriginList = (name, value, errors) => {
  if (isBlank(value)) {
    return;
  }

  const origins = String(value)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    errors.push(`${name} must contain at least one origin.`);
    return;
  }

  origins.forEach((origin) => {
    if (origin === "*") {
      errors.push(`${name} must not use wildcard (*) origins when credentials are enabled.`);
      return;
    }

    validateHttpUrl(name, origin, errors);
  });
};

const validateDatabaseEnvironment = (errors) => {
  requireValue("DB_HOST", errors);
  requireValue("DB_USER", errors);
  requireValue("DB_PASSWORD", errors);
  requireValue("DB_NAME", errors);
  requireValue("DB_PORT", errors);
  validateInteger("DB_PORT", errors, { min: 1, max: 65535 });
};

const validateApplicationEnvironment = (errors) => {
  validateDatabaseEnvironment(errors);

  const nodeEnv = String(process.env.NODE_ENV || "development").trim().toLowerCase();
  process.env.NODE_ENV = nodeEnv;

  if (!VALID_NODE_ENVS.has(nodeEnv)) {
    errors.push(`NODE_ENV must be one of: ${[...VALID_NODE_ENVS].join(", ")}.`);
  }

  validateInteger("PORT", errors, { min: 1, max: 65535 });
  validateInteger("TRUST_PROXY_HOPS", errors, { min: 0, max: 10 });
  validateBoolean("SWAGGER_ENABLED", errors);

  const frontendUrl = requireValue("FRONTEND_URL", errors);
  validateHttpUrl("FRONTEND_URL", frontendUrl, errors);
  validateOriginList("CORS_ORIGINS", process.env.CORS_ORIGINS || frontendUrl, errors);

  if (nodeEnv === "production") {
    const apiPublicUrl = requireValue("API_PUBLIC_URL", errors);
    validateHttpUrl("API_PUBLIC_URL", apiPublicUrl, errors);
    requireValue("TRUST_PROXY_HOPS", errors);
    requireValue("UPLOAD_DIR", errors);
  } else {
    validateHttpUrl("API_PUBLIC_URL", process.env.API_PUBLIC_URL, errors);
  }

  const jwtSecret = requireValue("JWT_SECRET", errors);
  if (jwtSecret && jwtSecret.length < 32) {
    errors.push("JWT_SECRET must be at least 32 characters long.");
  }

  const emailProvider = String(process.env.EMAIL_PROVIDER || "smtp").trim().toLowerCase();
  process.env.EMAIL_PROVIDER = emailProvider;

  if (!VALID_EMAIL_PROVIDERS.has(emailProvider)) {
    errors.push(`EMAIL_PROVIDER must be one of: ${[...VALID_EMAIL_PROVIDERS].join(", ")}.`);
  }

  requireValue("MAIL_FROM", errors);

  if (emailProvider === "smtp") {
    requireValue("MAIL_HOST", errors);
    requireValue("MAIL_USER", errors);
    requireValue("MAIL_PASS", errors);
    requireValue("MAIL_PORT", errors);
    requireValue("MAIL_SECURE", errors);
    validateInteger("MAIL_PORT", errors, { min: 1, max: 65535 });
    validateBoolean("MAIL_SECURE", errors);
    validateInteger("MAIL_CONNECTION_TIMEOUT_MS", errors, { min: 1, max: 300000 });
    validateInteger("MAIL_GREETING_TIMEOUT_MS", errors, { min: 1, max: 300000 });
    validateInteger("MAIL_SOCKET_TIMEOUT_MS", errors, { min: 1, max: 300000 });
  }

  if (emailProvider === "resend") {
    requireValue("RESEND_API_KEY", errors);
    validateHttpUrl("RESEND_API_URL", process.env.RESEND_API_URL, errors);
    validateInteger("EMAIL_API_TIMEOUT_MS", errors, { min: 1000, max: 300000 });
  }

  const aiProvider = String(process.env.AI_PROVIDER || "local").trim().toLowerCase();
  process.env.AI_PROVIDER = aiProvider;

  if (!VALID_AI_PROVIDERS.has(aiProvider)) {
    errors.push(`AI_PROVIDER must be one of: ${[...VALID_AI_PROVIDERS].join(", ")}.`);
  }

  if (aiProvider === "gemini") {
    requireValue("GEMINI_API_KEY", errors);
  }

  if (aiProvider === "openai") {
    requireValue("OPENAI_API_KEY", errors);
  }

  validateHttpUrl("GEMINI_API_URL", process.env.GEMINI_API_URL, errors);
  validateHttpUrl("OPENAI_API_URL", process.env.OPENAI_API_URL, errors);
  validateInteger("AI_PROVIDER_TIMEOUT_MS", errors, { min: 1000, max: 300000 });
};

const validateEnvironment = ({ profile = "application" } = {}) => {
  const errors = [];

  if (profile === "database") {
    validateDatabaseEnvironment(errors);
  } else if (profile === "application") {
    validateApplicationEnvironment(errors);
  } else {
    throw new Error(`Unknown environment validation profile: ${profile}`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Environment configuration is invalid:\n- ${errors.join("\n- ")}`
    );
  }

  return true;
};

const getAllowedOrigins = () => {
  const configuredOrigins = process.env.CORS_ORIGINS || process.env.FRONTEND_URL;

  if (!configuredOrigins) {
    return ["http://localhost:5173", "http://127.0.0.1:5173"];
  }

  return configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const isSwaggerEnabled = () => {
  if (!isBlank(process.env.SWAGGER_ENABLED)) {
    return String(process.env.SWAGGER_ENABLED).trim().toLowerCase() === "true";
  }

  return process.env.NODE_ENV !== "production";
};

module.exports = {
  getAllowedOrigins,
  isSwaggerEnabled,
  validateEnvironment
};
