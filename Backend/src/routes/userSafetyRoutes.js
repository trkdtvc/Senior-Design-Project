const express = require("express");
const router = express.Router();
const userSafetyController = require("../controllers/userSafetyController");
const { protect } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   - name: User Safety
 *     description: User blocking and reporting routes
 */

/**
 * @swagger
 * /api/user-safety/blocked-users:
 *   get:
 *     summary: Get users blocked by the authenticated user
 *     tags: [User Safety]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Blocked users fetched successfully
 *       401:
 *         description: Not authorized
 */
router.get("/blocked-users", protect, userSafetyController.getBlockedUsers);

/**
 * @swagger
 * /api/user-safety/users/{userId}/block:
 *   post:
 *     summary: Block a user
 *     tags: [User Safety]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User blocked successfully
 *       400:
 *         description: Invalid target user
 *       401:
 *         description: Not authorized
 *       404:
 *         description: User not found
 */
router.post("/users/:userId/block", protect, userSafetyController.blockUser);

/**
 * @swagger
 * /api/user-safety/users/{userId}/block:
 *   delete:
 *     summary: Unblock a user
 *     tags: [User Safety]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User unblocked successfully
 *       400:
 *         description: Invalid target user
 *       401:
 *         description: Not authorized
 *       404:
 *         description: User not found
 */
router.delete("/users/:userId/block", protect, userSafetyController.unblockUser);

/**
 * @swagger
 * /api/user-safety/users/{userId}/report:
 *   post:
 *     summary: Report a user
 *     tags: [User Safety]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 example: Harassment
 *               details:
 *                 type: string
 *                 example: This user sent inappropriate messages.
 *     responses:
 *       201:
 *         description: Report submitted successfully
 *       400:
 *         description: Report reason is required
 *       401:
 *         description: Not authorized
 *       404:
 *         description: User not found
 */
router.post("/users/:userId/report", protect, userSafetyController.reportUser);

module.exports = router;
