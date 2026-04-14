import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { registerUser } from "../services/authService";
import "../styles/auth.css";

const getPasswordChecks = (password) => ({
  minLength: password.length >= 8,
  hasUppercase: /[A-Z]/.test(password),
  hasLowercase: /[a-z]/.test(password),
  hasNumber: /\d/.test(password),
  hasSpecialChar: /[^A-Za-z0-9]/.test(password)
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

  const passwordChecks = useMemo(
    () => getPasswordChecks(formData.password),
    [formData.password]
  );

  const passwordStrength = useMemo(
    () => getPasswordStrength(passwordChecks),
    [passwordChecks]
  );

  const isEmptyFieldsError = error === "Please fill in all fields.";

  const isEmailError =
    error === "Email already exists" ||
    error === "Please enter a valid email address.";

  const isUsernameError = error === "Username already exists";

  const isPasswordRequirementError =
    error ===
    "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.";

  const isPasswordMismatchError =
    error === "Passwords do not match." || error === "Passwords do not match";

  const isGeneralError =
    !!error &&
    !isEmptyFieldsError &&
    !isEmailError &&
    !isUsernameError &&
    !isPasswordRequirementError &&
    !isPasswordMismatchError;

  const emailInputError =
    isEmailError || (isEmptyFieldsError && !formData.email.trim());

  const usernameInputError =
    isUsernameError || (isEmptyFieldsError && !formData.username.trim());

  const passwordInputError =
    isPasswordRequirementError ||
    isPasswordMismatchError ||
    (isEmptyFieldsError && !formData.password);

  const confirmPasswordInputError =
    isPasswordMismatchError ||
    (isEmptyFieldsError && !formData.confirmPassword);

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

    const email = formData.email.trim().toLowerCase();
    const username = formData.username.trim();
    const password = formData.password;
    const confirmPassword = formData.confirmPassword;

    if (!email || !username || !password || !confirmPassword) {
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

      localStorage.setItem("pendingVerificationEmail", data.email || email);

      setSuccess(
        data.message ||
          `Registration successful. Check ${email} to verify your account.`
      );

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

        {(isEmptyFieldsError || isGeneralError) && (
          <p className="auth-error auth-error-register-top">{error}</p>
        )}

        {success && <p className="auth-success">{success}</p>}

        {isEmailError && (
          <p className="auth-error auth-error-register-top">{error}</p>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            className={emailInputError ? "auth-input auth-input-error" : "auth-input"}
          />

          {isUsernameError && <p className="auth-error">{error}</p>}

          <input
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            className={
              usernameInputError ? "auth-input auth-input-error" : "auth-input"
            }
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            className={
              passwordInputError ? "auth-input auth-input-error" : "auth-input"
            }
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
            className={
              confirmPasswordInputError
                ? "auth-input auth-input-error"
                : "auth-input"
            }
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