const jwt = require("jsonwebtoken");
const {
  signAuthToken,
  tokenMatchesCurrentCredentials
} = require("../../src/services/authTokenService");

const USER = {
  user_id: 9,
  username: "alice",
  email: "alice@example.com",
  password_hash: "$2b$10$current-password-hash"
};

describe("auth token service", () => {
  test("issues a token bound to the current password credentials", () => {
    const token = signAuthToken(USER, { expiresIn: "1h" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    expect(decoded).toMatchObject({
      user_id: USER.user_id,
      username: USER.username,
      email: USER.email
    });
    expect(decoded.session_binding).toBeTruthy();
    expect(tokenMatchesCurrentCredentials(decoded, USER)).toBe(true);
  });

  test("rejects a token after the password hash changes", () => {
    const token = signAuthToken(USER, { expiresIn: "1h" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    expect(
      tokenMatchesCurrentCredentials(decoded, {
        ...USER,
        password_hash: "$2b$10$new-password-hash"
      })
    ).toBe(false);
  });

  test("rejects legacy tokens that do not contain a session binding", () => {
    const token = jwt.sign({ user_id: USER.user_id }, process.env.JWT_SECRET, {
      expiresIn: "1h"
    });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    expect(tokenMatchesCurrentCredentials(decoded, USER)).toBe(false);
  });
});
