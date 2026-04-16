import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resendVerificationEmail, verifyEmail } from "../services/authService";
import "../styles/auth.css";

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
    fallbackEmail &&
    errorType !== "already_verified";

  useEffect(() => {
    const verifyUserEmail = async () => {
      if (!token) {
        setStatus("error");
        setErrorType("invalid");
        setMessage("This verification link is invalid.");
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
        const normalizedMessage = backendMessage.toLowerCase();

        if (normalizedMessage.includes("expired")) {
          setStatus("error");
          setErrorType("expired");
          setMessage("This verification link has expired.");
          return;
        }

        if (normalizedMessage.includes("already been used")) {
          setStatus("error");
          setErrorType("already_verified");
          setMessage("This verification link has already been used.");
          return;
        }

        if (normalizedMessage.includes("already verified")) {
          setStatus("error");
          setErrorType("already_verified");
          setMessage("This email is already verified");
          return;
        }

        setStatus("error");
        setErrorType("invalid");
        setMessage("This verification link is invalid.");
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
      setResendError("");
      setResendMessage("");

      const data = await resendVerificationEmail(fallbackEmail);

      setResendMessage(
        data.message || "Verification email resent successfully"
      );
    } catch (err) {
      const backendMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to resend verification email.";

      if (backendMessage.toLowerCase().includes("already verified")) {
        setErrorType("already_verified");
        setResendError("This email is already verified");
      } else {
        setResendError(backendMessage);
      }
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

        {status === "loading" ? (
          <p className="auth-subtitle">Email verification</p>
        ) : null}

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