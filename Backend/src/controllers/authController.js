const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendEmail } = require("../services/emailService");
const {
  findUserByEmail,
  findUserByUsername,
  findUserById,
  createUser,
  markUserAsVerified,
  setPasswordResetToken,
  findUserByPasswordResetToken,
  updateUserPassword,
  updateUserProfile,
  createEmailVerificationToken,
  findEmailVerificationTokenRecord,
  markEmailVerificationTokenAsUsed
} = require("../models/userModel");

const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
const PASSWORD_RESET_EXPIRY_HOURS = 24;

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

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const getSafeUserResponse = (user) => ({
  user_id: user.user_id,
  username: user.username,
  email: user.email,
  is_verified: user.is_verified,
  status: user.status || "online",
  is_online: Boolean(user.is_online),
  last_seen_at: user.last_seen_at
});

const getPasswordChecks = (password) => ({
  minLength: password.length >= 8,
  uppercase: /[A-Z]/.test(password),
  lowercase: /[a-z]/.test(password),
  number: /\d/.test(password),
  special: /[^A-Za-z0-9]/.test(password)
});

const getPasswordValidation = (password) => {
  const rules = getPasswordChecks(password);
  const passedChecks = Object.values(rules).filter(Boolean).length;

  let strength = "Strong";

  if (passedChecks <= 2) {
    strength = "Weak";
  } else if (passedChecks <= 4) {
    strength = "Medium";
  }

  return {
    rules,
    passedChecks,
    strength,
    isAccepted: strength !== "Weak"
  };
};

const sendVerificationEmailToUser = async (
  user,
  verificationToken,
  expiresInHours = EMAIL_VERIFICATION_EXPIRY_HOURS
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
  expiresInHours = PASSWORD_RESET_EXPIRY_HOURS
) => {
  const resetLink = `${getFrontendBaseUrl()}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

  await sendEmail({
    to: user.email,
    subject: "Reset your password - Your Friendly Neighborhood Chatster",
    text: `Hello ${user.username},

We received a request to reset your password.

Use the link below to reset it:
${resetLink}

This link expires in ${expiresInHours} hour${expiresInHours === 1 ? "" : "s"}.`,
    html: `
      <p>Hello ${user.username},</p>
      <p>We received a request to reset your password.</p>
      <p>Use the link below to reset it:</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>This link expires in ${expiresInHours} hour${expiresInHours === 1 ? "" : "s"}.</p>
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

    const passwordValidation = getPasswordValidation(password);

    if (!passwordValidation.isAccepted) {
      res.status(400);
      throw new Error(
        "Weak password not accepted. Your password must be at least medium strength."
      );
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
    const verificationTokenExpires = new Date(
      Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000
    );

    await createEmailVerificationToken(
      user.user_id,
      verificationToken,
      verificationTokenExpires
    );

    await sendVerificationEmailToUser(
      user,
      verificationToken,
      EMAIL_VERIFICATION_EXPIRY_HOURS
    );

    return res.status(201).json({
      message: "Registration successful. Check your email to verify your account",
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
      return res.status(403).json({
        message: "Please verify your email before logging in",
        email: user.email
      });
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
      throw new Error("Invalid verification token");
    }

    const verificationRecord = await findEmailVerificationTokenRecord(token);

    if (!verificationRecord) {
      res.status(400);
      throw new Error("Invalid verification token");
    }

    if (verificationRecord.used_at) {
      if (verificationRecord.is_verified) {
        res.status(400);
        throw new Error("This email is already verified");
      }

      res.status(400);
      throw new Error("Verification token has already been used");
    }

    const isExpired =
      !verificationRecord.expires_at ||
      new Date(verificationRecord.expires_at) < new Date();

    if (isExpired) {
      res.status(400);
      throw new Error("Verification token has expired");
    }

    if (verificationRecord.is_verified) {
      res.status(400);
      throw new Error("This email is already verified");
    }

    await markUserAsVerified(verificationRecord.user_id);
    await markEmailVerificationTokenAsUsed(verificationRecord.verification_id);

    const freshUser = await findUserById(verificationRecord.user_id);

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
    const verificationTokenExpires = new Date(
      Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000
    );

    await createEmailVerificationToken(
      user.user_id,
      verificationToken,
      verificationTokenExpires
    );

    await sendVerificationEmailToUser(
      user,
      verificationToken,
      EMAIL_VERIFICATION_EXPIRY_HOURS
    );

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
      const resetTokenExpires = new Date(
        Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000
      );

      await setPasswordResetToken(
        user.user_id,
        resetToken,
        resetTokenExpires
      );

      await sendPasswordResetEmailToUser(
        user,
        resetToken,
        PASSWORD_RESET_EXPIRY_HOURS
      );
    }

    return res.status(200).json({
      message: "If an account with that email exists, a password reset email has been sent"
    });
  } catch (error) {
    next(error);
  }
};

