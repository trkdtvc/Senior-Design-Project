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
 *     summary: Get blocked users for the authenticated user
 *     tags: [User Safety]
 *     security:
 *       - bearerAuth: []
 */
router.get("/blocked-users", protect, userSafetyController.getBlockedUsers);

/**
 * @swagger
 * /api/user-safety/blocks/{userId}:
 *   post:
 *     summary: Block a user
 *     tags: [User Safety]
 *     security:
 *       - bearerAuth: []
 */
router.post("/blocks/:userId", protect, userSafetyController.blockUser);

/**
 * @swagger
 * /api/user-safety/blocks/{userId}:
 *   delete:
 *     summary: Unblock a user
 *     tags: [User Safety]
 *     security:
 *       - bearerAuth: []
 */
router.delete("/blocks/:userId", protect, userSafetyController.unblockUser);

/**
 * @swagger
 * /api/user-safety/reports/{userId}:
 *   post:
 *     summary: Report a user
 *     tags: [User Safety]
 *     security:
 *       - bearerAuth: []
 */
router.post("/reports/:userId", protect, userSafetyController.reportUser);

module.exports = router;
