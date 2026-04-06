import { useState } from "react";
import { Link } from "react-router-dom";
import { registerUser } from "../services/authService";
import "../styles/auth.css";

const getPasswordChecks = (password) => ({
  minLength: password.length >= 8,
  hasUppercase: /[A-Z]/.test(password),
  hasLowercase: /[a-z]/.test(password),
  hasNumber: /[0-9]/.test(password),
  hasSpecialChar: /[^A-Za-z0-9]/.test(password)
});

const getPasswordStrength = (password) => {
  if (!password) {
    return {
      score: 0,
      label: "",
      className: ""
    };
  }

  const checks = getPasswordChecks(password);
  const score = Object.values(checks).filter(Boolean).length;

  if (score <= 2) {
    return {
      score,
      label: "Weak",
      className: "password-strength-weak"
    };
  }

  if (score <= 4) {
    return {
      score,
      label: "Medium",
      className: "password-strength-medium"
    };
  }

  return {
    score,
    label: "Strong",
    className: "password-strength-strong"
  };
};

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: ""
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const passwordChecks = getPasswordChecks(formData.password);
  const passwordStrength = getPasswordStrength(formData.password);

  const normalizedError = error.toLowerCase();
  const isUsernameError = normalizedError.includes("username");
  const isEmailError = normalizedError.includes("email");
  const isPasswordRequirementError =
    normalizedError.includes("password must") ||
    normalizedError.includes("strong password");
  const isPasswordMismatchError =
    normalizedError.includes("passwords do not match") ||
    normalizedError.includes("do not match");
  const isEmailOrUsernameError = isUsernameError || isEmailError;
  const isGeneralError =
    error &&
    !isEmailOrUsernameError &&
    !isPasswordRequirementError &&
    !isPasswordMismatchError;

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

    const { email, username, password, confirmPassword } = formData;

    if (
      !email.trim() ||
      !username.trim() ||
      !password.trim() ||
      !confirmPassword.trim()
    ) {
      setError("Please fill in all fields.");
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!Object.values(passwordChecks).every(Boolean)) {
      setError(
        "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      setSuccess("");

      const data = await registerUser({
        email,
        username,
        password,
        confirmPassword
      });

      setSuccess(data.message || "Registration successful.");

      setFormData({
        email: "",
        username: "",
        password: "",
        confirmPassword: ""
      });
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">YFNC</h1>
        <p className="auth-subtitle">Create an account to get started.</p>

        {isGeneralError && <p className="auth-error">{error}</p>}
        {success && <p className="auth-success">{success}</p>}

        {isEmailError && <p className="auth-error auth-error-register-top">{error}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
          />

          {isUsernameError && <p className="auth-error">{error}</p>}

          <input
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
          />

          {formData.password && (
            <div className="password-strength-wrapper">
              <p className={`password-strength-text ${passwordStrength.className}`}>
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
                    passwordChecks.hasUppercase
                      ? "password-rule password-rule-valid"
                      : "password-rule"
                  }
                >
                  One uppercase letter
                </p>
                <p
                  className={
                    passwordChecks.hasLowercase
                      ? "password-rule password-rule-valid"
                      : "password-rule"
                  }
                >
                  One lowercase letter
                </p>
                <p
                  className={
                    passwordChecks.hasNumber
                      ? "password-rule password-rule-valid"
                      : "password-rule"
                  }
                >
                  One number
                </p>
                <p
                  className={
                    passwordChecks.hasSpecialChar
                      ? "password-rule password-rule-valid"
                      : "password-rule"
                  }
                >
                  One special character
                </p>
              </div>
            </div>
          )}

          {isPasswordRequirementError && <p className="auth-error">{error}</p>}
          {isPasswordMismatchError && <p className="auth-error">{error}</p>}

          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleChange}
          />

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Registering..." : "Register"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;