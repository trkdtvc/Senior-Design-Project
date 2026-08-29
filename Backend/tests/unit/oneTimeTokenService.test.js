const {
  TOKEN_HEX_LENGTH,
  createOneTimeTokenPair,
  hashOneTimeToken,
  isValidOneTimeToken
} = require("../../src/services/oneTimeTokenService");

describe("one-time token service", () => {
  test("creates a high-entropy raw token and a distinct deterministic hash", () => {
    const { token, tokenHash } = createOneTimeTokenPair();

    expect(token).toMatch(new RegExp(`^[a-f0-9]{${TOKEN_HEX_LENGTH}}$`));
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).toBe(hashOneTimeToken(token));
    expect(tokenHash).not.toBe(token);
  });

  test("rejects malformed tokens before hashing", () => {
    expect(isValidOneTimeToken("too-short")).toBe(false);
    expect(isValidOneTimeToken("g".repeat(TOKEN_HEX_LENGTH))).toBe(false);
    expect(hashOneTimeToken("too-short")).toBeNull();
  });
});
