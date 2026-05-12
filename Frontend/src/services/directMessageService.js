const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const handleResponse = async (response) => {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Request failed.");
  }

  return data;
};

export const getDirectConversations = async (token) => {
  const response = await fetch(`${API_BASE_URL}/direct-messages/conversations`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(response);
};

export const getOrCreateDirectConversation = async (token, friendId) => {
  const response = await fetch(`${API_BASE_URL}/direct-messages/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ friendId })
  });

  return handleResponse(response);
};

export const getDirectMessages = async (token, conversationId) => {
  const response = await fetch(
    `${API_BASE_URL}/direct-messages/conversations/${conversationId}/messages`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  return handleResponse(response);
};

export const sendDirectMessage = async (token, messageData) => {
  const response = await fetch(`${API_BASE_URL}/direct-messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(messageData)
  });

  return handleResponse(response);
};

export const deleteDirectConversation = async (token, conversationId) => {
  const response = await fetch(
    `${API_BASE_URL}/direct-messages/conversations/${conversationId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  return handleResponse(response);
};