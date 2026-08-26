const { pool } = require("../config/db");

const SERVER_ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member"
};

const normalizeRoleName = (roleName) =>
  String(roleName || "")
    .trim()
    .toLowerCase();

const getServerPermissionContext = async (serverId, userId) => {
  const [rows] = await pool.execute(
    `SELECT
        s.server_id,
        s.owner_id,
        sm.member_id,
        sm.server_role
     FROM servers s
     LEFT JOIN server_members sm
       ON sm.server_id = s.server_id
      AND sm.user_id = ?
     WHERE s.server_id = ?
     LIMIT 1`,
    [userId, serverId]
  );

  const row = rows[0];

  if (!row) {
    return {
      serverExists: false,
      isMember: false,
      memberId: null,
      role: null
    };
  }

  const isOwner = String(row.owner_id) === String(userId);
  const isMember = Boolean(row.member_id) || isOwner;
  const storedRole = normalizeRoleName(row.server_role);
  let role = null;

  if (isOwner) {
    role = SERVER_ROLES.OWNER;
  } else if (isMember && storedRole === SERVER_ROLES.ADMIN) {
    role = SERVER_ROLES.ADMIN;
  } else if (isMember) {
    role = SERVER_ROLES.MEMBER;
  }

  return {
    serverExists: true,
    isMember,
    memberId: row.member_id || null,
    role
  };
};

const hasServerRole = async (serverId, userId, allowedRoles = []) => {
  const context = await getServerPermissionContext(serverId, userId);
  const normalizedAllowedRoles = allowedRoles.map(normalizeRoleName);

  return {
    ...context,
    allowed: Boolean(context.role && normalizedAllowedRoles.includes(context.role))
  };
};

const canManageServerContent = async (serverId, userId) =>
  hasServerRole(serverId, userId, [SERVER_ROLES.OWNER, SERVER_ROLES.ADMIN]);

const canManageServerRoles = async (serverId, userId) =>
  hasServerRole(serverId, userId, [SERVER_ROLES.OWNER]);

module.exports = {
  SERVER_ROLES,
  normalizeRoleName,
  getServerPermissionContext,
  hasServerRole,
  canManageServerContent,
  canManageServerRoles
};
