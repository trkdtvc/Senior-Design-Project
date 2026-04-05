import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getUserServers, deleteServer } from "../services/serverService";
import "../styles/auth.css";

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

const ServerPage = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();

  const [server, setServer] = useState(null);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchServer = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        setDeleteError("");

        const serverData = await getUserServers(token);
        const servers = normalizeServers(serverData);

        const matchedServer = servers.find(
          (item) => String(getServerId(item)) === String(serverId)
        );

        if (!matchedServer) {
          setError("Server not found.");
          setServer(null);
          return;
        }

        setServer(matchedServer);
      } catch (error) {
        localStorage.removeItem("token");
        navigate("/login");
      } finally {
        setIsLoading(false);
      }
    };

    fetchServer();
  }, [serverId, navigate]);

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

        <div style={{ textAlign: "left", marginTop: "1rem", marginBottom: "1.5rem" }}>
          <p><strong>Server ID:</strong> {getServerId(server)}</p>
          <p>
            <strong>Description:</strong>{" "}
            {getServerDescription(server) || "No description provided."}
          </p>
        </div>

        <div style={{ textAlign: "left", marginBottom: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>Server area</h2>
          <p>This server page is now connected and working.</p>
          <p>The next logical step is loading channels for this server.</p>
        </div>

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