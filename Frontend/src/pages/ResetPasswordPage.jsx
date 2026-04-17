import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  forgotPassword as forgotPasswordRequest,
  resetPassword as resetPasswordRequest,
  validateResetPasswordToken
} from "../services/authService";
import "../styles/auth.css";

const getPasswordChecks = (password) => ({
  minLength: password.length >= 8,
  uppercase: /[A-Z]/.test(password),
  lowercase: /[a-z]/.test(password),
  number: /\d/.test(password),
  special: /[^A-Za-z0-9]/.test(password)
});

const getPasswordStrength = (checks) => {
  const passedChecks = Object.values(checks).filter(Boolean).length;

  if (passedChecks <= 2) {
    return { label: "Weak", className: "password-strength-weak" };
  }

  if (passedChecks <= 4) {
    return { label: "Medium", className: "password-strength-medium" };
  }

  return { label: "Strong", className: "password-strength-strong" };
};

const getTokenErrorState = (errorMessage = "") => {
  const normalizedMessage = errorMessage.toLowerCase();

  if (
    normalizedMessage.includes("expired") ||
    normalizedMessage.includes("invalid or expired")
  ) {
    return {
      tokenState: "expired",
      message: "This password reset link has expired"
    };
  }

  return {
    tokenState: "invalid",
    message: "This password reset link is invalid"
  };
};

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectTimeoutRef = useRef(null);

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
  const [resendError, setResendError] = useState("");

  const passwordChecks = useMemo(
    () => getPasswordChecks(formData.newPassword),
    [formData.newPassword]
  );

  const passwordStrength = useMemo(
    () => getPasswordStrength(passwordChecks),
    [passwordChecks]
  );

  const isEmptyFieldsError =
    status === "error" && message === "Please fill in all fields.";

  const isPasswordMismatchError =
    status === "error" && message === "Passwords do not match.";

  const isWeakPasswordError =
    status === "error" &&
    message ===
    "Weak password not accepted. Your password must be at least medium strength.";

  const isSamePasswordError =
    status === "error" &&
    message === "Please do not use the same password you already used";

  const newPasswordInputError =
    (isEmptyFieldsError && !formData.newPassword.trim()) ||
    isPasswordMismatchError ||
    isWeakPasswordError ||
    isSamePasswordError;

  const confirmPasswordInputError =
    (isEmptyFieldsError && !formData.confirmPassword.trim()) ||
    isPasswordMismatchError;

  useEffect(() => {
    let isMounted = true;

    const validateToken = async () => {
      if (!token) {
        if (!isMounted) return;

        setIsTokenValid(false);
        setTokenState("invalid");
        setStatus("error");
        setMessage("This password reset link is invalid.");
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

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

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
      setResendError("");

      const data = await forgotPasswordRequest(email.trim().toLowerCase());

      setResendStatus("success");
      setResendMessage(
        data.message || "Password reset email resent successfully"
      );
    } catch (error) {
      setResendStatus("error");
      setResendError(
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
            message: "This password reset link has expired"
          }
          : {
            tokenState: "invalid",
            message: "This password reset link is invalid"
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

    if (passwordStrength.label === "Weak") {
      setStatus("error");
      setMessage(
        "Weak password not accepted. Your password must be at least medium strength."
      );
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

      redirectTimeoutRef.current = setTimeout(() => {
        navigate("/login");
      }, 3000);
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

  const getMessageClassName = () => {
    if (status === "success") {
      return "auth-feedback auth-feedback-success auth-feedback-center";
    }

    if (status === "checking" || status === "loading") {
      return "auth-feedback auth-feedback-neutral auth-feedback-center";
    }

    return "auth-feedback auth-feedback-error auth-feedback-center";
  };

  const getTokenMessageClassName = () => {
    if (tokenState === "expired") {
      return "auth-feedback auth-feedback-warning auth-feedback-center";
    }

    return "auth-feedback auth-feedback-error auth-feedback-center";
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

            {message ? (
              <p className={`${getMessageClassName()} auth-reset-message`}>{message}</p>
            ) : null}

            <form className="auth-form" onSubmit={handleSubmit}>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="New password"
                value={formData.newPassword}
                onChange={handleChange}
                disabled={status === "loading" || status === "checking"}
                className={
                  newPasswordInputError ? "auth-input auth-input-error" : "auth-input"
                }
              />

              {formData.newPassword ? (
                <div className="password-strength-wrapper">
                  <p
                    className={`password-strength-text ${passwordStrength.className}`}
                  >
                    Password strength: {passwordStrength.label}
                  </p>

                  <div className="password-rules">
                    <p
                      className={
                        passwordChecks.minLength
                          ? "password-rule password-rule-valid"
                          : "password-rule"
                      }
                    >
                      At least 8 characters
                    </p>
                    <p
                      className={
                        passwordChecks.uppercase
                          ? "password-rule password-rule-valid"
                          : "password-rule"
                      }
                    >
                      One uppercase letter
                    </p>
                    <p
                      className={
                        passwordChecks.lowercase
                          ? "password-rule password-rule-valid"
                          : "password-rule"
                      }
                    >
                      One lowercase letter
                    </p>
                    <p
                      className={
                        passwordChecks.number
                          ? "password-rule password-rule-valid"
                          : "password-rule"
                      }
                    >
                      One number
                    </p>
                    <p
                      className={
                        passwordChecks.special
                          ? "password-rule password-rule-valid"
                          : "password-rule"
                      }
                    >
                      One special character
                    </p>
                  </div>
                </div>
              ) : null}

              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={status === "loading" || status === "checking"}
                className={
                  confirmPasswordInputError
                    ? "auth-input auth-input-error"
                    : "auth-input"
                }
              />

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
            <p className={getTokenMessageClassName()}>{message}</p>

            {email ? (
              <button
                type="button"
                className="auth-feedback auth-feedback-link auth-resend-link auth-verify-resend-link"
                onClick={handleResendResetLink}
                disabled={resendStatus === "loading"}
              >
                {resendStatus === "loading"
                  ? "Sending..."
                  : "Resend password reset email"}
              </button>
            ) : (
              <p className="auth-footer auth-verify-footer">
                Go to <Link to="/forgot-password">forgot password</Link>
              </p>
            )}

            {resendMessage ? (
              <p className="auth-feedback auth-feedback-success auth-feedback-center">
                {resendMessage}
              </p>
            ) : null}

            {resendError ? (
              <p className="auth-feedback auth-feedback-error auth-feedback-center">
                {resendError}
              </p>
            ) : null}

            <p className="auth-footer auth-verify-footer">
              Go back to <Link to="/login">login</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;