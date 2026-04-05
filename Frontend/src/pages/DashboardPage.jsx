import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../services/authService";
import "../styles/auth.css";

const DashboardPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const data = await getMe(token);
        setUser(data);
      } catch (err) {
        localStorage.removeItem("token");
        setError(err.message || "Failed to load user data.");
        navigate("/login");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
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
            <p><strong>Username:</strong> {user.username}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>User ID:</strong> {user.user_id}</p>
          </div>
        )}

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