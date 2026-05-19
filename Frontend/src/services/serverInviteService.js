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
    throw new Error(data?.message || data?.error || "Something went wrong.");
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

export const createServerInvite = async (serverId, token) => {
  const response = await fetch(`${API_BASE_URL}/server-invites/${serverId}`, {
    method: "POST",
    headers: getAuthHeaders(token)
  });

  return handleResponse(response);
};

export const getServerInvites = async (serverId, token) => {
  const response = await fetch(`${API_BASE_URL}/server-invites/${serverId}`, {
    method: "GET",
    headers: getAuthHeaders(token)
  });

  return handleResponse(response);
};

export const joinServerByInvite = async (inviteCode, token) => {
  const response = await fetch(`${API_BASE_URL}/server-invites/join`, {
    method: "POST",
    headers: getJsonHeaders(token),
    body: JSON.stringify({
      invite_code: inviteCode.trim().toUpperCase()
    })
  });

  return handleResponse(response);
};