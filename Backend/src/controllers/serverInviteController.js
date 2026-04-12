const crypto = require("crypto");
const {
  createServerInvite,
  getInviteByCode,
  getActiveInvitesByServerId,
  isInviteCodeInUse,
  deactivateInvite,
  deactivateInvitesByServerId,
  deactivateExpiredInvitesByServerId
} = require("../models/serverInviteModel");

const {
  isUserMemberOfServer,
  addServerMember
} = require("../models/serverMemberModel");

const INVITE_DURATION_MINUTES = 10;

const generateInviteCode = async () => {
  let inviteCode = "";
  let codeExists = true;

  while (codeExists) {
    inviteCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    codeExists = await isInviteCodeInUse(inviteCode);
  }

  return inviteCode;
};

const createInvite = async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const userId = req.user.user_id;

    const isMember = await isUserMemberOfServer(serverId, userId);

    if (!isMember) {
      res.status(403);
      throw new Error("Access denied. You are not a member of this server.");
    }

    const expiresAt = new Date(
      Date.now() + INVITE_DURATION_MINUTES * 60 * 1000
    );

    await deactivateInvitesByServerId(serverId);

    const inviteCode = await generateInviteCode();

    await createServerInvite(serverId, userId, inviteCode, expiresAt);

    res.status(201).json({
      message: `Invite created successfully. It will expire in ${INVITE_DURATION_MINUTES} minutes.`,
      invite_code: inviteCode,
      expires_at: expiresAt,
      expires_in_minutes: INVITE_DURATION_MINUTES
    });
  } catch (error) {
    next(error);
  }
};

const getServerInvites = async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const userId = req.user.user_id;

    const isMember = await isUserMemberOfServer(serverId, userId);

    if (!isMember) {
      res.status(403);
      throw new Error("Access denied. You are not a member of this server.");
    }

    await deactivateExpiredInvitesByServerId(serverId);

    const invites = await getActiveInvitesByServerId(serverId);

    res.status(200).json(invites);
  } catch (error) {
    next(error);
  }
};

const joinServerByInvite = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const inviteCode = req.body.invite_code?.trim();

    if (!inviteCode) {
      res.status(400);
      throw new Error("Invite code is required.");
    }

    const invite = await getInviteByCode(inviteCode);

    if (!invite) {
      res.status(404);
      throw new Error("Invite not found.");
    }

    if (!invite.is_active) {
      res.status(400);
      throw new Error("This invite is no longer active.");
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await deactivateInvite(invite.invite_id);
      res.status(400);
      throw new Error("This invite has expired.");
    }

    const isAlreadyMember = await isUserMemberOfServer(invite.server_id, userId);

    if (isAlreadyMember) {
      res.status(400);
      throw new Error("You are already a member of this server.");
    }

    await addServerMember(invite.server_id, userId);

    res.status(200).json({
      message: "Joined server successfully.",
      server_id: invite.server_id,
      server_name: invite.server_name
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createInvite,
  getServerInvites,
  joinServerByInvite
};