import { apiRequest, buildQueryString } from "./apiClient";

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

export const getDirectConversations = async (token) =>
  apiRequest("/direct-messages/conversations", {
    token
  });

export const getOrCreateDirectConversation = async (token, friendId) =>
  apiRequest("/direct-messages/conversations", {
    method: "POST",
    token,
    body: { friendId }
  });

export const getDirectMessages = async (token, conversationId, options = {}) => {
  const queryString = buildQueryString({
    limit: options.limit,
    beforeDirectMessageId: options.beforeDirectMessageId,
    aroundDirectMessageId: options.aroundDirectMessageId
  });

  return apiRequest(
    `/direct-messages/conversations/${conversationId}/messages${queryString}`,
    { token }
  );
};

export const searchDirectMessages = async (token, conversationId, searchTerm) => {
  const queryString = buildQueryString({
    query: searchTerm
  });

  return apiRequest(
    `/direct-messages/conversations/${conversationId}/search${queryString}`,
    { token }
  );
};

export const sendDirectMessage = async (token, messageData) => {
  const hasAttachment = Boolean(messageData?.attachment);

  return apiRequest("/direct-messages", {
    method: "POST",
    token,
    isFormData: hasAttachment,
    body: hasAttachment
      ? createDirectMessageFormData(messageData)
      : {
          conversationId: messageData.conversationId,
          content: messageData.content || "",
          reply_to_direct_message_id:
            messageData.reply_to_direct_message_id || null
        }
  });
};

export const updateDirectMessage = async (token, directMessageId, content) =>
  apiRequest(`/direct-messages/messages/${directMessageId}`, {
    method: "PUT",
    token,
    body: { content }
  });

export const deleteDirectMessage = async (token, directMessageId) =>
  apiRequest(`/direct-messages/messages/${directMessageId}`, {
    method: "DELETE",
    token
  });

export const deleteDirectConversation = async (token, conversationId) =>
  apiRequest(`/direct-messages/conversations/${conversationId}`, {
    method: "DELETE",
    token
  });

export const markDirectConversationAsRead = async (token, conversationId) =>
  apiRequest(`/direct-messages/conversations/${conversationId}/read`, {
    method: "PATCH",
    token
  });

export const getUnreadDirectConversationCounts = async (token) =>
  apiRequest("/direct-messages/unread-counts", {
    token
  });
