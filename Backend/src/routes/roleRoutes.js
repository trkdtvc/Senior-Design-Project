const express = require("express");
const router = express.Router();
const roleController = require("../controllers/roleController");
const { protect } = require("../middleware/authMiddleware");

/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: Create a new role
 *     tags: [Roles]
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
 *               - role_name
 *             properties:
 *               server_id:
 *                 type: integer
 *                 example: 1
 *               role_name:
 *                 type: string
 *                 example: Moderator
 *     responses:
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Not authorized
 *       403:
 *         description: You are not a member of this server
 */
router.post("/", protect, roleController.createRole);

/**
 * @swagger
 * /api/roles/{serverId}:
 *   get:
 *     summary: Get all roles for a server
 *     tags: [Roles]
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
 *         description: Server roles returned successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: You are not a member of this server
 */
router.get("/:serverId", protect, roleController.getServerRoles);

module.exports = router;