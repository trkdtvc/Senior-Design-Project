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

const createMessageFormData = ({ channel_id, content = "", attachment }) => {
  const formData = new FormData();

  formData.append("channel_id", channel_id);
  formData.append("content", content);
  formData.append("attachment", attachment);

  return formData;
};

export const getChannelMessages = async (token, channelId) => {
  const response = await fetch(`${API_BASE_URL}/messages/${channelId}`, {
    method: "GET",
    headers: getAuthHeaders(token)
  });

  return handleResponse(response);
};

export const createMessage = async (token, messageData) => {
  const hasAttachment = Boolean(messageData?.attachment);

  const response = await fetch(`${API_BASE_URL}/messages`, {
    method: "POST",
    headers: hasAttachment ? getAuthHeaders(token) : getJsonHeaders(token),
    body: hasAttachment
      ? createMessageFormData(messageData)
      : JSON.stringify({
          channel_id: messageData.channel_id,
          content: messageData.content || ""
        })
  });

  return handleResponse(response);
};