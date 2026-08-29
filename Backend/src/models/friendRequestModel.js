const { pool, withTransaction } = require("../config/db");

const hasBlockBetweenUsers = async (userAId, userBId) => {
  const [rows] = await pool.execute(
    `SELECT block_id
     FROM user_blocks
     WHERE (blocker_id = ? AND blocked_id = ?)
        OR (blocker_id = ? AND blocked_id = ?)
     LIMIT 1`,
    [userAId, userBId, userBId, userAId]
  );

  return Boolean(rows[0]);
};

const findUserByUsernameOrEmail = async (value) => {
  const [rows] = await pool.execute(
    `SELECT user_id, username, email, avatar_url
     FROM users
     WHERE username = ? OR email = ?
     LIMIT 1`,
    [value, value]
  );

  return rows[0];
};

const getPendingFriendRequestBetweenUsers = async (userAId, userBId) => {
  const [rows] = await pool.execute(
    `SELECT *
     FROM friend_requests
     WHERE (
       (sender_id = ? AND receiver_id = ?)
       OR
       (sender_id = ? AND receiver_id = ?)
     )
     AND status = 'pending'
     LIMIT 1`,
    [userAId, userBId, userBId, userAId]
  );

  return rows[0];
};

const getFriendRequestBetweenUsers = async (userAId, userBId) => {
  const [rows] = await pool.execute(
    `SELECT *
     FROM friend_requests
     WHERE (
       (sender_id = ? AND receiver_id = ?)
       OR
       (sender_id = ? AND receiver_id = ?)
     )
     LIMIT 1`,
    [userAId, userBId, userBId, userAId]
  );

  return rows[0];
};

const createFriendRequest = async (senderId, receiverId) => {
  const [result] = await pool.execute(
    `INSERT INTO friend_requests (sender_id, receiver_id)
     VALUES (?, ?)`,
    [senderId, receiverId]
  );

  return result;
};

const resendFriendRequest = async (requestId, senderId, receiverId) => {
  const [result] = await pool.execute(
    `UPDATE friend_requests
     SET sender_id = ?,
         receiver_id = ?,
         status = 'pending',
         responded_at = NULL,
         created_at = NOW()
     WHERE request_id = ?`,
    [senderId, receiverId, requestId]
  );

  return result;
};

const getIncomingPendingRequestsByUserId = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT
      fr.request_id,
      fr.sender_id,
      fr.receiver_id,
      fr.status,
      fr.created_at,
      u.username AS sender_username,
      u.email AS sender_email,
      u.avatar_url AS sender_avatar_url
     FROM friend_requests fr
     JOIN users u ON fr.sender_id = u.user_id
     WHERE fr.receiver_id = ?
       AND fr.status = 'pending'
       AND NOT EXISTS (
         SELECT 1
         FROM user_blocks ub
         WHERE (ub.blocker_id = fr.sender_id AND ub.blocked_id = fr.receiver_id)
            OR (ub.blocker_id = fr.receiver_id AND ub.blocked_id = fr.sender_id)
       )
     ORDER BY fr.created_at DESC`,
    [userId]
  );

  return rows;
};

const getOutgoingPendingRequestsByUserId = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT
      fr.request_id,
      fr.sender_id,
      fr.receiver_id,
      fr.status,
      fr.created_at,
      u.username AS receiver_username,
      u.email AS receiver_email,
      u.avatar_url AS receiver_avatar_url
     FROM friend_requests fr
     JOIN users u ON fr.receiver_id = u.user_id
     WHERE fr.sender_id = ?
       AND fr.status = 'pending'
       AND NOT EXISTS (
         SELECT 1
         FROM user_blocks ub
         WHERE (ub.blocker_id = fr.sender_id AND ub.blocked_id = fr.receiver_id)
            OR (ub.blocker_id = fr.receiver_id AND ub.blocked_id = fr.sender_id)
       )
     ORDER BY fr.created_at DESC`,
    [userId]
  );

  return rows;
};

