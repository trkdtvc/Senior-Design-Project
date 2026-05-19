import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { registerUser } from "../services/authService";
import "../styles/auth.css";

const EMPTY_FIELDS_ERROR = "Please fill in all fields";
const INVALID_EMAIL_ERROR = "Invalid email format";
const EMAIL_EXISTS_ERROR = "Email already exists";
const USERNAME_EXISTS_ERROR = "Username already exists";
const PASSWORD_MISMATCH_ERROR = "Passwords do not match";
const PASSWORD_STRENGTH_ERROR = "Password must be at least of medium strength";
const REGISTER_SUCCESS_MESSAGE =
  "Registration successful. Check your email to verify your account";

const PASSWORD_MISMATCH_ERRORS = new Set([
  "Passwords do not match",
  "Passwords do not match."
]);

const PASSWORD_REQUIREMENT_ERRORS = new Set([
  PASSWORD_STRENGTH_ERROR,
  "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character",
  "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
  "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character",
  "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character."
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email = "") => email.trim().toLowerCase();

const normalizeError = (message = "") => message.trim().replace(/\.$/, "");

const getPasswordChecks = (password = "") => ({
  minLength: password.length >= 8,
  hasUppercase: /[A-Z]/.test(password),
  hasLowercase: /[a-z]/.test(password),
  hasNumber: /\d/.test(password),
  hasSpecialChar: /[^A-Za-z0-9]/.test(password)
});

const getPassedPasswordCheckCount = (checks) =>
  Object.values(checks).filter(Boolean).length;

const getPasswordStrength = (checks) => {
  const passedChecks = getPassedPasswordCheckCount(checks);

  if (passedChecks <= 2) {
    return {
      label: "Weak",
      className: "password-strength-weak"
    };
  }

  if (passedChecks <= 4) {
    return {
      label: "Medium",
      className: "password-strength-medium"
    };
  }

  return {
    label: "Strong",
    className: "password-strength-strong"
  };
};

const passwordRules = [
  {
    key: "minLength",
    label: "At least 8 characters"
  },
  {
    key: "hasUppercase",
    label: "One uppercase letter"
  },
  {
    key: "hasLowercase",
    label: "One lowercase letter"
  },
  {
    key: "hasNumber",
    label: "One number"
  },
  {
    key: "hasSpecialChar",
    label: "One special character"
  }
];

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

  const normalizedError = useMemo(() => normalizeError(error), [error]);

  const passwordChecks = useMemo(
    () => getPasswordChecks(formData.password),
    [formData.password]
  );

  const passwordStrength = useMemo(
    () => getPasswordStrength(passwordChecks),
    [passwordChecks]
  );

  const isEmptyFieldsError = normalizedError === EMPTY_FIELDS_ERROR;
  const isEmailError =
    normalizedError === EMAIL_EXISTS_ERROR ||
    normalizedError === INVALID_EMAIL_ERROR;
  const isUsernameError = normalizedError === USERNAME_EXISTS_ERROR;
  const isPasswordRequirementError =
    PASSWORD_REQUIREMENT_ERRORS.has(error) ||
    PASSWORD_REQUIREMENT_ERRORS.has(normalizedError);
  const isPasswordMismatchError =
    PASSWORD_MISMATCH_ERRORS.has(error) ||
    PASSWORD_MISMATCH_ERRORS.has(normalizedError);

  const isGeneralError =
    Boolean(normalizedError) &&
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

  const clearFeedback = () => {
    setError("");
    setSuccess("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prevData) => ({
      ...prevData,
      [name]: value
    }));

    clearFeedback();
  };

  const validateForm = ({ email, username, password, confirmPassword }) => {
    if (!email || !username || !password || !confirmPassword) {
      return EMPTY_FIELDS_ERROR;
    }

    if (!EMAIL_REGEX.test(email)) {
      return INVALID_EMAIL_ERROR;
    }

    if (getPassedPasswordCheckCount(passwordChecks) <= 2) {
      return PASSWORD_STRENGTH_ERROR;
    }

    if (password !== confirmPassword) {
      return PASSWORD_MISMATCH_ERROR;
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nextFormData = {
      email: normalizeEmail(formData.email),
      username: formData.username.trim(),
      password: formData.password,
      confirmPassword: formData.confirmPassword
    };

    const validationError = validateForm(nextFormData);

    if (validationError) {
      setError(validationError);
      setSuccess("");
      return;
    }

    try {
      setIsLoading(true);
      clearFeedback();

      const data = await registerUser(nextFormData);

      const pendingEmail = normalizeEmail(data?.email || nextFormData.email);
      localStorage.setItem("pendingVerificationEmail", pendingEmail);

      setSuccess(REGISTER_SUCCESS_MESSAGE);

      setFormData({
        email: "",
        username: "",
        password: "",
        confirmPassword: ""
      });
    } catch (err) {
      setSuccess("");
      setError(err.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">YFNC</h1>
        <p className="auth-subtitle">Create an account to get started</p>

        {(isEmptyFieldsError || isGeneralError) ? (
          <p className="auth-error auth-error-register-top">{normalizedError}</p>
        ) : null}

        {success ? <p className="auth-success">{success}</p> : null}

        {isEmailError ? (
          <p className="auth-error auth-error-register-top">{normalizedError}</p>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            autoComplete="email"
            disabled={isLoading}
            className={
              emailInputError ? "auth-input auth-input-error" : "auth-input"
            }
          />

          {isUsernameError ? (
            <p className="auth-error">{normalizedError}</p>
          ) : null}

          <input
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            autoComplete="username"
            disabled={isLoading}
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
            autoComplete="new-password"
            disabled={isLoading}
            className={
              passwordInputError ? "auth-input auth-input-error" : "auth-input"
            }
          />

          {formData.password ? (
            <div className="password-strength-wrapper">
              <p
                className={`password-strength-text ${passwordStrength.className}`}
              >
                Password strength: {passwordStrength.label}
              </p>

              <div className="password-rules">
                {passwordRules.map((rule) => (
                  <p
                    key={rule.key}
                    className={
                      passwordChecks[rule.key]
                        ? "password-rule password-rule-valid"
                        : "password-rule"
                    }
                  >
                    {rule.label}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {isPasswordRequirementError ? (
            <p className="auth-error">{normalizedError}</p>
          ) : null}

          {isPasswordMismatchError ? (
            <p className="auth-error">{normalizedError}</p>
          ) : null}

          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
            disabled={isLoading}
            className={
              confirmPasswordInputError
                ? "auth-input auth-input-error"
                : "auth-input"
            }
          />

          <button
            type="submit"
            className="auth-submit-button"
            disabled={isLoading}
          >
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