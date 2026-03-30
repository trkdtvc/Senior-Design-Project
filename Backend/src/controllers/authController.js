const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
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
const crypto = require("crypto");

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
      email
    };

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await setVerificationToken(
      user.user_id,
      verificationToken,
      verificationTokenExpires
    );
    
    await sendEmail({
      to: user.email,
      subject: "Verify your email - Your Friendly Neighborhood Chatster",
      text: `Hello ${user.username},
      
    Please verify your email by visiting this link:
      
    http://localhost:5000/api/auth/verify-email?token=${verificationToken}
      
    This link expires in 24 hours.`
    });

    res.status(201).json({
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

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email
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

    res.status(200).json({
      message: "Email verified successfully"
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

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  verifyEmail
};