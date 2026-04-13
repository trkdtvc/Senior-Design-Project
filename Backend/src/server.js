require("dotenv").config();
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");
const { setUserOnlineState } = require("./models/userModel");

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

connectDB();

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true
  }
});

app.set("io", io);

const activeUserSockets = new Map();

const getSocketToken = (socket) => {
  const authToken = socket.handshake?.auth?.token;

  if (authToken) {
    return authToken.startsWith("Bearer ")
      ? authToken.split(" ")[1]
      : authToken;
  }

  const authHeader = socket.handshake?.headers?.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  return null;
};

const addActiveSocket = (userId, socketId) => {
  const userKey = String(userId);
  const existingSockets = activeUserSockets.get(userKey) || new Set();

  existingSockets.add(socketId);
  activeUserSockets.set(userKey, existingSockets);
};

const removeActiveSocket = (userId, socketId) => {
  const userKey = String(userId);
  const existingSockets = activeUserSockets.get(userKey);

  if (!existingSockets) {
    return;
  }

  existingSockets.delete(socketId);

  if (existingSockets.size === 0) {
    activeUserSockets.delete(userKey);
    return;
  }

  activeUserSockets.set(userKey, existingSockets);
};

const getActiveSocketCount = (userId) => {
  const userKey = String(userId);
  const existingSockets = activeUserSockets.get(userKey);

  return existingSockets ? existingSockets.size : 0;
};

const emitPresenceUpdate = (userId, username, isOnline, lastSeenAt = null) => {
  const payload = {
    user_id: userId,
    username,
    status: isOnline ? "online" : "offline",
    last_seen_at: lastSeenAt || null
  };

  io.emit("presence_update", payload);
};

io.use((socket, next) => {
  try {
    const token = getSocketToken(socket);

    if (!token) {
      return next(new Error("Not authorized, no token"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;

    next();
  } catch (error) {
    next(new Error("Not authorized, invalid token"));
  }
});

io.on("connection", async (socket) => {
  const userId = socket.user.user_id;
  const username = socket.user.username;

  console.log(`Socket connected: ${socket.id} (user ${userId})`);

  addActiveSocket(userId, socket.id);
  console.log(
    `Active sockets after connect for user ${userId}: ${getActiveSocketCount(userId)}`
  );
  socket.join(`user_${userId}`);

  try {
    await setUserOnlineState(userId, true, null);
    emitPresenceUpdate(userId, username, true, null);
  } catch (error) {
    console.error("Failed to mark user online:", error.message);
  }

  socket.on("join_server", (serverId) => {
    if (!serverId) return;
    socket.join(`server_${serverId}`);
  });

  socket.on("leave_server", (serverId) => {
    if (!serverId) return;
    socket.leave(`server_${serverId}`);
  });

  socket.on("join_channel", (channelId) => {
    if (!channelId) return;
    socket.join(`channel_${channelId}`);
  });

  socket.on("leave_channel", (channelId) => {
    if (!channelId) return;
    socket.leave(`channel_${channelId}`);
  });

  socket.on("disconnect", async () => {
    console.log(`Socket disconnected: ${socket.id} (user ${userId})`);

    removeActiveSocket(userId, socket.id);
    console.log(
      `Active sockets after disconnect for user ${userId}: ${getActiveSocketCount(userId)}`
    );

    if (getActiveSocketCount(userId) > 0) {
      return;
    }

    try {
      const lastSeenAt = new Date();

      await setUserOnlineState(userId, false, lastSeenAt);
      emitPresenceUpdate(userId, username, false, lastSeenAt);
    } catch (error) {
      console.error("Failed to mark user offline:", error.message);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});