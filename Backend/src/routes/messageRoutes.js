const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const { protect } = require("../middleware/authMiddleware");
const {
  cleanupUncommittedUpload,
  uploadMessageAttachment,
  validateMessageAttachmentContents
} = require("../middleware/uploadMiddleware");

/**
 * @swagger
 * tags:
 *   - name: Messages
 *     description: Message management routes
 */

/**
 * @swagger
 * /api/messages:
 *   post:
 *     summary: Create a new message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - channel_id
 *             properties:
 *               channel_id:
 *                 type: integer
 *                 example: 1
 *               content:
 *                 type: string
 *                 example: Hello everyone
 *               reply_to_message_id:
 *                 type: integer
 *                 nullable: true
 *                 example: 5
 *               attachment:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Message created successfully
 *       400:
 *         description: Missing required fields or invalid reply target
 *       401:
 *         description: Not authorized
 *       403:
 *         description: You are not a member of this server
 *       404:
 *         description: Reply target message not found
 */
router.post(
  "/",
  protect,
  uploadMessageAttachment.single("attachment"),
  cleanupUncommittedUpload,
  validateMessageAttachmentContents,
  messageController.createMessage
);

/**
 * @swagger
 * /api/messages/unread-counts:
 *   get:
 *     summary: Get unread channel and server message counts for the authenticated user
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread channel and server counts fetched successfully
 *       401:
 *         description: Not authorized
 */
router.get("/unread-counts", protect, messageController.getUnreadChannelCounts);

/**
 * @swagger
 * /api/messages/mention-counts:
 *   get:
 *     summary: Get unread mention counts for the authenticated user
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread mention counts fetched successfully
 *       401:
 *         description: Not authorized
 */
router.get("/mention-counts", protect, messageController.getUnreadMentionCounts);

/**
 * @swagger
 * /api/messages/{channelId}/read:
 *   patch:
 *     summary: Mark a channel as read for the authenticated user
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the channel
 *     responses:
 *       200:
 *         description: Channel marked as read
 *       401:
 *         description: Not authorized
 *       403:
 *         description: You are not a member of this channel's server
 */
router.patch("/:channelId/read", protect, messageController.markChannelAsRead);

/**
 * @swagger
 * /api/messages/search/{channelId}:
 *   get:
 *     summary: Search messages inside a channel
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the channel
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: The search term
 *     responses:
 *       200:
 *         description: Matching channel messages returned successfully
 *       400:
 *         description: Search term is required
 *       401:
 *         description: Not authorized
 *       403:
 *         description: You are not a member of this server
 */
router.get(
  "/search/:channelId",
  protect,
  messageController.searchChannelMessages
);

/**
 * @swagger
 * /api/messages/{channelId}/pins:
 *   get:
 *     summary: Get pinned messages for a channel
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/:channelId/pins",
  protect,
  messageController.getPinnedChannelMessages
);

/**
 * @swagger
 * /api/messages/{messageId}/reactions:
 *   post:
 *     summary: Toggle a reaction on a channel message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/:messageId/reactions",
  protect,
  messageController.toggleMessageReaction
);

/**
 * @swagger
 * /api/messages/{messageId}/pin:
 *   patch:
 *     summary: Pin a channel message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */
router.patch("/:messageId/pin", protect, messageController.pinMessage);

/**
 * @swagger
 * /api/messages/{messageId}/pin:
 *   delete:
 *     summary: Unpin a channel message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */
router.delete("/:messageId/pin", protect, messageController.unpinMessage);

/**
 * @swagger
 * /api/messages/{channelId}:
 *   get:
 *     summary: Get all messages for a channel
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the channel
 *     responses:
 *       200:
 *         description: Channel messages returned successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: You are not a member of this server
 */
router.get("/:channelId", protect, messageController.getChannelMessages);

/**
 * @swagger
 * /api/messages/{messageId}:
 *   put:
 *     summary: Edit your own message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the message
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
 *                 example: Edited message content
 *     responses:
 *       200:
 *         description: Message updated successfully
 *       400:
 *         description: Message content is required
 *       401:
 *         description: Not authorized
 *       403:
 *         description: You can only edit your own messages
 *       404:
 *         description: Message not found
 */
router.put("/:messageId", protect, messageController.updateMessage);

/**
 * @swagger
 * /api/messages/{messageId}:
 *   delete:
 *     summary: Delete your own message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the message
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: You can only delete your own messages
 *       404:
 *         description: Message not found
 */
router.delete("/:messageId", protect, messageController.deleteMessage);

module.exports = router;
