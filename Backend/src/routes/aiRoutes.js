const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const { protect } = require("../middleware/authMiddleware");
const { aiRateLimiter } = require("../middleware/rateLimitMiddleware");

/**
 * @swagger
 * tags:
 *   - name: AI Assistant
 *     description: AI chat assistant and conversation intelligence routes
 */

router.post(
  "/channels/:channelId/ask",
  protect,
  aiRateLimiter,
  aiController.askChannelAi
);
router.post(
  "/direct/:conversationId/ask",
  protect,
  aiRateLimiter,
  aiController.askDirectAi
);
router.post(
  "/channels/:channelId/intelligence",
  protect,
  aiRateLimiter,
  aiController.getChannelIntelligence
);
router.post(
  "/direct/:conversationId/intelligence",
  protect,
  aiRateLimiter,
  aiController.getDirectIntelligence
);

module.exports = router;
