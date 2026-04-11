const friendRequestModel = require("../models/friendRequestModel");

const sendFriendRequest = async (req, res, next) => {
  try {
    const senderId = req.user.user_id;
    const { username, email, target } = req.body || {};
    const lookupValue = username || email || target;

    if (!lookupValue) {
      res.status(400);
      throw new Error("Username or email is required");
    }

    const receiver = await friendRequestModel.findUserByUsernameOrEmail(
      lookupValue
    );

    if (!receiver) {
      res.status(404);
      throw new Error("User not found");
    }

    if (Number(receiver.user_id) === Number(senderId)) {
      res.status(400);
      throw new Error("You cannot send a friend request to yourself");
    }

    const existingFriendship =
      await friendRequestModel.getFriendshipBetweenUsers(
        senderId,
        receiver.user_id
      );

    if (existingFriendship) {
      res.status(400);
      throw new Error("You are already friends with this user");
    }

    const existingPendingRequest =
      await friendRequestModel.getPendingFriendRequestBetweenUsers(
        senderId,
        receiver.user_id
      );

    if (existingPendingRequest) {
      res.status(400);
      throw new Error("A pending friend request already exists between these users");
    }

    const result = await friendRequestModel.createFriendRequest(
      senderId,
      receiver.user_id
    );

    res.status(201).json({
      message: "Friend request sent successfully",
      request_id: result.insertId
    });
  } catch (error) {
    next(error);
  }
};

const getIncomingFriendRequests = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const requests =
      await friendRequestModel.getIncomingPendingRequestsByUserId(userId);

    res.status(200).json(requests);
  } catch (error) {
    next(error);
  }
};

const getOutgoingFriendRequests = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const requests =
      await friendRequestModel.getOutgoingPendingRequestsByUserId(userId);

    res.status(200).json(requests);
  } catch (error) {
    next(error);
  }
};

const acceptFriendRequest = async (req, res, next) => {
  try {
    const requestId = Number(req.params.requestId);
    const userId = req.user.user_id;

    const request = await friendRequestModel.getFriendRequestById(requestId);

    if (!request) {
      res.status(404);
      throw new Error("Friend request not found");
    }

    if (request.status !== "pending") {
      res.status(400);
      throw new Error("This friend request has already been responded to");
    }

    if (Number(request.receiver_id) !== Number(userId)) {
      res.status(403);
      throw new Error("Only the receiver can accept this friend request");
    }

    const existingFriendship =
      await friendRequestModel.getFriendshipBetweenUsers(
        request.sender_id,
        request.receiver_id
      );

    if (!existingFriendship) {
      await friendRequestModel.createFriendship(
        request.sender_id,
        request.receiver_id
      );
    }

    await friendRequestModel.updateFriendRequestStatus(requestId, "accepted");

    res.status(200).json({
      message: "Friend request accepted successfully"
    });
  } catch (error) {
    next(error);
  }
};

const rejectFriendRequest = async (req, res, next) => {
  try {
    const requestId = Number(req.params.requestId);
    const userId = req.user.user_id;

    const request = await friendRequestModel.getFriendRequestById(requestId);

    if (!request) {
      res.status(404);
      throw new Error("Friend request not found");
    }

    if (request.status !== "pending") {
      res.status(400);
      throw new Error("This friend request has already been responded to");
    }

    if (Number(request.receiver_id) !== Number(userId)) {
      res.status(403);
      throw new Error("Only the receiver can reject this friend request");
    }

    await friendRequestModel.updateFriendRequestStatus(requestId, "rejected");

    res.status(200).json({
      message: "Friend request rejected successfully"
    });
  } catch (error) {
    next(error);
  }
};

const getFriends = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const friends = await friendRequestModel.getFriendsByUserId(userId);

    res.status(200).json(friends);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendFriendRequest,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriends
};