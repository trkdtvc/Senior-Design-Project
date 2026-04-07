const { pool } = require("../config/db");

const createServerInvite = async (
  serverId,
  createdBy,
  inviteCode,
  expiresAt = null
) => {
  const [result] = await pool.execute(
    `INSERT INTO server_invites (server_id, created_by, invite_code, expires_at, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [serverId, createdBy, inviteCode, expiresAt]
  );

  return result;
};

const getInviteByCode = async (inviteCode) => {
  const [rows] = await pool.execute(
    `SELECT
      si.invite_id,
      si.server_id,
      si.created_by,
      si.invite_code,
      si.expires_at,
      si.is_active,
      si.created_at,
      s.server_name
     FROM server_invites si
     JOIN servers s ON si.server_id = s.server_id
     WHERE si.invite_code = ?
     LIMIT 1`,
    [inviteCode]
  );

  return rows[0];
};

const getActiveInvitesByServerId = async (serverId) => {
  const [rows] = await pool.execute(
    `SELECT
      invite_id,
      server_id,
      created_by,
      invite_code,
      expires_at,
      is_active,
      created_at
     FROM server_invites
     WHERE server_id = ? AND is_active = 1
     ORDER BY created_at DESC`,
    [serverId]
  );

  return rows;
};

const isInviteCodeInUse = async (inviteCode) => {
  const [rows] = await pool.execute(
    "SELECT invite_id FROM server_invites WHERE invite_code = ? LIMIT 1",
    [inviteCode]
  );

  return rows.length > 0;
};

const deactivateInvite = async (inviteId) => {
  const [result] = await pool.execute(
    "UPDATE server_invites SET is_active = 0 WHERE invite_id = ?",
    [inviteId]
  );

  return result;
};

const deactivateInvitesByServerId = async (serverId) => {
  const [result] = await pool.execute(
    "UPDATE server_invites SET is_active = 0 WHERE server_id = ? AND is_active = 1",
    [serverId]
  );

  return result;
};

module.exports = {
  createServerInvite,
  getInviteByCode,
  getActiveInvitesByServerId,
  isInviteCodeInUse,
  deactivateInvite,
  deactivateInvitesByServerId
};