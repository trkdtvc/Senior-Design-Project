const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../services/emailService");
const {
  findUserByEmail,
  findUserByUsername,
  findUserById,
  createUser
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

    const token = generateToken(user);

    await sendEmail({
      to: user.email,
      subject: "Welcome to Your Friendly Neighborhood Chatster",
      text: `Hello ${user.username},

Welcome to Your Friendly Neighborhood Chatster!

Your account has been created successfully.

Enjoy the app!
`
    });

    res.status(201).json({
      message: "User registered successfully",
      token,
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
  getMe
};