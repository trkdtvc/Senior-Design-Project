const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const { protect } = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   - name: AI Assistant
 *     description: AI chat assistant and conversation intelligence routes
 */

router.post("/channels/:channelId/ask", protect, aiController.askChannelAi);
router.post("/direct/:conversationId/ask", protect, aiController.askDirectAi);
router.post(
  "/channels/:channelId/intelligence",
  protect,
  aiController.getChannelIntelligence
);
router.post(
  "/direct/:conversationId/intelligence",
  protect,
  aiController.getDirectIntelligence
);

module.exports = router;
