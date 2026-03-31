const express = require("express");
const { getTestMessage } = require("../controllers/testController");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Test
 *     description: Test routes
 */

/**
 * @swagger
 * /api/test:
 *   get:
 *     summary: Get test message
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Test message returned successfully
 */
router.get("/", getTestMessage);

module.exports = router;