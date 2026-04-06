const crypto = require("crypto");
const {
  createServerInvite,
  getInviteByCode,
  getActiveInvitesByServerId,
  isInviteCodeInUse,
  deactivateInvite,
} = require("../models/serverInviteModel")

const {
  isUserMemberOfServer,
  addServerMember
} = require("../models/serverMemberModel");

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
    const { expires_in_days } = req.body;

    const isMember = await isUserMemberOfServer(serverId, userId);

    if (!isMember) {
      res.status(403);
      throw new Error("Access denied. You are not a member of this server.");
    }

    let expiresAt = null;

    if (expires_in_days) {
      const parsedDays = Number(expires_in_days);

      if (Number.isNaN(parsedDays) || parsedDays <= 0) {
        res.status(400);
        throw new Error("expires_in_days must be a positive number.");
      }

      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + parsedDays);
      expiresAt = expirationDate;
    }

    const inviteCode = await generateInviteCode();

    await createServerInvite(serverId, userId, inviteCode, expiresAt);

    res.status(201).json({
      message: "Invite created successfully.",
      invite_code: inviteCode,
      expires_at: expiresAt
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