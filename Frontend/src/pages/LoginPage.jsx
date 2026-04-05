import { useState } from "react";
import { Link } from "react-router-dom";
import { loginUser } from "../services/authService";
import "../styles/auth.css";

const LoginPage = () => {
  const [formData, setFormData] = useState({
    login: "",
    password: ""
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prevData) => ({
      ...prevData,
      [name]: value
    }));

    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.login.trim() || !formData.password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      setSuccess("");

      const data = await loginUser(formData);

      setSuccess(data.message || "Login successful.");
      console.log("Login successful:", data);

      setFormData({
        login: "",
        password: ""
      });
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">YFNC</h1>
        <p className="auth-subtitle">Welcome back. Sign in to continue.</p>

        {error && <p className="auth-error auth-error-login">{error}</p>}
        {success && <p className="auth-success">{success}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            type="text"
            name="login"
            placeholder="Email or username"
            value={formData.login}
            onChange={handleChange}
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
          />

          <p className="auth-forgot-password">
            <Link to="/forgot-password">Forgot password?</Link>
          </p>

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Login"}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;