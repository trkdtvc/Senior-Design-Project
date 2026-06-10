const userSafetyModel = require("../models/userSafetyModel");


const normalizeUserId = (value) => {
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
};


const assertTargetUser = async (currentUserId, targetUserId, res) => {
  if (!targetUserId) {
    res.status(400);
    throw new Error("User ID is required");
  }

  if (Number(targetUserId) === Number(currentUserId)) {
    res.status(400);
    throw new Error("You cannot perform this action on yourself");
  }

  const targetUser = await userSafetyModel.getUserById(targetUserId);

  if (!targetUser) {
    res.status(404);
    throw new Error("User not found");
  }

  return targetUser;
};

const emitBlockUpdated = (req, blockerId, blockedId, block = null) => {
  const io = req.app.get("io");

  if (!io) {
    return;
  }

  io.to(`user_${blockerId}`).emit("user_block_updated", {
    blocker_id: Number(blockerId),
    blocked_id: Number(blockedId),
    blocked: Boolean(block),
    block
  });

  io.to(`user_${blockedId}`).emit("blocked_by_user_updated", {
    blocker_id: Number(blockerId),
    blocked_id: Number(blockedId),
    blocked: Boolean(block)
  });
};

const getBlockedUsers = async (req, res, next) => {
  try {
    const blockedUsers = await userSafetyModel.getBlockedUsersByUserId(
      req.user.user_id
    );

    res.status(200).json({
      message: "Blocked users fetched successfully",
      blocked_users: blockedUsers
    });
  } catch (error) {
    next(error);
  }
};

const blockUser = async (req, res, next) => {
  try {
    const currentUserId = req.user.user_id;
    const targetUserId = normalizeUserId(req.params.userId || req.body.userId);

    await assertTargetUser(currentUserId, targetUserId, res);

    const block = await userSafetyModel.createBlockAndCleanup(
      currentUserId,
      targetUserId
    );

    emitBlockUpdated(req, currentUserId, targetUserId, block);

    res.status(200).json({
      message: "User blocked successfully",
      block
    });
  } catch (error) {
    next(error);
  }
};

const unblockUser = async (req, res, next) => {
  try {
    const currentUserId = req.user.user_id;
    const targetUserId = normalizeUserId(req.params.userId || req.body.userId);

    await assertTargetUser(currentUserId, targetUserId, res);

    await userSafetyModel.deleteBlock(currentUserId, targetUserId);
    emitBlockUpdated(req, currentUserId, targetUserId, null);

    res.status(200).json({
      message: "User unblocked successfully",
      blocked_user_id: Number(targetUserId)
    });
  } catch (error) {
    next(error);
  }
};


module.exports = {
  getBlockedUsers,
  blockUser,
  unblockUser
};
