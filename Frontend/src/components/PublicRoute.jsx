import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getMe } from "../services/authService";
import "../styles/auth.css";

const AUTH_STATUS = {
  CHECKING: "checking",
  AUTHORIZED: "authorized",
  UNAUTHORIZED: "unauthorized"
};

const PublicRoute = () => {
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
      } catch {
        localStorage.removeItem("token");

        if (isMounted) {
          setAuthStatus(AUTH_STATUS.UNAUTHORIZED);
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

  if (authStatus === AUTH_STATUS.AUTHORIZED) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default PublicRoute;