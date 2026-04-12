const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendEmail } = require("../services/emailService");
const {
  findUserByEmail,
  findUserByUsername,
  findUserById,
  createUser,
  setVerificationToken,
  markUserAsVerified,
  setPasswordResetToken,
  findUserByPasswordResetToken,
  updateUserPassword,
  findUserByVerificationToken
} = require("../models/userModel");

const generateToken = (user) => {
  return jwt.sign(
    {
      user_id: user.user_id,
      username: user.username,
      email: user.email
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const getFrontendBaseUrl = () => {
  return process.env.FRONTEND_URL || "http://localhost:5173";
};

const sendVerificationEmailToUser = async (
  user,
  verificationToken,
  expiresInHours = 24
) => {
  const verificationLink = `${getFrontendBaseUrl()}/verify-email?token=${verificationToken}&email=${encodeURIComponent(user.email)}`;

  await sendEmail({
    to: user.email,
    subject: "Verify your email - Your Friendly Neighborhood Chatster",
    text: `Hello ${user.username},

Please verify your email by visiting this link:

${verificationLink}

This link expires in ${expiresInHours} hours.`,
    html: `
      <h2>Verify your email</h2>
      <p>Hello ${user.username},</p>
      <p>Click the link below to verify your account:</p>
      <a href="${verificationLink}">${verificationLink}</a>
      <p>This link expires in ${expiresInHours} hours.</p>
    `
  });
};

const sendPasswordResetEmailToUser = async (
  user,
  resetToken,
  expiresInHours = 1
) => {
  const resetLink = `${getFrontendBaseUrl()}/reset-password?token=${resetToken}`;

  await sendEmail({
    to: user.email,
    subject: "Reset your password - Your Friendly Neighborhood Chatster",
    text: `Hello ${user.username},

We received a request to reset your password.

Use the link below to reset it:
${resetLink}

If you are testing the backend without a frontend yet, use this token in your reset-password request:
${resetToken}

This link/token expires in ${expiresInHours} hour${expiresInHours === 1 ? "" : "s"}.

If you did not request this, you can ignore this email.`,
    html: `
      <h2>Reset your password</h2>
      <p>Hello ${user.username},</p>
      <p>We received a request to reset your password.</p>
      <p>Use the link below to reset it:</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>If you are testing the backend without a frontend yet, use this token in your reset-password request:</p>
      <p><strong>${resetToken}</strong></p>
      <p>This link/token expires in ${expiresInHours} hour${expiresInHours === 1 ? "" : "s"}.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `
  });
};

const registerUser = async (req, res, next) => {
  try {
    const { username, email, password, confirmPassword } = req.body || {};

    if (!username || !email || !password || !confirmPassword) {
      res.status(400);
      throw new Error("All fields are required");
    }

    if (password !== confirmPassword) {
      res.status(400);
      throw new Error("Passwords do not match");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    const existingEmail = await findUserByEmail(normalizedEmail);
    if (existingEmail) {
      res.status(400);
      throw new Error("Email already exists");
    }

    const existingUsername = await findUserByUsername(normalizedUsername);
    if (existingUsername) {
      res.status(400);
      throw new Error("Username already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await createUser(
      normalizedUsername,
      normalizedEmail,
      passwordHash
    );

    const user = {
      user_id: result.insertId,
      username: normalizedUsername,
      email: normalizedEmail,
      is_verified: 0
    };

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await setVerificationToken(
      user.user_id,
      verificationToken,
      verificationTokenExpires
    );

    await sendVerificationEmailToUser(user, verificationToken, 24);

    return res.status(201).json({
      message: "Registration successful. Check your email to verify your account.",
      email: user.email,
      user
    });
  } catch (error) {
    next(error);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const { login, identity, password } = req.body || {};
    const rawLoginValue = login || identity;
    const loginValue = rawLoginValue ? rawLoginValue.trim() : "";

    if (!loginValue || !password) {
      res.status(400);
      throw new Error("Login and password are required");
    }

    let user = await findUserByEmail(loginValue.toLowerCase());

    if (!user) {
      user = await findUserByUsername(loginValue);
    }

    if (!user) {
      res.status(401);
      throw new Error("User does not exist.");
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      res.status(401);
      throw new Error("Incorrect password.");
    }

    if (!user.is_verified) {
      res.status(403);
      throw new Error("Please verify your email before logging in");
    }

    const token = generateToken(user);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        is_verified: user.is_verified
      }
    });
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query || {};

    if (!token) {
      res.status(400);
      throw new Error("Invalid verification token.");
    }

    const user = await findUserByVerificationToken(token);

    if (!user) {
      res.status(400);
      throw new Error("Invalid verification token.");
    }

    const isExpired =
      !user.verification_token_expires ||
      new Date(user.verification_token_expires) < new Date();

    if (isExpired) {
      res.status(400);
      throw new Error("Verification token has expired.");
    }

    if (!user.is_verified) {
      await markUserAsVerified(user.user_id);
    }

    const freshUser = await findUserById(user.user_id);

    if (!freshUser) {
      res.status(404);
      throw new Error("User not found");
    }

    const authToken = generateToken(freshUser);

    return res.status(200).json({
      message: "Email verified successfully. Redirecting you into the app...",
      token: authToken,
      user: {
        user_id: freshUser.user_id,
        username: freshUser.username,
        email: freshUser.email,
        is_verified: freshUser.is_verified
      }
    });
  } catch (error) {
    next(error);
  }
};

const resendVerificationEmail = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    const normalizedEmail = email ? email.trim().toLowerCase() : "";

    if (!normalizedEmail) {
      res.status(400);
      throw new Error("Email is required");
    }

    const user = await findUserByEmail(normalizedEmail);

    if (!user) {
      return res.status(200).json({
        message: "If an unverified account with that email exists, a new verification email has been sent"
      });
    }

    if (user.is_verified) {
      res.status(400);
      throw new Error("This email is already verified");
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await setVerificationToken(
      user.user_id,
      verificationToken,
      verificationTokenExpires
    );

    await sendVerificationEmailToUser(user, verificationToken, 24);

    return res.status(200).json({
      message: "Verification email resent successfully"
    });
  } catch (error) {
    next(error);
  }
};

const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    const normalizedEmail = email ? email.trim().toLowerCase() : "";

    if (!normalizedEmail) {
      res.status(400);
      throw new Error("Email is required");
    }

    const user = await findUserByEmail(normalizedEmail);

    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

      await setPasswordResetToken(
        user.user_id,
        resetToken,
        resetTokenExpires
      );

      await sendPasswordResetEmailToUser(user, resetToken, 1);
    }

    return res.status(200).json({
      message: "If an account with that email exists, a password reset email has been sent"
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword, confirmPassword } = req.body || {};

    if (!token) {
      res.status(400);
      throw new Error("Invalid password reset token.");
    }

    if (!newPassword || !confirmPassword) {
      res.status(400);
      throw new Error("New password and confirm password are required.");
    }

    if (newPassword !== confirmPassword) {
      res.status(400);
      throw new Error("Passwords do not match.");
    }

    const user = await findUserByPasswordResetToken(token);

    if (!user) {
      res.status(400);
      throw new Error("Invalid password reset token.");
    }

    const isExpired =
      !user.password_reset_token_expires ||
      new Date(user.password_reset_token_expires) < new Date();

    if (isExpired) {
      res.status(400);
      throw new Error("Password reset token has expired.");
    }

    const isSamePassword = await bcrypt.compare(
      newPassword,
      user.password_hash
    );

    if (isSamePassword) {
      res.status(400);
      throw new Error("Please do not use the same password you already used.");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await updateUserPassword(user.user_id, passwordHash);

    return res.status(200).json({
      message: "Password reset successfully."
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await findUserById(req.user.user_id);

    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    return res.status(200).json({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      is_verified: user.is_verified,
      status: user.status || "online",
      is_online: Boolean(user.is_online),
      last_seen_at: user.last_seen_at
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword: requestPasswordReset,
  resetPassword
};