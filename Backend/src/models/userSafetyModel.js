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
    `SELECT
        ub.block_id,
        ub.blocker_id,
        blocker.username AS blocker_username,
        ub.blocked_id,
        blocked.username AS blocked_username,
        ub.created_at
     FROM user_blocks ub
     JOIN users blocker ON ub.blocker_id = blocker.user_id
     JOIN users blocked ON ub.blocked_id = blocked.user_id
     WHERE (ub.blocker_id = ? AND ub.blocked_id = ?)
        OR (ub.blocker_id = ? AND ub.blocked_id = ?)
     LIMIT 1`,
    [userAId, userBId, userBId, userAId]
  );

  return rows[0] || null;
};

const hasBlockBetweenUsers = async (userAId, userBId) => {
  const block = await getBlockBetweenUsers(userAId, userBId);
  return Boolean(block);
};

const hasUserBlocked = async (blockerId, blockedId) => {
  const [rows] = await pool.execute(
    `SELECT block_id
     FROM user_blocks
     WHERE blocker_id = ? AND blocked_id = ?
     LIMIT 1`,
    [blockerId, blockedId]
  );

  return Boolean(rows[0]);
};

const getBlockedUsersByUserId = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT
        ub.block_id,
        ub.blocker_id,
        ub.blocked_id,
        ub.created_at,
        u.username,
        u.email,
        CASE
          WHEN u.is_online = 1 THEN 'online'
          ELSE 'offline'
        END AS presence_status
     FROM user_blocks ub
     JOIN users u ON ub.blocked_id = u.user_id
     WHERE ub.blocker_id = ?
     ORDER BY ub.created_at DESC`,
    [userId]
  );

  return rows;
};

const createBlockAndCleanup = async (blockerId, blockedId) => {
  const userOneId = Math.min(Number(blockerId), Number(blockedId));
  const userTwoId = Math.max(Number(blockerId), Number(blockedId));
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `INSERT IGNORE INTO user_blocks (blocker_id, blocked_id)
       VALUES (?, ?)`,
      [blockerId, blockedId]
    );

    await connection.execute(
      `DELETE FROM friendships
       WHERE user_one_id = ? AND user_two_id = ?`,
      [userOneId, userTwoId]
    );

    await connection.execute(
      `DELETE FROM friend_requests
       WHERE status = 'pending'
         AND (
           (sender_id = ? AND receiver_id = ?)
           OR
           (sender_id = ? AND receiver_id = ?)
         )`,
      [blockerId, blockedId, blockedId, blockerId]
    );

    const [rows] = await connection.execute(
      `SELECT
          ub.block_id,
          ub.blocker_id,
          ub.blocked_id,
          ub.created_at,
          u.username,
          u.email,
          CASE
            WHEN u.is_online = 1 THEN 'online'
            ELSE 'offline'
          END AS presence_status
       FROM user_blocks ub
       JOIN users u ON ub.blocked_id = u.user_id
       WHERE ub.blocker_id = ? AND ub.blocked_id = ?
       LIMIT 1`,
      [blockerId, blockedId]
    );

    await connection.commit();
    return rows[0] || null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteBlock = async (blockerId, blockedId) => {
  const [result] = await pool.execute(
    `DELETE FROM user_blocks
     WHERE blocker_id = ? AND blocked_id = ?`,
    [blockerId, blockedId]
  );

  return result;
};


module.exports = {
  getUserById,
  getBlockBetweenUsers,
  hasBlockBetweenUsers,
  hasUserBlocked,
  getBlockedUsersByUserId,
  createBlockAndCleanup,
  deleteBlock
};
