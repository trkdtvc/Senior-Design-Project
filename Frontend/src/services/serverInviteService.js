const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const handleResponse = async (response) => {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
};

export const createServerInvite = async (serverId, token, payload = {}) => {
  const response = await fetch(`${API_BASE_URL}/server-invites/${serverId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  return handleResponse(response);
};

export const getServerInvites = async (serverId, token) => {
  const response = await fetch(`${API_BASE_URL}/server-invites/${serverId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(response);
};

export const joinServerByInvite = async (inviteCode, token) => {
  const response = await fetch(`${API_BASE_URL}/server-invites/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      invite_code: inviteCode
    })
  });

  return handleResponse(response);
};