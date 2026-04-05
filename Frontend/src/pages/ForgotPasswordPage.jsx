import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword as forgotPasswordRequest } from "../services/authService";
import "../styles/auth.css";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setEmail(e.target.value);
    setStatus("idle");
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setStatus("error");
      setMessage("Email is required");
      return;
    }

    try {
      setStatus("loading");
      setMessage("");

      const data = await forgotPasswordRequest(email.trim());

      setStatus("success");
      setMessage(
        data.message ||
          "If an account with that email exists, a password reset email has been sent."
      );
      setEmail("");
    } catch (error) {
      setStatus("error");
      setMessage(
        error.response?.data?.message ||
          error.message ||
          "Something went wrong. Please try again."
      );
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">YFNC</h1>
        <p className="auth-subtitle">Password reset</p>
        <p className="auth-description">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {message && (
          <div className={`auth-message ${status}`}>
            {message}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form-group">
            
            <input
              id="email"
              name="email"
              type="email"
              placeholder="Enter your email here:"
              value={email}
              onChange={handleChange}
              disabled={status === "loading"}
            />
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <p className="auth-footer-text">
          Remembered your password? <Link to="/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;