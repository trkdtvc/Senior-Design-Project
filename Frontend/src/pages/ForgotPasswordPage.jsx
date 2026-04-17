import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword as forgotPasswordRequest } from "../services/authService";
import "../styles/auth.css";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const trimmedEmail = email.trim();

  const isEmailRequiredError = status === "error" && message === "Email is required";
  const isInvalidEmailError =
    status === "error" && message === "Please enter a valid email address.";
  const hasEmailError = isEmailRequiredError || isInvalidEmailError;

  const getMessageClassName = () => {
    if (status === "success") {
      return "auth-feedback auth-feedback-success auth-feedback-center";
    }

    if (status === "loading") {
      return "auth-feedback auth-feedback-neutral auth-feedback-center";
    }

    return "auth-feedback auth-feedback-error auth-feedback-center";
  };

  const handleChange = (e) => {
    setEmail(e.target.value);
    setStatus("idle");
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!trimmedEmail) {
      setStatus("error");
      setMessage("Email is required");
      return;
    }

    if (!trimmedEmail.includes("@")) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    try {
      setStatus("loading");
      setMessage("");

      const data = await forgotPasswordRequest(trimmedEmail.toLowerCase());

      setStatus("success");
      setMessage(
        data.message ||
        "If an account with that email exists, a password reset email has been sent"
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
          Enter your email and we&apos;ll send you a reset link
        </p>

        {message ? (
          <p className={`${getMessageClassName()} auth-forgot-message`}>{message}</p>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={handleChange}
            disabled={status === "loading"}
            className={hasEmailError ? "auth-input auth-input-error" : "auth-input"}
          />

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