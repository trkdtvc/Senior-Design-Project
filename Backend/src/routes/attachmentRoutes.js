const express = require("express");
const attachmentController = require("../controllers/attachmentController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/channel/:attachmentId",
  protect,
  attachmentController.getChannelAttachment
);

router.get(
  "/direct/:attachmentId",
  protect,
  attachmentController.getDirectAttachment
);

module.exports = router;
