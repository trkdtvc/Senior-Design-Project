const express = require("express");
const router = express.Router();
const serverMemberController = require("../controllers/serverMemberController");
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
 *         description: The ID of the server
 *     responses:
 *       200:
 *         description: Server members returned successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: You are not a member of this server
 */
router.get("/:serverId", protect, serverMemberController.getServerMembers);

module.exports = router;