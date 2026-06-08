const express = require("express");
const router = express.Router();
const notificationSettingsController = require("../controllers/notificationSettingsController");
const { protect } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   - name: Notification Settings
 *     description: User notification mute preferences
 */

/**
 * @swagger
 * /api/notification-settings:
 *   get:
 *     summary: Get notification settings for the authenticated user
 *     tags: [Notification Settings]
 *     security:
 *       - bearerAuth: []
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
router.patch("/servers/:serverId", protect, notificationSettingsController.setServerMute);

/**
 * @swagger
 * /api/notification-settings/channels/{channelId}:
 *   patch:
 *     summary: Mute or unmute a channel
 *     tags: [Notification Settings]
 *     security:
 *       - bearerAuth: []
 */
router.patch("/channels/:channelId", protect, notificationSettingsController.setChannelMute);

/**
 * @swagger
 * /api/notification-settings/direct-conversations/{conversationId}:
 *   patch:
 *     summary: Mute or unmute a direct conversation
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
