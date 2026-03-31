const express = require("express");
const { sendTestEmail } = require("../controllers/emailController");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Email
 *     description: Email testing routes
 */

/**
 * @swagger
 * /api/email/test:
 *   post:
 *     summary: Send a test email
 *     tags: [Email]
 *     responses:
 *       200:
 *         description: Test email sent successfully
 *       500:
 *         description: Failed to send test email
 */
router.post("/test", sendTestEmail);

module.exports = router;