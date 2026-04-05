import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../services/authService";
import { getUserServers } from "../services/serverService";
import "../styles/auth.css";

const DashboardPage = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [servers, setServers] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const userData = await getMe(token);
        setUser(userData);

        const serverData = await getUserServers(token);
        console.log("serverData:", serverData);

        if (Array.isArray(serverData)) {
          setServers(serverData);
        } else if (Array.isArray(serverData.servers)) {
          setServers(serverData.servers);
        } else if (Array.isArray(serverData.data)) {
          setServers(serverData.data);
        } else {
          setServers([]);
        }
      } catch (err) {
        localStorage.removeItem("token");
        setError(err.message || "Failed to load dashboard data.");
        navigate("/login");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-logo">YFNC</h1>
          <p className="auth-subtitle">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">YFNC</h1>
        <p className="auth-subtitle">Welcome to your dashboard.</p>

        {error && <p className="auth-error">{error}</p>}

        {user && (
          <div style={{ marginTop: "1.5rem", textAlign: "left" }}>
            <p>
              <strong>Username:</strong> {user.username}
            </p>
            <p>
              <strong>Email:</strong> {user.email}
            </p>
            <p>
              <strong>User ID:</strong> {user.user_id}
            </p>
          </div>
        )}

        <div style={{ marginTop: "1.5rem", textAlign: "left" }}>
          <p>
            <strong>Your Servers:</strong>
          </p>

          {servers.length === 0 ? (
            <p>You are not a member of any servers yet.</p>
          ) : (
            <ul style={{ paddingLeft: "1.25rem", marginTop: "0.5rem" }}>
              {servers.map((server) => (
                <li key={server.server_id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/server/${server.server_id}`)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "inherit",
                      cursor: "pointer",
                      textDecoration: "underline"
                    }}
                  >
                    {server.server_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="auth-button"
          onClick={handleLogout}
          style={{ marginTop: "1.5rem" }}
        >
          Log out
        </button>
      </div>
    </div>
  );
};

export default DashboardPage;