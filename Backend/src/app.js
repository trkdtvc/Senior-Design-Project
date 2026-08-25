const express = require("express");
const cors = require("cors");
const path = require("path");

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
const serverInviteRoutes = require("./routes/serverInviteRoutes");
const friendRequestRoutes = require("./routes/friendRequestRoutes");
const directMessageRoutes = require("./routes/directMessageRoutes");
const notificationSettingsRoutes = require("./routes/notificationSettingsRoutes");
const userSafetyRoutes = require("./routes/userSafetyRoutes");
const aiRoutes = require("./routes/aiRoutes");

const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

const parseAllowedOrigins = () => {
  const origins = process.env.CORS_ORIGINS || process.env.FRONTEND_URL;

  if (!origins) {
    return ["http://localhost:5173", "http://127.0.0.1:5173"];
  }

  return origins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use("/api/test", testRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/servers", serverRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/member-roles", memberRoleRoutes);
app.use("/api/server-members", serverMemberRoutes);
app.use("/api/server-invites", serverInviteRoutes);
app.use("/api/friends", friendRequestRoutes);
app.use("/api/direct-messages", directMessageRoutes);
app.use("/api/notification-settings", notificationSettingsRoutes);
app.use("/api/user-safety", userSafetyRoutes);
app.use("/api/ai", aiRoutes);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(notFound);
app.use(errorHandler);

module.exports = app;