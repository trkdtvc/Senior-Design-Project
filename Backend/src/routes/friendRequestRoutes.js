const express = require("express");
const router = express.Router();
const friendRequestController = require("../controllers/friendRequestController");
const { protect } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   - name: Friends
 *     description: Friend requests and friendships
 */

/**
 * @swagger
 * /api/friends/requests:
 *   post:
 *     summary: Send a friend request by username or email
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: tarik
 *               email:
 *                 type: string
 *                 example: tarik@example.com
 *               target:
 *                 type: string
 *                 example: tarik
 *     responses:
 *       201:
 *         description: Friend request sent successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authorized
 *       404:
 *         description: User not found
 */
router.post("/requests", protect, friendRequestController.sendFriendRequest);

/**
 * @swagger
 * /api/friends/requests/incoming:
 *   get:
 *     summary: Get incoming pending friend requests
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Incoming friend requests returned successfully
 *       401:
 *         description: Not authorized
 */
router.get(
  "/requests/incoming",
  protect,
  friendRequestController.getIncomingFriendRequests
);

/**
 * @swagger
 * /api/friends/requests/outgoing:
 *   get:
 *     summary: Get outgoing pending friend requests
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Outgoing friend requests returned successfully
 *       401:
 *         description: Not authorized
 */
router.get(
  "/requests/outgoing",
  protect,
  friendRequestController.getOutgoingFriendRequests
);

/**
 * @swagger
 * /api/friends/requests/{requestId}/accept:
 *   patch:
 *     summary: Accept a friend request
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Friend request accepted successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Friend request not found
 */
router.patch(
  "/requests/:requestId/accept",
  protect,
  friendRequestController.acceptFriendRequest
);

/**
 * @swagger
 * /api/friends/requests/{requestId}/reject:
 *   patch:
 *     summary: Reject a friend request
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Friend request rejected successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Friend request not found
 */
router.patch(
  "/requests/:requestId/reject",
  protect,
  friendRequestController.rejectFriendRequest
);

/**
 * @swagger
 * /api/friends:
 *   get:
 *     summary: Get the authenticated user's friends
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Friends returned successfully
 *       401:
 *         description: Not authorized
 */
router.get("/", protect, friendRequestController.getFriends);

/**
 * @swagger
 * /api/friends/{friendId}:
 *   delete:
 *     summary: Remove a confirmed friend
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: friendId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Friend removed successfully
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Friendship not found
 */
router.delete("/:friendId", protect, friendRequestController.removeFriend);

module.exports = router;