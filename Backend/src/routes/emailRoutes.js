const express = require("express");
const { sendTestEmail } = require("../controllers/emailController");

const router = express.Router();

router.post("/test", sendTestEmail);

module.exports = router;