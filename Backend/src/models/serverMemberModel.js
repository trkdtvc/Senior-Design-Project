const { pool } = require("../config/db");
const { normalizeRoleName } = require("./permissionModel");

const MANAGED_SERVER_ROLES = ["admin", "member"];

const addServerMember = async (serverId, userId) => {
  const [result] = await pool.execute(
    "INSERT INTO server_members (server_id, user_id, server_role) VALUES (?, ?, 'member')",
    [serverId, userId]
  );

  return result;
};

const getMembersByServerId = async (serverId) => {
  const [rows] = await pool.execute(
    `SELECT
      sm.member_id,
      sm.server_id,
      sm.user_id,
      sm.server_role,
      sm.joined_at,
      u.username,
      u.email,
      u.avatar_url,
      u.last_seen_at,
      CASE
        WHEN u.is_online = 1 THEN 'online'
        ELSE 'offline'
      END AS presence_status,
      CASE
        WHEN s.owner_id = u.user_id THEN 1
        ELSE 0
      END AS is_owner,
      CASE
        WHEN s.owner_id = u.user_id THEN 'owner'
        WHEN sm.server_role = 'admin' THEN 'admin'
        ELSE 'member'
      END AS effective_server_role
     FROM server_members sm
     JOIN users u ON sm.user_id = u.user_id
     JOIN servers s ON sm.server_id = s.server_id
     WHERE sm.server_id = ?
     ORDER BY is_owner DESC, effective_server_role ASC, u.username ASC`,
    [serverId]
  );

  return rows.map((member) => ({
    ...member,
    server_role: member.effective_server_role || member.server_role || "member"
  }));
};

const getServerIdsByUserId = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT server_id
     FROM server_members
     WHERE user_id = ?`,
    [userId]
  );

  return rows;
};

const getServerMemberByMemberId = async (memberId) => {
  const [rows] = await pool.execute(
    `SELECT
        sm.member_id,
        sm.server_id,
        sm.user_id,
        sm.server_role,
        sm.joined_at,
        u.username,
        u.email,
        u.avatar_url,
        s.owner_id,
        CASE WHEN s.owner_id = sm.user_id THEN 1 ELSE 0 END AS is_owner,
        CASE
          WHEN s.owner_id = sm.user_id THEN 'owner'
          WHEN sm.server_role = 'admin' THEN 'admin'
          ELSE 'member'
        END AS effective_server_role
     FROM server_members sm
     JOIN users u ON sm.user_id = u.user_id
     JOIN servers s ON sm.server_id = s.server_id
     WHERE sm.member_id = ?
     LIMIT 1`,
    [memberId]
  );

  if (!rows[0]) {
    return null;
  }

  return {
    ...rows[0],
    server_role: rows[0].effective_server_role || rows[0].server_role || "member"
  };
};

const isUserMemberOfServer = async (serverId, userId) => {
  const [rows] = await pool.execute(
    "SELECT member_id FROM server_members WHERE server_id = ? AND user_id = ? LIMIT 1",
    [serverId, userId]
  );

  return rows.length > 0;
};

const removeServerMember = async (serverId, userId) => {
  const [result] = await pool.execute(
    "DELETE FROM server_members WHERE server_id = ? AND user_id = ?",
    [serverId, userId]
  );

  return result;
};

const removeServerMemberByMemberId = async (memberId) => {
  const [result] = await pool.execute(
    "DELETE FROM server_members WHERE member_id = ?",
    [memberId]
  );

  return result;
};

const getServerBans = async (serverId) => {
  const [rows] = await pool.execute(
    `SELECT
       sb.ban_id,
       sb.server_id,
       sb.user_id,
       sb.banned_by,
       sb.reason,
       sb.created_at,
       u.username,
       u.email,
       u.avatar_url,
       moderator.username AS banned_by_username
     FROM server_bans sb
     JOIN users u ON sb.user_id = u.user_id
     LEFT JOIN users moderator ON sb.banned_by = moderator.user_id
     WHERE sb.server_id = ?
     ORDER BY sb.created_at DESC`,
    [serverId]
  );

  return rows;
};

const isUserBannedFromServer = async (serverId, userId) => {
  const [rows] = await pool.execute(
    `SELECT ban_id
     FROM server_bans
     WHERE server_id = ? AND user_id = ?
     LIMIT 1`,
    [serverId, userId]
  );

  return Boolean(rows[0]);
};

const banServerMember = async (
  serverId,
  memberId,
  bannedBy,
  reason = null
) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [targetRows] = await connection.execute(
      `SELECT sm.member_id, sm.server_id, sm.user_id
       FROM server_members sm
       WHERE sm.server_id = ? AND sm.member_id = ?
       LIMIT 1`,
      [serverId, memberId]
    );

    const targetMember = targetRows[0];

    if (!targetMember) {
      const error = new Error("Server member not found.");
      error.statusCode = 404;
      throw error;
    }

    await connection.execute(
      `INSERT INTO server_bans (server_id, user_id, banned_by, reason)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         banned_by = VALUES(banned_by),
         reason = VALUES(reason),
         created_at = CURRENT_TIMESTAMP`,
      [serverId, targetMember.user_id, bannedBy, reason]
    );

    await connection.execute(
      "DELETE FROM server_members WHERE member_id = ?",
      [memberId]
    );

    await connection.commit();

    return {
      server_id: Number(serverId),
      user_id: Number(targetMember.user_id)
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const unbanServerUser = async (serverId, userId) => {
  const [result] = await pool.execute(
    `DELETE FROM server_bans
     WHERE server_id = ? AND user_id = ?`,
    [serverId, userId]
  );

  return result;
};

const setServerMemberRole = async (serverId, memberId, roleName) => {
  const normalizedRoleName = normalizeRoleName(roleName);

  if (!MANAGED_SERVER_ROLES.includes(normalizedRoleName)) {
    throw new Error("Only admin or member roles can be assigned here.");
  }

  const [targetRows] = await pool.execute(
    `SELECT sm.member_id, sm.server_id, sm.user_id, s.owner_id
     FROM server_members sm
     JOIN servers s ON sm.server_id = s.server_id
     WHERE sm.server_id = ? AND sm.member_id = ?
     LIMIT 1`,
    [serverId, memberId]
  );

  const targetMember = targetRows[0];

  if (!targetMember) {
    const notFoundError = new Error("Server member not found.");
    notFoundError.statusCode = 404;
    throw notFoundError;
  }

  if (String(targetMember.owner_id) === String(targetMember.user_id)) {
    const ownerError = new Error("The server owner's role cannot be changed.");
    ownerError.statusCode = 400;
    throw ownerError;
  }

  await pool.execute(
    `UPDATE server_members
     SET server_role = ?
     WHERE server_id = ? AND member_id = ?`,
    [normalizedRoleName, serverId, memberId]
  );

  return getServerMemberByMemberId(memberId);
};

module.exports = {
  addServerMember,
  getMembersByServerId,
  getServerIdsByUserId,
  getServerMemberByMemberId,
  isUserMemberOfServer,
  removeServerMember,
  removeServerMemberByMemberId,
  getServerBans,
  isUserBannedFromServer,
  banServerMember,
  unbanServerUser,
  setServerMemberRole
};
