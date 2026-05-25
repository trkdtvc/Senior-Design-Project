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
    throw new Error(data?.message || data?.error || "Request failed.");
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

const createDirectMessageFormData = ({
  conversationId,
  content = "",
  attachment,
  reply_to_direct_message_id
}) => {
  const formData = new FormData();

  formData.append("conversationId", conversationId);
  formData.append("content", content);

  if (reply_to_direct_message_id) {
    formData.append("reply_to_direct_message_id", reply_to_direct_message_id);
  }

  if (attachment) {
    formData.append("attachment", attachment);
  }

  return formData;
};

export const getDirectConversations = async (token) => {
  const response = await fetch(`${API_BASE_URL}/direct-messages/conversations`, {
    method: "GET",
    headers: getAuthHeaders(token)
  });

  return handleResponse(response);
};

export const getOrCreateDirectConversation = async (token, friendId) => {
  const response = await fetch(`${API_BASE_URL}/direct-messages/conversations`, {
    method: "POST",
    headers: getJsonHeaders(token),
    body: JSON.stringify({ friendId })
  });

  return handleResponse(response);
};

export const getDirectMessages = async (token, conversationId) => {
  const response = await fetch(
    `${API_BASE_URL}/direct-messages/conversations/${conversationId}/messages`,
    {
      method: "GET",
      headers: getAuthHeaders(token)
    }
  );

  return handleResponse(response);
};

export const sendDirectMessage = async (token, messageData) => {
  const hasAttachment = Boolean(messageData?.attachment);

  const response = await fetch(`${API_BASE_URL}/direct-messages`, {
    method: "POST",
    headers: hasAttachment ? getAuthHeaders(token) : getJsonHeaders(token),
    body: hasAttachment
      ? createDirectMessageFormData(messageData)
      : JSON.stringify({
          conversationId: messageData.conversationId,
          content: messageData.content || "",
          reply_to_direct_message_id:
            messageData.reply_to_direct_message_id || null
        })
  });

  return handleResponse(response);
};

export const updateDirectMessage = async (token, directMessageId, content) => {
  const response = await fetch(
    `${API_BASE_URL}/direct-messages/messages/${directMessageId}`,
    {
      method: "PUT",
      headers: getJsonHeaders(token),
      body: JSON.stringify({ content })
    }
  );

  return handleResponse(response);
};

export const deleteDirectMessage = async (token, directMessageId) => {
  const response = await fetch(
    `${API_BASE_URL}/direct-messages/messages/${directMessageId}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(token)
    }
  );

  return handleResponse(response);
};

export const deleteDirectConversation = async (token, conversationId) => {
  const response = await fetch(
    `${API_BASE_URL}/direct-messages/conversations/${conversationId}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(token)
    }
  );

  return handleResponse(response);
};