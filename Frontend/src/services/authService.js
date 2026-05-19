const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const JSON_HEADERS = {
  "Content-Type": "application/json"
};

const normalizeEmail = (email = "") => email.trim().toLowerCase();

const parseResponseBody = async (response) => {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }

  const text = await response.text().catch(() => "");

  return text ? { message: text } : {};
};

const handleResponse = async (response) => {
  const data = await parseResponseBody(response);

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.error || "Something went wrong"
    );

    error.response = {
      data,
      status: response.status
    };

    throw error;
  }

  return data;
};

const buildQueryString = (params) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });

  return query.toString();
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
  const queryString = buildQueryString({
    token: token || "",
    email: normalizeEmail(email)
  });

  const response = await fetch(
    `${API_BASE_URL}/auth/verify-email?${queryString}`
  );

  return handleResponse(response);
};

export const resendVerificationEmail = async (email) => {
  const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      email: normalizeEmail(email)
    })
  });

  return handleResponse(response);
};

export const forgotPassword = async (email) => {
  const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      email: normalizeEmail(email)
    })
  });

  return handleResponse(response);
};

export const validateResetPasswordToken = async (token) => {
  const queryString = buildQueryString({
    token: token || ""
  });

  const response = await fetch(
    `${API_BASE_URL}/auth/reset-password/validate?${queryString}`
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
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(response);
};