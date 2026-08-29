const path = require("path");
const express = require("express");
const cors = require("cors");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const { getAllowedOrigins, isSwaggerEnabled } = require("./config/env");
const { getUploadsRoot } = require("./config/paths");

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
const healthRoutes = require("./routes/healthRoutes");

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

  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }

  next();
});

// Reverse-proxy trust is explicit so req.ip remains reliable for rate limiting.
// Local development defaults to no trusted proxy; production defaults to one hop.
const defaultProxyHops = process.env.NODE_ENV === "production" ? 1 : 0;
const configuredProxyHops = Number.parseInt(
  process.env.TRUST_PROXY_HOPS ?? String(defaultProxyHops),
  10
);
app.set("trust proxy", configuredProxyHops);

const allowedOrigins = getAllowedOrigins();

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

// Authenticated API responses can contain private user and message data.
// Prevent browsers and intermediary caches from retaining those responses.
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(
  "/uploads/avatars",
  express.static(path.join(getUploadsRoot(), "avatars"), {
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
app.use("/api/health", healthRoutes);

if (isSwaggerEnabled()) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
