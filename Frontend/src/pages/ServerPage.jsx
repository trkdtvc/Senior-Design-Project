import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getUserServers, deleteServer } from "../services/serverService";
import { getServerChannels, createChannel } from "../services/channelService";
import {
  getChannelMessages,
  createMessage
} from "../services/messageService";
import "../styles/auth.css";

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

const ServerPage = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();

  const messagesContainerRef = useRef(null);
  const messageInputRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  const [server, setServer] = useState(null);
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [channelName, setChannelName] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [error, setError] = useState("");
  const [channelError, setChannelError] = useState("");
  const [messagesError, setMessagesError] = useState("");
  const [createError, setCreateError] = useState("");
  const [messageCreateError, setMessageCreateError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const resetMessageInputHeight = () => {
    if (!messageInputRef.current) {
      return;
    }

    messageInputRef.current.style.height = "44px";
  };

  const handleMessageInputChange = (e) => {
    setMessageContent(e.target.value);
    setMessageCreateError("");
    e.target.style.height = "44px";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
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
        setCreateError("");
        setMessageCreateError("");
        setDeleteError("");

        const serverData = await getUserServers(token);
        const servers = normalizeServers(serverData);

        const matchedServer = servers.find(
          (item) => String(getServerId(item)) === String(serverId)
        );

        if (!matchedServer) {
          setError("Server not found.");
          setServer(null);
          setChannels([]);
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
      } catch (error) {
        localStorage.removeItem("token");
        navigate("/login");
      } finally {
        setIsLoading(false);
      }
    };

    fetchServerPageData();
  }, [serverId, navigate]);

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

    const intervalId = setInterval(() => {
      loadMessages(activeChannelId, {
        showLoader: false,
        showError: false,
        clearMessagesOnError: false
      });
    }, 3000);

    return () => clearInterval(intervalId);
  }, [activeChannelId, loadMessages]);

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

      await loadMessages(activeChannelId, {
        showLoader: false,
        showError: true,
        clearMessagesOnError: false
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

  const activeChannel = channels.find(
    (channel) => String(getChannelId(channel)) === String(activeChannelId)
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

            {deleteError && (
              <p className="auth-error server-inline-error">{deleteError}</p>
            )}

            <button
              type="button"
              className="auth-button auth-button-danger"
              onClick={handleDeleteServer}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete server"}
            </button>
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
      </div>
    </div>
  );
};

export default ServerPage;