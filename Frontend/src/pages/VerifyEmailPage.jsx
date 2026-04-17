import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resendVerificationEmail, verifyEmail } from "../services/authService";
import "../styles/auth.css";

const getVerificationStateFromError = (rawMessage) => {
  const normalizedMessage = (rawMessage || "").toLowerCase();

  if (normalizedMessage.includes("expired")) {
    return {
      status: "error",
      errorType: "expired",
      message: "This verification link has expired"
    };
  }

  if (normalizedMessage.includes("already been used")) {
    return {
      status: "error",
      errorType: "already_verified",
      message: "This verification link has already been used."
    };
  }

  if (normalizedMessage.includes("already verified")) {
    return {
      status: "error",
      errorType: "already_verified",
      message: "This email is already verified"
    };
  }

  return {
    status: "error",
    errorType: "invalid",
    message: "This verification link is invalid"
  };
};

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token")?.trim() || "";
  const emailFromQuery = searchParams.get("email")?.trim() || "";
  const attemptedTokenRef = useRef("");

  const fallbackEmail =
    emailFromQuery || localStorage.getItem("pendingVerificationEmail") || "";

  const [status, setStatus] = useState("loading");
  const [errorType, setErrorType] = useState("");
  const [message, setMessage] = useState("Verifying your email...");
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");

  const shouldShowResendButton =
    status === "error" &&
    Boolean(fallbackEmail) &&
    errorType !== "already_verified";

  useEffect(() => {
    const verifyUserEmail = async () => {
      setResendMessage("");
      setResendError("");

      if (!token) {
        setStatus("error");
        setErrorType("invalid");
        setMessage("This verification link is invalid");
        return;
      }

      try {
        await verifyEmail(token, fallbackEmail);

        localStorage.removeItem("pendingVerificationEmail");
        setStatus("success");
        setErrorType("");
        setMessage("Email successfully verified");
      } catch (err) {
        const backendMessage =
          err.response?.data?.message || err.message || "Verification failed";

        const nextState = getVerificationStateFromError(backendMessage);

        setStatus(nextState.status);
        setErrorType(nextState.errorType);
        setMessage(nextState.message);
      }
    };

    if (token && attemptedTokenRef.current === token) {
      return;
    }

    if (token) {
      attemptedTokenRef.current = token;
    }

    verifyUserEmail();
  }, [token, fallbackEmail]);

  const handleResend = async () => {
    if (!fallbackEmail) {
      setResendError("No email found for resending the verification link.");
      return;
    }

    try {
      setIsResending(true);
      setResendMessage("");
      setResendError("");

      const data = await resendVerificationEmail(fallbackEmail);

      setResendMessage(
        data.message || "Verification email resent successfully"
      );
    } catch (err) {
      const backendMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to resend verification email.";

      const normalizedMessage = backendMessage.toLowerCase();

      if (normalizedMessage.includes("already verified")) {
        setStatus("error");
        setErrorType("already_verified");
        setMessage("This email is already verified");
        setResendMessage("");
        setResendError("");
        return;
      }

      setResendError(backendMessage);
    } finally {
      setIsResending(false);
    }
  };

  const getMessageClassName = () => {
    if (status === "success") {
      return "auth-feedback auth-feedback-success auth-feedback-center";
    }

    if (status === "loading") {
      return "auth-feedback auth-feedback-neutral auth-feedback-center";
    }

    if (errorType === "expired" || errorType === "already_verified") {
      return "auth-feedback auth-feedback-warning auth-feedback-center";
    }

    return "auth-feedback auth-feedback-error auth-feedback-center";
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-verify-card">
        <h1 className="auth-logo">YFNC</h1>
        

        <div className="auth-verify-stack">
          <p className={getMessageClassName()}>{message}</p>

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