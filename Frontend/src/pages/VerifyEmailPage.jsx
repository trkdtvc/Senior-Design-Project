import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resendVerificationEmail, verifyEmail } from "../services/authService";
import "../styles/auth.css";

const STATUS = {
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error"
};

const ERROR_TYPE = {
  INVALID: "invalid",
  EXPIRED: "expired",
  ALREADY_VERIFIED: "already_verified"
};

const normalizeEmail = (email = "") => email.trim().toLowerCase();

const getVerificationStateFromError = (rawMessage = "") => {
  const normalizedMessage = rawMessage.toLowerCase();

  if (normalizedMessage.includes("expired")) {
    return {
      status: STATUS.ERROR,
      errorType: ERROR_TYPE.EXPIRED,
      message: "This verification link has expired"
    };
  }

  if (
    normalizedMessage.includes("already been used") ||
    normalizedMessage.includes("already verified")
  ) {
    return {
      status: STATUS.ERROR,
      errorType: ERROR_TYPE.ALREADY_VERIFIED,
      message: "This email is already verified"
    };
  }

  return {
    status: STATUS.ERROR,
    errorType: ERROR_TYPE.INVALID,
    message: "This verification link is invalid"
  };
};

const getMessageClassName = (status, errorType) => {
  if (status === STATUS.SUCCESS) {
    return "auth-feedback auth-feedback-success auth-feedback-center";
  }

  if (status === STATUS.LOADING) {
    return "auth-feedback auth-feedback-neutral auth-feedback-center";
  }

  if (
    errorType === ERROR_TYPE.EXPIRED ||
    errorType === ERROR_TYPE.ALREADY_VERIFIED
  ) {
    return "auth-feedback auth-feedback-warning auth-feedback-center";
  }

  return "auth-feedback auth-feedback-error auth-feedback-center";
};

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const attemptedTokenRef = useRef("");

  const token = useMemo(
    () => searchParams.get("token")?.trim() || "",
    [searchParams]
  );

  const emailFromQuery = useMemo(
    () => normalizeEmail(searchParams.get("email") || ""),
    [searchParams]
  );

  const fallbackEmail = useMemo(() => {
    if (emailFromQuery) {
      return emailFromQuery;
    }

    return normalizeEmail(localStorage.getItem("pendingVerificationEmail") || "");
  }, [emailFromQuery]);

  const [status, setStatus] = useState(STATUS.LOADING);
  const [errorType, setErrorType] = useState("");
  const [message, setMessage] = useState("Verifying your email...");
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");

  const shouldShowResendButton =
    status === STATUS.ERROR &&
    Boolean(fallbackEmail) &&
    errorType !== ERROR_TYPE.ALREADY_VERIFIED;

  const setVerificationState = useCallback((nextState) => {
    setStatus(nextState.status);
    setErrorType(nextState.errorType || "");
    setMessage(nextState.message);
  }, []);

  useEffect(() => {
    const verifyUserEmail = async () => {
      setResendMessage("");
      setResendError("");

      if (!token) {
        setVerificationState({
          status: STATUS.ERROR,
          errorType: ERROR_TYPE.INVALID,
          message: "This verification link is invalid"
        });
        return;
      }

      try {
        await verifyEmail(token, fallbackEmail);

        localStorage.removeItem("pendingVerificationEmail");

        setVerificationState({
          status: STATUS.SUCCESS,
          errorType: "",
          message: "Email successfully verified"
        });
      } catch (err) {
        const backendMessage =
          err.response?.data?.message || err.message || "Verification failed";

        setVerificationState(getVerificationStateFromError(backendMessage));
      }
    };

    if (token && attemptedTokenRef.current === token) {
      return;
    }

    if (token) {
      attemptedTokenRef.current = token;
    }

    verifyUserEmail();
  }, [token, fallbackEmail, setVerificationState]);

  const handleResend = async () => {
    if (!fallbackEmail) {
      setResendMessage("");
      setResendError("No email found for resending the verification link");
      return;
    }

    try {
      setIsResending(true);
      setResendMessage("");
      setResendError("");

      const data = await resendVerificationEmail(fallbackEmail);

      localStorage.setItem("pendingVerificationEmail", fallbackEmail);
      setResendMessage(data.message || "Verification email resent successfully");
    } catch (err) {
      const backendMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to resend verification email";

      const normalizedMessage = backendMessage.toLowerCase();

      if (normalizedMessage.includes("already verified")) {
        setVerificationState({
          status: STATUS.ERROR,
          errorType: ERROR_TYPE.ALREADY_VERIFIED,
          message: "This email is already verified"
        });

        setResendMessage("");
        setResendError("");
        return;
      }

      setResendMessage("");
      setResendError(backendMessage.replace(/\.$/, ""));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-verify-card">
        <h1 className="auth-logo">YFNC</h1>

        <div className="auth-verify-stack">
          <p className={getMessageClassName(status, errorType)}>{message}</p>

          {shouldShowResendButton ? (
            <div className="auth-verify-resend-wrap">
              <button
                type="button"
                className="auth-feedback auth-feedback-link auth-resend-link auth-verify-resend-link"
                onClick={handleResend}
                disabled={isResending}
              >
                {isResending ? "Resending..." : "Resend verification email"}
              </button>

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
            </div>
          ) : null}

          <p className="auth-footer auth-verify-footer">
            Go back to <Link to="/login">login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;