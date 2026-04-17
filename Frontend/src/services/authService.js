const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const JSON_HEADERS = {
  "Content-Type": "application/json"
};

const normalizeEmail = (email = "") => email.trim().toLowerCase();

const handleResponse = async (response) => {
  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(data.message || "Something went wrong");
    error.response = { data, status: response.status };
    throw error;
  }

  return data;
};

export const registerUser = async (userData) => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      ...userData,
      email: normalizeEmail(userData.email || "")
    })
  });

  return handleResponse(response);
};

export const loginUser = async (userData) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(userData)
  });

  return handleResponse(response);
};

export const verifyEmail = async (token, email = "") => {
  const query = new URLSearchParams({
    token: token || ""
  });

  if (email) {
    query.set("email", normalizeEmail(email));
  }

  const response = await fetch(
    `${API_BASE_URL}/auth/verify-email?${query.toString()}`
  );

  return handleResponse(response);
};

export const resendVerificationEmail = async (email) => {
  const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ email: normalizeEmail(email) })
  });

  return handleResponse(response);
};

export const forgotPassword = async (email) => {
  const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ email: normalizeEmail(email) })
  });

  return handleResponse(response);
};

export const validateResetPasswordToken = async (token) => {
  const response = await fetch(
    `${API_BASE_URL}/auth/reset-password/validate?token=${encodeURIComponent(token)}`
  );

  return handleResponse(response);
};

export const resetPassword = async (token, newPassword, confirmPassword) => {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      token,
      newPassword,
      confirmPassword
    })
  });

  return handleResponse(response);
};

export const getMe = async (token) => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(response);
};