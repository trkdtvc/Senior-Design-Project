import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser, resendVerificationEmail } from "../services/authService";
import "../styles/auth.css";

const LoginPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    login: "",
    password: ""
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");

  const normalizedError = error.replace(/\.$/, "");
  const typedLogin = formData.login.trim();
  const isEmailLogin = typedLogin.includes("@");

  const friendlyError =
    normalizedError === "User does not exist"
      ? isEmailLogin
        ? "No user found with that email"
        : "No user found with that username"
      : normalizedError;

  const isUnverifiedError =
    friendlyError === "Please verify your email before logging in";

  const isIncorrectPasswordError = friendlyError === "Incorrect password";

  const isUserNotFoundError =
    friendlyError === "No user found with that username" ||
    friendlyError === "No user found with that email";

  const resendTarget = useMemo(() => {
    const currentLogin = formData.login.trim().toLowerCase();

    if (currentLogin.includes("@")) {
      return currentLogin;
    }

    return localStorage.getItem("pendingVerificationEmail") || "";
  }, [formData.login]);

  const isEmptyFieldsError = error === "Please fill in all fields.";
  const isSimpleLoginError = !!friendlyError && !isUnverifiedError;

  const loginInputError =
    (isEmptyFieldsError && !formData.login.trim()) || isUserNotFoundError;

  const passwordInputError =
    (isEmptyFieldsError && !formData.password.trim()) || isIncorrectPasswordError;

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prevData) => ({
      ...prevData,
      [name]: value
    }));

    setError("");
    setSuccess("");
    setResendMessage("");
    setResendError("");
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
      setResendMessage("");
      setResendError("");

      const data = await loginUser(formData);

      localStorage.setItem("token", data.token);
      setSuccess(data.message || "Login successful.");

      setFormData({
        login: "",
        password: ""
      });

      navigate("/dashboard");
    } catch (err) {
      const message = err.message || "Login failed.";

      setError(message);

      const responseEmail = err.response?.data?.email;

      if (responseEmail) {
        localStorage.setItem("pendingVerificationEmail", responseEmail);
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
      setResendMessage(
        data.message || "Verification email resent successfully"
      );
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

        {isUnverifiedError && (
          <div className="auth-status-stack">
            <p className="auth-feedback auth-feedback-warning">
              Please verify your email before logging in.
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

              {resendMessage && (
                <p className="auth-feedback auth-feedback-success">
                  {resendMessage}
                </p>
              )}

              {resendError && (
                <p className="auth-feedback auth-feedback-error">
                  {resendError}
                </p>
              )}
            </div>
          </div>
        )}

        {success && (
          <p className="auth-feedback auth-feedback-success auth-feedback-center">
            {success}
          </p>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSimpleLoginError && (
            <p className="auth-feedback auth-feedback-error">
              {friendlyError}
            </p>
          )}

          <input
            type="text"
            name="login"
            placeholder="Email or username"
            value={formData.login}
            onChange={handleChange}
            autoComplete="username"
            className={loginInputError ? "auth-input auth-input-error" : "auth-input"}
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

          <button type="submit" className="auth-submit-button" disabled={isLoading}>
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