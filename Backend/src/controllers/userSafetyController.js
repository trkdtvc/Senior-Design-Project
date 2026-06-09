const userSafetyModel = require("../models/userSafetyModel");

const MAX_REPORT_REASON_LENGTH = 100;
const MAX_REPORT_DETAILS_LENGTH = 1000;

const normalizeUserId = (value) => {
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
};

const normalizeReportReason = (reason) =>
  String(reason || "").trim().slice(0, MAX_REPORT_REASON_LENGTH);

const normalizeReportDetails = (details) => {
  const normalizedDetails = String(details || "").trim();

  if (!normalizedDetails) {
    return null;
  }

  return normalizedDetails.slice(0, MAX_REPORT_DETAILS_LENGTH);
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

const reportUser = async (req, res, next) => {
  try {
    const currentUserId = req.user.user_id;
    const targetUserId = normalizeUserId(req.params.userId || req.body.userId);
    const reason = normalizeReportReason(req.body.reason);
    const details = normalizeReportDetails(req.body.details);

    await assertTargetUser(currentUserId, targetUserId, res);

    if (!reason) {
      res.status(400);
      throw new Error("Report reason is required");
    }

    const report = await userSafetyModel.createUserReport({
      reporterId: currentUserId,
      reportedUserId: targetUserId,
      reason,
      details
    });

    res.status(201).json({
      message: "Report submitted successfully",
      report
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBlockedUsers,
  blockUser,
  unblockUser,
  reportUser
};
