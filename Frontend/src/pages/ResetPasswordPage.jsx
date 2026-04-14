import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  forgotPassword as forgotPasswordRequest,
  resetPassword as resetPasswordRequest,
  validateResetPasswordToken
} from "../services/authService";
import "../styles/auth.css";

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token")?.trim() || "";
  const email = searchParams.get("email")?.trim() || "";

  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: ""
  });

  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("Checking your reset link...");
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [tokenState, setTokenState] = useState("valid");
  const [resendStatus, setResendStatus] = useState("idle");
  const [resendMessage, setResendMessage] = useState("");

  const passwordRules = {
    minLength: formData.newPassword.length >= 8,
    uppercase: /[A-Z]/.test(formData.newPassword),
    lowercase: /[a-z]/.test(formData.newPassword),
    number: /\d/.test(formData.newPassword),
    special: /[^A-Za-z0-9]/.test(formData.newPassword)
  };

  const passedRulesCount = Object.values(passwordRules).filter(Boolean).length;
  const isPasswordValid = Object.values(passwordRules).every(Boolean);

  const getPasswordStrength = () => {
    if (!formData.newPassword) return "";
    if (passedRulesCount <= 2) return "Weak";
    if (passedRulesCount <= 4) return "Medium";
    return "Strong";
  };

  const getTokenErrorState = (errorMessage = "") => {
    const normalizedMessage = errorMessage.toLowerCase();

    if (
      normalizedMessage.includes("expired") ||
      normalizedMessage.includes("invalid or expired")
    ) {
      return {
        tokenState: "expired",
        message: "This password reset link has already been used or has expired."
      };
    }

    return {
      tokenState: "invalid",
      message: "Invalid password reset link."
    };
  };

  const passwordStrength = getPasswordStrength();

  useEffect(() => {
    let isMounted = true;

    const validateToken = async () => {
      if (!token) {
        if (!isMounted) return;

        setIsTokenValid(false);
        setTokenState("invalid");
        setStatus("error");
        setMessage("Invalid password reset link.");
        return;
      }

      try {
        await validateResetPasswordToken(token);

        if (!isMounted) return;

        setIsTokenValid(true);
        setTokenState("valid");
        setStatus("idle");
        setMessage("");
      } catch (error) {
        if (!isMounted) return;

        const rawMessage =
          error.response?.data?.message ||
          error.message ||
          "Invalid password reset token.";

        const resolvedError = getTokenErrorState(rawMessage);

        setIsTokenValid(false);
        setTokenState(resolvedError.tokenState);
        setStatus("error");
        setMessage(resolvedError.message);
      }
    };

    validateToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));

    if (isTokenValid && status !== "checking") {
      setStatus("idle");
      setMessage("");
    }
  };

  const handleResendResetLink = async () => {
    if (!email) {
      navigate("/forgot-password");
      return;
    }

    try {
      setResendStatus("loading");
      setResendMessage("");

      await forgotPasswordRequest(email);

      setResendStatus("success");
      setResendMessage("Password reset email resent.");
    } catch (error) {
      setResendStatus("error");
      setResendMessage(
        error.response?.data?.message ||
        error.message ||
        "Something went wrong. Please try again."
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token || !isTokenValid) {
      const resolvedError =
        tokenState === "expired"
          ? {
            tokenState: "expired",
            message: "This password reset link has already been used or has expired."
          }
          : {
            tokenState: "invalid",
            message: "Invalid password reset link."
          };

      setStatus("error");
      setIsTokenValid(false);
      setTokenState(resolvedError.tokenState);
      setMessage(resolvedError.message);
      return;
    }

    if (!formData.newPassword.trim() || !formData.confirmPassword.trim()) {
      setStatus("error");
      setMessage("Please fill in all fields.");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    if (!isPasswordValid) {
      setStatus("error");
      setMessage("Weak password can't be accepted");
      return;
    }

    try {
      setStatus("loading");
      setMessage("");

      const data = await resetPasswordRequest(
        token,
        formData.newPassword,
        formData.confirmPassword
      );

      setStatus("success");
      setMessage(
        data.message
          ? `${data.message} Redirecting to login...`
          : "Password reset successfully. Redirecting to login..."
      );

      setFormData({
        newPassword: "",
        confirmPassword: ""
      });

      setTimeout(() => {
        navigate("/login");
      }, 5000);
    } catch (error) {
      const rawMessage =
        error.response?.data?.message ||
        error.message ||
        "Something went wrong. Please try again.";

      const normalizedMessage = rawMessage.toLowerCase();

      const isTokenIssue =
        normalizedMessage.includes("token") ||
        normalizedMessage.includes("expired");

      if (isTokenIssue) {
        const resolvedError = getTokenErrorState(rawMessage);

        setIsTokenValid(false);
        setTokenState(resolvedError.tokenState);
        setStatus("error");
        setMessage(resolvedError.message);
        return;
      }

      setStatus("error");
      setMessage(rawMessage);
    }
  };

  const showResetForm = status !== "error" || isTokenValid;
  const showTokenErrorState = status === "error" && !isTokenValid;

  return (
    <div className="auth-page">
      <div className={`auth-card ${showTokenErrorState ? "auth-verify-card" : ""}`}>
        <h1 className="auth-logo">YFNC</h1>

        {showResetForm ? (
          <>
            <p className="auth-subtitle">Set your new password</p>

            {message && (
              <div className={`auth-message ${status}`}>
                {message}
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={formData.newPassword}
                  onChange={handleChange}
                  disabled={status === "loading" || status === "checking"}
                />
              </div>

              {formData.newPassword && (
                <div className="password-strength-wrapper">
                  <p
                    className={`password-strength-text ${passwordStrength === "Weak"
                      ? "password-strength-weak"
                      : passwordStrength === "Medium"
                        ? "password-strength-medium"
                        : "password-strength-strong"
                      }`}
                  >
                    Password strength: {passwordStrength}
                  </p>

                  <div className="password-rules">
                    <p
                      className={`password-rule ${passwordRules.minLength ? "password-rule-valid" : ""
                        }`}
                    >
                      At least 8 characters
                    </p>
                    <p
                      className={`password-rule ${passwordRules.uppercase ? "password-rule-valid" : ""
                        }`}
                    >
                      At least 1 uppercase letter
                    </p>
                    <p
                      className={`password-rule ${passwordRules.lowercase ? "password-rule-valid" : ""
                        }`}
                    >
                      At least 1 lowercase letter
                    </p>
                    <p
                      className={`password-rule ${passwordRules.number ? "password-rule-valid" : ""
                        }`}
                    >
                      At least 1 number
                    </p>
                    <p
                      className={`password-rule ${passwordRules.special ? "password-rule-valid" : ""
                        }`}
                    >
                      At least 1 special character
                    </p>
                  </div>
                </div>
              )}

              <div className="auth-form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={status === "loading" || status === "checking"}
                />
              </div>

              <button
                type="submit"
                className="auth-button"
                disabled={status === "loading" || status === "checking"}
              >
                {status === "checking"
                  ? "Checking..."
                  : status === "loading"
                    ? "Resetting..."
                    : "Reset password"}
              </button>
            </form>

            <p className="auth-footer-text">
              Back to <Link to="/login">login</Link>
            </p>
          </>
        ) : (
          <div className="auth-verify-stack">
            <p className="auth-verify-status auth-verify-status-error">{message}</p>

            <button
              type="button"
              className="auth-button auth-button-secondary auth-verify-button"
              onClick={handleResendResetLink}
              disabled={resendStatus === "loading"}
            >
              {resendStatus === "loading" ? "Sending..." : "Send a new reset link"}
            </button>

            {resendMessage && (
              <p
                className={
                  resendStatus === "success"
                    ? "auth-resend-success"
                    : "auth-resend-error"
                }
              >
                {resendMessage}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;