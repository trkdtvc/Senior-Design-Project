const express = require("express");
const router = express.Router();
const {
  getOrCreateDirectConversation,
  getMyDirectConversations,
  getDirectMessages,
  sendDirectMessageToConversation,
  updateDirectMessage,
  deleteDirectMessage,
  toggleDirectReaction,
  pinDirectMessage,
  unpinDirectMessage,
  getPinnedDirectMessages,
  deleteDirectConversationForMe,
  markDirectConversationRead,
  getUnreadDirectConversationCounts
} = require("../controllers/directMessageController");
const { protect } = require("../middleware/authMiddleware");
const { uploadMessageAttachment } = require("../middleware/uploadMiddleware");
const {
  isUserInConversation,
  searchDirectMessagesByConversationId
} = require("../models/directMessageModel");

/**
 * @swagger
 * tags:
 *   - name: Direct Messages
 *     description: Direct message management routes
 */

/**
 * @swagger
 * /api/direct-messages/unread-counts:
 *   get:
 *     summary: Get unread direct conversation counts for the authenticated user
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread direct conversation counts fetched successfully
 *       401:
 *         description: Not authorized
 */
router.get("/unread-counts", protect, getUnreadDirectConversationCounts);

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
 * /api/direct-messages/conversations/{conversationId}/search:
 *   get:
 *     summary: Search messages inside a direct conversation
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the direct conversation
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Search term used to find matching direct messages
 *     responses:
 *       200:
 *         description: Matching direct messages fetched successfully
 *       400:
 *         description: Search term is required
 *       401:
 *         description: Not authorized
 *       403:
 *         description: User is not part of the conversation
 *       500:
 *         description: Server error
 */
router.get(
  "/conversations/:conversationId/search",
  protect,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.user_id || req.user?.id;
      const searchTerm = String(
        req.query.query || req.query.searchTerm || req.query.q || ""
      ).trim();

      if (searchTerm.length < 2) {
        return res.status(400).json({
          message: "Search term must be at least 2 characters."
        });
      }

      const isMember = await isUserInConversation(conversationId, userId);

      if (!isMember) {
        return res.status(403).json({
          message: "You are not allowed to search this conversation."
        });
      }

      const matches = await searchDirectMessagesByConversationId(
        conversationId,
        userId,
        searchTerm
      );

      return res.status(200).json({
        message: "Direct message matches fetched successfully",
        query: searchTerm,
        total: matches.length,
        matches
      });
    } catch (error) {
      return res.status(500).json({
        message: error.message || "Failed to search direct messages."
      });
    }
  }
);

/**
 * @swagger
 * /api/direct-messages/conversations/{conversationId}/pins:
 *   get:
 *     summary: Get pinned messages for a direct conversation
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/conversations/:conversationId/pins",
  protect,
  getPinnedDirectMessages
);

/**
 * @swagger
 * /api/direct-messages/conversations/{conversationId}/read:
 *   patch:
 *     summary: Mark a direct conversation as read for the authenticated user
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the direct conversation
 *     responses:
 *       200:
 *         description: Direct conversation marked as read
 *       401:
 *         description: Not authorized
 *       403:
 *         description: User is not part of the conversation
 *       404:
 *         description: Direct conversation not found
 */
router.patch(
  "/conversations/:conversationId/read",
  protect,
  markDirectConversationRead
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
 * /api/direct-messages/messages/{directMessageId}/reactions:
 *   post:
 *     summary: Toggle a reaction on a direct message
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/messages/:directMessageId/reactions",
  protect,
  toggleDirectReaction
);

/**
 * @swagger
 * /api/direct-messages/messages/{directMessageId}/pin:
 *   patch:
 *     summary: Pin a direct message
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  "/messages/:directMessageId/pin",
  protect,
  pinDirectMessage
);

/**
 * @swagger
 * /api/direct-messages/messages/{directMessageId}/pin:
 *   delete:
 *     summary: Unpin a direct message
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  "/messages/:directMessageId/pin",
  protect,
  unpinDirectMessage
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