import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMe } from "../services/authService";
import {
  getUserServers,
  createServer,
  deleteServer
} from "../services/serverService";
import {
  getServerChannels,
  createChannel,
  deleteChannel as deleteChannelById
} from "../services/channelService";
import {
  getChannelMessages,
  createMessage
} from "../services/messageService";
import { getServerMembers } from "../services/serverMemberService";
import { joinServerByInvite } from "../services/serverInviteService";
import {
  getDirectConversations,
  getOrCreateDirectConversation,
  getDirectMessages,
  sendDirectMessage
} from "../services/directMessageService";
import { connectSocket, disconnectSocket } from "../services/socket";
import "../styles/auth.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const handleResponse = async (response) => {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Request failed.");
  }

  return data;
};

const getFriends = async (token) => {
  const response = await fetch(`${API_BASE_URL}/friends`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(response);
};

const normalizeServers = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.servers)) return data.servers;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const normalizeChannels = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.channels)) return data.channels;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const normalizeMessages = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.messages)) return data.messages;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const normalizeMembers = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.members)) return data.members;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const normalizeDirectConversations = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.conversations)) return data.conversations;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const normalizeFriends = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.friends)) return data.friends;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const getServerId = (server) =>
  server?.server_id || server?.id || server?.serverId || null;

const getServerName = (server) =>
  server?.server_name || server?.name || "Untitled Server";

const getServerDescription = (server) =>
  server?.description || server?.server_description || "";

const getServerOwnerId = (server) =>
  server?.owner_id || server?.ownerId || null;

const getChannelId = (channel) =>
  channel?.channel_id || channel?.id || channel?.channelId || null;

const getChannelName = (channel) =>
  channel?.channel_name || channel?.name || "untitled-channel";

const getMessageId = (message) =>
  message?.message_id || message?.id || message?.messageId || null;

const getMessageAuthor = (message) =>
  message?.username || message?.user?.username || "Unknown user";

const getMessageContent = (message) =>
  message?.content || message?.message || "";

const getMessageTimestamp = (message) =>
  message?.created_at || message?.createdAt || message?.timestamp || null;

const getMemberId = (member) =>
  member?.member_id || member?.id || member?.memberId || null;

const getMemberName = (member) =>
  member?.username || member?.name || "Unknown user";

const getMemberEmail = (member) => member?.email || "";

const getMemberUserId = (member) =>
  member?.user_id || member?.userId || member?.id || null;

const getMemberPresenceStatus = (member) =>
  member?.presence_status || member?.presenceStatus || "offline";

const isOwner = (member) =>
  member?.is_owner === 1 || member?.is_owner === true || false;

const getFriendId = (friend) =>
  friend?.user_id || friend?.id || friend?.friendId || null;

const getFriendName = (friend) =>
  friend?.username || friend?.name || "Unknown user";

const getFriendEmail = (friend) => friend?.email || "";

const getFriendPresenceStatus = (friend) =>
  friend?.presence_status || friend?.presenceStatus || "offline";

const getConversationId = (conversation) =>
  conversation?.conversation_id ||
  conversation?.id ||
  conversation?.conversationId ||
  null;

const getConversationOtherUserId = (conversation) =>
  conversation?.other_user?.user_id ||
  conversation?.other_user_id ||
  conversation?.otherUser?.user_id ||
  null;

const getConversationOtherUsername = (conversation) =>
  conversation?.other_user?.username ||
  conversation?.other_username ||
  conversation?.otherUser?.username ||
  "Unknown user";

const getConversationOtherEmail = (conversation) =>
  conversation?.other_user?.email ||
  conversation?.other_email ||
  conversation?.otherUser?.email ||
  "";

const getConversationPresenceStatus = (conversation) => {
  const rawValue =
    conversation?.other_user?.is_online ??
    conversation?.other_is_online ??
    conversation?.otherUser?.is_online ??
    conversation?.presence_status;

  if (rawValue === 1 || rawValue === true || rawValue === "online") {
    return "online";
  }

  return "offline";
};

const getConversationLastMessage = (conversation) =>
  conversation?.last_message_content ||
  conversation?.lastMessageContent ||
  "";

const getConversationLastTimestamp = (conversation) =>
  conversation?.last_message_created_at ||
  conversation?.lastMessageCreatedAt ||
  conversation?.updated_at ||
  conversation?.created_at ||
  null;

const getDirectMessageId = (message) =>
  message?.direct_message_id ||
  message?.id ||
  message?.directMessageId ||
  null;

const getDirectMessageSenderId = (message) =>
  message?.sender_id ||
  message?.senderId ||
  message?.sender_user_id ||
  null;

const getDirectMessageAuthor = (message) =>
  message?.sender_username ||
  message?.username ||
  message?.sender?.username ||
  "Unknown user";

const getDirectMessageContent = (message) =>
  message?.content || "";

const getDirectMessageTimestamp = (message) =>
  message?.created_at || message?.createdAt || null;

const formatTimestamp = (timestamp) => {
  if (!timestamp) return "";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
};

const getPresenceColorClass = (status) => {
  return status === "online" ? "status-online" : "status-offline";
};

const getInitial = (value) => {
  const safeValue = String(value || "?").trim();
  return safeValue.charAt(0).toUpperCase() || "?";
};

