const express = require("express");
const router = express.Router();
const {
  getOrCreateDirectConversation,
  getMyDirectConversations,
  getDirectMessages,
  sendDirectMessageToConversation,
  deleteDirectConversationForMe
} = require("../controllers/directMessageController");
const { protect } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   - name: Direct Messages
 *     description: Direct message management routes
 */

/**
 * @swagger
 * /api/direct-messages/conversations:
 *   post:
 *     summary: Create or get a direct conversation with a friend
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - friendId
 *             properties:
 *               friendId:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       200:
 *         description: Direct conversation already exists
 *       201:
 *         description: Direct conversation created successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Users are not confirmed friends
 *       404:
 *         description: Friend user not found
 */
router.post("/conversations", protect, getOrCreateDirectConversation);

/**
 * @swagger
 * /api/direct-messages/conversations:
 *   get:
 *     summary: Get all direct conversations for the authenticated user
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Direct conversations fetched successfully
 */
router.get("/conversations", protect, getMyDirectConversations);

/**
 * @swagger
 * /api/direct-messages/conversations/{conversationId}/messages:
 *   get:
 *     summary: Get all messages for a direct conversation
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Direct messages fetched successfully
 *       403:
 *         description: User is not part of the conversation
 *       404:
 *         description: Direct conversation not found
 */
router.get(
  "/conversations/:conversationId/messages",
  protect,
  getDirectMessages
);

/**
 * @swagger
 * /api/direct-messages:
 *   post:
 *     summary: Send a direct message to an existing direct conversation
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conversationId
 *               - content
 *             properties:
 *               conversationId:
 *                 type: integer
 *                 example: 1
 *               content:
 *                 type: string
 *                 example: Hello bro
 *     responses:
 *       201:
 *         description: Direct message sent successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: User is not part of the conversation
 *       404:
 *         description: Direct conversation not found
 */
router.post("/", protect, sendDirectMessageToConversation);

router.delete(
  "/conversations/:conversationId",
  protect,
  deleteDirectConversationForMe
);

module.exports = router;