require("dotenv").config();
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");
const { findUserById, setUserOnlineState } = require("./models/userModel");
const { isUserMemberOfServer } = require("./models/serverMemberModel");
const userSafetyModel = require("./models/userSafetyModel");
const { isUserMemberOfChannelServer } = require("./models/messageModel");
const {
  getConversationById,
  isUserInConversation
} = require("./models/directMessageModel");

const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";
const debugLog = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const SOCKET_CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [FRONTEND_URL, "http://127.0.0.1:5173"];

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: SOCKET_CORS_ORIGINS,
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

io.use(async (socket, next) => {
  try {
    const token = getSocketToken(socket);

    if (!token) {
      return next(new Error("Not authorized, no token"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await findUserById(decoded.user_id);

    if (!user) {
      return next(new Error("Not authorized, account unavailable"));
    }

    if (!user.is_verified) {
      return next(new Error("Please verify your email before logging in"));
    }

    socket.user = {
      ...decoded,
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      is_verified: user.is_verified
    };

    next();
  } catch (error) {
    next(new Error("Not authorized, invalid token"));
  }
});

io.on("connection", async (socket) => {
  const userId = socket.user.user_id;
  const username = socket.user.username;

  debugLog(`Socket connected: ${socket.id} (user ${userId})`);

  addActiveSocket(userId, socket.id);
  debugLog(
    `Active sockets after connect for user ${userId}: ${getActiveSocketCount(userId)}`
  );
  socket.join(`user_${userId}`);

  try {
    await setUserOnlineState(userId, true, null);
    emitPresenceUpdate(userId, username, true, null);
  } catch (error) {
    console.error("Failed to mark user online:", error.message);
  }

  socket.on("join_server", async (serverId) => {
    try {
      if (!serverId) return;

      const isMember = await isUserMemberOfServer(serverId, userId);

      if (!isMember) return;

      socket.join(`server_${serverId}`);
    } catch (error) {
      console.error("Failed to join server room:", error.message);
    }
  });

  socket.on("leave_server", (serverId) => {
    if (!serverId) return;
    socket.leave(`server_${serverId}`);
  });

  socket.on("join_channel", async (channelId) => {
    try {
      if (!channelId) return;

      const isMember = await isUserMemberOfChannelServer(channelId, userId);

      if (!isMember) return;

      socket.join(`channel_${channelId}`);
    } catch (error) {
      console.error("Failed to join channel room:", error.message);
    }
  });

  socket.on("leave_channel", (channelId) => {
    if (!channelId) return;
    socket.leave(`channel_${channelId}`);
  });

  socket.on("channel_typing_start", async (payload = {}) => {
    try {
      const channelId = payload.channel_id || payload.channelId;

      if (!channelId) return;

      const isMember = await isUserMemberOfChannelServer(channelId, userId);

      if (!isMember) return;

      socket.to(`channel_${channelId}`).emit("channel_typing_start", {
        channel_id: Number(channelId),
        user_id: Number(userId),
        username
      });
    } catch (error) {
      console.error("Failed to emit channel typing start:", error.message);
    }
  });

  socket.on("channel_typing_stop", async (payload = {}) => {
    try {
      const channelId = payload.channel_id || payload.channelId;

      if (!channelId) return;

      const isMember = await isUserMemberOfChannelServer(channelId, userId);

      if (!isMember) return;

      socket.to(`channel_${channelId}`).emit("channel_typing_stop", {
        channel_id: Number(channelId),
        user_id: Number(userId),
        username
      });
    } catch (error) {
      console.error("Failed to emit channel typing stop:", error.message);
    }
  });

  socket.on("direct_typing_start", async (payload = {}) => {
    try {
      const conversationId = payload.conversation_id || payload.conversationId;

      if (!conversationId) return;

      const [conversation, hasAccess] = await Promise.all([
        getConversationById(conversationId),
        isUserInConversation(conversationId, userId)
      ]);

      if (!conversation || !hasAccess) return;

      const recipientUserId =
        Number(conversation.user_one_id) === Number(userId)
          ? Number(conversation.user_two_id)
          : Number(conversation.user_one_id);

      const usersBlockedEachOther = await userSafetyModel.hasBlockBetweenUsers(
        userId,
        recipientUserId
      );

      if (usersBlockedEachOther) return;

      io.to(`user_${recipientUserId}`).emit("direct_typing_start", {
        conversation_id: Number(conversationId),
        user_id: Number(userId),
        username
      });
    } catch (error) {
      console.error("Failed to emit direct typing start:", error.message);
    }
  });

  socket.on("direct_typing_stop", async (payload = {}) => {
    try {
      const conversationId = payload.conversation_id || payload.conversationId;

      if (!conversationId) return;

      const [conversation, hasAccess] = await Promise.all([
        getConversationById(conversationId),
        isUserInConversation(conversationId, userId)
      ]);

      if (!conversation || !hasAccess) return;

      const recipientUserId =
        Number(conversation.user_one_id) === Number(userId)
          ? Number(conversation.user_two_id)
          : Number(conversation.user_one_id);

      const usersBlockedEachOther = await userSafetyModel.hasBlockBetweenUsers(
        userId,
        recipientUserId
      );

      if (usersBlockedEachOther) return;

      io.to(`user_${recipientUserId}`).emit("direct_typing_stop", {
        conversation_id: Number(conversationId),
        user_id: Number(userId),
        username
      });
    } catch (error) {
      console.error("Failed to emit direct typing stop:", error.message);
    }
  });

  socket.on("disconnect", async () => {
    debugLog(`Socket disconnected: ${socket.id} (user ${userId})`);

    removeActiveSocket(userId, socket.id);
    debugLog(
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

const startServer = async () => {
  await connectDB();

  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
