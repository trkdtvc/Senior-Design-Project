import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PasswordInput from "../components/PasswordInput";
import {
  forgotPassword as forgotPasswordRequest,
  resetPassword as resetPasswordRequest,
  validateResetPasswordToken
} from "../services/authService";
import "../styles/auth.css";

const STATUS = {
  CHECKING: "checking",
  IDLE: "idle",
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error"
};

const TOKEN_STATE = {
  VALID: "valid",
  INVALID: "invalid",
  EXPIRED: "expired"
};

const EMPTY_FIELDS_ERROR = "Please fill in all fields";
const PASSWORD_MISMATCH_ERROR = "Passwords do not match";
const WEAK_PASSWORD_ERROR = "Password must be at least of medium strength";
const SAME_PASSWORD_ERROR = "Please do not use the same password you already used";

const PASSWORD_RESET_SUCCESS_MESSAGE =
  "Password reset successfully. Redirecting to login...";
const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again";

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const normalizeMessage = (message = "") => message.trim().replace(/\.$/, "");

const getPasswordChecks = (password = "") => ({
  minLength: password.length >= 8,
  uppercase: /[A-Z]/.test(password),
  lowercase: /[a-z]/.test(password),
  number: /\d/.test(password),
  special: /[^A-Za-z0-9]/.test(password)
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
    key: "uppercase",
    label: "One uppercase letter"
  },
  {
    key: "lowercase",
    label: "One lowercase letter"
  },
  {
    key: "number",
    label: "One number"
  },
  {
    key: "special",
    label: "One special character"
  }
];

const getTokenErrorState = (errorMessage = "") => {
  const normalizedMessage = errorMessage.toLowerCase();

  if (
    normalizedMessage.includes("expired") ||
    normalizedMessage.includes("invalid or expired")
  ) {
    return {
      tokenState: TOKEN_STATE.EXPIRED,
      message: "This password reset link has expired"
    };
  }

  return {
    tokenState: TOKEN_STATE.INVALID,
    message: "This password reset link is invalid"
  };
};

const getMessageClassName = (status) => {
  if (status === STATUS.SUCCESS) {
    return "auth-feedback auth-feedback-success auth-feedback-center";
  }

  if (status === STATUS.CHECKING || status === STATUS.LOADING) {
    return "auth-feedback auth-feedback-neutral auth-feedback-center";
  }

  return "auth-feedback auth-feedback-error auth-feedback-center";
};

