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
      avatar_url,
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

const findUserCredentialsById = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT user_id, username, email, avatar_url, password_hash, is_verified
     FROM users
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
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


const updateUserProfile = async (userId, username, email, emailChanged = false) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET username = ?,
         email = ?,
         is_verified = CASE WHEN ? THEN 0 ELSE is_verified END
     WHERE user_id = ?`,
    [username, email, emailChanged ? 1 : 0, userId]
  );

  return result;
};

const updateUserAvatar = async (userId, avatarUrl) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET avatar_url = ?
     WHERE user_id = ?`,
    [avatarUrl || null, userId]
  );

  return result;
};

const invalidateEmailVerificationTokens = async (userId) => {
  const [result] = await pool.execute(
    `UPDATE email_verification_tokens
     SET used_at = NOW()
     WHERE user_id = ?
       AND used_at IS NULL`,
    [userId]
  );

  return result;
};

const getAttachmentUrlsAffectedByUserDeletion = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT DISTINCT ma.file_url
     FROM message_attachments ma
     JOIN messages m ON ma.message_id = m.message_id
     JOIN channels c ON m.channel_id = c.channel_id
     JOIN servers s ON c.server_id = s.server_id
     WHERE m.user_id = ? OR s.owner_id = ?

     UNION

     SELECT DISTINCT dma.file_url
     FROM direct_message_attachments dma
     JOIN direct_messages dm ON dma.direct_message_id = dm.direct_message_id
     JOIN direct_conversations dc ON dm.conversation_id = dc.conversation_id
     WHERE dc.user_one_id = ? OR dc.user_two_id = ?`,
    [userId, userId, userId, userId]
  );

  return rows;
};

const deleteUserById = async (userId) => {
  const [result] = await pool.execute(
    "DELETE FROM users WHERE user_id = ?",
    [userId]
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
  findUserCredentialsById,
  createUser,
  markUserAsVerified,
  setPasswordResetToken,
  findUserByPasswordResetToken,
  updateUserPassword,
  updateUserProfile,
  updateUserAvatar,
  invalidateEmailVerificationTokens,
  getAttachmentUrlsAffectedByUserDeletion,
  deleteUserById,
  updateUserPresenceStatus,
  setUserOnlineState,
  createEmailVerificationToken,
  findEmailVerificationTokenRecord,
  markEmailVerificationTokenAsUsed
};