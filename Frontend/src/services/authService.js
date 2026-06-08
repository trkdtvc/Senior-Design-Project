import { apiRequest, buildQueryString, normalizeEmail } from "./apiClient";

export const registerUser = async (userData) =>
  apiRequest("/auth/register", {
    method: "POST",
    body: {
      ...userData,
      email: normalizeEmail(userData.email || "")
    }
  });

export const loginUser = async (userData) =>
  apiRequest("/auth/login", {
    method: "POST",
    body: userData
  });

export const verifyEmail = async (token, email = "") => {
  const queryString = buildQueryString({
    token: token || "",
    email: normalizeEmail(email)
  });

  return apiRequest(`/auth/verify-email${queryString}`);
};

export const resendVerificationEmail = async (email) =>
  apiRequest("/auth/resend-verification", {
    method: "POST",
    body: {
      email: normalizeEmail(email)
    }
  });

export const forgotPassword = async (email) =>
  apiRequest("/auth/forgot-password", {
    method: "POST",
    body: {
      email: normalizeEmail(email)
    }
  });

export const validateResetPasswordToken = async (token) => {
  const queryString = buildQueryString({
    token: token || ""
  });

  return apiRequest(`/auth/reset-password/validate${queryString}`);
};

export const resetPassword = async (token, newPassword, confirmPassword) =>
  apiRequest("/auth/reset-password", {
    method: "POST",
    body: {
      token,
      newPassword,
      confirmPassword
    }
  });

export const getMe = async (token) =>
  apiRequest("/auth/me", {
    token
  });
export const updateProfile = async (token, profileData) =>
  apiRequest("/auth/profile", {
    method: "PATCH",
    token,
    body: {
      username: profileData.username || "",
      email: normalizeEmail(profileData.email || "")
    }
  });

