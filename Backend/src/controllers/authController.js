const bcrypt = require("bcryptjs");
const { sendEmail } = require("../services/emailService");
const { signAuthToken } = require("../services/authTokenService");
const {
  findUserByEmail,
  findUserByUsername,
  findUserById,
  findUserCredentialsById,
  createUserWithVerificationToken,
  consumeEmailVerificationToken,
  replaceEmailVerificationToken,
  setPasswordResetToken,
  findUserByPasswordResetToken,
  updateUserPassword,
  updateUserPasswordWithResetToken,
  updateUserProfile,
  updateUserProfileWithVerificationToken,
  updateUserAvatar,
  getAttachmentUrlsAffectedByUserDeletion,
  deleteUserById
} = require("../models/userModel");
const { deleteStoredFiles } = require("../services/attachmentFileService");
const {
  createOneTimeTokenPair,
  hashOneTimeToken,
  isValidOneTimeToken
} = require("../services/oneTimeTokenService");

const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
const PASSWORD_RESET_EXPIRY_MINUTES = 60;

const getFrontendBaseUrl = () => {
  return (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
};

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const getSafeUserResponse = (user) => ({
  user_id: user.user_id,
  username: user.username,
  email: user.email,
  avatar_url: user.avatar_url || null,
  is_verified: user.is_verified,
  status: user.status || "online",
  is_online: Boolean(user.is_online),
  last_seen_at: user.last_seen_at
});

const getPublicUserProfileResponse = (user) => ({
  user_id: user.user_id,
  username: user.username,
  avatar_url: user.avatar_url || null
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
  expiresInMinutes = PASSWORD_RESET_EXPIRY_MINUTES
) => {
  const resetLink = `${getFrontendBaseUrl()}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

  await sendEmail({
    to: user.email,
    subject: "Reset your password - Your Friendly Neighborhood Chatster",
    text: `Hello ${user.username},

We received a request to reset your password.

Use the link below to reset it:
${resetLink}

This link expires in ${expiresInMinutes} minute${expiresInMinutes === 1 ? "" : "s"}.`,
    html: `
      <p>Hello ${user.username},</p>
      <p>We received a request to reset your password.</p>
      <p>Use the link below to reset it:</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>This link expires in ${expiresInMinutes} minute${expiresInMinutes === 1 ? "" : "s"}.</p>
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

    if (
      typeof username !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof confirmPassword !== "string"
    ) {
      res.status(400);
      throw new Error("Registration fields must be valid text values");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = String(username || "").trim();

    if (normalizedUsername.length < 3 || normalizedUsername.length > 50) {
      res.status(400);
      throw new Error("Username must be between 3 and 50 characters");
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(normalizedUsername)) {
      res.status(400);
      throw new Error(
        "Username can only contain letters, numbers, underscores, dots, and dashes"
      );
    }

    if (normalizedEmail.length > 100 || !isValidEmail(normalizedEmail)) {
      res.status(400);
      throw new Error("Enter a valid email address");
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
    const { token: verificationToken, tokenHash: verificationTokenHash } =
      createOneTimeTokenPair();
    const verificationTokenExpires = new Date(
      Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000
    );
    const result = await createUserWithVerificationToken(
      normalizedUsername,
      normalizedEmail,
      passwordHash,
      verificationTokenHash,
      verificationTokenExpires
    );

    const user = {
      user_id: result.insertId,
      username: normalizedUsername,
      email: normalizedEmail,
      is_verified: 0
    };

    let verificationEmailSent = true;

    try {
      await sendVerificationEmailToUser(
        user,
        verificationToken,
        EMAIL_VERIFICATION_EXPIRY_HOURS
      );
    } catch (emailError) {
      verificationEmailSent = false;
      console.error("Failed to send registration verification email:", emailError.message);
    }

    return res.status(201).json({
      message: verificationEmailSent
        ? "Registration successful. Check your email to verify your account"
        : "Registration successful. Verification email could not be sent; request a new verification email.",
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
    const loginValue = typeof rawLoginValue === "string" ? rawLoginValue.trim() : "";

    if (!loginValue || typeof password !== "string" || !password) {
      res.status(400);
      throw new Error("Login and password are required");
    }

    let user = await findUserByEmail(loginValue.toLowerCase());

    if (!user) {
      user = await findUserByUsername(loginValue);
    }

    if (!user) {
      res.status(401);
      throw new Error("Invalid login or password.");
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      res.status(401);
      throw new Error("Invalid login or password.");
    }

    if (!user.is_verified) {
      return res.status(403).json({
        message: "Please verify your email before logging in",
        email: user.email
      });
    }

    const token = signAuthToken(user);

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

    if (!isValidOneTimeToken(token)) {
      res.status(400);
      throw new Error("Invalid verification token");
    }

    const verificationTokenHash = hashOneTimeToken(token);
    const verificationResult = await consumeEmailVerificationToken(
      verificationTokenHash
    );

    if (verificationResult.status === "invalid") {
      res.status(400);
      throw new Error("Invalid verification token");
    }

    if (verificationResult.status === "already_verified") {
      res.status(400);
      throw new Error("This email is already verified");
    }

    if (verificationResult.status === "already_used") {
      res.status(400);
      throw new Error("Verification token has already been used");
    }

    if (verificationResult.status === "expired") {
      res.status(400);
      throw new Error("Verification token has expired");
    }

    const freshUser = await findUserById(verificationResult.record.user_id);

    if (!freshUser) {
      res.status(404);
      throw new Error("User not found");
    }

    return res.status(200).json({
      message: "Email verified successfully. You can now log in.",
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
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || normalizedEmail.length > 100 || !isValidEmail(normalizedEmail)) {
      res.status(400);
      throw new Error("Enter a valid email address");
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

    const { token: verificationToken, tokenHash: verificationTokenHash } =
      createOneTimeTokenPair();
    const verificationTokenExpires = new Date(
      Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000
    );

    await replaceEmailVerificationToken(
      user.user_id,
      verificationTokenHash,
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
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || normalizedEmail.length > 100 || !isValidEmail(normalizedEmail)) {
      res.status(400);
      throw new Error("Enter a valid email address");
    }

    const user = await findUserByEmail(normalizedEmail);

    if (user) {
      const { token: resetToken, tokenHash: resetTokenHash } =
        createOneTimeTokenPair();
      const resetTokenExpires = new Date(
        Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000
      );

      await setPasswordResetToken(
        user.user_id,
        resetTokenHash,
        resetTokenExpires
      );

      try {
        await sendPasswordResetEmailToUser(
          user,
          resetToken,
          PASSWORD_RESET_EXPIRY_MINUTES
        );
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError.message);
      }
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

    if (!isValidOneTimeToken(token)) {
      res.status(400);
      throw new Error("Invalid password reset token");
    }

    const resetTokenHash = hashOneTimeToken(token);
    const user = await findUserByPasswordResetToken(resetTokenHash);

    if (!user) {
      res.status(400);
      throw new Error("Invalid password reset token");
    }

    const isExpired = Number(user.reset_token_is_unexpired) !== 1;

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

    if (!isValidOneTimeToken(token)) {
      res.status(400);
      throw new Error("Invalid password reset token");
    }

    const resetTokenHash = hashOneTimeToken(token);

    if (
      typeof newPassword !== "string" ||
      typeof confirmPassword !== "string" ||
      !newPassword ||
      !confirmPassword
    ) {
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

    const user = await findUserByPasswordResetToken(resetTokenHash);

    if (!user) {
      res.status(400);
      throw new Error("Invalid password reset token");
    }

    const isExpired = Number(user.reset_token_is_unexpired) !== 1;

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
    const updateResult = await updateUserPasswordWithResetToken(
      user.user_id,
      resetTokenHash,
      passwordHash
    );

    if (!updateResult || updateResult.affectedRows !== 1) {
      res.status(400);
      throw new Error("Password reset token is invalid or has expired");
    }

    const io = req.app.get("io");

    if (io) {
      io.in(`user_${user.user_id}`).disconnectSockets(true);
    }

    return res.status(200).json({
      message: "Password reset successfully."
    });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      typeof confirmPassword !== "string" ||
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      res.status(400);
      throw new Error("Current password, new password, and confirmation are required");
    }

    if (newPassword !== confirmPassword) {
      res.status(400);
      throw new Error("New passwords do not match");
    }

    const passwordValidation = getPasswordValidation(newPassword);

    if (!passwordValidation.isAccepted) {
      res.status(400);
      throw new Error(
        "Weak password not accepted. Your password must be at least medium strength."
      );
    }

    const user = await findUserCredentialsById(req.user.user_id);

    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    const currentPasswordMatches = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );

    if (!currentPasswordMatches) {
      res.status(401);
      throw new Error("Current password is incorrect");
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);

    if (isSamePassword) {
      res.status(400);
      throw new Error("New password must be different from your current password");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await updateUserPassword(user.user_id, passwordHash);

    const freshUser = await findUserCredentialsById(user.user_id);

    if (!freshUser) {
      res.status(404);
      throw new Error("User not found");
    }

    const token = signAuthToken(freshUser);
    const io = req.app.get("io");

    if (io) {
      io.in(`user_${user.user_id}`).disconnectSockets(true);
    }

    res.status(200).json({
      message: "Password changed successfully",
      token
    });
  } catch (error) {
    next(error);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body || {};

    if (typeof password !== "string" || !password) {
      res.status(400);
      throw new Error("Password is required to delete your account");
    }

    const userId = req.user.user_id;
    const user = await findUserCredentialsById(userId);

    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      res.status(401);
      throw new Error("Password is incorrect");
    }

    const attachmentUrls = await getAttachmentUrlsAffectedByUserDeletion(userId);
    const storedFilesToDelete = [
      ...attachmentUrls,
      ...(user.avatar_url ? [user.avatar_url] : [])
    ];

    await deleteUserById(userId);
    await deleteStoredFiles(storedFilesToDelete);

    const io = req.app.get("io");

    if (io) {
      io.to(`user_${userId}`).emit("account_deleted", {
        user_id: Number(userId)
      });
      io.in(`user_${userId}`).disconnectSockets(true);
    }

    res.status(200).json({
      message: "Account deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { username, email } = req.body || {};
    const normalizedUsername =
      typeof username === "string" ? username.trim() : "";
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

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

    const currentUser = await findUserById(req.user.user_id);

    if (!currentUser) {
      res.status(404);
      throw new Error("User not found");
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

    const emailChanged =
      normalizedEmail !== String(currentUser.email || "").toLowerCase();

    let verificationToken = null;

    if (emailChanged) {
      const tokenPair = createOneTimeTokenPair();
      verificationToken = tokenPair.token;
      const verificationTokenExpires = new Date(
        Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000
      );

      await updateUserProfileWithVerificationToken(
        req.user.user_id,
        normalizedUsername,
        normalizedEmail,
        tokenPair.tokenHash,
        verificationTokenExpires
      );
    } else {
      await updateUserProfile(
        req.user.user_id,
        normalizedUsername,
        normalizedEmail,
        false
      );
    }

    const updatedUser = await findUserById(req.user.user_id);

    if (!updatedUser) {
      res.status(404);
      throw new Error("User not found");
    }

    let verificationEmailSent = true;

    if (emailChanged) {
      try {
        await sendVerificationEmailToUser(
          updatedUser,
          verificationToken,
          EMAIL_VERIFICATION_EXPIRY_HOURS
        );
      } catch (emailError) {
        verificationEmailSent = false;
        console.error("Failed to send profile verification email:", emailError.message);
      }
    }

    let token = null;

    if (!emailChanged) {
      const updatedCredentials = await findUserCredentialsById(req.user.user_id);

      if (!updatedCredentials) {
        res.status(404);
        throw new Error("User not found");
      }

      token = signAuthToken(updatedCredentials);
    }
    const safeUser = getSafeUserResponse(updatedUser);
    const io = req.app.get("io");

    if (io) {
      io.emit("user_profile_updated", getPublicUserProfileResponse(updatedUser));
    }

    return res.status(200).json({
      message: emailChanged
        ? verificationEmailSent
          ? "Profile updated. Please verify your new email address"
          : "Profile updated. Verification email could not be sent; request a new verification email."
        : "Profile updated successfully",
      ...(token ? { token } : {}),
      requires_email_verification: emailChanged,
      user: safeUser
    });
  } catch (error) {
    next(error);
  }
};

const updateProfileAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error("Choose an image to use as your avatar");
    }

    const userId = req.user.user_id;
    const currentUser = await findUserById(userId);

    if (!currentUser) {
      await deleteStoredFiles([`/uploads/avatars/${req.file.filename}`]);
      res.status(404);
      throw new Error("User not found");
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    try {
      await updateUserAvatar(userId, avatarUrl);
    } catch (error) {
      await deleteStoredFiles([avatarUrl]);
      throw error;
    }

    if (currentUser.avatar_url) {
      await deleteStoredFiles([currentUser.avatar_url]);
    }

    const updatedUser = await findUserById(userId);
    const safeUser = getSafeUserResponse(updatedUser);
    const io = req.app.get("io");

    if (io) {
      io.emit("user_profile_updated", getPublicUserProfileResponse(updatedUser));
    }

    res.status(200).json({
      message: "Profile picture updated successfully",
      user: safeUser
    });
  } catch (error) {
    next(error);
  }
};

const deleteProfileAvatar = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const currentUser = await findUserById(userId);

    if (!currentUser) {
      res.status(404);
      throw new Error("User not found");
    }

    await updateUserAvatar(userId, null);

    if (currentUser.avatar_url) {
      await deleteStoredFiles([currentUser.avatar_url]);
    }

    const updatedUser = await findUserById(userId);
    const safeUser = getSafeUserResponse(updatedUser);
    const io = req.app.get("io");

    if (io) {
      io.emit("user_profile_updated", getPublicUserProfileResponse(updatedUser));
    }

    res.status(200).json({
      message: "Profile picture removed",
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
  updateProfileAvatar,
  deleteProfileAvatar,
  changePassword,
  deleteAccount,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword: requestPasswordReset,
  validatePasswordResetToken,
  resetPassword
};