const getTokenMessageClassName = (tokenState) => {
  if (tokenState === TOKEN_STATE.EXPIRED) {
    return "auth-feedback auth-feedback-warning auth-feedback-center";
  }

  return "auth-feedback auth-feedback-error auth-feedback-center";
};

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectTimeoutRef = useRef(null);

  const token = useMemo(
    () => searchParams.get("token")?.trim() || "",
    [searchParams]
  );

  const email = useMemo(
    () => normalizeEmail(searchParams.get("email") || ""),
    [searchParams]
  );

  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: ""
  });

  const [status, setStatus] = useState(STATUS.CHECKING);
  const [message, setMessage] = useState("Checking your reset link...");
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [tokenState, setTokenState] = useState(TOKEN_STATE.VALID);
  const [resendStatus, setResendStatus] = useState(STATUS.IDLE);
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

  const normalizedMessage = useMemo(() => normalizeMessage(message), [message]);

  const isEmptyFieldsError =
    status === STATUS.ERROR && normalizedMessage === EMPTY_FIELDS_ERROR;

  const isPasswordMismatchError =
    status === STATUS.ERROR && normalizedMessage === PASSWORD_MISMATCH_ERROR;

  const isWeakPasswordError =
    status === STATUS.ERROR && normalizedMessage === WEAK_PASSWORD_ERROR;

  const isSamePasswordError =
    status === STATUS.ERROR && normalizedMessage === SAME_PASSWORD_ERROR;

  const newPasswordInputError =
    (isEmptyFieldsError && !formData.newPassword.trim()) ||
    isPasswordMismatchError ||
    isWeakPasswordError ||
    isSamePasswordError;

  const confirmPasswordInputError =
    (isEmptyFieldsError && !formData.confirmPassword.trim()) ||
    isPasswordMismatchError;

  const isBusy =
    status === STATUS.CHECKING ||
    status === STATUS.LOADING ||
    status === STATUS.SUCCESS;

  const showResetForm = status !== STATUS.ERROR || isTokenValid;
  const showTokenErrorState = status === STATUS.ERROR && !isTokenValid;

  const setTokenError = useCallback((rawMessage) => {
    const resolvedError = getTokenErrorState(rawMessage);

    setIsTokenValid(false);
    setTokenState(resolvedError.tokenState);
    setStatus(STATUS.ERROR);
    setMessage(resolvedError.message);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const validateToken = async () => {
      if (!token) {
        if (!isMounted) return;

        setIsTokenValid(false);
        setTokenState(TOKEN_STATE.INVALID);
        setStatus(STATUS.ERROR);
        setMessage("This password reset link is invalid");
        return;
      }

      try {
        await validateResetPasswordToken(token);

        if (!isMounted) return;

        setIsTokenValid(true);
        setTokenState(TOKEN_STATE.VALID);
        setStatus(STATUS.IDLE);
        setMessage("");
      } catch (error) {
        if (!isMounted) return;

        const rawMessage =
          error.response?.data?.message ||
          error.message ||
          "Invalid password reset token";

        setTokenError(rawMessage);
      }
    };

    validateToken();

    return () => {
      isMounted = false;
    };
  }, [token, setTokenError]);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const clearFormFeedback = () => {
    if (isTokenValid && status !== STATUS.CHECKING) {
      setStatus(STATUS.IDLE);
      setMessage("");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prevData) => ({
      ...prevData,
      [name]: value
    }));

    clearFormFeedback();
  };

  const handleResendResetLink = async () => {
    if (!email) {
      navigate("/forgot-password");
      return;
    }

    try {
      setResendStatus(STATUS.LOADING);
      setResendMessage("");
      setResendError("");

      const data = await forgotPasswordRequest(email);

      setResendStatus(STATUS.SUCCESS);
      setResendMessage(data?.message || "Password reset email resent successfully");
    } catch (error) {
      setResendStatus(STATUS.ERROR);
      setResendMessage("");
      setResendError(
        error.response?.data?.message || error.message || DEFAULT_ERROR_MESSAGE
      );
    }
  };

  const validateForm = () => {
    if (!formData.newPassword.trim() || !formData.confirmPassword.trim()) {
      return EMPTY_FIELDS_ERROR;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      return PASSWORD_MISMATCH_ERROR;
    }

    if (passwordStrength.label === "Weak") {
      return WEAK_PASSWORD_ERROR;
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token || !isTokenValid) {
      setTokenError(
        tokenState === TOKEN_STATE.EXPIRED
          ? "expired"
          : "Invalid password reset token"
      );
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setStatus(STATUS.ERROR);
      setMessage(validationError);
      return;
    }

    try {
      setStatus(STATUS.LOADING);
      setMessage("");

      const data = await resetPasswordRequest(
        token,
        formData.newPassword,
        formData.confirmPassword
      );

      setStatus(STATUS.SUCCESS);
      setMessage(
        data?.message
          ? `${normalizeMessage(data.message)}. Redirecting to login...`
          : PASSWORD_RESET_SUCCESS_MESSAGE
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
        error.response?.data?.message || error.message || DEFAULT_ERROR_MESSAGE;

      const loweredMessage = rawMessage.toLowerCase();
      const isTokenIssue =
        loweredMessage.includes("token") || loweredMessage.includes("expired");

      if (isTokenIssue) {
        setTokenError(rawMessage);
        return;
      }

      setStatus(STATUS.ERROR);
      setMessage(normalizeMessage(rawMessage));
    }
  };

  return (
    <div className="auth-page">
      <div className={`auth-card ${showTokenErrorState ? "auth-verify-card" : ""}`}>
        <h1 className="auth-logo">YFNC</h1>

        {showResetForm ? (
          <>
            <p className="auth-subtitle">Set your new password</p>

            {message ? (
              <p className={`${getMessageClassName(status)} auth-reset-message`}>
                {message}
              </p>
            ) : null}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <PasswordInput
                id="newPassword"
                name="newPassword"
                visibilityLabel="new password"
                placeholder="New password"
                value={formData.newPassword}
                onChange={handleChange}
                autoComplete="new-password"
                disabled={isBusy}
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

              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                visibilityLabel="confirm new password"
                placeholder="Confirm new password"
                value={formData.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                disabled={isBusy}
                className={
                  confirmPasswordInputError
                    ? "auth-input auth-input-error"
                    : "auth-input"
                }
              />

              <button
                type="submit"
                className="auth-button"
                disabled={isBusy}
              >
                {status === STATUS.CHECKING
                  ? "Checking..."
                  : status === STATUS.LOADING
                    ? "Resetting..."
                    : status === STATUS.SUCCESS
                      ? "Redirecting..."
                      : "Reset password"}
              </button>
            </form>

            <p className="auth-footer-text">
              Back to <Link to="/login">login</Link>
            </p>
          </>
        ) : (
          <div className="auth-verify-stack">
            <p className={getTokenMessageClassName(tokenState)}>{message}</p>

            {email ? (
              <button
                type="button"
                className="auth-feedback auth-feedback-link auth-resend-link auth-verify-resend-link"
                onClick={handleResendResetLink}
                disabled={resendStatus === STATUS.LOADING}
              >
                {resendStatus === STATUS.LOADING
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
