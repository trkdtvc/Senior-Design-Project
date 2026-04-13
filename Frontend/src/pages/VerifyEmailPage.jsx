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
    return (
      emailFromQuery || localStorage.getItem("pendingVerificationEmail") || ""
    );
  }, [emailFromQuery]);

  const [status, setStatus] = useState("loading");
  const [errorType, setErrorType] = useState("");
  const [message, setMessage] = useState("Verifying your email...");
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");

  const pageSubtitle = useMemo(() => {
    if (status === "loading") return "Email verification";
    if (status === "success") return "Email verified";
    if (errorType === "expired") return "Verification link expired";
    if (errorType === "invalid") return "Invalid verification link";
    if (errorType === "already_verified") return "Email already verified";
    return "Email verification";
  }, [status, errorType]);

  const shouldShowResendButton =
    status === "error" &&
    fallbackEmail &&
    errorType !== "already_verified";

  useEffect(() => {
    let isMounted = true;
    let redirectTimeout;

    const verifyUserEmail = async () => {
      if (!token) {
        if (!isMounted) return;

        setStatus("error");
        setErrorType("invalid");
        setMessage("This verification link is invalid");
        return;
      }

      try {
        const data = await verifyEmail(token, fallbackEmail);

        if (!isMounted) return;

        if (data.token) {
          localStorage.setItem("token", data.token);
        }

        if (data.user?.email) {
          localStorage.removeItem("pendingVerificationEmail");
        }

        setStatus("success");
        setErrorType("");
        setMessage(
          data.message || "Email verified successfully. Redirecting you into the app..."
        );

        redirectTimeout = setTimeout(() => {
          navigate("/dashboard", { replace: true });
        }, 3000);
      } catch (err) {
        if (!isMounted) return;

        const backendMessage =
          err.response?.data?.message || err.message || "Verification failed";
        const normalizedMessage = backendMessage.toLowerCase();

        if (normalizedMessage.includes("expired")) {
          setStatus("error");
          setErrorType("expired");
          setMessage("This verification link has expired");
          return;
        }

        if (normalizedMessage.includes("expired")) {
          setStatus("error");
          setErrorType("expired");
          setMessage("This verification link has expired");
          return;
        }

        if (normalizedMessage.includes("already been used")) {
          setStatus("error");
          setErrorType("already_verified");
          setMessage("This verification link has already been used");
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
        setMessage("This verification link is invalid");
      }
    };

    verifyUserEmail();

    return () => {
      isMounted = false;

      if (redirectTimeout) {
        clearTimeout(redirectTimeout);
      }
    };
  }, [token, fallbackEmail, navigate]);

  const handleResend = async () => {
    if (!fallbackEmail) {
      setResendError("No email found for resending the verification link");
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
        "Failed to resend verification email";

      if (backendMessage.toLowerCase().includes("already verified")) {
        setErrorType("already_verified");
        setResendError("This email is already verified");
      } else {
        setResendError(backendMessage.replace(/\.$/, ""));
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">YFNC</h1>
        <p className="auth-subtitle">{pageSubtitle}</p>

        {status === "loading" && <p className="auth-message loading">{message}</p>}
        {status === "success" && <p className="auth-success">{message}</p>}
        {status === "error" && <p className="auth-error">{message}</p>}

        {shouldShowResendButton ? (
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
            Taking you into the app. If nothing happens,{" "}
            <Link to="/dashboard">continue</Link>.
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