import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword as forgotPasswordRequest } from "../services/authService";
import "../styles/auth.css";

const STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error"
};

const EMAIL_REQUIRED_ERROR = "Email is required";
const INVALID_EMAIL_ERROR = "Please enter a valid email address";
const DEFAULT_SUCCESS_MESSAGE =
  "If an account with that email exists, a password reset email has been sent";
const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email = "") => email.trim().toLowerCase();

const getMessageClassName = (status) => {
  if (status === STATUS.SUCCESS) {
    return "auth-feedback auth-feedback-success auth-feedback-center";
  }

  if (status === STATUS.LOADING) {
    return "auth-feedback auth-feedback-neutral auth-feedback-center";
  }

  return "auth-feedback auth-feedback-error auth-feedback-center";
};

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(STATUS.IDLE);
  const [message, setMessage] = useState("");

  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);

  const hasEmailError =
    status === STATUS.ERROR &&
    (message === EMAIL_REQUIRED_ERROR || message === INVALID_EMAIL_ERROR);

  const clearFeedback = () => {
    setStatus(STATUS.IDLE);
    setMessage("");
  };

  const handleChange = (e) => {
    setEmail(e.target.value);
    clearFeedback();
  };

  const validateEmail = () => {
    if (!normalizedEmail) {
      return EMAIL_REQUIRED_ERROR;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return INVALID_EMAIL_ERROR;
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateEmail();

    if (validationError) {
      setStatus(STATUS.ERROR);
      setMessage(validationError);
      return;
    }

    try {
      setStatus(STATUS.LOADING);
      setMessage("");

      const data = await forgotPasswordRequest(normalizedEmail);

      setStatus(STATUS.SUCCESS);
      setMessage(data?.message || DEFAULT_SUCCESS_MESSAGE);
      setEmail("");
    } catch (error) {
      setStatus(STATUS.ERROR);
      setMessage(
        error.response?.data?.message || error.message || DEFAULT_ERROR_MESSAGE
      );
    }
  };

  const isLoading = status === STATUS.LOADING;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">YFNC</h1>
        <p className="auth-subtitle">Password reset</p>
        <p className="auth-description">
          Enter your email and we&apos;ll send you a reset link
        </p>

        {message ? (
          <p className={`${getMessageClassName(status)} auth-forgot-message`}>
            {message}
          </p>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={handleChange}
            autoComplete="email"
            disabled={isLoading}
            className={hasEmailError ? "auth-input auth-input-error" : "auth-input"}
          />

          <button
            type="submit"
            className="auth-button"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send reset link"}
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