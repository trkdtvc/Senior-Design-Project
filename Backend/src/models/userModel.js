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
    `SELECT
      user_id,
      username,
      email,
      is_verified,
      status,
      is_online,
      last_seen_at,
      created_at,
      updated_at
     FROM users
     WHERE user_id = ?`,
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
    `SELECT
       user_id,
       username,
       email,
       password_hash,
       password_reset_token,
       password_reset_token_expires
     FROM users
     WHERE password_reset_token = ?
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

const updateUserPresenceStatus = async (userId, status) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET status = ?
     WHERE user_id = ?`,
    [status, userId]
  );

  return result;
};

const setUserOnlineState = async (userId, isOnline, lastSeenAt = null) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET is_online = ?,
         last_seen_at = ?
     WHERE user_id = ?`,
    [isOnline ? 1 : 0, lastSeenAt, userId]
  );

  return result;
};

const createEmailVerificationToken = async (userId, token, expiresAt) => {
  const [result] = await pool.execute(
    `INSERT INTO email_verification_tokens (user_id, token, expires_at)
     VALUES (?, ?, ?)`,
    [userId, token, expiresAt]
  );

  return result;
};

const findEmailVerificationTokenRecord = async (token) => {
  const [rows] = await pool.execute(
    `SELECT
       evt.verification_id,
       evt.user_id,
       evt.token,
       evt.expires_at,
       evt.used_at,
       u.username,
       u.email,
       u.is_verified
     FROM email_verification_tokens evt
     INNER JOIN users u ON u.user_id = evt.user_id
     WHERE evt.token = ?
     LIMIT 1`,
    [token]
  );

  return rows[0] || null;
};

const markEmailVerificationTokenAsUsed = async (verificationId) => {
  const [result] = await pool.execute(
    `UPDATE email_verification_tokens
     SET used_at = NOW()
     WHERE verification_id = ?`,
    [verificationId]
  );

  return result;
};

module.exports = {
  findUserByEmail,
  findUserByUsername,
  findUserById,
  createUser,
  markUserAsVerified,
  setPasswordResetToken,
  findUserByPasswordResetToken,
  updateUserPassword,
  updateUserPresenceStatus,
  setUserOnlineState,
  createEmailVerificationToken,
  findEmailVerificationTokenRecord,
  markEmailVerificationTokenAsUsed
};