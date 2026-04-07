const express = require("express");
const router = express.Router();
const {
  getServerMembers,
  leaveServer
} = require("../controllers/serverMemberController");
const { protect } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   - name: Server Members
 *     description: Server member management routes
 */

/**
 * @swagger
 * /api/server-members/{serverId}:
 *   get:
 *     summary: Get all members of a server
 *     tags: [Server Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Server ID
 *     responses:
 *       200:
 *         description: Server members fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
router.get("/:serverId", protect, getServerMembers);

/**
 * @swagger
 * /api/server-members/{serverId}/leave:
 *   delete:
 *     summary: Leave a server
 *     tags: [Server Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Server ID
 *     responses:
 *       200:
 *         description: Left server successfully
 *       400:
 *         description: Server owner cannot leave their own server
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Server or membership not found
 */
router.delete("/:serverId/leave", protect, leaveServer);

module.exports = router;