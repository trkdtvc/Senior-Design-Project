const express = require("express");
const router = express.Router();
const serverController = require("../controllers/serverController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, serverController.createServer);
router.get("/", protect, serverController.getUserServers);

module.exports = router;