const MainPage = () => {
  const navigate = useNavigate();
  const { serverId: routeServerId } = useParams();

  const messagesContainerRef = useRef(null);
  const messageInputRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const socketRef = useRef(null);
  const previousServerIdRef = useRef(null);
  const previousChannelIdRef = useRef(null);

  const [user, setUser] = useState(null);
  const [servers, setServers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [directConversations, setDirectConversations] = useState([]);
  const [channels, setChannels] = useState([]);
  const [members, setMembers] = useState([]);
  const [channelMessages, setChannelMessages] = useState([]);
  const [directMessages, setDirectMessages] = useState([]);

  const [activeServerId, setActiveServerId] = useState(null);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(null);

  const [isSocketReady, setIsSocketReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  const [isJoiningServer, setIsJoiningServer] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isDeletingServer, setIsDeletingServer] = useState(false);
  const [isDeletingChannel, setIsDeletingChannel] = useState(false);

  const [error, setError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [serverError, setServerError] = useState("");
  const [channelError, setChannelError] = useState("");
  const [membersError, setMembersError] = useState("");
  const [createServerError, setCreateServerError] = useState("");
  const [joinServerError, setJoinServerError] = useState("");
  const [createChannelError, setCreateChannelError] = useState("");
  const [deleteChannelError, setDeleteChannelError] = useState("");
  const [deleteServerError, setDeleteServerError] = useState("");

  const [messageContent, setMessageContent] = useState("");
  const [channelName, setChannelName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [serverFormData, setServerFormData] = useState({
    server_name: "",
    description: ""
  });

  const isDmView = !activeServerId;

  const activeServer = servers.find(
    (server) => String(getServerId(server)) === String(activeServerId)
  );

  const activeChannel = channels.find(
    (channel) => String(getChannelId(channel)) === String(activeChannelId)
  );

  const activeConversation = directConversations.find(
    (conversation) =>
      String(getConversationId(conversation)) === String(activeConversationId)
  );

  const activeConversationUser = activeConversation
    ? {
        user_id: getConversationOtherUserId(activeConversation),
        username: getConversationOtherUsername(activeConversation),
        email: getConversationOtherEmail(activeConversation),
        presence_status: getConversationPresenceStatus(activeConversation)
      }
    : null;

  const selectedChannelName = activeChannel
    ? getChannelName(activeChannel)
    : "";

  const isGeneralChannelSelected =
    selectedChannelName.trim().toLowerCase() === "general";

  const canDeleteSelectedChannel =
    !!activeChannel && channels.length > 1 && !isGeneralChannelSelected;

  const currentUserId = user?.user_id || user?.id || null;

  const currentUserIsOwner =
    (activeServer && currentUserId
      ? String(getServerOwnerId(activeServer)) === String(currentUserId)
      : false) ||
    members.some(
      (member) =>
        String(getMemberUserId(member)) === String(currentUserId) && isOwner(member)
    );

  const displayedMessages = isDmView ? directMessages : channelMessages;
  const normalizedSidebarSearch = sidebarSearch.trim().toLowerCase();

  const filteredChannels = channels.filter((channel) =>
    getChannelName(channel).toLowerCase().includes(normalizedSidebarSearch)
  );

  const filteredFriends = friends.filter((friend) => {
    const name = getFriendName(friend).toLowerCase();
    const email = getFriendEmail(friend).toLowerCase();
    return (
      name.includes(normalizedSidebarSearch) ||
      email.includes(normalizedSidebarSearch)
    );
  });

  const filteredDirectConversations = directConversations.filter((conversation) => {
    const username = getConversationOtherUsername(conversation).toLowerCase();
    const email = getConversationOtherEmail(conversation).toLowerCase();
    const lastMessage = getConversationLastMessage(conversation).toLowerCase();

    return (
      username.includes(normalizedSidebarSearch) ||
      email.includes(normalizedSidebarSearch) ||
      lastMessage.includes(normalizedSidebarSearch)
    );
  });

  const onlineMembers = members.filter(
    (member) => getMemberPresenceStatus(member) === "online"
  );

  const offlineMembers = members.filter(
    (member) => getMemberPresenceStatus(member) !== "online"
  );

  const resetMessageInputHeight = () => {
    if (!messageInputRef.current) {
      return;
    }

    messageInputRef.current.style.height = "44px";
  };

  const loadServers = useCallback(async (token) => {
    const serverData = await getUserServers(token);
    const normalizedServers = normalizeServers(serverData);
    setServers(normalizedServers);
    return normalizedServers;
  }, []);

  const loadFriends = useCallback(async (token) => {
    const friendData = await getFriends(token);
    const normalizedFriends = normalizeFriends(friendData);
    setFriends(normalizedFriends);
    return normalizedFriends;
  }, []);

  const loadDirectConversationList = useCallback(async (token) => {
    const conversationData = await getDirectConversations(token);
    const normalizedConversations =
      normalizeDirectConversations(conversationData);
    setDirectConversations(normalizedConversations);
    return normalizedConversations;
  }, []);

  const loadServerChannels = useCallback(
    async (token, serverId) => {
      if (!serverId) {
        setChannels([]);
        setActiveChannelId(null);
        return [];
      }

      const channelData = await getServerChannels(token, serverId);
      const normalizedChannels = normalizeChannels(channelData);

      setChannels(normalizedChannels);

      if (normalizedChannels.length === 0) {
        setActiveChannelId(null);
        setChannelMessages([]);
        return [];
      }

      setActiveChannelId((prevActiveChannelId) => {
        const stillExists = normalizedChannels.some(
          (channel) =>
            String(getChannelId(channel)) === String(prevActiveChannelId)
        );

        if (stillExists) {
          return prevActiveChannelId;
        }

        return getChannelId(normalizedChannels[0]);
      });

      return normalizedChannels;
    },
    []
  );

  const loadServerMembers = useCallback(async (token, serverId) => {
    if (!serverId) {
      setMembers([]);
      return [];
    }

    const memberData = await getServerMembers(serverId, token);
    const normalizedMembers = normalizeMembers(memberData);
    setMembers(normalizedMembers);
    return normalizedMembers;
  }, []);

  const loadChannelMessageList = useCallback(
    async (token, channelId) => {
      if (!channelId) {
        setChannelMessages([]);
        setMessageError("");
        return [];
      }

      const messageData = await getChannelMessages(token, channelId);
      const normalizedMessageData = normalizeMessages(messageData);
      setChannelMessages(normalizedMessageData);
      return normalizedMessageData;
    },
    []
  );

  const loadDirectMessageList = useCallback(
    async (token, conversationId) => {
      if (!conversationId) {
        setDirectMessages([]);
        setMessageError("");
        return [];
      }

      const messageData = await getDirectMessages(token, conversationId);
      const normalizedMessageData = normalizeMessages(messageData);
      setDirectMessages(normalizedMessageData);
      return normalizedMessageData;
    },
    []
  );

  useEffect(() => {
    const loadMainPageData = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        setServerError("");
        setChannelError("");
        setMembersError("");
        setMessageError("");
        setCreateServerError("");
        setJoinServerError("");
        setCreateChannelError("");
        setDeleteChannelError("");
        setDeleteServerError("");

        const userData = await getMe(token);
        setUser(userData);

        connectSocket(token);

        await Promise.all([
          loadServers(token),
          loadFriends(token),
          loadDirectConversationList(token)
        ]);
      } catch (error) {
        disconnectSocket();
        localStorage.removeItem("token");
        setError(error.message || "Failed to load the app. Please log in again.");
        navigate("/login");
      } finally {
        setIsLoading(false);
      }
    };

    loadMainPageData();
  }, [navigate, loadServers, loadFriends, loadDirectConversationList]);

  useEffect(() => {
    if (!routeServerId) {
      setActiveServerId(null);
      setChannels([]);
      setMembers([]);
      setActiveChannelId(null);
      setChannelMessages([]);
      return;
    }

    const matchedServer = servers.find(
      (server) => String(getServerId(server)) === String(routeServerId)
    );

    if (matchedServer) {
      setActiveServerId(getServerId(matchedServer));
      setActiveConversationId(null);
      return;
    }

    if (!isLoading) {
      navigate("/dashboard");
    }
  }, [routeServerId, servers, isLoading, navigate]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    if (!activeServerId) {
      setServerError("");
      setChannelError("");
      setMembersError("");
      setChannels([]);
      setMembers([]);
      setActiveChannelId(null);
      setChannelMessages([]);
      return;
    }

    const loadSelectedServerData = async () => {
      try {
        setServerError("");
        setChannelError("");
        setMembersError("");

        await Promise.all([
          loadServerChannels(token, activeServerId),
          loadServerMembers(token, activeServerId)
        ]);
      } catch (error) {
        setChannels([]);
        setMembers([]);
        setActiveChannelId(null);
        setChannelMessages([]);
        setServerError(error.message || "Failed to load selected server.");
      }
    };

    loadSelectedServerData();
  }, [activeServerId, loadServerChannels, loadServerMembers, navigate]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    if (!activeServerId || !activeChannelId) {
      setChannelMessages([]);
      return;
    }

    const loadSelectedChannelMessages = async () => {
      try {
        setIsMessagesLoading(true);
        setMessageError("");
        shouldAutoScrollRef.current = true;
        await loadChannelMessageList(token, activeChannelId);
      } catch (error) {
        setChannelMessages([]);
        setMessageError(error.message || "Failed to load channel messages.");
      } finally {
        setIsMessagesLoading(false);
      }
    };

    loadSelectedChannelMessages();
  }, [activeServerId, activeChannelId, loadChannelMessageList, navigate]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    if (!isDmView || !activeConversationId) {
      if (isDmView) {
        setDirectMessages([]);
      }
      return;
    }

    const loadSelectedDirectMessages = async () => {
      try {
        setIsMessagesLoading(true);
        setMessageError("");
        shouldAutoScrollRef.current = true;
        await loadDirectMessageList(token, activeConversationId);
      } catch (error) {
        setDirectMessages([]);
        setMessageError(error.message || "Failed to load direct messages.");
      } finally {
        setIsMessagesLoading(false);
      }
    };

    loadSelectedDirectMessages();
  }, [isDmView, activeConversationId, loadDirectMessageList, navigate]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    const socket = connectSocket(token);
    socketRef.current = socket;

    const handleConnect = () => {
      setIsSocketReady(true);
    };

    const handleDisconnect = () => {
      setIsSocketReady(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      if (socket.connected) {
        if (previousChannelIdRef.current) {
          socket.emit("leave_channel", String(previousChannelIdRef.current));
        }

        if (previousServerIdRef.current) {
          socket.emit("leave_server", String(previousServerIdRef.current));
        }
      }

      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socketRef.current = null;
      previousServerIdRef.current = null;
      previousChannelIdRef.current = null;
      setIsSocketReady(false);
    };
  }, [navigate]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket || !isSocketReady) {
      return;
    }

    const previousServerId = previousServerIdRef.current;

    if (
      previousServerId &&
      String(previousServerId) !== String(activeServerId)
    ) {
      socket.emit("leave_server", String(previousServerId));
    }

    if (activeServerId) {
      socket.emit("join_server", String(activeServerId));
      previousServerIdRef.current = activeServerId;
    } else {
      previousServerIdRef.current = null;
    }

    return () => {
      if (
        socket.connected &&
        activeServerId &&
        String(previousServerIdRef.current) === String(activeServerId)
      ) {
        if (previousChannelIdRef.current) {
          socket.emit("leave_channel", String(previousChannelIdRef.current));
          previousChannelIdRef.current = null;
        }

        socket.emit("leave_server", String(activeServerId));
        previousServerIdRef.current = null;
      }
    };
  }, [activeServerId, isSocketReady]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket || !isSocketReady) {
      return;
    }

    const previousChannelId = previousChannelIdRef.current;

    if (
      previousChannelId &&
      String(previousChannelId) !== String(activeChannelId)
    ) {
      socket.emit("leave_channel", String(previousChannelId));
    }

    if (activeServerId && activeChannelId) {
      socket.emit("join_channel", String(activeChannelId));
      previousChannelIdRef.current = activeChannelId;
    } else {
      previousChannelIdRef.current = null;
    }

    return () => {
      if (
        socket.connected &&
        activeChannelId &&
        String(previousChannelIdRef.current) === String(activeChannelId)
      ) {
        socket.emit("leave_channel", String(activeChannelId));
        previousChannelIdRef.current = null;
      }
    };
  }, [activeServerId, activeChannelId, isSocketReady]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket || !isSocketReady) {
      return;
    }

    const handlePresenceUpdate = (presenceData) => {
      if (!presenceData?.user_id) {
        return;
      }

      const nextPresenceStatus =
        presenceData.status === "online" ? "online" : "offline";

      setMembers((prevMembers) =>
        prevMembers.map((member) => {
          if (String(getMemberUserId(member)) !== String(presenceData.user_id)) {
            return member;
          }

          return {
            ...member,
            presence_status: nextPresenceStatus
          };
        })
      );

      setFriends((prevFriends) =>
        prevFriends.map((friend) => {
          if (String(getFriendId(friend)) !== String(presenceData.user_id)) {
            return friend;
          }

          return {
            ...friend,
            presence_status: nextPresenceStatus
          };
        })
      );

      setDirectConversations((prevConversations) =>
        prevConversations.map((conversation) => {
          if (
            String(getConversationOtherUserId(conversation)) !==
            String(presenceData.user_id)
          ) {
            return conversation;
          }

          return {
            ...conversation,
            other_is_online: nextPresenceStatus === "online" ? 1 : 0,
            other_user: conversation?.other_user
              ? {
                  ...conversation.other_user,
                  is_online: nextPresenceStatus === "online" ? 1 : 0
                }
              : conversation?.other_user
          };
        })
      );
    };

    const handleNewMessage = (incomingMessage) => {
      if (
        !incomingMessage ||
        !activeServerId ||
        String(
          incomingMessage.channel_id ||
            incomingMessage.channelId ||
            incomingMessage.channel?.channel_id ||
            incomingMessage.channel?.id
        ) !== String(activeChannelId)
      ) {
        return;
      }

      shouldAutoScrollRef.current = true;

      setChannelMessages((prevMessages) => {
        const incomingMessageId = getMessageId(incomingMessage);

        if (
          incomingMessageId &&
          prevMessages.some(
            (message) => String(getMessageId(message)) === String(incomingMessageId)
          )
        ) {
          return prevMessages;
        }

        return [...prevMessages, incomingMessage];
      });
    };

    const handleDirectMessage = (payload) => {
      if (!payload?.conversation_id || !payload?.directMessage) {
        return;
      }

      shouldAutoScrollRef.current = true;

      if (String(payload.conversation_id) === String(activeConversationId)) {
        setDirectMessages((prevMessages) => {
          const incomingMessageId = getDirectMessageId(payload.directMessage);

          if (
            incomingMessageId &&
            prevMessages.some(
              (message) =>
                String(getDirectMessageId(message)) === String(incomingMessageId)
            )
          ) {
            return prevMessages;
          }

          return [...prevMessages, payload.directMessage];
        });
      }

      const token = localStorage.getItem("token");

      if (token) {
        loadDirectConversationList(token);
      }
    };

    socket.on("presence_update", handlePresenceUpdate);
    socket.on("new_message", handleNewMessage);
    socket.on("direct_message", handleDirectMessage);

    return () => {
      socket.off("presence_update", handlePresenceUpdate);
      socket.off("new_message", handleNewMessage);
      socket.off("direct_message", handleDirectMessage);
    };
  }, [
    isSocketReady,
    activeServerId,
    activeChannelId,
    activeConversationId,
    loadDirectConversationList
  ]);

  useEffect(() => {
    if (!messageInputRef.current || isSendingMessage) {
      return;
    }

    if ((isDmView && activeConversationId) || (!isDmView && activeChannelId)) {
      messageInputRef.current.focus();
    }
  }, [isDmView, activeConversationId, activeChannelId, isSendingMessage]);

  useEffect(() => {
    const container = messagesContainerRef.current;

    if (!container || !shouldAutoScrollRef.current) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [displayedMessages]);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;

    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    shouldAutoScrollRef.current = distanceFromBottom < 120;
  };

  const handleLogout = () => {
    disconnectSocket();
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleSelectHome = () => {
    shouldAutoScrollRef.current = true;
    setActiveServerId(null);
    setActiveConversationId(null);
    setSidebarSearch("");
    setMessageContent("");
    setServerError("");
    setMessageError("");
    navigate("/dashboard");

    requestAnimationFrame(() => {
      resetMessageInputHeight();
    });
  };

  const handleSelectServer = (serverId) => {
    shouldAutoScrollRef.current = true;
    setActiveConversationId(null);
    setSidebarSearch("");
    setMessageContent("");
    setServerError("");
    setMessageError("");
    navigate(`/server/${serverId}`);

    requestAnimationFrame(() => {
      resetMessageInputHeight();
    });
  };

  const handleSelectChannel = (channelId) => {
    shouldAutoScrollRef.current = true;
    setActiveChannelId(channelId);
    setDeleteChannelError("");
    setMessageError("");
    setMessageContent("");

    requestAnimationFrame(() => {
      resetMessageInputHeight();
    });
  };

  const handleSelectConversation = (conversationId) => {
    shouldAutoScrollRef.current = true;
    setActiveServerId(null);
    setActiveConversationId(conversationId);
    setMessageError("");
    setMessageContent("");
    navigate("/dashboard");

    requestAnimationFrame(() => {
      resetMessageInputHeight();
    });
  };

  const handleStartDirectConversation = async (friend) => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setError("");
      const response = await getOrCreateDirectConversation(token, getFriendId(friend));
      const conversationId = getConversationId(response?.conversation);

      await loadDirectConversationList(token);

      setActiveServerId(null);
      setActiveConversationId(conversationId);
      setMessageContent("");
      navigate("/dashboard");

      requestAnimationFrame(() => {
        resetMessageInputHeight();
      });
    } catch (error) {
      setError(error.message || "Failed to start direct conversation.");
    }
  };

  const handleCreateServer = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("token");
    const trimmedName = serverFormData.server_name.trim();
    const trimmedDescription = serverFormData.description.trim();

    if (!trimmedName) {
      setCreateServerError("Server name is required.");
      return;
    }

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setIsCreatingServer(true);
      setCreateServerError("");

      const payload = {
        server_name: trimmedName,
        description: trimmedDescription
      };

      const createdServer = await createServer(token, payload);

      setServerFormData({
        server_name: "",
        description: ""
      });

      await loadServers(token);

      const newServerId =
        createdServer?.server?.server_id ||
        createdServer?.server?.id ||
        createdServer?.server_id ||
        createdServer?.id ||
        createdServer?.serverId;

      if (newServerId) {
        handleSelectServer(newServerId);
      }
    } catch (error) {
      setCreateServerError(
        error.message || "Failed to create server. Please try again."
      );
    } finally {
      setIsCreatingServer(false);
    }
  };

  const handleJoinServer = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("token");
    const trimmedInviteCode = inviteCode.trim();

    if (!trimmedInviteCode) {
      setJoinServerError("Invite code is required.");
      return;
    }

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setIsJoiningServer(true);
      setJoinServerError("");

      const data = await joinServerByInvite(trimmedInviteCode, token);

      setInviteCode("");
      await loadServers(token);

      if (data.server_id) {
        handleSelectServer(data.server_id);
      }
    } catch (error) {
      setJoinServerError(error.message || "Failed to join server.");
    } finally {
      setIsJoiningServer(false);
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    if (!activeServerId) {
      setCreateChannelError("Select a server first.");
      return;
    }

    if (!channelName.trim()) {
      setCreateChannelError("Channel name is required.");
      return;
    }

    try {
      setIsCreatingChannel(true);
      setCreateChannelError("");
      setDeleteChannelError("");

      const response = await createChannel(token, {
        server_id: activeServerId,
        channel_name: channelName.trim()
      });

      const createdChannel = response?.channel || response?.data || response;

      await loadServerChannels(token, activeServerId);

      const createdChannelId = getChannelId(createdChannel);

      if (createdChannelId) {
        setActiveChannelId(createdChannelId);
      }

      setChannelName("");
    } catch (error) {
      setCreateChannelError(error.message || "Failed to create channel.");
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleDeleteChannel = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    if (!activeChannel) {
      setDeleteChannelError("Select a channel first.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete #${getChannelName(activeChannel)}? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeletingChannel(true);
      setDeleteChannelError("");
      shouldAutoScrollRef.current = true;

      await deleteChannelById(token, getChannelId(activeChannel));
      await loadServerChannels(token, activeServerId);
      setMessageContent("");
    } catch (error) {
      setDeleteChannelError(error.message || "Failed to delete channel.");
    } finally {
      setIsDeletingChannel(false);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) {
      e.preventDefault();
    }

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    if (!messageContent.trim()) {
      setMessageError("Message content is required.");
      return;
    }

    try {
      setIsSendingMessage(true);
      setMessageError("");
      shouldAutoScrollRef.current = true;

      if (isDmView) {
        if (!activeConversationId) {
          setMessageError("Select a direct conversation first.");
          return;
        }

        await sendDirectMessage(token, {
          conversationId: activeConversationId,
          content: messageContent.trim()
        });
      } else {
        if (!activeChannelId) {
          setMessageError("Select a channel first.");
          return;
        }

        await createMessage(token, {
          channel_id: activeChannelId,
          content: messageContent.trim()
        });
      }

      setMessageContent("");

      requestAnimationFrame(() => {
        resetMessageInputHeight();

        if (messageInputRef.current) {
          messageInputRef.current.focus();
        }
      });
    } catch (error) {
      setMessageError(error.message || "Failed to send message.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleMessageInputChange = (e) => {
    setMessageContent(e.target.value);
    setMessageError("");
    e.target.style.height = "44px";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const handleMessageKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      if (!messageContent.trim()) {
        return;
      }

      handleSendMessage();
    }
  };

  const handleDeleteOrLeaveServer = async () => {
    const token = localStorage.getItem("token");

    if (!token || !activeServer) {
      navigate("/login");
      return;
    }

    const confirmed = window.confirm(
      currentUserIsOwner
        ? `Are you sure you want to delete "${getServerName(activeServer)}"? This cannot be undone.`
        : `Are you sure you want to leave "${getServerName(activeServer)}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeletingServer(true);
      setDeleteServerError("");

      if (currentUserIsOwner) {
        await deleteServer(token, getServerId(activeServer));
      } else {
        const response = await fetch(
          `${API_BASE_URL}/server-members/${getServerId(activeServer)}/leave`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.message || "Failed to leave server.");
        }
      }

      await loadServers(token);
      handleSelectHome();
    } catch (error) {
      setDeleteServerError(error.message || "Failed to update server membership.");
    } finally {
      setIsDeletingServer(false);
    }
  };

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-logo">YFNC</h1>
          <p>Loading app...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="server-page main-page-shell">
      <div className="server-layout main-layout-grid">
        <aside className="server-sidebar discord-sidebar-shell">
          <div className="discord-guilds-bar">
            <button
              type="button"
              onClick={handleSelectHome}
              className={`discord-guild-button discord-home-button${
                isDmView ? " discord-guild-button-active" : ""
              }`}
              title="Direct Messages"
            >
              <span className="discord-guild-initial">DM</span>
            </button>

            <div className="discord-guild-divider" />

            <div className="discord-guild-list">
              {servers.map((server) => {
                const serverId = getServerId(server);
                const serverName = getServerName(server);
                const isActive = String(serverId) === String(activeServerId);

                return (
                  <button
                    key={serverId}
                    type="button"
                    onClick={() => handleSelectServer(serverId)}
                    className={`discord-guild-button${
                      isActive ? " discord-guild-button-active" : ""
                    }`}
                    title={serverName}
                  >
                    <span className="discord-guild-initial">
                      {getInitial(serverName)}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="discord-logout-button"
              onClick={handleLogout}
              title="Log out"
            >
              Out
            </button>
          </div>

          <div className="discord-sidebar-pane">
            <div className="discord-pane-header">
              <div>
                <p className="discord-pane-label">
                  {isDmView ? "Direct Messages" : "Server"}
                </p>
                <h1 className="discord-pane-title">
                  {isDmView ? "Messages" : getServerName(activeServer)}
                </h1>
                {!isDmView && activeServer ? (
                  <p className="discord-pane-subtitle">
                    {getServerDescription(activeServer) || "No description provided."}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="discord-search-wrap">
              <input
                type="text"
                className="discord-search-input"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder={
                  isDmView
                    ? "Find or start a conversation"
                    : "Search channels"
                }
              />
            </div>

            {error && <p className="auth-error server-inline-error">{error}</p>}
            {serverError && !isDmView && (
              <p className="auth-error server-inline-error">{serverError}</p>
            )}
            {channelError && !isDmView && (
              <p className="auth-error server-inline-error">{channelError}</p>
            )}

            <div className="discord-sidebar-scroll">
              {isDmView ? (
                <>
                  <section className="discord-section-block">
                    <div className="discord-section-heading">Direct Messages</div>

                    {filteredDirectConversations.length === 0 ? (
                      <p className="discord-helper-text">No direct conversations yet.</p>
                    ) : (
                      <div className="discord-dm-list">
                        {filteredDirectConversations.map((conversation) => {
                          const conversationId = getConversationId(conversation);
                          const isActive =
                            String(conversationId) === String(activeConversationId);
                          const presenceStatus =
                            getConversationPresenceStatus(conversation);

                          return (
                            <button
                              key={conversationId}
                              type="button"
                              onClick={() => handleSelectConversation(conversationId)}
                              className={`discord-dm-item${
                                isActive ? " discord-dm-item-active" : ""
                              }`}
                            >
                              <div className="discord-dm-avatar">
                                {getInitial(getConversationOtherUsername(conversation))}
                                <span
                                  className={`discord-status-dot ${getPresenceColorClass(
                                    presenceStatus
                                  )}`}
                                />
                              </div>

                              <div className="discord-dm-content">
                                <div className="discord-dm-name-row">
                                  <span className="discord-dm-name">
                                    {getConversationOtherUsername(conversation)}
                                  </span>
                                  <span className="discord-dm-time">
                                    {formatTimestamp(
                                      getConversationLastTimestamp(conversation)
                                    )}
                                  </span>
                                </div>

                                <p className="discord-dm-preview">
                                  {getConversationLastMessage(conversation) ||
                                    "No messages yet."}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="discord-section-block">
                    <div className="discord-section-heading">Friends</div>

                    {filteredFriends.length === 0 ? (
                      <p className="discord-helper-text">No friends found.</p>
                    ) : (
                      <div className="discord-dm-list">
                        {filteredFriends.map((friend) => {
                          const presenceStatus = getFriendPresenceStatus(friend);

                          return (
                            <button
                              key={getFriendId(friend)}
                              type="button"
                              onClick={() => handleStartDirectConversation(friend)}
                              className="discord-dm-item"
                            >
                              <div className="discord-dm-avatar">
                                {getInitial(getFriendName(friend))}
                                <span
                                  className={`discord-status-dot ${getPresenceColorClass(
                                    presenceStatus
                                  )}`}
                                />
                              </div>

                              <div className="discord-dm-content">
                                <div className="discord-dm-name-row">
                                  <span className="discord-dm-name">
                                    {getFriendName(friend)}
                                  </span>
                                </div>
                                <p className="discord-dm-preview">
                                  {getFriendEmail(friend)}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="discord-section-block discord-utility-section">
                    <div className="discord-section-heading">Join a Server</div>
                    {joinServerError && (
                      <p className="auth-error server-inline-error">{joinServerError}</p>
                    )}

                    <form onSubmit={handleJoinServer} className="discord-form-stack">
                      <input
                        id="invite_code"
                        type="text"
                        className="auth-input compact-input"
                        value={inviteCode}
                        onChange={(e) => {
                          setInviteCode(e.target.value);
                          setJoinServerError("");
                        }}
                        placeholder="Enter invite code"
                      />

                      <button
                        type="submit"
                        className="auth-button compact-button"
                        disabled={isJoiningServer}
                      >
                        {isJoiningServer ? "Joining..." : "Join server"}
                      </button>
                    </form>
                  </section>

                  <section className="discord-section-block discord-utility-section">
                    <div className="discord-section-heading">Create a Server</div>
                    {createServerError && (
                      <p className="auth-error server-inline-error">
                        {createServerError}
                      </p>
                    )}

                    <form onSubmit={handleCreateServer} className="discord-form-stack">
                      <input
                        id="server_name"
                        name="server_name"
                        type="text"
                        className="auth-input compact-input"
                        value={serverFormData.server_name}
                        onChange={(e) => {
                          const { name, value } = e.target;

                          setServerFormData((prevData) => ({
                            ...prevData,
                            [name]: value
                          }));

                          setCreateServerError("");
                        }}
                        placeholder="Server name"
                      />

                      <textarea
                        id="description"
                        name="description"
                        className="auth-input compact-input compact-textarea"
                        value={serverFormData.description}
                        onChange={(e) => {
                          const { name, value } = e.target;

                          setServerFormData((prevData) => ({
                            ...prevData,
                            [name]: value
                          }));

                          setCreateServerError("");
                        }}
                        placeholder="Server description"
                        rows="3"
                      />

                      <button
                        type="submit"
                        className="auth-button compact-button"
                        disabled={isCreatingServer}
                      >
                        {isCreatingServer ? "Creating..." : "Create server"}
                      </button>
                    </form>
                  </section>
                </>
              ) : (
                <>
                  <section className="discord-section-block">
                    <div className="discord-section-heading">Text Channels</div>

                    {filteredChannels.length === 0 ? (
                      <p className="discord-helper-text">No channels found.</p>
                    ) : (
                      <div className="channel-list discord-channel-list">
                        {filteredChannels.map((channel) => {
                          const channelId = getChannelId(channel);
                          const isActive =
                            String(channelId) === String(activeChannelId);

                          return (
                            <button
                              key={channelId}
                              type="button"
                              onClick={() => handleSelectChannel(channelId)}
                              className={`channel-button discord-channel-button${
                                isActive ? " channel-button-active" : ""
                              }`}
                            >
                              <span className="channel-hash">#</span>
                              <span className="channel-name">
                                {getChannelName(channel)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="discord-section-block discord-utility-section">
                    <div className="discord-section-heading">Create Channel</div>
                    {createChannelError && (
                      <p className="auth-error server-inline-error">
                        {createChannelError}
                      </p>
                    )}

                    <form onSubmit={handleCreateChannel} className="discord-form-stack">
                      <input
                        id="channelName"
                        type="text"
                        className="auth-input compact-input"
                        value={channelName}
                        onChange={(e) => {
                          setChannelName(e.target.value);
                          setCreateChannelError("");
                        }}
                        placeholder="Enter channel name"
                      />

                      <button
                        type="submit"
                        className="auth-button compact-button"
                        disabled={isCreatingChannel}
                      >
                        {isCreatingChannel ? "Creating..." : "Create channel"}
                      </button>
                    </form>
                  </section>

                  <section className="discord-section-block discord-utility-section">
                    <div className="discord-section-heading">Server Actions</div>

                    {deleteChannelError && (
                      <p className="auth-error server-inline-error">
                        {deleteChannelError}
                      </p>
                    )}

                    {activeChannel && isGeneralChannelSelected ? (
                      <p className="discord-helper-text">
                        The general channel cannot be deleted.
                      </p>
                    ) : null}

                    {activeChannel && !isGeneralChannelSelected ? (
                      <button
                        type="button"
                        className="auth-button auth-button-danger compact-button"
                        onClick={handleDeleteChannel}
                        disabled={!canDeleteSelectedChannel || isDeletingChannel}
                      >
                        {isDeletingChannel
                          ? "Deleting..."
                          : `Delete #${getChannelName(activeChannel)}`}
                      </button>
                    ) : null}
                  </section>
                </>
              )}
            </div>

            <div className="discord-current-user-bar">
              <div className="discord-current-user-avatar">
                {getInitial(user?.username)}
              </div>
              <div className="discord-current-user-meta">
                <div className="discord-current-user-name">{user?.username}</div>
                <div className="discord-current-user-email">{user?.email}</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="server-main discord-chat-panel">
          <div className="server-main-header discord-chat-header">
            <div className="discord-chat-header-left">
              {isDmView ? (
                <>
                  <span
                    className={`discord-status-dot discord-header-status ${getPresenceColorClass(
                      activeConversationUser?.presence_status
                    )}`}
                  />
                  <div>
                    <h2 className="server-main-title discord-chat-title">
                      {activeConversationUser
                        ? activeConversationUser.username
                        : "Direct Messages"}
                    </h2>
                    <p className="discord-chat-subtitle">
                      {activeConversationUser
                        ? activeConversationUser.presence_status === "online"
                          ? "Online"
                          : "Offline"
                        : "Choose a conversation"}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <span className="discord-channel-symbol">#</span>
                  <div>
                    <h2 className="server-main-title discord-chat-title">
                      {activeChannel ? getChannelName(activeChannel) : "Select a channel"}
                    </h2>
                    <p className="discord-chat-subtitle">
                      {activeServer
                        ? getServerName(activeServer)
                        : "No server selected"}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          <section className="server-messages-panel discord-messages-panel">
            {isMessagesLoading ? (
              <div className="server-state-message discord-empty-state">
                Loading messages...
              </div>
            ) : messageError ? (
              <div className="server-state-message server-state-error discord-empty-state">
                {messageError}
              </div>
            ) : isDmView && !activeConversationId ? (
              <div className="server-state-message discord-empty-state">
                Select a friend or a direct conversation to start chatting.
              </div>
            ) : !isDmView && !activeChannelId ? (
              <div className="server-state-message discord-empty-state">
                Select a channel to view messages.
              </div>
            ) : displayedMessages.length === 0 ? (
              <div className="server-state-message discord-empty-state">
                No messages yet.
              </div>
            ) : (
              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="message-list discord-message-list"
              >
                {displayedMessages.map((message, index) => {
                  const timestamp = isDmView
                    ? formatTimestamp(getDirectMessageTimestamp(message))
                    : formatTimestamp(getMessageTimestamp(message));

                  const author = isDmView
                    ? getDirectMessageAuthor(message)
                    : getMessageAuthor(message);

                  const content = isDmView
                    ? getDirectMessageContent(message)
                    : getMessageContent(message);

                  const key = isDmView
                    ? getDirectMessageId(message) || index
                    : getMessageId(message) || index;

                  const isOwnDmMessage =
                    isDmView &&
                    String(getDirectMessageSenderId(message)) === String(currentUserId);

                  return (
                    <div key={key} className="discord-message-row">
                      <div className="discord-message-avatar">
                        {getInitial(author)}
                      </div>

                      <div className="discord-message-body">
                        <div className="discord-message-meta">
                          <span className="discord-message-author">
                            {author}
                            {isOwnDmMessage ? " (You)" : ""}
                          </span>
                          {timestamp && (
                            <span className="discord-message-time">{timestamp}</span>
                          )}
                        </div>

                        <p className="discord-message-text">{content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <form onSubmit={handleSendMessage} className="server-message-form discord-composer">
            {messageError && (
              <p className="auth-error server-inline-error server-inline-error-tight">
                {messageError}
              </p>
            )}

            <div className="discord-composer-shell">
              <textarea
                ref={messageInputRef}
                className="message-input discord-composer-input"
                placeholder={
                  isDmView
                    ? activeConversationUser
                      ? `Message @${activeConversationUser.username}`
                      : "Select a direct conversation"
                    : activeChannel
                      ? `Message #${getChannelName(activeChannel)}`
                      : "Select a channel"
                }
                value={messageContent}
                onChange={handleMessageInputChange}
                onKeyDown={handleMessageKeyDown}
                disabled={
                  (isDmView && !activeConversationId) ||
                  (!isDmView && !activeChannelId)
                }
              />

              <button
                type="submit"
                className="auth-button discord-send-button"
                disabled={
                  isSendingMessage ||
                  (isDmView && !activeConversationId) ||
                  (!isDmView && !activeChannelId)
                }
              >
                {isSendingMessage ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </main>

        <aside className="server-members-panel discord-right-pane">
          {isDmView ? (
            <>
              <div className="discord-right-pane-header">
                <h2 className="server-members-title">Profile</h2>
              </div>

              {activeConversationUser ? (
                <div className="discord-profile-card">
                  <div className="discord-profile-banner" />
                  <div className="discord-profile-avatar large-avatar">
                    {getInitial(activeConversationUser.username)}
                    <span
                      className={`discord-status-dot discord-profile-status ${getPresenceColorClass(
                        activeConversationUser.presence_status
                      )}`}
                    />
                  </div>
                  <div className="discord-profile-name">
                    {activeConversationUser.username}
                  </div>
                  <div className="discord-profile-meta">
                    {activeConversationUser.email}
                  </div>
                  <div className="discord-profile-meta discord-profile-presence">
                    {activeConversationUser.presence_status === "online"
                      ? "Online"
                      : "Offline"}
                  </div>
                </div>
              ) : (
                <div className="discord-profile-card compact-profile-card">
                  <div className="discord-profile-name">{user?.username}</div>
                  <div className="discord-profile-meta">{user?.email}</div>
                  <div className="discord-profile-meta">Friends: {friends.length}</div>
                  <div className="discord-profile-meta">
                    Direct conversations: {directConversations.length}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="discord-right-pane-header">
                <h2 className="server-members-title">Members</h2>
              </div>

              {membersError && (
                <p className="auth-error server-inline-error">{membersError}</p>
              )}

              <div className="server-members-list discord-member-groups">
                <div className="discord-members-group">
                  <div className="discord-members-group-title">
                    Online — {onlineMembers.length}
                  </div>

                  {onlineMembers.length === 0 ? (
                    <p className="server-members-empty">No members online.</p>
                  ) : (
                    <div className="server-members-list discord-member-list">
                      {onlineMembers.map((member) => (
                        <div key={getMemberId(member)} className="server-member-item discord-member-item">
                          <div className="discord-member-row-top">
                            <div className="discord-profile-avatar member-avatar">
                              {getInitial(getMemberName(member))}
                              <span
                                className={`discord-status-dot discord-profile-status ${getPresenceColorClass(
                                  getMemberPresenceStatus(member)
                                )}`}
                              />
                            </div>

                            <div className="discord-member-text">
                              <div className="server-member-name">
                                {getMemberName(member)}
                                {isOwner(member) ? " (Owner)" : ""}
                              </div>
                              <div className="server-member-email">
                                {getMemberEmail(member)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="discord-members-group">
                  <div className="discord-members-group-title">
                    Offline — {offlineMembers.length}
                  </div>

                  {offlineMembers.length === 0 ? (
                    <p className="server-members-empty">No members offline.</p>
                  ) : (
                    <div className="server-members-list discord-member-list">
                      {offlineMembers.map((member) => (
                        <div key={getMemberId(member)} className="server-member-item discord-member-item">
                          <div className="discord-member-row-top">
                            <div className="discord-profile-avatar member-avatar">
                              {getInitial(getMemberName(member))}
                              <span
                                className={`discord-status-dot discord-profile-status ${getPresenceColorClass(
                                  getMemberPresenceStatus(member)
                                )}`}
                              />
                            </div>

                            <div className="discord-member-text">
                              <div className="server-member-name">
                                {getMemberName(member)}
                                {isOwner(member) ? " (Owner)" : ""}
                              </div>
                              <div className="server-member-email">
                                {getMemberEmail(member)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {deleteServerError && (
                <p className="auth-error server-inline-error">
                  {deleteServerError}
                </p>
              )}

              {activeServer && (
                <button
                  type="button"
                  className="auth-button auth-button-danger compact-button discord-danger-button"
                  onClick={handleDeleteOrLeaveServer}
                  disabled={isDeletingServer}
                >
                  {isDeletingServer
                    ? currentUserIsOwner
                      ? "Deleting..."
                      : "Leaving..."
                    : currentUserIsOwner
                      ? "Delete server"
                      : "Leave server"}
                </button>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

export default MainPage;
