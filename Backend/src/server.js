require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");

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

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

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

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});