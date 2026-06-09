const DEFAULT_API_BASE_URL = "http://localhost:5000/api";
const API_REQUEST_TIMEOUT_MS = 30000;

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

const createApiError = (message, response = null) => {
  const error = new Error(message);

  if (response) {
    error.response = response;
  }

  return error;
};

export const handleResponse = async (response) => {
  const data = await parseResponseBody(response);

  if (!response.ok) {
    throw createApiError(data?.message || data?.error || "Request failed.", {
      data,
      status: response.status
    });
  }

  return data;
};

const buildRequestHeaders = ({ body, headers, isFormData, token }) => {
  if (isFormData) {
    return {
      ...getAuthHeaders(token),
      ...headers
    };
  }

  return {
    ...(body !== undefined ? getJsonHeaders(token) : getAuthHeaders(token)),
    ...headers
  };
};

const buildRequestBody = ({ body, isFormData }) => {
  if (body === undefined) {
    return undefined;
  }

  if (isFormData || typeof body === "string") {
    return body;
  }

  return JSON.stringify(body);
};

export const apiRequest = async (
  path,
  {
    method = "GET",
    token,
    body,
    headers = {},
    isFormData = body instanceof FormData,
    timeoutMs = API_REQUEST_TIMEOUT_MS
  } = {}
) => {
  const controller = typeof AbortController !== "undefined"
    ? new AbortController()
    : null;
  const timeoutId = controller
    ? globalThis.setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: buildRequestHeaders({ body, headers, isFormData, token }),
      body: buildRequestBody({ body, isFormData }),
      signal: controller?.signal
    });

    return await handleResponse(response);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createApiError("Request timed out. Please try again.");
    }

    if (error instanceof TypeError) {
      throw createApiError("Unable to reach the server. Please try again.");
    }

    throw error;
  } finally {
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }
  }
};
