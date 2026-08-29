const express = require("express");
const cors = require("cors");
const path = require("path");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const authRoutes = require("./routes/authRoutes");
const serverRoutes = require("./routes/serverRoutes");
const channelRoutes = require("./routes/channelRoutes");
const messageRoutes = require("./routes/messageRoutes");
const serverMemberRoutes = require("./routes/serverMemberRoutes");
const serverInviteRoutes = require("./routes/serverInviteRoutes");
const friendRequestRoutes = require("./routes/friendRequestRoutes");
const directMessageRoutes = require("./routes/directMessageRoutes");
const notificationSettingsRoutes = require("./routes/notificationSettingsRoutes");
const userSafetyRoutes = require("./routes/userSafetyRoutes");
const aiRoutes = require("./routes/aiRoutes");
const attachmentRoutes = require("./routes/attachmentRoutes");

const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});

// Production hosts such as Railway sit behind a reverse proxy.
// Trust the nearest proxy so req.ip reflects the real client for rate limiting.
app.set("trust proxy", 1);

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

      const corsError = new Error("Not allowed by CORS");
      corsError.statusCode = 403;
      callback(corsError);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(
  "/uploads/avatars",
  express.static(path.join(__dirname, "..", "uploads", "avatars"), {
    maxAge: "7d",
    immutable: true
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/servers", serverRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/server-members", serverMemberRoutes);
app.use("/api/server-invites", serverInviteRoutes);
app.use("/api/friends", friendRequestRoutes);
app.use("/api/direct-messages", directMessageRoutes);
app.use("/api/notification-settings", notificationSettingsRoutes);
app.use("/api/user-safety", userSafetyRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/attachments", attachmentRoutes);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
