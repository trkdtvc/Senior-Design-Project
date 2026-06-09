const express = require("express");
const router = express.Router();
const notificationSettingsController = require("../controllers/notificationSettingsController");
const { protect } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   - name: Notification Settings
 *     description: Notification mute settings for servers, channels, and direct messages
 */

/**
 * @swagger
 * /api/notification-settings:
 *   get:
 *     summary: Get the authenticated user's notification mute settings
 *     tags: [Notification Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification settings fetched successfully
 *       401:
 *         description: Not authorized
 */
router.get("/", protect, notificationSettingsController.getNotificationSettings);

/**
 * @swagger
 * /api/notification-settings/servers/{serverId}:
 *   patch:
 *     summary: Mute or unmute a server
 *     tags: [Notification Settings]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  "/servers/:serverId",
  protect,
  notificationSettingsController.setServerMute
);

/**
 * @swagger
 * /api/notification-settings/channels/{channelId}:
 *   patch:
 *     summary: Mute or unmute a channel
 *     tags: [Notification Settings]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  "/channels/:channelId",
  protect,
  notificationSettingsController.setChannelMute
);

/**
 * @swagger
 * /api/notification-settings/direct-conversations/{conversationId}:
 *   patch:
 *     summary: Mute or unmute a direct message conversation
 *     tags: [Notification Settings]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  "/direct-conversations/:conversationId",
  protect,
  notificationSettingsController.setDirectConversationMute
);

module.exports = router;
