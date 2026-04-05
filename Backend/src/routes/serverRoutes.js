const express = require("express");
const router = express.Router();
const serverController = require("../controllers/serverController");
const { protect } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   - name: Servers
 *     description: Server management routes
 */

/**
 * @swagger
 * /api/servers:
 *   post:
 *     summary: Create a new server
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - server_name
 *             properties:
 *               server_name:
 *                 type: string
 *                 example: My Server
 *               description:
 *                 type: string
 *                 example: Server for chatting with friends
 *     responses:
 *       201:
 *         description: Server created successfully
 *       400:
 *         description: Server name is required
 *       401:
 *         description: Not authorized
 */
router.post("/", protect, serverController.createServer);

/**
 * @swagger
 * /api/servers:
 *   get:
 *     summary: Get all servers for the currently authenticated user
 *     tags: [Servers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User servers returned successfully
 *       401:
 *         description: Not authorized
 */
router.get("/", protect, serverController.getUserServers);
router.delete("/:serverId", protect, serverController.deleteServer);

module.exports = router;