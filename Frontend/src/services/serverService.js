const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const handleResponse = async (response) => {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Something went wrong. Please try again.");
  }

  return data;
};

export const getUserServers = async (token) => {
  const response = await fetch(`${API_BASE_URL}/servers`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(response);
};

export const createServer = async (token, serverData) => {
  const response = await fetch(`${API_BASE_URL}/servers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(serverData)
  });

  return handleResponse(response);
};

export const deleteServer = async (token, serverId) => {
  const response = await fetch(`${API_BASE_URL}/servers/${serverId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(response);
};