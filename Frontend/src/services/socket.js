import { io } from "socket.io-client";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "");

let socket = null;

export const connectSocket = (token) => {
  if (!token) {
    return null;
  }

  if (socket) {
    socket.auth = { token };

    if (!socket.connected) {
      socket.connect();
    }

    return socket;
  }

  socket = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    auth: {
      token
    }
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (!socket) {
    return;
  }

  socket.disconnect();
  socket = null;
};
