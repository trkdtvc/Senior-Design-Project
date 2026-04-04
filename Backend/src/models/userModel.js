const { pool } = require("../config/db");

const findUserByEmail = async (email) => {
  const [rows] = await pool.execute(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );
  return rows[0];
};

const findUserByUsername = async (username) => {
  const [rows] = await pool.execute(
    "SELECT * FROM users WHERE username = ?",
    [username]
  );
  return rows[0];
};

const findUserById = async (userId) => {
  const [rows] = await pool.execute(
    "SELECT user_id, username, email, is_verified, created_at, updated_at FROM users WHERE user_id = ?",
    [userId]
  );
  return rows[0];
};

const createUser = async (username, email, passwordHash) => {
  const [result] = await pool.execute(
    "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
    [username, email, passwordHash]
  );
  return result;
};

const setVerificationToken = async (userId, token, expiresAt) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET verification_token = ?, verification_token_expires = ?
     WHERE user_id = ?`,
    [token, expiresAt, userId]
  );

  return result;
};

const findUserByVerificationToken = async (token) => {
  const [rows] = await pool.execute(
    `SELECT user_id, username, email, is_verified, verification_token, verification_token_expires
     FROM users
     WHERE verification_token = ?
     LIMIT 1`,
    [token]
  );

  return rows[0];
};

const verifyUserByToken = async (token) => {
  const [rows] = await pool.execute(
    `SELECT *
     FROM users
     WHERE verification_token = ?
       AND verification_token_expires > NOW()
       AND is_verified = 0
     LIMIT 1`,
    [token]
  );

  return rows[0];
};

const markUserAsVerified = async (userId) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET is_verified = 1,
         verification_token = NULL,
         verification_token_expires = NULL
     WHERE user_id = ?`,
    [userId]
  );

  return result;
};

const setPasswordResetToken = async (userId, token, expiresAt) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET password_reset_token = ?, password_reset_token_expires = ?
     WHERE user_id = ?`,
    [token, expiresAt, userId]
  );

  return result;
};

const findUserByPasswordResetToken = async (token) => {
  const [rows] = await pool.execute(
    `SELECT *
     FROM users
     WHERE password_reset_token = ?
       AND password_reset_token_expires > NOW()
     LIMIT 1`,
    [token]
  );

  return rows[0];
};

const updateUserPassword = async (userId, passwordHash) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET password_hash = ?,
         password_reset_token = NULL,
         password_reset_token_expires = NULL
     WHERE user_id = ?`,
    [passwordHash, userId]
  );

  return result;
};

module.exports = {
  findUserByEmail,
  findUserByUsername,
  findUserById,
  createUser,
  setVerificationToken,
  findUserByVerificationToken,
  verifyUserByToken,
  markUserAsVerified,
  setPasswordResetToken,
  findUserByPasswordResetToken,
  updateUserPassword
};