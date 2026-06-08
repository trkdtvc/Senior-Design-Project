import { apiRequest, buildQueryString } from "./apiClient";

const createMessageFormData = ({
  channel_id,
  content = "",
  attachment,
  reply_to_message_id
}) => {
  const formData = new FormData();

  formData.append("channel_id", channel_id);
  formData.append("content", content);

  if (reply_to_message_id) {
    formData.append("reply_to_message_id", reply_to_message_id);
  }

  if (attachment) {
    formData.append("attachment", attachment);
  }

  return formData;
};

export const getChannelMessages = async (token, channelId, options = {}) => {
  const queryString = buildQueryString({
    limit: options.limit,
    beforeMessageId: options.beforeMessageId,
    aroundMessageId: options.aroundMessageId
  });

  return apiRequest(`/messages/${channelId}${queryString}`, {
    token
  });
};

export const searchChannelMessages = async (token, channelId, searchTerm) => {
  const queryString = buildQueryString({
    q: searchTerm
  });

  return apiRequest(`/messages/search/${channelId}${queryString}`, {
    token
  });
};

export const createMessage = async (token, messageData) => {
  const hasAttachment = Boolean(messageData?.attachment);

  return apiRequest("/messages", {
    method: "POST",
    token,
    isFormData: hasAttachment,
    body: hasAttachment
      ? createMessageFormData(messageData)
      : {
          channel_id: messageData.channel_id,
          content: messageData.content || "",
          reply_to_message_id: messageData.reply_to_message_id || null
        }
  });
};

export const updateMessage = async (token, messageId, content) =>
  apiRequest(`/messages/${messageId}`, {
    method: "PUT",
    token,
    body: { content }
  });

export const deleteMessage = async (token, messageId) =>
  apiRequest(`/messages/${messageId}`, {
    method: "DELETE",
    token
  });

export const markChannelAsRead = async (token, channelId) =>
  apiRequest(`/messages/${channelId}/read`, {
    method: "PATCH",
    token
  });

export const getUnreadChannelCounts = async (token) =>
  apiRequest("/messages/unread-counts", {
    token
  });

export const getUnreadMentionCounts = async (token) =>
  apiRequest("/messages/mention-counts", {
    token
  });