const getFriendRequestById = async (requestId) => {
  const [rows] = await pool.execute(
    `SELECT *
     FROM friend_requests
     WHERE request_id = ?
     LIMIT 1`,
    [requestId]
  );

  return rows[0];
};

const updateFriendRequestStatus = async (requestId, status) => {
  const [result] = await pool.execute(
    `UPDATE friend_requests
     SET status = ?,
         responded_at = NOW()
     WHERE request_id = ?`,
    [status, requestId]
  );

  return result;
};

const acceptFriendRequestAtomic = async (requestId, senderId, receiverId) => {
  const userOneId = Math.min(Number(senderId), Number(receiverId));
  const userTwoId = Math.max(Number(senderId), Number(receiverId));

  return withTransaction(async (connection) => {
    const [requestResult] = await connection.execute(
      `UPDATE friend_requests
       SET status = 'accepted',
           responded_at = NOW()
       WHERE request_id = ?
         AND sender_id = ?
         AND receiver_id = ?
         AND status = 'pending'`,
      [requestId, senderId, receiverId]
    );

    if (requestResult.affectedRows !== 1) {
      const error = new Error("This friend request is no longer pending");
      error.statusCode = 409;
      throw error;
    }

    const [friendshipResult] = await connection.execute(
      `INSERT IGNORE INTO friendships (user_one_id, user_two_id)
       VALUES (?, ?)`,
      [userOneId, userTwoId]
    );

    return {
      requestResult,
      friendshipResult
    };
  });
};

const createFriendship = async (userAId, userBId) => {
  const userOneId = Math.min(Number(userAId), Number(userBId));
  const userTwoId = Math.max(Number(userAId), Number(userBId));

  const [result] = await pool.execute(
    `INSERT INTO friendships (user_one_id, user_two_id)
     VALUES (?, ?)`,
    [userOneId, userTwoId]
  );

  return result;
};

const getFriendshipBetweenUsers = async (userAId, userBId) => {
  const userOneId = Math.min(Number(userAId), Number(userBId));
  const userTwoId = Math.max(Number(userAId), Number(userBId));

  const [rows] = await pool.execute(
    `SELECT *
     FROM friendships
     WHERE user_one_id = ?
       AND user_two_id = ?
     LIMIT 1`,
    [userOneId, userTwoId]
  );

  return rows[0];
};

const deleteFriendship = async (userAId, userBId) => {
  const userOneId = Math.min(Number(userAId), Number(userBId));
  const userTwoId = Math.max(Number(userAId), Number(userBId));

  const [result] = await pool.execute(
    `DELETE FROM friendships
     WHERE user_one_id = ?
       AND user_two_id = ?`,
    [userOneId, userTwoId]
  );

  return result;
};

const getFriendsByUserId = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT
      f.friendship_id,
      f.created_at,
      u.user_id,
      u.username,
      u.email,
      u.avatar_url,
      CASE
        WHEN u.is_online = 1 THEN 'online'
        ELSE 'offline'
      END AS presence_status
     FROM friendships f
     JOIN users u
       ON u.user_id = CASE
         WHEN f.user_one_id = ? THEN f.user_two_id
         ELSE f.user_one_id
       END
     WHERE (f.user_one_id = ? OR f.user_two_id = ?)
       AND NOT EXISTS (
         SELECT 1
         FROM user_blocks ub
         WHERE (ub.blocker_id = ? AND ub.blocked_id = u.user_id)
            OR (ub.blocker_id = u.user_id AND ub.blocked_id = ?)
       )
     ORDER BY u.username ASC`,
    [userId, userId, userId, userId, userId]
  );

  return rows;
};

module.exports = {
  hasBlockBetweenUsers,
  findUserByUsernameOrEmail,
  getPendingFriendRequestBetweenUsers,
  getFriendRequestBetweenUsers,
  createFriendRequest,
  resendFriendRequest,
  getIncomingPendingRequestsByUserId,
  getOutgoingPendingRequestsByUserId,
  getFriendRequestById,
  updateFriendRequestStatus,
  acceptFriendRequestAtomic,
  createFriendship,
  getFriendshipBetweenUsers,
  deleteFriendship,
  getFriendsByUserId
};