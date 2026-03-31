const express = require("express");
const router = express.Router();
const memberRoleController = require("../controllers/memberRoleController");
const { protect } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   - name: Member Roles
 *     description: Member role management routes
 */

/**
 * @swagger
 * /api/member-roles:
 *   post:
 *     summary: Assign a role to a server member
 *     tags: [Member Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - member_id
 *               - role_id
 *             properties:
 *               member_id:
 *                 type: integer
 *                 example: 1
 *               role_id:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       201:
 *         description: Role assigned successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Not authorized
 *       403:
 *         description: You are not a member of this server
 */
router.post("/", protect, memberRoleController.assignRole);

/**
 * @swagger
 * /api/member-roles/{memberId}:
 *   get:
 *     summary: Get all roles assigned to a member
 *     tags: [Member Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the server member
 *     responses:
 *       200:
 *         description: Member roles returned successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: You are not allowed to view these roles
 */
router.get("/:memberId", protect, memberRoleController.getMemberRoles);

module.exports = router;