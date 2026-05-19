const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const { protect } = require("../middleware/authMiddleware");
const { uploadMessageAttachment } = require("../middleware/uploadMiddleware");

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
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channel_id
 *               - content
 *             properties:
 *               channel_id:
 *                 type: integer
 *                 example: 1
 *               content:
 *                 type: string
 *                 example: Hello everyone
 *     responses:
 *       201:
 *         description: Message created successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Not authorized
 *       403:
 *         description: You are not a member of this server
 */
router.post(
    "/",
    protect,
    uploadMessageAttachment.single("attachment"),
    messageController.createMessage
);

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

module.exports = router;