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
  verifyUserByToken,
  markUserAsVerified
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

const getVerificationBaseUrl = () => {
  return process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
};

const sendVerificationEmailToUser = async (user, verificationToken, expiresInHours = 24) => {
  const verificationLink = `${getVerificationBaseUrl()}/api/auth/verify-email?token=${verificationToken}`;

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

const registerUser = async (req, res, next) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      res.status(400);
      throw new Error("All fields are required");
    }

    if (password !== confirmPassword) {
      res.status(400);
      throw new Error("Passwords do not match");
    }

    const existingEmail = await findUserByEmail(email);
    if (existingEmail) {
      res.status(400);
      throw new Error("Email already exists");
    }

    const existingUsername = await findUserByUsername(username);
    if (existingUsername) {
      res.status(400);
      throw new Error("Username already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await createUser(username, email, passwordHash);

    const user = {
      user_id: result.insertId,
      username,
      email,
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
      message: "User registered successfully. Please verify your email before logging in.",
      user
    });
  } catch (error) {
    next(error);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      res.status(400);
      throw new Error("Login and password are required");
    }

    let user = await findUserByEmail(login);

    if (!user) {
      user = await findUserByUsername(login);
    }

    if (!user) {
      res.status(401);
      throw new Error("Invalid credentials");
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      res.status(401);
      throw new Error("Invalid credentials");
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
    const { token } = req.query;

    if (!token) {
      res.status(400);
      throw new Error("Verification token is required");
    }

    const user = await verifyUserByToken(token);

    if (!user) {
      res.status(400);
      throw new Error("Invalid or expired verification token");
    }

    await markUserAsVerified(user.user_id);

    return res.status(200).json({
      message: "Email verified successfully"
    });
  } catch (error) {
    next(error);
  }
};

const resendVerificationEmail = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400);
      throw new Error("Email is required");
    }

    const user = await findUserByEmail(email);

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
      is_verified: user.is_verified
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
  resendVerificationEmail
};