import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../services/authService";
import { getUserServers, createServer } from "../services/serverService";
import "../styles/auth.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const normalizeServers = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.servers)) return data.servers;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const getServerId = (server) =>
  server?.server_id || server?.id || server?.serverId || null;

const getServerName = (server) =>
  server?.server_name || server?.name || "Untitled Server";

const getServerDescription = (server) =>
  server?.description || server?.server_description || "";

const DashboardPage = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [servers, setServers] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState({
    server_name: "",
    description: ""
  });
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  const [inviteCode, setInviteCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const loadServers = async (token) => {
    const serverData = await getUserServers(token);
    const normalizedServers = normalizeServers(serverData);
    setServers(normalizedServers);
    return normalizedServers;
  };

  const loadDashboardData = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const userData = await getMe(token);
      setUser(userData);

      await loadServers(token);
    } catch (error) {
      localStorage.removeItem("token");
      setError(
        error.message || "Failed to load dashboard data. Please log in again."
      );
      navigate("/login");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prevData) => ({
      ...prevData,
      [name]: value
    }));

    setCreateError("");
  };

  const handleInviteChange = (e) => {
    setInviteCode(e.target.value);
    setJoinError("");
  };

  const handleCreateServer = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("token");
    const trimmedName = formData.server_name.trim();
    const trimmedDescription = formData.description.trim();

    if (!trimmedName) {
      setCreateError("Server name is required.");
      return;
    }

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setIsCreating(true);
      setCreateError("");

      const payload = {
        server_name: trimmedName,
        description: trimmedDescription
      };

      const createdServer = await createServer(token, payload);

      setFormData({
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
        navigate(`/server/${newServerId}`);
      }
    } catch (error) {
      setCreateError(
        error.message || "Failed to create server. Please try again."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinServer = async (e) => {
    e.preventDefault();
    
    const token = localStorage.getItem("token");
    const trimmedInviteCode = inviteCode.trim();
    
    if (!trimmedInviteCode) {
      setJoinError("Invite code is required.");
      return;
    }
    
    if (!token) {
      navigate("/login");
      return;
    }
    
    try {
      setIsJoining(true);
      setJoinError("");
      
      const response = await fetch(`${API_BASE_URL}/server-invites/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          invite_code: trimmedInviteCode
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Failed to join server.");
      }
      
      setInviteCode("");
      await loadServers(token);
      
      if (data.server_id) {
        navigate(`/server/${data.server_id}`);
      }
    } catch (error) {
      setJoinError(error.message || "Failed to join server.");
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-logo">YFNC</h1>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">YFNC</h1>
        <p>Welcome to your dashboard.</p>

        {error && <p className="auth-error">{error}</p>}

        {user && (
  <div style={{ textAlign: "left", marginTop: "1rem", marginBottom: "1.5rem" }}>
    <h2 style={{ marginBottom: "0.75rem" }}>Your account</h2>
    <p><strong>Username:</strong> {user.username}</p>
    <p><strong>Email:</strong> {user.email}</p>
    <p><strong>User ID:</strong> {user.user_id}</p>
  </div>
)}

<div style={{ textAlign: "left", marginTop: "1.5rem", marginBottom: "1.5rem" }}>
  <h2 style={{ marginBottom: "0.75rem" }}>Your servers</h2>

  {servers.length === 0 ? (
    <p>You are not a member of any servers yet.</p>
  ) : (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      {servers.map((server) => {
        const serverId = getServerId(server);
        const serverName = getServerName(server);
        const serverDescription = getServerDescription(server);

        return (
          <button
            key={serverId}
            type="button"
            className="auth-button"
            style={{ textAlign: "left" }}
            onClick={() => navigate(`/server/${serverId}`)}
          >
            <div style={{ fontWeight: "bold" }}>{serverName}</div>
            <div style={{ fontSize: "0.95rem", opacity: 0.9 }}>
              {serverDescription || "No description provided."}
            </div>
          </button>
        );
      })}
    </div>
  )}
</div>

<div style={{ textAlign: "left", marginTop: "1.5rem", marginBottom: "1.5rem" }}>
  <h2 style={{ marginBottom: "0.75rem" }}>Join a server</h2>

  {joinError && <p className="auth-error">{joinError}</p>}

  <form onSubmit={handleJoinServer}>
    <div className="auth-form-group">
      <label htmlFor="invite_code" className="auth-label">
        Invite code
      </label>
      <input
        id="invite_code"
        name="invite_code"
        type="text"
        className="auth-input"
        value={inviteCode}
        onChange={handleInviteChange}
        placeholder="Enter invite code"
      />
    </div>

    <button
      type="submit"
      className="auth-button"
      disabled={isJoining}
    >
      {isJoining ? "Joining..." : "Join server"}
    </button>
  </form>
</div>

<div style={{ textAlign: "left", marginTop: "1.5rem", marginBottom: "1.5rem" }}>
  <h2 style={{ marginBottom: "0.75rem" }}>Create a server</h2>

  {createError && <p className="auth-error">{createError}</p>}

  <form onSubmit={handleCreateServer}>
    <div className="auth-form-group">
      <label htmlFor="server_name" className="auth-label">
        Server name
      </label>
      <input
        id="server_name"
        name="server_name"
        type="text"
        className="auth-input"
        value={formData.server_name}
        onChange={handleChange}
        placeholder="Enter server name"
      />
    </div>

    <div className="auth-form-group">
      <label htmlFor="description" className="auth-label">
        Description
      </label>
      <textarea
        id="description"
        name="description"
        className="auth-input"
        value={formData.description}
        onChange={handleChange}
        placeholder="Enter server description"
        rows="3"
        style={{ resize: "vertical", minHeight: "90px" }}
      />
    </div>

    <button
      type="submit"
      className="auth-button"
      disabled={isCreating}
    >
      {isCreating ? "Creating..." : "Create server"}
    </button>
  </form>
</div>

        

        <button
          type="button"
          className="auth-button auth-button-secondary"
          onClick={handleLogout}
        >
          Log out
        </button>
      </div>
    </div>
  );
};

export default DashboardPage;