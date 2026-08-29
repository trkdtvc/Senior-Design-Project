jest.mock("../../src/services/emailService", () => ({
  sendEmail: jest.fn()
}));

jest.mock("../../src/services/attachmentFileService", () => ({
  deleteStoredFiles: jest.fn().mockResolvedValue(undefined),
  getStoredFilePath: jest.fn()
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn(async (value) => `hash:${value}`),
  compare: jest.fn(async (plain, hashed) => hashed === `hash:${plain}`)
}));

jest.mock("../../src/models/userModel", () => ({
  findUserByEmail: jest.fn(),
  findUserByUsername: jest.fn(),
  findUserById: jest.fn(),
  findUserCredentialsById: jest.fn(),
  createUserWithVerificationToken: jest.fn(),
  consumeEmailVerificationToken: jest.fn(),
  replaceEmailVerificationToken: jest.fn(),
  setPasswordResetToken: jest.fn(),
  findUserByPasswordResetToken: jest.fn(),
  updateUserPassword: jest.fn(),
  updateUserPasswordWithResetToken: jest.fn(),
  updateUserProfile: jest.fn(),
  updateUserProfileWithVerificationToken: jest.fn(),
  updateUserAvatar: jest.fn(),
  getAttachmentUrlsAffectedByUserDeletion: jest.fn(),
  deleteUserById: jest.fn()
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const { signAuthToken } = require("../../src/services/authTokenService");
const { hashOneTimeToken } = require("../../src/services/oneTimeTokenService");
const app = require("../../src/app");
const userModel = require("../../src/models/userModel");
const { sendEmail } = require("../../src/services/emailService");

const VERIFIED_USER = {
  user_id: 41,
  username: "alice",
  email: "alice@example.com",
  password_hash: "hash:GoodPassword1!",
  avatar_url: null,
  is_verified: 1,
  is_online: 1,
  status: "online",
  last_seen_at: null
};

const tokenFor = (user = VERIFIED_USER) =>
  signAuthToken(user, { expiresIn: "1h" });

const RAW_VERIFICATION_TOKEN = "a".repeat(64);
const RAW_RESET_TOKEN = "b".repeat(64);

describe("authentication and account integration flow", () => {
  let currentUser;

  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = { ...VERIFIED_USER };

    userModel.findUserById.mockImplementation(async () =>
      currentUser ? { ...currentUser } : null
    );
    userModel.findUserByEmail.mockResolvedValue(null);
    userModel.findUserByUsername.mockResolvedValue(null);
    userModel.createUserWithVerificationToken.mockResolvedValue({ insertId: 77 });
    userModel.consumeEmailVerificationToken.mockImplementation(async () => {
      if (currentUser) currentUser.is_verified = 1;

      return {
        status: "verified",
        record: { user_id: currentUser?.user_id || 41 }
      };
    });
    userModel.replaceEmailVerificationToken.mockResolvedValue({ insertId: 1 });
    userModel.setPasswordResetToken.mockResolvedValue({ affectedRows: 1 });
    userModel.findUserByPasswordResetToken.mockResolvedValue(null);
    userModel.updateUserProfile.mockImplementation(
      async (userId, username, email) => {
        currentUser = {
          ...currentUser,
          user_id: Number(userId),
          username,
          email
        };
      }
    );
    userModel.updateUserProfileWithVerificationToken.mockImplementation(
      async (userId, username, email) => {
        currentUser = {
          ...currentUser,
          user_id: Number(userId),
          username,
          email,
          is_verified: 0
        };

        return { affectedRows: 1 };
      }
    );
    userModel.findUserCredentialsById.mockImplementation(async () =>
      currentUser ? { ...currentUser } : null
    );
    userModel.updateUserPassword.mockImplementation(async (userId, passwordHash) => {
      if (currentUser && Number(currentUser.user_id) === Number(userId)) {
        currentUser.password_hash = passwordHash;
      }

      return { affectedRows: 1 };
    });
    userModel.updateUserPasswordWithResetToken.mockImplementation(
      async (userId, tokenHash, passwordHash) => {
        if (currentUser && Number(currentUser.user_id) === Number(userId)) {
          currentUser.password_hash = passwordHash;
        }

        return { affectedRows: 1 };
      }
    );
    userModel.getAttachmentUrlsAffectedByUserDeletion.mockResolvedValue([]);
    userModel.deleteUserById.mockResolvedValue({ affectedRows: 1 });
  });

  test("registers atomically, stores only the verification-token hash, and emails the raw token", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        username: "  New.User  ",
        email: "  NEW.USER@EXAMPLE.COM ",
        password: "GoodPassword1!",
        confirmPassword: "GoodPassword1!"
      });

    expect(response.statusCode).toBe(201);
    expect(userModel.createUserWithVerificationToken).toHaveBeenCalledWith(
      "New.User",
      "new.user@example.com",
      "hash:GoodPassword1!",
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date)
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({
      to: "new.user@example.com",
      subject: expect.stringContaining("Verify your email")
    });

    const emailedText = sendEmail.mock.calls[0][0].text;
    const rawToken = emailedText.match(/verify-email\?token=([a-f0-9]{64})/i)?.[1];
    const storedHash = userModel.createUserWithVerificationToken.mock.calls[0][3];

    expect(rawToken).toBeTruthy();
    expect(storedHash).toBe(hashOneTimeToken(rawToken));
    expect(storedHash).not.toBe(rawToken);
    expect(response.body.user.is_verified).toBe(0);
  });

  test("keeps the account registered if the initial verification email temporarily fails", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    sendEmail.mockRejectedValueOnce(new Error("SMTP unavailable"));

    const response = await request(app)
      .post("/api/auth/register")
      .send({
        username: "New.User",
        email: "new.user@example.com",
        password: "GoodPassword1!",
        confirmPassword: "GoodPassword1!"
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.message).toMatch(/request a new verification email/i);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  test("logs in a verified user and returns a usable JWT", async () => {
    userModel.findUserByEmail.mockResolvedValue({ ...VERIFIED_USER });

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        login: "ALICE@EXAMPLE.COM",
        password: "GoodPassword1!"
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("Login successful");
    expect(jwt.verify(response.body.token, process.env.JWT_SECRET)).toMatchObject({
      user_id: VERIFIED_USER.user_id
    });
  });

  test("returns the same generic credential error for an unknown account", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ login: "missing@example.com", password: "WrongPassword1!" });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe("Invalid login or password.");
  });

  test("returns the same generic credential error for a wrong password", async () => {
    userModel.findUserByEmail.mockResolvedValue({ ...VERIFIED_USER });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ login: "alice@example.com", password: "WrongPassword1!" });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe("Invalid login or password.");
  });

  test("blocks login until the user's email is verified", async () => {
    userModel.findUserByEmail.mockResolvedValue({
      ...VERIFIED_USER,
      is_verified: 0
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        login: "alice@example.com",
        password: "GoodPassword1!"
      });

    expect(response.statusCode).toBe(403);
    expect(response.body.email).toBe("alice@example.com");
  });

  test("verifies a valid token by hashing it before the transactional consume", async () => {
    currentUser = { ...VERIFIED_USER, is_verified: 0 };

    const response = await request(app)
      .get("/api/auth/verify-email")
      .query({ token: RAW_VERIFICATION_TOKEN });

    expect(response.statusCode).toBe(200);
    expect(userModel.consumeEmailVerificationToken).toHaveBeenCalledWith(
      hashOneTimeToken(RAW_VERIFICATION_TOKEN)
    );
    expect(response.body).not.toHaveProperty("token");
  });

  test("rejects an expired verification token", async () => {
    userModel.consumeEmailVerificationToken.mockResolvedValue({
      status: "expired",
      record: { user_id: 41 }
    });

    const response = await request(app)
      .get("/api/auth/verify-email")
      .query({ token: RAW_VERIFICATION_TOKEN });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toMatch(/expired/i);
  });

  test("changing email updates the profile and verification token atomically without issuing a replacement JWT", async () => {
    const response = await request(app)
      .patch("/api/auth/profile")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({
        username: "alice",
        email: "alice.new@example.com"
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.requires_email_verification).toBe(true);
    expect(response.body).not.toHaveProperty("token");
    expect(userModel.updateUserProfileWithVerificationToken).toHaveBeenCalledWith(
      41,
      "alice",
      "alice.new@example.com",
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date)
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "alice.new@example.com" })
    );
  });

  test("changing only the username keeps the account verified and returns a fresh JWT", async () => {
    const response = await request(app)
      .patch("/api/auth/profile")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({
        username: "alice_updated",
        email: "alice@example.com"
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.requires_email_verification).toBe(false);
    expect(response.body.token).toBeTruthy();
    expect(userModel.updateUserProfileWithVerificationToken).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("password reset requests do not reveal whether an email exists", async () => {
    userModel.findUserByEmail.mockResolvedValue(null);

    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "unknown@example.com" });

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toMatch(/if an account/i);
    expect(userModel.setPasswordResetToken).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("stores only a password-reset token hash and expires it after about one hour", async () => {
    userModel.findUserByEmail.mockResolvedValue({ ...VERIFIED_USER });
    const startedAt = Date.now();

    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: VERIFIED_USER.email });

    expect(response.statusCode).toBe(200);
    expect(userModel.setPasswordResetToken).toHaveBeenCalledWith(
      VERIFIED_USER.user_id,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date)
    );

    const emailedText = sendEmail.mock.calls[0][0].text;
    const rawToken = emailedText.match(/reset-password\?token=([a-f0-9]{64})/i)?.[1];
    const [, storedHash, expiresAt] = userModel.setPasswordResetToken.mock.calls[0];
    const lifetimeMs = expiresAt.getTime() - startedAt;

    expect(rawToken).toBeTruthy();
    expect(storedHash).toBe(hashOneTimeToken(rawToken));
    expect(storedHash).not.toBe(rawToken);
    expect(lifetimeMs).toBeGreaterThanOrEqual(59 * 60 * 1000);
    expect(lifetimeMs).toBeLessThanOrEqual(61 * 60 * 1000);
    expect(emailedText).toMatch(/60 minutes/i);
  });

  test("consumes the hashed reset token atomically when changing the password", async () => {
    userModel.findUserByPasswordResetToken.mockResolvedValue({
      ...VERIFIED_USER,
      password_reset_token_expires: new Date(Date.now() + 60_000),
      reset_token_is_unexpired: 1
    });

    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({
        token: RAW_RESET_TOKEN,
        newPassword: "BetterPassword2!",
        confirmPassword: "BetterPassword2!"
      });

    expect(response.statusCode).toBe(200);
    expect(userModel.findUserByPasswordResetToken).toHaveBeenCalledWith(
      hashOneTimeToken(RAW_RESET_TOKEN)
    );
    expect(userModel.updateUserPasswordWithResetToken).toHaveBeenCalledWith(
      VERIFIED_USER.user_id,
      hashOneTimeToken(RAW_RESET_TOKEN),
      "hash:BetterPassword2!"
    );
  });

  test("changes password only when the current password is correct and new password differs", async () => {
    const response = await request(app)
      .patch("/api/auth/password")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({
        currentPassword: "GoodPassword1!",
        newPassword: "BetterPassword2!",
        confirmPassword: "BetterPassword2!"
      });

    expect(response.statusCode).toBe(200);
    expect(userModel.updateUserPassword).toHaveBeenCalledWith(
      41,
      "hash:BetterPassword2!"
    );
    expect(response.body.token).toBeTruthy();
  });

  test("rejects an unsupported avatar file type as a client error", async () => {
    const response = await request(app)
      .put("/api/auth/profile/avatar")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .attach("avatar", Buffer.from("not an image"), {
        filename: "avatar.txt",
        contentType: "text/plain"
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toMatch(/JPEG, PNG, WebP, or GIF/i);
  });

  test("deletes an account only after password confirmation", async () => {
    const response = await request(app)
      .delete("/api/auth/account")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .send({ password: "GoodPassword1!" });

    expect(response.statusCode).toBe(200);
    expect(userModel.deleteUserById).toHaveBeenCalledWith(41);
  });
});
