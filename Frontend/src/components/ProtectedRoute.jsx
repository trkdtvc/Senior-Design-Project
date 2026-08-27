import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getMe } from "../services/authService";
import "../styles/auth.css";

const AUTH_STATUS = {
  CHECKING: "checking",
  AUTHORIZED: "authorized",
  UNAUTHORIZED: "unauthorized",
  VERIFICATION_REQUIRED: "verification_required"
};

const ProtectedRoute = () => {
  const [authStatus, setAuthStatus] = useState(AUTH_STATUS.CHECKING);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        if (isMounted) {
          setAuthStatus(AUTH_STATUS.UNAUTHORIZED);
        }

        return;
      }

      try {
        await getMe(token);

        if (isMounted) {
          setAuthStatus(AUTH_STATUS.AUTHORIZED);
        }
      } catch (error) {
        localStorage.removeItem("token");

        const verificationEmail = error?.response?.data?.email;
        const requiresVerification =
          error?.response?.status === 403 && Boolean(verificationEmail);

        if (requiresVerification) {
          localStorage.setItem("pendingVerificationEmail", verificationEmail);
        }

        if (isMounted) {
          setAuthStatus(
            requiresVerification
              ? AUTH_STATUS.VERIFICATION_REQUIRED
              : AUTH_STATUS.UNAUTHORIZED
          );
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  if (authStatus === AUTH_STATUS.CHECKING) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-logo">YFNC</h1>
          <p className="auth-feedback auth-feedback-neutral auth-feedback-center">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (authStatus === AUTH_STATUS.VERIFICATION_REQUIRED) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          requiresEmailVerification: true,
          verificationMessage: "Please verify your email before logging in"
        }}
      />
    );
  }

  if (authStatus === AUTH_STATUS.UNAUTHORIZED) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;