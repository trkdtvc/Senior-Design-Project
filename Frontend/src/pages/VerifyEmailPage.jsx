import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resendVerificationEmail, verifyEmail } from "../services/authService";
import "../styles/auth.css";

const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token")?.trim() || "";
  const emailFromQuery = searchParams.get("email")?.trim() || "";

  const fallbackEmail = useMemo(() => {
    return emailFromQuery || localStorage.getItem("pendingVerificationEmail") || "";
  }, [emailFromQuery]);

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your email...");
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");

  useEffect(() => {
    let isMounted = true;
    let redirectTimeout;

    const verifyUserEmail = async () => {
      if (!token) {
        if (!isMounted) {
          return;
        }

        setStatus("error");
        setMessage("Invalid verification token.");
        return;
      }

      try {
        const data = await verifyEmail(token);

        if (!isMounted) {
          return;
        }

        if (data.token) {
          localStorage.setItem("token", data.token);
        }

        if (data.user?.email) {
          localStorage.removeItem("pendingVerificationEmail");
        }

        setStatus("success");
        setMessage(
          data.message || "Email verified successfully. Redirecting you into the app..."
        );

        redirectTimeout = setTimeout(() => {
          navigate("/dashboard", { replace: true });
        }, 3000);
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setStatus("error");
        setMessage(err.message || "Verification failed.");
      }
    };

    verifyUserEmail();

    return () => {
      isMounted = false;

      if (redirectTimeout) {
        clearTimeout(redirectTimeout);
      }
    };
  }, [token, navigate]);

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
        data.message || "Verification email resent successfully."
      );
    } catch (err) {
      setResendError(err.message || "Failed to resend verification email.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">YFNC</h1>
        <p className="auth-subtitle">Email verification</p>

        {status === "loading" && <p className="auth-message loading">{message}</p>}
        {status === "success" && <p className="auth-success">{message}</p>}
        {status === "error" && <p className="auth-error">{message}</p>}

        {status === "error" && fallbackEmail ? (
          <button
            type="button"
            className="auth-button auth-button-secondary"
            onClick={handleResend}
            disabled={isResending}
          >
            {isResending ? "Resending..." : "Resend verification email"}
          </button>
        ) : null}

        {resendMessage ? <p className="auth-success">{resendMessage}</p> : null}
        {resendError ? <p className="auth-error">{resendError}</p> : null}

        {status === "success" ? (
          <p className="auth-footer">
            Taking you into the app. If nothing happens, <Link to="/dashboard">continue</Link>.
          </p>
        ) : (
          <p className="auth-footer">
            Go back to <Link to="/login">login</Link>.
          </p>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;