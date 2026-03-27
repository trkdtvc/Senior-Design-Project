const express = require("express");
const router = express.Router();
const channelController = require("../controllers/channelController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, channelController.createChannel);
router.get("/:serverId", protect, channelController.getServerChannels);

module.exports = router;