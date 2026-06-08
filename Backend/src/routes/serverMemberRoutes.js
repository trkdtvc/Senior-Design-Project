const express = require("express");
const router = express.Router();
const {
  getServerMembers,
  leaveServer,
  removeMember,
  updateMemberRole
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

/**
 * @swagger
 * /api/server-members/{serverId}/members/{memberId}:
 *   delete:
 *     summary: Remove a member from a server
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
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Server member ID
 *     responses:
 *       200:
 *         description: Member removed successfully
 *       400:
 *         description: Invalid member removal
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only owners/admins can remove members
 *       404:
 *         description: Server or member not found
 */
router.delete("/:serverId/members/:memberId", protect, removeMember);

/**
 * @swagger
 * /api/server-members/{serverId}/members/{memberId}/role:
 *   patch:
 *     summary: Promote or demote a server member
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
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Server member ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, member]
 *                 example: admin
 *     responses:
 *       200:
 *         description: Member role updated successfully
 *       400:
 *         description: Invalid role change
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only the owner can change roles
 *       404:
 *         description: Server or member not found
 */
router.patch("/:serverId/members/:memberId/role", protect, updateMemberRole);

module.exports = router;