const validatePasswordResetToken = async (req, res, next) => {
  try {
    const { token } = req.query || {};

    if (!token) {
      res.status(400);
      throw new Error("Invalid password reset token");
    }

    const user = await findUserByPasswordResetToken(token);

    if (!user) {
      res.status(400);
      throw new Error("Invalid password reset token");
    }

    const isExpired =
      !user.password_reset_token_expires ||
      new Date(user.password_reset_token_expires) < new Date();

    if (isExpired) {
      res.status(400);
      throw new Error("Password reset token has expired");
    }

    return res.status(200).json({
      message: "Password reset token is valid"
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
      throw new Error("Invalid password reset token");
    }

    if (!newPassword || !confirmPassword) {
      res.status(400);
      throw new Error("New password and confirm password are required");
    }

    if (newPassword !== confirmPassword) {
      res.status(400);
      throw new Error("Passwords do not match");
    }

    const passwordValidation = getPasswordValidation(newPassword);

    if (!passwordValidation.isAccepted) {
      res.status(400);
      throw new Error(
        "Weak password not accepted. Your password must be at least medium strength."
      );
    }

    const user = await findUserByPasswordResetToken(token);

    if (!user) {
      res.status(400);
      throw new Error("Invalid password reset token");
    }

    const isExpired =
      !user.password_reset_token_expires ||
      new Date(user.password_reset_token_expires) < new Date();

    if (isExpired) {
      res.status(400);
      throw new Error("Password reset token has expired");
    }

    const isSamePassword = await bcrypt.compare(
      newPassword,
      user.password_hash
    );

    if (isSamePassword) {
      res.status(400);
      throw new Error("Please do not use the same password you already used");
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

const updateProfile = async (req, res, next) => {
  try {
    const { username, email } = req.body || {};
    const normalizedUsername = username ? username.trim() : "";
    const normalizedEmail = email ? email.trim().toLowerCase() : "";

    if (!normalizedUsername || !normalizedEmail) {
      res.status(400);
      throw new Error("Username and email are required");
    }

    if (normalizedUsername.length < 3 || normalizedUsername.length > 50) {
      res.status(400);
      throw new Error("Username must be between 3 and 50 characters");
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(normalizedUsername)) {
      res.status(400);
      throw new Error("Username can only contain letters, numbers, underscores, dots, and dashes");
    }

    if (normalizedEmail.length > 100 || !isValidEmail(normalizedEmail)) {
      res.status(400);
      throw new Error("Enter a valid email address");
    }

    const existingUsername = await findUserByUsername(normalizedUsername);

    if (
      existingUsername &&
      String(existingUsername.user_id) !== String(req.user.user_id)
    ) {
      res.status(400);
      throw new Error("Username already exists");
    }

    const existingEmail = await findUserByEmail(normalizedEmail);

    if (
      existingEmail &&
      String(existingEmail.user_id) !== String(req.user.user_id)
    ) {
      res.status(400);
      throw new Error("Email already exists");
    }

    await updateUserProfile(
      req.user.user_id,
      normalizedUsername,
      normalizedEmail
    );

    const updatedUser = await findUserById(req.user.user_id);

    if (!updatedUser) {
      res.status(404);
      throw new Error("User not found");
    }

    const token = generateToken(updatedUser);
    const safeUser = getSafeUserResponse(updatedUser);
    const io = req.app.get("io");

    if (io) {
      io.emit("user_profile_updated", safeUser);
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      token,
      user: safeUser
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

    return res.status(200).json(getSafeUserResponse(user));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateProfile,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword: requestPasswordReset,
  validatePasswordResetToken,
  resetPassword
};