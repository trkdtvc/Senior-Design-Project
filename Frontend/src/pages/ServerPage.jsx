import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getUserServers } from "../services/serverService";
import "../styles/auth.css";

const ServerPage = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();

  const [server, setServer] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchServer = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const data = await getUserServers(token);

        let servers = [];

        if (Array.isArray(data)) {
          servers = data;
        } else if (Array.isArray(data.servers)) {
          servers = data.servers;
        } else if (Array.isArray(data.data)) {
          servers = data.data;
        }

        const matchedServer = servers.find(
          (item) => String(item.server_id) === String(serverId)
        );

        if (!matchedServer) {
          setError("Server not found.");
        } else {
          setServer(matchedServer);
        }
      } catch (err) {
        localStorage.removeItem("token");
        navigate("/login");
      } finally {
        setIsLoading(false);
      }
    };

    fetchServer();
  }, [navigate, serverId]);

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-logo">YFNC</h1>
          <p className="auth-subtitle">Loading server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">YFNC</h1>

        {error ? (
          <>
            <p className="auth-error">{error}</p>
            <p className="auth-footer">
              <Link to="/dashboard">Back to dashboard</Link>
            </p>
          </>
        ) : (
          <>
            <p className="auth-subtitle">{server.server_name}</p>

            <div style={{ marginTop: "1.5rem", textAlign: "left" }}>
              <p>
                <strong>Server ID:</strong> {server.server_id}
              </p>
              <p>
                <strong>Server Name:</strong> {server.server_name}
              </p>
              {server.description && (
                <p>
                  <strong>Description:</strong> {server.description}
                </p>
              )}
            </div>

            <p className="auth-footer" style={{ marginTop: "1.5rem" }}>
              <Link to="/dashboard">Back to dashboard</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ServerPage;