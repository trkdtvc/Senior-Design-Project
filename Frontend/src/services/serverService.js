const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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

const handleResponse = async (response) => {
  const data = await parseResponseBody(response);

  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || "Something went wrong. Please try again."
    );
  }

  return data;
};

const getAuthHeaders = (token) => ({
  Authorization: `Bearer ${token}`
});

const getJsonHeaders = (token) => ({
  ...getAuthHeaders(token),
  "Content-Type": "application/json"
});

export const getUserServers = async (token) => {
  const response = await fetch(`${API_BASE_URL}/servers`, {
    method: "GET",
    headers: getAuthHeaders(token)
  });

  return handleResponse(response);
};

export const createServer = async (token, serverData) => {
  const response = await fetch(`${API_BASE_URL}/servers`, {
    method: "POST",
    headers: getJsonHeaders(token),
    body: JSON.stringify({
      server_name: serverData.server_name?.trim() || "",
      description: serverData.description?.trim() || ""
    })
  });

  return handleResponse(response);
};

export const deleteServer = async (token, serverId) => {
  const response = await fetch(`${API_BASE_URL}/servers/${serverId}`, {
    method: "DELETE",
    headers: getAuthHeaders(token)
  });

  return handleResponse(response);
};