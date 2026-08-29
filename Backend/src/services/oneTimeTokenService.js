const crypto = require("crypto");

const TOKEN_BYTES = 32;
const TOKEN_HEX_LENGTH = TOKEN_BYTES * 2;
const TOKEN_PATTERN = new RegExp(`^[a-fA-F0-9]{${TOKEN_HEX_LENGTH}}$`);

const createOneTimeToken = () => crypto.randomBytes(TOKEN_BYTES).toString("hex");

const isValidOneTimeToken = (token) =>
  typeof token === "string" && TOKEN_PATTERN.test(token.trim());

const hashOneTimeToken = (token) => {
  if (!isValidOneTimeToken(token)) {
    return null;
  }

  return crypto
    .createHash("sha256")
    .update(token.trim().toLowerCase(), "utf8")
    .digest("hex");
};

const createOneTimeTokenPair = () => {
  const token = createOneTimeToken();

  return {
    token,
    tokenHash: hashOneTimeToken(token)
  };
};

module.exports = {
  TOKEN_HEX_LENGTH,
  createOneTimeToken,
  createOneTimeTokenPair,
  hashOneTimeToken,
  isValidOneTimeToken
};
