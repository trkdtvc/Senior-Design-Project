import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginUser, resendVerificationEmail } from "../services/authService";
import "../styles/auth.css";

const normalizeInput = (value = "") => value.trim();
const normalizeEmail = (email = "") => email.trim().toLowerCase();

const getFriendlyLoginError = (rawError, typedLogin) => {
  const normalizedError = normalizeInput(rawError).replace(/\.$/, "");
  const isEmailLogin = typedLogin.includes("@");

  if (
    normalizedError === "User does not exist" ||
    normalizedError === "User not found"
  ) {
    return isEmailLogin
      ? "No user found with that email"
      : "No user found with that username";
  }

  return normalizedError;
};

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialVerificationMessage =
    location.state?.requiresEmailVerification &&
    typeof location.state?.verificationMessage === "string"
      ? location.state.verificationMessage
      : "";

  const [verificationMessage, setVerificationMessage] = useState(
    initialVerificationMessage
  );
  const [formData, setFormData] = useState({
    login: "",
    password: ""
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(
    () => localStorage.getItem("pendingVerificationEmail") || ""
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");

  const typedLogin = useMemo(() => normalizeInput(formData.login), [formData.login]);

  const friendlyError = useMemo(
    () => getFriendlyLoginError(error, typedLogin),
    [error, typedLogin]
  );

  const resendTarget = useMemo(() => {
    const normalizedLogin = normalizeEmail(formData.login);

    if (normalizedLogin.includes("@")) {
      return normalizedLogin;
    }

    return pendingVerificationEmail;
  }, [formData.login, pendingVerificationEmail]);

  const isUnverifiedError =
    friendlyError === "Please verify your email before logging in";

  const isIncorrectPasswordError = friendlyError === "Incorrect password";

  const isUserNotFoundError =
    friendlyError === "No user found with that username" ||
    friendlyError === "No user found with that email";

  const isEmptyFieldsError = friendlyError === "Please fill in all fields";
  const isSimpleLoginError = Boolean(friendlyError) && !isUnverifiedError;

  const loginInputError =
    (isEmptyFieldsError && !typedLogin) || isUserNotFoundError;

  const passwordInputError =
    (isEmptyFieldsError && !formData.password.trim()) || isIncorrectPasswordError;

  const clearFeedback = () => {
    setError("");
    setSuccess("");
    setVerificationMessage("");
    setResendMessage("");
    setResendError("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prevData) => ({
      ...prevData,
      [name]: value
    }));

    clearFeedback();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const password = formData.password;

    if (!typedLogin || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    try {
      setIsLoading(true);
      clearFeedback();

      const data = await loginUser({
        login: typedLogin,
        password
      });

      localStorage.setItem("token", data.token);
      localStorage.removeItem("pendingVerificationEmail");
      setPendingVerificationEmail("");

      setSuccess(data.message || "Login successful");

      setFormData({
        login: "",
        password: ""
      });

      navigate("/dashboard");
    } catch (err) {
      const message = err.message || "Login failed.";
      const responseEmail = err.response?.data?.email;

      setError(message);

      if (responseEmail) {
        const normalizedResponseEmail = normalizeEmail(responseEmail);

        localStorage.setItem("pendingVerificationEmail", normalizedResponseEmail);
        setPendingVerificationEmail(normalizedResponseEmail);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!resendTarget) {
      setResendMessage("");
      setResendError("Enter your email above to resend the verification email");
      return;
    }

    try {
      setIsResending(true);
      setResendMessage("");
      setResendError("");

      const data = await resendVerificationEmail(resendTarget);

      localStorage.setItem("pendingVerificationEmail", resendTarget);
      setPendingVerificationEmail(resendTarget);
      setResendMessage(data.message || "Verification email resent successfully");
    } catch (err) {
      setResendMessage("");
      setResendError(err.message || "Failed to resend verification email.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">YFNC</h1>
        <p className="auth-subtitle">Welcome back. Sign in to continue.</p>

        {(isUnverifiedError || verificationMessage) ? (
          <div className="auth-status-stack">
            <p className="auth-feedback auth-feedback-warning">
              {verificationMessage || "Please verify your email before logging in"}
            </p>

            <div className="auth-resend-block">
              <button
                type="button"
                className="auth-feedback auth-feedback-link auth-resend-link"
                onClick={handleResendVerification}
                disabled={isResending}
              >
                {isResending ? "Resending..." : "Resend verification email"}
              </button>

              {resendMessage ? (
                <p className="auth-feedback auth-feedback-success">
                  {resendMessage}
                </p>
              ) : null}

              {resendError ? (
                <p className="auth-feedback auth-feedback-error">
                  {resendError}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {success ? (
          <p className="auth-feedback auth-feedback-success auth-feedback-center">
            {success}
          </p>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSimpleLoginError ? (
            <p className="auth-feedback auth-feedback-error">{friendlyError}</p>
          ) : null}

          <input
            type="text"
            name="login"
            placeholder="Email or username"
            value={formData.login}
            onChange={handleChange}
            autoComplete="username"
            className={
              loginInputError ? "auth-input auth-input-error" : "auth-input"
            }
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            autoComplete="current-password"
            className={
              passwordInputError ? "auth-input auth-input-error" : "auth-input"
            }
          />

          <p className="auth-forgot-password">
            <Link to="/forgot-password">Forgot password?</Link>
          </p>

          <button
            type="submit"
            className="auth-submit-button"
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Login"}
          </button>
        </form>

        <p className="auth-footer">
          Don&apos;t have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;