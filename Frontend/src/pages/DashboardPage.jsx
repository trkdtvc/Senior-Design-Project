import { useNavigate } from "react-router-dom";

const DashboardPage = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">YFNC</h1>
        <p className="auth-subtitle">Welcome to your dashboard.</p>

        <div style={{ marginTop: "1.5rem" }}>
          <p>You are logged in successfully.</p>
          <p>This is the protected dashboard page.</p>
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