import { useEffect, useState } from "react";
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

const ServerPage = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();

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

        const channelData = await getServerChannels(token, serverId);
        const normalizedChannels = normalizeChannels(channelData);

        setChannels(normalizedChannels);

        if (normalizedChannels.length > 0) {
          setActiveChannelId(getChannelId(normalizedChannels[0]));
        } else {
          setActiveChannelId(null);
          setMessages([]);
          setMessageContent("");
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
    const fetchMessages = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login");
        return;
      }

      if (!activeChannelId) {
        setMessages([]);
        setMessagesError("");
        return;
      }

      try {
        setIsMessagesLoading(true);
        setMessagesError("");

        const messageData = await getChannelMessages(token, activeChannelId);
        setMessages(normalizeMessages(messageData));
      } catch (error) {
        setMessages([]);
        setMessagesError(error.message || "Failed to load messages.");
      } finally {
        setIsMessagesLoading(false);
      }
    };

    fetchMessages();
  }, [activeChannelId, navigate]);

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

      if (response?.channel) {
        setChannels((prevChannels) => [...prevChannels, response.channel]);
        setActiveChannelId(getChannelId(response.channel));
        setMessageContent("");
        setMessageCreateError("");
      }

      setChannelName("");
    } catch (error) {
      setCreateError(error.message || "Failed to create channel.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

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

      await createMessage(token, {
        channel_id: activeChannelId,
        content: messageContent.trim()
      });

      const messageData = await getChannelMessages(token, activeChannelId);
      setMessages(normalizeMessages(messageData));
      setMessageContent("");
    } catch (error) {
      setMessageCreateError(error.message || "Failed to send message.");
    } finally {
      setIsSendingMessage(false);
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
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">{getServerName(server)}</h1>

        <div
          style={{ textAlign: "left", marginTop: "1rem", marginBottom: "1.5rem" }}
        >
          <p>
            <strong>Server ID:</strong> {getServerId(server)}
          </p>
          <p>
            <strong>Description:</strong>{" "}
            {getServerDescription(server) || "No description provided."}
          </p>
        </div>

        <div style={{ textAlign: "left", marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>Channels</h2>

          {channelError && (
            <p className="auth-error" style={{ marginBottom: "0.75rem" }}>
              {channelError}
            </p>
          )}

          {channels.length === 0 ? (
            <p>No channels found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {channels.map((channel) => {
                const channelId = getChannelId(channel);
                const isActive = String(channelId) === String(activeChannelId);

                return (
                  <button
                    key={channelId}
                    type="button"
                    onClick={() => {
                      setActiveChannelId(channelId);
                      setMessageCreateError("");
                      setMessageContent("");
                    }}
                    style={{
                      padding: "0.75rem 1rem",
                      border: isActive ? "1px solid #5865f2" : "1px solid #2a2a2a",
                      borderRadius: "10px",
                      backgroundColor: isActive ? "#1d2340" : "#1a1a1a",
                      color: "#ffffff",
                      textAlign: "left",
                      cursor: "pointer"
                    }}
                  >
                    #{getChannelName(channel)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {activeChannel && (
          <div style={{ textAlign: "left", marginBottom: "1.5rem" }}>
            <h2 style={{ marginBottom: "0.75rem" }}>Selected channel</h2>
            <p>#{getChannelName(activeChannel)}</p>
          </div>
        )}

        <div style={{ textAlign: "left", marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>Messages</h2>

          <form onSubmit={handleSendMessage} style={{ marginBottom: "1rem" }}>
            <div className="auth-form-group">
              <input
                type="text"
                className="auth-input"
                placeholder={
                  activeChannel
                    ? `Message #${getChannelName(activeChannel)}`
                    : "Select a channel first"
                }
                value={messageContent}
                onChange={(e) => {
                  setMessageContent(e.target.value);
                  setMessageCreateError("");
                }}
                disabled={!activeChannel || isSendingMessage}
              />
            </div>

            {messageCreateError && (
              <p className="auth-error" style={{ marginBottom: "1rem" }}>
                {messageCreateError}
              </p>
            )}

            <button
              type="submit"
              className="auth-button"
              disabled={!activeChannel || isSendingMessage}
              style={{ marginBottom: "1rem" }}
            >
              {isSendingMessage ? "Sending..." : "Send message"}
            </button>
          </form>

          {isMessagesLoading ? (
            <p>Loading messages...</p>
          ) : messagesError ? (
            <p className="auth-error">{messagesError}</p>
          ) : messages.length === 0 ? (
            <p>No messages yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {messages.map((message) => (
                <div
                  key={message.message_id}
                  style={{
                    padding: "0.75rem 1rem",
                    border: "1px solid #2a2a2a",
                    borderRadius: "10px",
                    backgroundColor: "#1a1a1a"
                  }}
                >
                  <p style={{ margin: 0, fontWeight: "bold", marginBottom: "0.35rem" }}>
                    {message.username}
                  </p>
                  <p style={{ margin: 0 }}>{message.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <h2 style={{ textAlign: "left", marginBottom: "0.75rem" }}>
          Create channel
        </h2>

        <form onSubmit={handleCreateChannel} style={{ marginBottom: "1.5rem" }}>
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
            <p className="auth-error" style={{ marginBottom: "1rem" }}>
              {createError}
            </p>
          )}

          <button
            type="submit"
            className="auth-button"
            disabled={isCreating}
            style={{ marginTop: "0.5rem" }}
          >
            {isCreating ? "Creating..." : "Create channel"}
          </button>
        </form>

        {deleteError && (
          <p className="auth-error" style={{ marginBottom: "1rem" }}>
            {deleteError}
          </p>
        )}

        <button
          type="button"
          className="auth-button auth-button-danger"
          onClick={handleDeleteServer}
          disabled={isDeleting}
          style={{ marginBottom: "1rem" }}
        >
          {isDeleting ? "Deleting..." : "Delete server"}
        </button>

        <Link to="/dashboard" className="auth-link">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
};

export default ServerPage;