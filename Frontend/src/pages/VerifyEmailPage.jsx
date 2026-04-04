import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../services/authService";
import "../styles/auth.css";

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Invalid verification token.");
      return;
    }

    const verifyUserEmail = async () => {
      try {
        const data = await verifyEmail(token);
        setStatus("success");
        setMessage(data.message || "Successfully verified.");
      } catch (err) {
        setStatus("error");
        setMessage(err.message || "Verification failed.");
      }
    };

    verifyUserEmail();
  }, [searchParams]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">YFNC</h1>
        <p className="auth-subtitle">Email verification</p>

        {status === "loading" && <p>{message}</p>}
        {status === "success" && <p className="auth-success">{message}</p>}
        {status === "error" && <p className="auth-error">{message}</p>}

        {status === "success" && (
          <p className="auth-footer">
            Go back to <Link to="/login">login</Link>.
          </p>
        )}

        {status === "error" && (
          <p className="auth-footer">
            Go back to <Link to="/login">login</Link>.
          </p>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;