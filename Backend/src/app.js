const express = require("express");
const app = express();

const testRoutes = require("./routes/testRoutes");
const authRoutes = require("./routes/authRoutes");
const serverRoutes = require("./routes/serverRoutes");
const channelRoutes = require("./routes/channelRoutes");
const messageRoutes = require("./routes/messageRoutes");
const roleRoutes = require("./routes/roleRoutes");
const memberRoleRoutes = require("./routes/memberRoleRoutes");

app.use(express.json());

app.use("/api/test", testRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/servers", serverRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/member-roles", memberRoleRoutes);

module.exports = app;