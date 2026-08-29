const { pool, withTransaction } = require("../config/db");

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
    `SELECT user_id, username, email, avatar_url, password_hash, is_verified, status, is_online, last_seen_at
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

const createUserWithVerificationToken = async (
  username,
  email,
  passwordHash,
  tokenHash,
  expiresAt
) =>
  withTransaction(async (connection) => {
    const [userResult] = await connection.execute(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email, passwordHash]
    );

    await connection.execute(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
       VALUES (?, ?, ?)`,
      [userResult.insertId, tokenHash, expiresAt]
    );

    return userResult;
  });

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

const setPasswordResetToken = async (userId, tokenHash, expiresAt) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET password_reset_token = ?, password_reset_token_expires = ?
     WHERE user_id = ?`,
    [tokenHash, expiresAt, userId]
  );

  return result;
};

const findUserByPasswordResetToken = async (tokenHash) => {
  const [rows] = await pool.execute(
    `SELECT
       user_id,
       username,
       email,
       password_hash,
       password_reset_token,
       password_reset_token_expires,
       CASE
         WHEN password_reset_token_expires IS NOT NULL
          AND password_reset_token_expires > NOW() THEN 1
         ELSE 0
       END AS reset_token_is_unexpired
     FROM users
     WHERE password_reset_token = ?
     LIMIT 1`,
    [tokenHash]
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

const updateUserPasswordWithResetToken = async (
  userId,
  tokenHash,
  passwordHash
) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET password_hash = ?,
         password_reset_token = NULL,
         password_reset_token_expires = NULL
     WHERE user_id = ?
       AND password_reset_token = ?
       AND password_reset_token_expires > NOW()`,
    [passwordHash, userId, tokenHash]
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

const updateUserProfileWithVerificationToken = async (
  userId,
  username,
  email,
  tokenHash,
  expiresAt
) =>
  withTransaction(async (connection) => {
    const [profileResult] = await connection.execute(
      `UPDATE users
       SET username = ?,
           email = ?,
           is_verified = 0
       WHERE user_id = ?`,
      [username, email, userId]
    );

    await connection.execute(
      `UPDATE email_verification_tokens
       SET used_at = NOW()
       WHERE user_id = ?
         AND used_at IS NULL`,
      [userId]
    );

    await connection.execute(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
       VALUES (?, ?, ?)`,
      [userId, tokenHash, expiresAt]
    );

    return profileResult;
  });

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

const replaceEmailVerificationToken = async (userId, tokenHash, expiresAt) =>
  withTransaction(async (connection) => {
    await connection.execute(
      `UPDATE email_verification_tokens
       SET used_at = NOW()
       WHERE user_id = ?
         AND used_at IS NULL`,
      [userId]
    );

    const [result] = await connection.execute(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
       VALUES (?, ?, ?)`,
      [userId, tokenHash, expiresAt]
    );

    return result;
  });

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

const setAllUsersOffline = async (lastSeenAt = new Date()) => {
  const [result] = await pool.execute(
    `UPDATE users
     SET is_online = 0,
         last_seen_at = ?
     WHERE is_online = 1`,
    [lastSeenAt]
  );

  return result;
};

const getPresenceAudienceUserIds = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT DISTINCT related_user_id
     FROM (
       SELECT sm2.user_id AS related_user_id
       FROM server_members sm1
       INNER JOIN server_members sm2 ON sm2.server_id = sm1.server_id
       WHERE sm1.user_id = ?

       UNION

       SELECT CASE
         WHEN dc.user_one_id = ? THEN dc.user_two_id
         ELSE dc.user_one_id
       END AS related_user_id
       FROM direct_conversations dc
       WHERE dc.user_one_id = ? OR dc.user_two_id = ?

       UNION

       SELECT CASE
         WHEN f.user_one_id = ? THEN f.user_two_id
         ELSE f.user_one_id
       END AS related_user_id
       FROM friendships f
       WHERE f.user_one_id = ? OR f.user_two_id = ?
     ) AS audience
     WHERE related_user_id IS NOT NULL`,
    [userId, userId, userId, userId, userId, userId, userId]
  );

  return rows.map((row) => Number(row.related_user_id)).filter(Number.isFinite);
};

const createEmailVerificationToken = async (userId, tokenHash, expiresAt) => {
  const [result] = await pool.execute(
    `INSERT INTO email_verification_tokens (user_id, token, expires_at)
     VALUES (?, ?, ?)`,
    [userId, tokenHash, expiresAt]
  );

  return result;
};

const findEmailVerificationTokenRecord = async (tokenHash) => {
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
    [tokenHash]
  );

  return rows[0] || null;
};

const consumeEmailVerificationToken = async (tokenHash) =>
  withTransaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT
         evt.verification_id,
         evt.user_id,
         evt.expires_at,
         evt.used_at,
         CASE
           WHEN evt.expires_at IS NOT NULL AND evt.expires_at > NOW() THEN 1
           ELSE 0
         END AS is_unexpired,
         u.username,
         u.email,
         u.is_verified
       FROM email_verification_tokens evt
       INNER JOIN users u ON u.user_id = evt.user_id
       WHERE evt.token = ?
       LIMIT 1
       FOR UPDATE`,
      [tokenHash]
    );

    const record = rows[0] || null;

    if (!record) {
      return { status: "invalid", record: null };
    }

    if (record.used_at) {
      return {
        status: record.is_verified ? "already_verified" : "already_used",
        record
      };
    }

    if (Number(record.is_unexpired) !== 1) {
      return { status: "expired", record };
    }

    if (record.is_verified) {
      return { status: "already_verified", record };
    }

    await connection.execute(
      `UPDATE users
       SET is_verified = 1,
           verification_token = NULL,
           verification_token_expires = NULL
       WHERE user_id = ?`,
      [record.user_id]
    );

    await connection.execute(
      `UPDATE email_verification_tokens
       SET used_at = NOW()
       WHERE verification_id = ?
         AND used_at IS NULL`,
      [record.verification_id]
    );

    return { status: "verified", record };
  });

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
  createUserWithVerificationToken,
  markUserAsVerified,
  setPasswordResetToken,
  findUserByPasswordResetToken,
  updateUserPassword,
  updateUserPasswordWithResetToken,
  updateUserProfile,
  updateUserProfileWithVerificationToken,
  updateUserAvatar,
  invalidateEmailVerificationTokens,
  replaceEmailVerificationToken,
  getAttachmentUrlsAffectedByUserDeletion,
  deleteUserById,
  updateUserPresenceStatus,
  setUserOnlineState,
  setAllUsersOffline,
  getPresenceAudienceUserIds,
  createEmailVerificationToken,
  findEmailVerificationTokenRecord,
  consumeEmailVerificationToken,
  markEmailVerificationTokenAsUsed
};
