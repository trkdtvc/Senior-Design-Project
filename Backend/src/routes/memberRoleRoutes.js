const express = require("express");
const router = express.Router();
const memberRoleController = require("../controllers/memberRoleController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, memberRoleController.assignRole);
router.get("/:memberId", protect, memberRoleController.getMemberRoles);

module.exports = router;