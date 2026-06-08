const DEFAULT_API_BASE_URL = "http://localhost:5000/api";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || DEFAULT_API_BASE_URL;

export const getApiBaseUrl = () => API_BASE_URL;

export const getFileBaseUrl = () => API_BASE_URL.replace(/\/api\/?$/, "");

export const normalizeEmail = (email = "") => email.trim().toLowerCase();

export const buildQueryString = (params = {}) => {
  const queryParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      queryParams.set(key, value);
    }
  });

  const queryString = queryParams.toString();
  return queryString ? `?${queryString}` : "";
};

export const getAuthHeaders = (token) => {
  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`
  };
};

export const getJsonHeaders = (token) => ({
  ...getAuthHeaders(token),
  "Content-Type": "application/json"
});

const parseResponseBody = async (response) => {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");
  return text ? { message: text } : null;
};

export const handleResponse = async (response) => {
  const data = await parseResponseBody(response);

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.error || "Request failed."
    );

    error.response = {
      data,
      status: response.status
    };

    throw error;
  }

  return data;
};

export const apiRequest = async (
  path,
  {
    method = "GET",
    token,
    body,
    headers = {},
    isFormData = body instanceof FormData
  } = {}
) => {
  const requestHeaders = isFormData
    ? {
        ...getAuthHeaders(token),
        ...headers
      }
    : {
        ...(body !== undefined ? getJsonHeaders(token) : getAuthHeaders(token)),
        ...headers
      };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: isFormData || typeof body === "string" ? body : JSON.stringify(body)
  });

  return handleResponse(response);
};
