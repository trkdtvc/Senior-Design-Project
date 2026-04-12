const express = require("express");
const router = express.Router();
const {
  createInvite,
  getServerInvites,
  joinServerByInvite
} = require("../controllers/serverInviteController");
const { protect } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   - name: Server Invites
 *     description: Server invite management routes
 */

/**
 * @swagger
 * /api/server-invites/join:
 *   post:
 *     summary: Join a server using an invite code
 *     tags: [Server Invites]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invite_code
 *             properties:
 *               invite_code:
 *                 type: string
 *                 example: A1B2C3D4
 *     responses:
 *       200:
 *         description: Joined server successfully
 *       400:
 *         description: Invalid or expired invite
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Invite not found
 */
router.post("/join", protect, joinServerByInvite);

/**
 * @swagger
 * /api/server-invites/{serverId}:
 *   post:
 *     summary: Create a new invite for a server
 *     description: Creates one active invite that always expires after 10 minutes. Creating a new invite deactivates any previous active invite for that server.
 *     tags: [Server Invites]
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
 *       201:
 *         description: Invite created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *
 *   get:
 *     summary: Get active invites for a server
 *     tags: [Server Invites]
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
 *         description: Active invites fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
router.post("/:serverId", protect, createInvite);
router.get("/:serverId", protect, getServerInvites);

module.exports = router;