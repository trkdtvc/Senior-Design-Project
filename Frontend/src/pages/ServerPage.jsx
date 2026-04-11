import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { getUserServers, deleteServer } from "../services/serverService";
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
import {
  createServerInvite,
  getServerInvites
} from "../services/serverInviteService";
import "../styles/auth.css";
import { getMe } from "../services/authService";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "");

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

const normalizeInvites = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.invites)) return data.invites;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const getServerId = (server) =>
  server?.server_id || server?.id || server?.serverId || null;

const getServerName = (server) =>
  server?.server_name || server?.name || "Untitled Server";

const getServerDescription = (server) =>
  server?.description || server?.server_description || "";

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

const getReadablePresenceStatus = (status) => {
  return status === "online" ? "Online" : "Offline";
};

const getPresenceColor = (status) => {
  return status === "online" ? "#23a55a" : "#f23f43";
};

const getServerOwnerId = (server) =>
  server?.owner_id || server?.ownerId || null;

const isOwner = (member) =>
  member?.is_owner === 1 || member?.is_owner === true || false;

const getInviteId = (invite) =>
  invite?.invite_id || invite?.id || invite?.inviteId || null;

const getInviteCode = (invite) =>
  invite?.invite_code || invite?.code || "";

const getInviteExpiresAt = (invite) =>
  invite?.expires_at || invite?.expiresAt || null;

