const express = require("express");
const router = express.Router();
const channelController = require("../controllers/channelController");
const { protect } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   - name: Channels
 *     description: Channel management routes
 */

/**
 * @swagger
 * /api/channels:
 *   post:
 *     summary: Create a new channel
 *     tags: [Channels]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - server_id
 *               - channel_name
 *             properties:
 *               server_id:
 *                 type: integer
 *                 example: 1
 *               channel_name:
 *                 type: string
 *                 example: general
 *     responses:
 *       201:
 *         description: Channel created successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Not authorized
 *       403:
 *         description: You are not a member of this server
 */
router.post("/", protect, channelController.createChannel);

/**
 * @swagger
 * /api/channels/{serverId}:
 *   get:
 *     summary: Get all channels for a server
 *     tags: [Channels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the server
 *     responses:
 *       200:
 *         description: Server channels returned successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: You are not a member of this server
 */
router.get("/:serverId", protect, channelController.getServerChannels);

/**
 * @swagger
 * /api/channels/{channelId}:
 *   delete:
 *     summary: Delete a channel
 *     tags: [Channels]
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
 *         description: Channel deleted successfully
 *       400:
 *         description: Invalid delete request
 *       401:
 *         description: Not authorized
 *       403:
 *         description: You are not a member of this server
 *       404:
 *         description: Channel not found
 */
router.delete("/:channelId", protect, channelController.deleteChannel);

module.exports = router;