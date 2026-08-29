const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const getSessionBinding = (passwordHash) => {
  if (!passwordHash) {
    throw new Error("Cannot create an authentication token without password credentials");
  }

  return crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(String(passwordHash))
    .digest("hex");
};

const signAuthToken = (user, options = {}) => {
  return jwt.sign(
    {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      session_binding: getSessionBinding(user.password_hash)
    },
    process.env.JWT_SECRET,
    { expiresIn: options.expiresIn || "7d" }
  );
};

const tokenMatchesCurrentCredentials = (decodedToken, user) => {
  const tokenBinding = String(decodedToken?.session_binding || "");

  if (!tokenBinding || !user?.password_hash) {
    return false;
  }

  const currentBinding = getSessionBinding(user.password_hash);
  const tokenBuffer = Buffer.from(tokenBinding, "utf8");
  const currentBuffer = Buffer.from(currentBinding, "utf8");

  if (tokenBuffer.length !== currentBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuffer, currentBuffer);
};

module.exports = {
  getSessionBinding,
  signAuthToken,
  tokenMatchesCurrentCredentials
};
