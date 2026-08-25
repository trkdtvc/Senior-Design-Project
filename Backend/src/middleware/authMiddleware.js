const jwt = require("jsonwebtoken");
const { findUserById } = require("../models/userModel");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await findUserById(decoded.user_id);

    if (!user) {
      return res.status(401).json({ message: "Not authorized, account not found" });
    }


    req.user = {
      ...decoded,
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      is_verified: user.is_verified
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized, invalid token" });
  }
};

module.exports = { protect };