const formatMessageTimestamp = (timestamp) => {
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

const formatInviteExpiry = (timestamp) => {
  if (!timestamp) {
    return "No expiration";
  }

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

const ServerPage = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();

  const messagesContainerRef = useRef(null);
  const messageInputRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const socketRef = useRef(null);

  const [server, setServer] = useState(null);
  const [channels, setChannels] = useState([]);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [channelName, setChannelName] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [error, setError] = useState("");
  const [channelError, setChannelError] = useState("");
  const [messagesError, setMessagesError] = useState("");
  const [membersError, setMembersError] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [createError, setCreateError] = useState("");
  const [deleteChannelError, setDeleteChannelError] = useState("");
  const [messageCreateError, setMessageCreateError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isDeletingChannel, setIsDeletingChannel] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [inviteExpiryDays, setInviteExpiryDays] = useState("7");
  const [copiedInviteId, setCopiedInviteId] = useState(null);

  const resetMessageInputHeight = () => {
    if (!messageInputRef.current) {
      return;
    }

    messageInputRef.current.style.height = "48px";
  };

  const handleMessageInputChange = (e) => {
    setMessageContent(e.target.value);
    setMessageCreateError("");
    e.target.style.height = "48px";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 148)}px`;
  };

  const loadMessages = useCallback(
    async (
      channelId,
      {
        showLoader = false,
        showError = true,
        clearMessagesOnError = true
      } = {}
    ) => {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login");
        return;
      }

      if (!channelId) {
        setMessages([]);
        setMessagesError("");
        return;
      }

      try {
        if (showLoader) {
          setIsMessagesLoading(true);
        }

        if (showError) {
          setMessagesError("");
        }

        const messageData = await getChannelMessages(token, channelId);
        setMessages(normalizeMessages(messageData));
      } catch (error) {
        if (clearMessagesOnError) {
          setMessages([]);
        }

        if (showError) {
          setMessagesError(error.message || "Failed to load messages.");
        }
      } finally {
        if (showLoader) {
          setIsMessagesLoading(false);
        }
      }
    },
    [navigate]
  );

  const loadMembers = useCallback(async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    if (!serverId) {
      setMembers([]);
      setMembersError("");
      return;
    }

    try {
      setMembersError("");
      const memberData = await getServerMembers(serverId, token);
      setMembers(normalizeMembers(memberData));
    } catch (error) {
      setMembers([]);
      setMembersError(error.message || "Failed to load server members.");
    }
  }, [serverId, navigate]);

  const loadInvites = useCallback(async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    if (!serverId) {
      setInvites([]);
      setInviteError("");
      return;
    }

    try {
      setInviteError("");
      const inviteData = await getServerInvites(serverId, token);
      setInvites(normalizeInvites(inviteData));
    } catch (error) {
      setInvites([]);
      setInviteError(error.message || "Failed to load invites.");
    }
  }, [serverId, navigate]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: {
        token
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [navigate]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket || !serverId) {
      return;
    }

    const serverIdString = String(serverId);

    socket.emit("join_server", serverIdString);

    return () => {
      socket.emit("leave_server", serverIdString);
    };
  }, [serverId]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket) {
      return;
    }

    const handlePresenceUpdate = (presenceData) => {
      if (!presenceData?.user_id) {
        return;
      }

      setMembers((prevMembers) =>
        prevMembers.map((member) => {
          if (String(getMemberUserId(member)) !== String(presenceData.user_id)) {
            return member;
          }

          return {
            ...member,
            presence_status: presenceData.status,
            last_seen_at: presenceData.last_seen_at ?? member.last_seen_at
          };
        })
      );
    };

    socket.on("presence_update", handlePresenceUpdate);

    return () => {
      socket.off("presence_update", handlePresenceUpdate);
    };
  }, [serverId]);

  useEffect(() => {
    const fetchServerPageData = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        setChannelError("");
        setMessagesError("");
        setMembersError("");
        setInviteError("");
        setInviteSuccess("");
        setCreateError("");
        setDeleteChannelError("");
        setMessageCreateError("");
        setDeleteError("");

        const currentUserData = await getMe(token);
        setCurrentUser(currentUserData);

        const serverData = await getUserServers(token);
        const servers = normalizeServers(serverData);

        const matchedServer = servers.find(
          (item) => String(getServerId(item)) === String(serverId)
        );

        if (!matchedServer) {
          setError("Server not found.");
          setServer(null);
          setChannels([]);
          setMembers([]);
          setInvites([]);
          setActiveChannelId(null);
          setMessages([]);
          setMessageContent("");
          return;
        }

        setServer(matchedServer);

        try {
          const channelData = await getServerChannels(token, serverId);
          const normalizedChannels = normalizeChannels(channelData);

          setChannels(normalizedChannels);

          if (normalizedChannels.length > 0) {
            setActiveChannelId((prevActiveChannelId) => {
              const existingChannelStillExists = normalizedChannels.some(
                (channel) =>
                  String(getChannelId(channel)) === String(prevActiveChannelId)
              );

              if (existingChannelStillExists) {
                return prevActiveChannelId;
              }

              return getChannelId(normalizedChannels[0]);
            });
          } else {
            setActiveChannelId(null);
            setMessages([]);
            setMessageContent("");
          }
        } catch (error) {
          setChannels([]);
          setActiveChannelId(null);
          setMessages([]);
          setMessageContent("");
          setChannelError(error.message || "Failed to load channels.");
        }

        await loadMembers();
        await loadInvites();
      } catch (error) {
        localStorage.removeItem("token");
        navigate("/login");
      } finally {
        setIsLoading(false);
      }
    };

    fetchServerPageData();
  }, [serverId, navigate, loadMembers, loadInvites]);

  useEffect(() => {
    if (!activeChannelId) {
      setMessages([]);
      setMessagesError("");
      return;
    }

    shouldAutoScrollRef.current = true;

    loadMessages(activeChannelId, {
      showLoader: true,
      showError: true,
      clearMessagesOnError: true
    });
  }, [activeChannelId, loadMessages]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket || !activeChannelId) {
      return;
    }

    const channelIdString = String(activeChannelId);

    socket.emit("join_channel", channelIdString);

    return () => {
      socket.emit("leave_channel", channelIdString);
    };
  }, [activeChannelId]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket) {
      return;
    }

    const handleNewMessage = (incomingMessage) => {
      if (
        !incomingMessage ||
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

      setMessages((prevMessages) => {
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

    socket.on("new_message", handleNewMessage);

    return () => {
      socket.off("new_message", handleNewMessage);
    };
  }, [activeChannelId]);

  useEffect(() => {
    if (!activeChannelId || isSendingMessage || !messageInputRef.current) {
      return;
    }

    messageInputRef.current.focus();
  }, [activeChannelId, isSendingMessage]);

  useEffect(() => {
    const container = messagesContainerRef.current;

    if (!container || !shouldAutoScrollRef.current) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages]);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;

    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    shouldAutoScrollRef.current = distanceFromBottom < 120;
  };

  const handleSelectChannel = (channelId) => {
    shouldAutoScrollRef.current = true;
    setActiveChannelId(channelId);
    setDeleteChannelError("");
    setMessageCreateError("");
    setMessageContent("");

    requestAnimationFrame(() => {
      resetMessageInputHeight();
    });
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    if (!channelName.trim()) {
      setCreateError("Channel name is required.");
      return;
    }

    try {
      setIsCreating(true);
      setCreateError("");
      setDeleteChannelError("");

      const response = await createChannel(token, {
        server_id: serverId,
        channel_name: channelName.trim()
      });

      const createdChannel = response?.channel || response?.data || response;

      const refreshedChannelData = await getServerChannels(token, serverId);
      const refreshedChannels = normalizeChannels(refreshedChannelData);

      setChannels(refreshedChannels);

      const createdChannelId = getChannelId(createdChannel);

      if (createdChannelId) {
        shouldAutoScrollRef.current = true;
        setActiveChannelId(createdChannelId);
      } else if (refreshedChannels.length > 0) {
        shouldAutoScrollRef.current = true;
        setActiveChannelId(
          getChannelId(refreshedChannels[refreshedChannels.length - 1])
        );
      } else {
        setActiveChannelId(null);
      }

      setChannelName("");
      setMessageContent("");
      setMessageCreateError("");

      requestAnimationFrame(() => {
        resetMessageInputHeight();
      });
    } catch (error) {
      setCreateError(error.message || "Failed to create channel.");
    } finally {
      setIsCreating(false);
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
      setMessageCreateError("");
      shouldAutoScrollRef.current = true;

      await deleteChannelById(token, getChannelId(activeChannel));

      const refreshedChannelData = await getServerChannels(token, serverId);
      const refreshedChannels = normalizeChannels(refreshedChannelData);

      setChannels(refreshedChannels);
      setMessages([]);
      setMessageContent("");

      if (refreshedChannels.length > 0) {
        setActiveChannelId(getChannelId(refreshedChannels[0]));
      } else {
        setActiveChannelId(null);
      }

      requestAnimationFrame(() => {
        resetMessageInputHeight();
      });
    } catch (error) {
      setDeleteChannelError(error.message || "Failed to delete channel.");
    } finally {
      setIsDeletingChannel(false);
    }
  };

  const handleCreateInvite = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setIsCreatingInvite(true);
      setInviteError("");
      setInviteSuccess("");
      setCopiedInviteId(null);

      const payload = inviteExpiryDays
        ? { expires_in_days: Number(inviteExpiryDays) }
        : {};

      const response = await createServerInvite(serverId, token, payload);

      setInviteSuccess(
        response?.invite_code
          ? `Invite created: ${response.invite_code}`
          : "Invite created successfully."
      );

      await loadInvites();
    } catch (error) {
      setInviteError(error.message || "Failed to create invite.");
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleCopyInvite = async (inviteCode, inviteId) => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiedInviteId(inviteId);
      setInviteSuccess(`Invite code copied: ${inviteCode}`);
    } catch (error) {
      setInviteError("Failed to copy invite code.");
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

    if (!activeChannelId) {
      setMessageCreateError("Select a channel first.");
      return;
    }

    if (!messageContent.trim()) {
      setMessageCreateError("Message content is required.");
      return;
    }

    try {
      setIsSendingMessage(true);
      setMessageCreateError("");
      shouldAutoScrollRef.current = true;

      await createMessage(token, {
        channel_id: activeChannelId,
        content: messageContent.trim()
      });

      setMessageContent("");

      requestAnimationFrame(() => {
        resetMessageInputHeight();

        if (messageInputRef.current) {
          messageInputRef.current.focus();
        }
      });
    } catch (error) {
      setMessageCreateError(error.message || "Failed to send message.");
    } finally {
      setIsSendingMessage(false);
    }
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

  const handleDeleteServer = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${getServerName(server)}"? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeleting(true);
      setDeleteError("");

      await deleteServer(token, getServerId(server));
      navigate("/dashboard");
    } catch (error) {
      setDeleteError(error.message || "Failed to delete server.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLeaveServer = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to leave "${getServerName(server)}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeleting(true);
      setDeleteError("");

      const response = await fetch(
        `http://localhost:5000/api/server-members/${serverId}/leave`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to leave server.");
      }

      navigate("/dashboard");
    } catch (error) {
      setDeleteError(error.message || "Failed to leave server.");
    } finally {
      setIsDeleting(false);
    }
  };

  const activeChannel = channels.find(
    (channel) => String(getChannelId(channel)) === String(activeChannelId)
  );

  const selectedChannelName = activeChannel
    ? getChannelName(activeChannel)
    : "";

  const isGeneralChannelSelected =
    selectedChannelName.trim().toLowerCase() === "general";

  const canDeleteSelectedChannel =
    !!activeChannel && channels.length > 1 && !isGeneralChannelSelected;

  const currentUserId = currentUser?.user_id || currentUser?.id || null;

  const currentUserIsOwner =
    (server && currentUserId
      ? String(getServerOwnerId(server)) === String(currentUserId)
      : false) ||
    members.some(
      (member) =>
        String(getMemberUserId(member)) === String(currentUserId) && isOwner(member)
    );

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-logo">YFNC</h1>
          <p>Loading server...</p>
        </div>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-logo">YFNC</h1>
          <p className="auth-error">{error || "Server not found."}</p>
          <Link to="/dashboard" className="auth-link">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="server-page">
      <div className="server-layout">
        <aside className="server-sidebar">
          <div className="server-sidebar-top">
            <div className="server-sidebar-header">
              <span className="server-brand">YFNC</span>
              <Link to="/dashboard" className="server-back-link">
                Back to dashboard
              </Link>
            </div>

            <div className="server-info-card">
              <h1 className="server-title">{getServerName(server)}</h1>
              <p className="server-description">
                {getServerDescription(server) || "No description provided."}
              </p>
              <p className="server-meta">Server ID: {getServerId(server)}</p>
            </div>

            <div className="server-section">
              <h2 className="server-section-title">Channels</h2>

              {channelError && (
                <p className="auth-error server-inline-error">{channelError}</p>
              )}

              {channels.length === 0 ? (
                <p className="server-empty-text">No channels found.</p>
              ) : (
                <div className="channel-list">
                  {channels.map((channel) => {
                    const channelId = getChannelId(channel);
                    const isActive =
                      String(channelId) === String(activeChannelId);

                    return (
                      <button
                        key={channelId}
                        type="button"
                        onClick={() => handleSelectChannel(channelId)}
                        className={`channel-button${
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

              {deleteChannelError && (
                <p className="auth-error server-inline-error">
                  {deleteChannelError}
                </p>
              )}

              {activeChannel && isGeneralChannelSelected && (
                <p className="server-empty-text">
                  The "general" channel cannot be deleted.
                </p>
              )}

              {activeChannel && !isGeneralChannelSelected && (
                <button
                  type="button"
                  className="auth-button auth-button-danger"
                  onClick={handleDeleteChannel}
                  disabled={!canDeleteSelectedChannel || isDeletingChannel}
                >
                  {isDeletingChannel
                    ? "Deleting..."
                    : `Delete #${getChannelName(activeChannel)}`}
                </button>
              )}
            </div>
          </div>

          <div className="server-sidebar-bottom">
            <div className="server-section">
              <h2 className="server-section-title">Create channel</h2>

              <form
                onSubmit={handleCreateChannel}
                className="server-create-channel-form"
              >
                <div className="auth-form-group">
                  <label htmlFor="channelName" className="auth-label">
                    Channel name
                  </label>
                  <input
                    id="channelName"
                    type="text"
                    className="auth-input"
                    placeholder="Enter channel name"
                    value={channelName}
                    onChange={(e) => {
                      setChannelName(e.target.value);
                      setCreateError("");
                    }}
                  />
                </div>

                {createError && (
                  <p className="auth-error server-inline-error">{createError}</p>
                )}

                <button
                  type="submit"
                  className="auth-button"
                  disabled={isCreating}
                >
                  {isCreating ? "Creating..." : "Create channel"}
                </button>
              </form>
            </div>

            <div className="server-section">
              <h2 className="server-section-title">Invites</h2>

              {inviteError && (
                <p className="auth-error server-inline-error">{inviteError}</p>
              )}

              {inviteSuccess && (
                <p className="auth-success server-inline-success">
                  {inviteSuccess}
                </p>
              )}

              <div className="auth-form-group">
                <label htmlFor="inviteExpiryDays" className="auth-label">
                  Expiration
                </label>
                <select
                  id="inviteExpiryDays"
                  className="auth-input"
                  value={inviteExpiryDays}
                  onChange={(e) => setInviteExpiryDays(e.target.value)}
                >
                  <option value="1">1 day</option>
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                </select>
              </div>

              <button
                type="button"
                className="auth-button"
                onClick={handleCreateInvite}
                disabled={isCreatingInvite}
              >
                {isCreatingInvite ? "Creating..." : "Create invite code"}
              </button>

              {invites.length === 0 ? (
                <p className="server-empty-text">No active invites.</p>
              ) : (
                <div className="server-invite-list">
                  {invites.map((invite) => (
                    <div
                      key={getInviteId(invite)}
                      className="server-invite-item"
                    >
                      <button
                        type="button"
                        className="server-invite-code"
                        onClick={() =>
                          handleCopyInvite(
                            getInviteCode(invite),
                            getInviteId(invite)
                          )
                        }
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          textAlign: "left",
                          width: "100%"
                        }}
                      >
                        {getInviteCode(invite)}
                      </button>

                      <p className="server-invite-meta">
                        Expires: {formatInviteExpiry(getInviteExpiresAt(invite))}
                      </p>

                      {copiedInviteId === getInviteId(invite) && (
                        <p className="auth-success server-inline-success">
                          Copied to clipboard.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {deleteError && (
              <p className="auth-error server-inline-error">{deleteError}</p>
            )}

            {currentUserIsOwner ? (
              <button
                type="button"
                className="auth-button auth-button-danger"
                onClick={handleDeleteServer}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete server"}
              </button>
            ) : (
              <button
                type="button"
                className="auth-button auth-button-danger"
                onClick={handleLeaveServer}
                disabled={isDeleting}
              >
                {isDeleting ? "Leaving..." : "Leave server"}
              </button>
            )}
          </div>
        </aside>

        <main className="server-main">
          <div className="server-main-header">
            <div>
              <p className="server-main-label">Selected channel</p>
              <h2 className="server-main-title">
                {activeChannel
                  ? `#${getChannelName(activeChannel)}`
                  : "No channel selected"}
              </h2>
            </div>
          </div>

          <section className="server-messages-panel">
            {isMessagesLoading ? (
              <div className="server-state-message">Loading messages...</div>
            ) : messagesError ? (
              <div className="server-state-message server-state-error">
                {messagesError}
              </div>
            ) : !activeChannel ? (
              <div className="server-state-message">
                Select a channel to view messages.
              </div>
            ) : messages.length === 0 ? (
              <div className="server-state-message">No messages yet.</div>
            ) : (
              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="message-list"
              >
                {messages.map((message, index) => {
                  const timestamp = formatMessageTimestamp(
                    getMessageTimestamp(message)
                  );

                  return (
                    <div
                      key={getMessageId(message) || index}
                      className="server-message-card"
                    >
                      <div className="server-message-header">
                        <p className="server-message-author">
                          {getMessageAuthor(message)}
                        </p>
                        {timestamp && (
                          <span className="server-message-time">
                            {timestamp}
                          </span>
                        )}
                      </div>

                      <p className="server-message-content">
                        {getMessageContent(message)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <form onSubmit={handleSendMessage} className="server-message-form">
            {messageCreateError && (
              <p className="auth-error server-inline-error">
                {messageCreateError}
              </p>
            )}

            <div className="server-message-input-row">
              <textarea
                ref={messageInputRef}
                className="message-input"
                placeholder={`Message #${
                  activeChannel ? getChannelName(activeChannel) : "channel"
                }`}
                value={messageContent}
                onChange={handleMessageInputChange}
                onKeyDown={handleMessageKeyDown}
              />

              <button
                type="submit"
                className="auth-button server-send-button"
                disabled={!activeChannel || isSendingMessage}
              >
                {isSendingMessage ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </main>

        <aside className="server-members-panel">
          <h2 className="server-members-title">Members</h2>

          {membersError && (
            <p className="auth-error server-inline-error">{membersError}</p>
          )}

          {members.length === 0 ? (
            <p className="server-members-empty">No members found.</p>
          ) : (
            <div className="server-members-list">
              {members.map((member) => {
                const presenceStatus = getMemberPresenceStatus(member);

                return (
                  <div
                    key={getMemberId(member)}
                    className="server-member-item"
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                      }}
                    >
                      <span
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "999px",
                          backgroundColor: getPresenceColor(presenceStatus),
                          flexShrink: 0
                        }}
                      />

                      <div className="server-member-name">
                        {getMemberName(member)}
                        {isOwner(member) ? " (Owner)" : ""}
                      </div>
                    </div>

                    <div className="server-member-email">
                      {getMemberEmail(member)}
                    </div>

                    <div className="server-member-email">
                      {getReadablePresenceStatus(presenceStatus)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default ServerPage;