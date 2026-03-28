const express = require("express");
const router = express.Router();
const serverMemberController = require("../controllers/serverMemberController");
const { protect } = require("../middleware/authMiddleware");

router.get("/:serverId", protect, serverMemberController.getServerMembers);

module.exports = router;