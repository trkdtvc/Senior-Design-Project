const express = require("express");
const cors = require("cors");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const testRoutes = require("./routes/testRoutes");
const authRoutes = require("./routes/authRoutes");
const serverRoutes = require("./routes/serverRoutes");
const channelRoutes = require("./routes/channelRoutes");
const messageRoutes = require("./routes/messageRoutes");
const roleRoutes = require("./routes/roleRoutes");
const memberRoleRoutes = require("./routes/memberRoleRoutes");
const serverMemberRoutes = require("./routes/serverMemberRoutes");
const emailRoutes = require("./routes/emailRoutes");

const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/test", testRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/servers", serverRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/member-roles", memberRoleRoutes);
app.use("/api/server-members", serverMemberRoutes);
app.use("/api/email", emailRoutes);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(notFound);
app.use(errorHandler);

module.exports = app;