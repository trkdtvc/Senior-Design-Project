const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const handleResponse = async (response) => {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
};

export const getServerMembers = async (serverId, token) => {
  const response = await fetch(`${API_BASE_URL}/server-members/${serverId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(response);
};