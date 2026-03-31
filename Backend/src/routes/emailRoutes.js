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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *             properties:
 *               to:
 *                 type: string
 *                 format: email
 *                 example: yfncsdp@gmail.com
 *     responses:
 *       200:
 *         description: Test email sent successfully
 *       400:
 *         description: Recipient email is required
 *       500:
 *         description: Failed to send test email
 */
router.post("/test", sendTestEmail);

module.exports = router;