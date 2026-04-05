const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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

export const getUserServers = async (token) => {
  const response = await fetch(`${API_BASE_URL}/servers`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(response);
};