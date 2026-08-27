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
  createUser: jest.fn(),
  markUserAsVerified: jest.fn(),
  setPasswordResetToken: jest.fn(),
  findUserByPasswordResetToken: jest.fn(),
  updateUserPassword: jest.fn(),
  updateUserProfile: jest.fn(),
  updateUserAvatar: jest.fn(),
  invalidateEmailVerificationTokens: jest.fn(),
  getAttachmentUrlsAffectedByUserDeletion: jest.fn(),
  deleteUserById: jest.fn(),
  createEmailVerificationToken: jest.fn(),
  findEmailVerificationTokenRecord: jest.fn(),
  markEmailVerificationTokenAsUsed: jest.fn()
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../src/app");
const userModel = require("../../src/models/userModel");
const { sendEmail } = require("../../src/services/emailService");
const bcrypt = require("bcryptjs");

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
  jwt.sign(
    {
      user_id: user.user_id,
      username: user.username,
      email: user.email
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

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
    userModel.createUser.mockResolvedValue({ insertId: 77 });
    userModel.createEmailVerificationToken.mockResolvedValue({ insertId: 1 });
    userModel.markUserAsVerified.mockImplementation(async () => {
      if (currentUser) currentUser.is_verified = 1;
    });
    userModel.markEmailVerificationTokenAsUsed.mockResolvedValue({ affectedRows: 1 });
    userModel.invalidateEmailVerificationTokens.mockResolvedValue({ affectedRows: 1 });
    userModel.updateUserProfile.mockImplementation(
      async (userId, username, email, emailChanged) => {
        currentUser = {
          ...currentUser,
          user_id: Number(userId),
          username,
          email,
          is_verified: emailChanged ? 0 : currentUser.is_verified
        };
      }
    );
    userModel.findUserCredentialsById.mockResolvedValue({ ...VERIFIED_USER });
    userModel.updateUserPassword.mockResolvedValue({ affectedRows: 1 });
    userModel.getAttachmentUrlsAffectedByUserDeletion.mockResolvedValue([]);
    userModel.deleteUserById.mockResolvedValue({ affectedRows: 1 });
  });

  test("registers a valid user, normalizes input, stores a verification token, and sends email", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        username: "  New.User  ",
        email: "  NEW.USER@EXAMPLE.COM ",
        password: "GoodPassword1!",
        confirmPassword: "GoodPassword1!"
      });

    expect(response.statusCode).toBe(201);
    expect(userModel.createUser).toHaveBeenCalledWith(
      "New.User",
      "new.user@example.com",
      "hash:GoodPassword1!"
    );
    expect(userModel.createEmailVerificationToken).toHaveBeenCalledWith(
      77,
      expect.any(String),
      expect.any(Date)
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({
      to: "new.user@example.com",
      subject: expect.stringContaining("Verify your email")
    });
    expect(response.body.user.is_verified).toBe(0);
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

  test("verifies a valid unused verification token", async () => {
    currentUser = { ...VERIFIED_USER, is_verified: 0 };
    userModel.findEmailVerificationTokenRecord.mockResolvedValue({
      verification_id: 9,
      user_id: currentUser.user_id,
      used_at: null,
      is_verified: 0,
      expires_at: new Date(Date.now() + 60_000)
    });

    const response = await request(app)
      .get("/api/auth/verify-email")
      .query({ token: "valid-token" });

    expect(response.statusCode).toBe(200);
    expect(userModel.markUserAsVerified).toHaveBeenCalledWith(currentUser.user_id);
    expect(userModel.markEmailVerificationTokenAsUsed).toHaveBeenCalledWith(9);
    expect(response.body).not.toHaveProperty("token");
  });

  test("rejects an expired verification token", async () => {
    userModel.findEmailVerificationTokenRecord.mockResolvedValue({
      verification_id: 9,
      user_id: 41,
      used_at: null,
      is_verified: 0,
      expires_at: new Date(Date.now() - 60_000)
    });

    const response = await request(app)
      .get("/api/auth/verify-email")
      .query({ token: "expired-token" });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toMatch(/expired/i);
    expect(userModel.markUserAsVerified).not.toHaveBeenCalled();
  });

  test("changing email invalidates old verification tokens and does not issue a replacement JWT", async () => {
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
    expect(userModel.invalidateEmailVerificationTokens).toHaveBeenCalledWith(41);
    expect(userModel.createEmailVerificationToken).toHaveBeenCalledTimes(1);
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
    expect(userModel.invalidateEmailVerificationTokens).not.toHaveBeenCalled();
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

  test("changes password only when the current password is correct and new password differs", async () => {
    userModel.findUserCredentialsById.mockResolvedValue({ ...VERIFIED_USER });

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
