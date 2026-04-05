import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword as resetPasswordRequest } from "../services/authService";
import "../styles/auth.css";

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token") || "";

  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: ""
  });

  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const passwordRules = {
    minLength: formData.newPassword.length >= 8,
    uppercase: /[A-Z]/.test(formData.newPassword),
    lowercase: /[a-z]/.test(formData.newPassword),
    number: /\d/.test(formData.newPassword),
    special: /[^A-Za-z0-9]/.test(formData.newPassword)
  };

  const passedRulesCount = Object.values(passwordRules).filter(Boolean).length;

  const getPasswordStrength = () => {
    if (!formData.newPassword) return "";
    if (passedRulesCount <= 2) return "Weak";
    if (passedRulesCount <= 4) return "Medium";
    return "Strong";
  };

  const passwordStrength = getPasswordStrength();

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));

    setStatus("idle");
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      setStatus("error");
      setMessage("Invalid password reset token.");
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
        <p className="auth-subtitle">Set your new password</p>

        {message && <div className={`auth-message ${status}`}>{message}</div>}

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
              disabled={status === "loading"}
            />
          </div>

          {formData.newPassword && (
            <div className="password-strength-wrapper">
              <p className="password-strength-text">
                Password strength:{" "}
                <span
                  className={
                    passwordStrength === "Weak"
                      ? "password-strength-weak"
                      : passwordStrength === "Medium"
                        ? "password-strength-medium"
                        : "password-strength-strong"
                  }
                >
                  {passwordStrength}
                </span>
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
              disabled={status === "loading"}
            />
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Resetting..." : "Reset password"}
          </button>
        </form>

        <p className="auth-footer-text">
          Back to <Link to="/login">login</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPasswordPage;