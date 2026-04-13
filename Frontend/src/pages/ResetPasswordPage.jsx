import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  resetPassword as resetPasswordRequest,
  validateResetPasswordToken
} from "../services/authService";
import "../styles/auth.css";

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token")?.trim() || "";

  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: ""
  });

  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("Checking your reset link...");
  const [isTokenValid, setIsTokenValid] = useState(false);

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

  const passwordStrength = getPasswordStrength();

  useEffect(() => {
    let isMounted = true;

    const validateToken = async () => {
      if (!token) {
        if (!isMounted) return;

        setIsTokenValid(false);
        setStatus("error");
        setMessage("Invalid password reset token");
        return;
      }

      try {
        await validateResetPasswordToken(token);

        if (!isMounted) return;

        setIsTokenValid(true);
        setStatus("idle");
        setMessage("");
      } catch (error) {
        if (!isMounted) return;

        setIsTokenValid(false);
        setStatus("error");
        setMessage(
          error.response?.data?.message ||
          error.message ||
          "Invalid or expired password reset token."
        );
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

    if (status !== "checking") {
      setStatus("idle");
      setMessage("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token || !isTokenValid) {
      setStatus("error");
      setMessage("Invalid or expired password reset token.");
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
      setMessage(
        "Weak password can't be accepted"
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

      setTimeout(() => {
        navigate("/login");
      }, 5000);
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

        {(status !== "error" || isTokenValid) && (
          <p className="auth-subtitle">Set your new password</p>
        )}

        {message && (
          <div
            className={`auth-message ${status} ${status === "error" && !isTokenValid ? "auth-message-centered" : ""}`}
          >
            {message}
          </div>
        )}

        {status !== "error" || isTokenValid ? (
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
                    className={`password-rule ${passwordRules.minLength ? "password-rule-valid" : ""}`}
                  >
                    At least 8 characters
                  </p>
                  <p
                    className={`password-rule ${passwordRules.uppercase ? "password-rule-valid" : ""}`}
                  >
                    At least 1 uppercase letter
                  </p>
                  <p
                    className={`password-rule ${passwordRules.lowercase ? "password-rule-valid" : ""}`}
                  >
                    At least 1 lowercase letter
                  </p>
                  <p
                    className={`password-rule ${passwordRules.number ? "password-rule-valid" : ""}`}
                  >
                    At least 1 number
                  </p>
                  <p
                    className={`password-rule ${passwordRules.special ? "password-rule-valid" : ""}`}
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
        ) : null}

        {(status !== "error" || isTokenValid) && (
          <p className="auth-footer-text">
            Back to <Link to="/login">login</Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;