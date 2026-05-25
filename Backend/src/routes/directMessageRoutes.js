const express = require("express");
const router = express.Router();
const {
  getOrCreateDirectConversation,
  getMyDirectConversations,
  getDirectMessages,
  sendDirectMessageToConversation,
  updateDirectMessage,
  deleteDirectMessage,
  deleteDirectConversationForMe
} = require("../controllers/directMessageController");
const { protect } = require("../middleware/authMiddleware");
const { uploadMessageAttachment } = require("../middleware/uploadMiddleware");

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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - conversationId
 *             properties:
 *               conversationId:
 *                 type: integer
 *                 example: 1
 *               content:
 *                 type: string
 *                 example: Hello bro
 *               reply_to_direct_message_id:
 *                 type: integer
 *                 nullable: true
 *                 example: 5
 *               attachment:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Direct message sent successfully
 *       400:
 *         description: Invalid input or invalid reply target
 *       401:
 *         description: Not authorized
 *       403:
 *         description: User is not part of the conversation
 *       404:
 *         description: Direct conversation or reply target message not found
 */
router.post(
  "/",
  protect,
  uploadMessageAttachment.single("attachment"),
  sendDirectMessageToConversation
);

/**
 * @swagger
 * /api/direct-messages/messages/{directMessageId}:
 *   put:
 *     summary: Edit your own direct message
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: directMessageId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the direct message
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 example: Edited direct message content
 *     responses:
 *       200:
 *         description: Direct message updated successfully
 *       400:
 *         description: Message content is required
 *       401:
 *         description: Not authorized
 *       403:
 *         description: You can only edit your own direct messages
 *       404:
 *         description: Direct message not found
 */
router.put(
  "/messages/:directMessageId",
  protect,
  updateDirectMessage
);

/**
 * @swagger
 * /api/direct-messages/messages/{directMessageId}:
 *   delete:
 *     summary: Delete your own direct message
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  "/messages/:directMessageId",
  protect,
  deleteDirectMessage
);

/**
 * @swagger
 * /api/direct-messages/conversations/{conversationId}:
 *   delete:
 *     summary: Delete a direct conversation for the authenticated user only
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  "/conversations/:conversationId",
  protect,
  deleteDirectConversationForMe
);

module.exports = router;