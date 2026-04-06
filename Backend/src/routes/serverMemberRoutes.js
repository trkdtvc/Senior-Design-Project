const express = require("express");
const router = express.Router();
const { getServerMembers } = require("../controllers/serverMemberController");
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

module.exports = router;