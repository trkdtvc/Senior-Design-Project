const userSafetyModel = require("../models/userSafetyModel");

const normalizeReason = (reason) => String(reason || "").trim().slice(0, 1000);

const getBlockedUsers = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const blockedUsers = await userSafetyModel.getBlockedUsersByUserId(userId);

    res.status(200).json({
      message: "Blocked users fetched successfully",
      blockedUsers
    });
  } catch (error) {
    next(error);
  }
};

const blockUser = async (req, res, next) => {
  try {
    const blockerId = req.user.user_id;
    const blockedId = Number(req.params.userId || req.body?.userId);

    if (!blockedId) {
      res.status(400);
      throw new Error("User ID is required");
    }

    if (Number(blockerId) === Number(blockedId)) {
      res.status(400);
      throw new Error("You cannot block yourself");
    }

    const blockedUser = await userSafetyModel.getUserById(blockedId);

    if (!blockedUser) {
      res.status(404);
      throw new Error("User not found");
    }

    await userSafetyModel.createUserBlock(blockerId, blockedId);

    const blockedUsers = await userSafetyModel.getBlockedUsersByUserId(blockerId);
    const io = req.app.get("io");

    if (io) {
      io.to(`user_${blockerId}`).emit("user_blocked", {
        blocker_id: Number(blockerId),
        blocked_id: Number(blockedId)
      });
      io.to(`user_${blockedId}`).emit("user_blocked", {
        blocker_id: Number(blockerId),
        blocked_id: Number(blockedId)
      });
    }

    res.status(200).json({
      message: "User blocked successfully",
      blockedUser,
      blockedUsers
    });
  } catch (error) {
    next(error);
  }
};

const unblockUser = async (req, res, next) => {
  try {
    const blockerId = req.user.user_id;
    const blockedId = Number(req.params.userId);

    if (!blockedId) {
      res.status(400);
      throw new Error("User ID is required");
    }

    await userSafetyModel.deleteUserBlock(blockerId, blockedId);

    const blockedUsers = await userSafetyModel.getBlockedUsersByUserId(blockerId);

    res.status(200).json({
      message: "User unblocked successfully",
      blockedUsers
    });
  } catch (error) {
    next(error);
  }
};

const reportUser = async (req, res, next) => {
  try {
    const reporterId = req.user.user_id;
    const reportedUserId = Number(req.params.userId || req.body?.userId);
    const reason = normalizeReason(req.body?.reason);
    const contextType = String(req.body?.context_type || req.body?.contextType || "profile")
      .trim()
      .slice(0, 50);
    const contextId = req.body?.context_id || req.body?.contextId || null;

    if (!reportedUserId) {
      res.status(400);
      throw new Error("Reported user ID is required");
    }

    if (Number(reporterId) === Number(reportedUserId)) {
      res.status(400);
      throw new Error("You cannot report yourself");
    }

    if (!reason) {
      res.status(400);
      throw new Error("Report reason is required");
    }

    const reportedUser = await userSafetyModel.getUserById(reportedUserId);

    if (!reportedUser) {
      res.status(404);
      throw new Error("User not found");
    }

    const result = await userSafetyModel.createUserReport({
      reporterId,
      reportedUserId,
      reason,
      contextType,
      contextId
    });

    res.status(201).json({
      message: "Report submitted successfully",
      report_id: result.insertId
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
