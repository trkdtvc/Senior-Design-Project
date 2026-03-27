const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, messageController.createMessage);
router.get("/:channelId", protect, messageController.getChannelMessages);

module.exports = router;