const { pool } = require("../config/db");

const getUserById = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT user_id, username, email
     FROM users
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
};

const getBlockBetweenUsers = async (userAId, userBId) => {
  const [rows] = await pool.execute(
    `SELECT *
     FROM user_blocks
     WHERE (blocker_id = ? AND blocked_id = ?)
        OR (blocker_id = ? AND blocked_id = ?)
     LIMIT 1`,
    [userAId, userBId, userBId, userAId]
  );

  return rows[0] || null;
};

const createUserBlock = async (blockerId, blockedId) => {
  const [result] = await pool.execute(
    `INSERT IGNORE INTO user_blocks (blocker_id, blocked_id)
     VALUES (?, ?)`,
    [blockerId, blockedId]
  );

  await pool.execute(
    `DELETE FROM friendships
     WHERE (user_one_id = LEAST(?, ?) AND user_two_id = GREATEST(?, ?))`,
    [blockerId, blockedId, blockerId, blockedId]
  );

  await pool.execute(
    `DELETE FROM friend_requests
     WHERE (sender_id = ? AND receiver_id = ?)
        OR (sender_id = ? AND receiver_id = ?)`,
    [blockerId, blockedId, blockedId, blockerId]
  );

  return result;
};

const deleteUserBlock = async (blockerId, blockedId) => {
  const [result] = await pool.execute(
    `DELETE FROM user_blocks
     WHERE blocker_id = ? AND blocked_id = ?`,
    [blockerId, blockedId]
  );

  return result;
};

const getBlockedUsersByUserId = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT
        ub.block_id,
        ub.blocked_id AS user_id,
        u.username,
        u.email,
        ub.created_at
     FROM user_blocks ub
     JOIN users u ON ub.blocked_id = u.user_id
     WHERE ub.blocker_id = ?
     ORDER BY ub.created_at DESC`,
    [userId]
  );

  return rows;
};

const createUserReport = async ({ reporterId, reportedUserId, reason, contextType, contextId }) => {
  const [result] = await pool.execute(
    `INSERT INTO user_reports (
        reporter_id,
        reported_user_id,
        reason,
        context_type,
        context_id
      )
     VALUES (?, ?, ?, ?, ?)`,
    [reporterId, reportedUserId, reason, contextType || "profile", contextId || null]
  );

  return result;
};

module.exports = {
  getUserById,
  getBlockBetweenUsers,
  createUserBlock,
  deleteUserBlock,
  getBlockedUsersByUserId,
  createUserReport
};
