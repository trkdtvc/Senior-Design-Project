const { pool } = require("../config/db");
const { normalizeRoleName } = require("./permissionModel");

const MANAGED_SERVER_ROLES = ["admin", "member"];

const addServerMember = async (serverId, userId) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [memberResult] = await connection.execute(
      "INSERT INTO server_members (server_id, user_id) VALUES (?, ?)",
      [serverId, userId]
    );

    const memberId = memberResult.insertId;

    const [roleRows] = await connection.execute(
      "SELECT role_id FROM roles WHERE server_id = ? AND LOWER(role_name) = ? LIMIT 1",
      [serverId, "member"]
    );

    let memberRoleId = roleRows[0]?.role_id;

    if (!memberRoleId) {
      const [roleResult] = await connection.execute(
        "INSERT INTO roles (server_id, role_name) VALUES (?, ?)",
        [serverId, "member"]
      );

      memberRoleId = roleResult.insertId;
    }

    await connection.execute(
      "INSERT IGNORE INTO member_roles (member_id, role_id) VALUES (?, ?)",
      [memberId, memberRoleId]
    );

    await connection.commit();

    return memberResult;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getMembersByServerId = async (serverId) => {
  const [rows] = await pool.execute(
    `SELECT
      sm.member_id,
      sm.server_id,
      sm.user_id,
      sm.joined_at,
      u.username,
      u.email,
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
        WHEN SUM(CASE WHEN LOWER(r.role_name) = 'admin' THEN 1 ELSE 0 END) > 0 THEN 'admin'
        ELSE 'member'
      END AS server_role,
      GROUP_CONCAT(DISTINCT r.role_name ORDER BY r.role_name SEPARATOR ',') AS role_names
     FROM server_members sm
     JOIN users u ON sm.user_id = u.user_id
     JOIN servers s ON sm.server_id = s.server_id
     LEFT JOIN member_roles mr ON sm.member_id = mr.member_id
     LEFT JOIN roles r ON mr.role_id = r.role_id
     WHERE sm.server_id = ?
     GROUP BY
      sm.member_id,
      sm.server_id,
      sm.user_id,
      sm.joined_at,
      u.username,
      u.email,
      u.last_seen_at,
      u.is_online,
      s.owner_id
     ORDER BY is_owner DESC, server_role ASC, u.username ASC`,
    [serverId]
  );

  return rows.map((member) => ({
    ...member,
    roles: String(member.role_names || "")
      .split(",")
      .map((roleName) => roleName.trim())
      .filter(Boolean)
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
        sm.joined_at,
        u.username,
        u.email,
        s.owner_id,
        CASE WHEN s.owner_id = sm.user_id THEN 1 ELSE 0 END AS is_owner,
        CASE
          WHEN s.owner_id = sm.user_id THEN 'owner'
          WHEN SUM(CASE WHEN LOWER(r.role_name) = 'admin' THEN 1 ELSE 0 END) > 0 THEN 'admin'
          ELSE 'member'
        END AS server_role
     FROM server_members sm
     JOIN users u ON sm.user_id = u.user_id
     JOIN servers s ON sm.server_id = s.server_id
     LEFT JOIN member_roles mr ON sm.member_id = mr.member_id
     LEFT JOIN roles r ON mr.role_id = r.role_id
     WHERE sm.member_id = ?
     GROUP BY
      sm.member_id,
      sm.server_id,
      sm.user_id,
      sm.joined_at,
      u.username,
      u.email,
      s.owner_id
     LIMIT 1`,
    [memberId]
  );

  return rows[0] || null;
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

const getOrCreateServerRole = async (serverId, roleName, connection = pool) => {
  const normalizedRoleName = normalizeRoleName(roleName);

  const [existingRoles] = await connection.execute(
    "SELECT role_id, role_name FROM roles WHERE server_id = ? AND LOWER(role_name) = ? LIMIT 1",
    [serverId, normalizedRoleName]
  );

  if (existingRoles[0]) {
    return existingRoles[0];
  }

  const [result] = await connection.execute(
    "INSERT INTO roles (server_id, role_name) VALUES (?, ?)",
    [serverId, normalizedRoleName]
  );

  return {
    role_id: result.insertId,
    role_name: normalizedRoleName
  };
};

const setServerMemberRole = async (serverId, memberId, roleName) => {
  const normalizedRoleName = normalizeRoleName(roleName);

  if (!MANAGED_SERVER_ROLES.includes(normalizedRoleName)) {
    throw new Error("Only admin or member roles can be assigned here.");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [targetRows] = await connection.execute(
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

    await connection.execute(
      `DELETE mr
       FROM member_roles mr
       JOIN roles r ON mr.role_id = r.role_id
       WHERE mr.member_id = ?
         AND r.server_id = ?
         AND LOWER(r.role_name) IN ('admin', 'member')`,
      [memberId, serverId]
    );

    const targetRole = await getOrCreateServerRole(
      serverId,
      normalizedRoleName,
      connection
    );

    await connection.execute(
      "INSERT IGNORE INTO member_roles (member_id, role_id) VALUES (?, ?)",
      [memberId, targetRole.role_id]
    );

    await connection.commit();

    return getServerMemberByMemberId(memberId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  addServerMember,
  getMembersByServerId,
  getServerIdsByUserId,
  getServerMemberByMemberId,
  isUserMemberOfServer,
  removeServerMember,
  removeServerMemberByMemberId,
  getOrCreateServerRole,
  setServerMemberRole
};
