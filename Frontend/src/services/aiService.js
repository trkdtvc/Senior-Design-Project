import { apiRequest } from "./apiClient";

export const askChannelAi = async (token, channelId, prompt, limit = 50) =>
  apiRequest(`/ai/channels/${channelId}/ask`, {
    method: "POST",
    token,
    body: { prompt, limit },
    timeoutMs: 60000
  });

export const askDirectAi = async (token, conversationId, prompt, limit = 50) =>
  apiRequest(`/ai/direct/${conversationId}/ask`, {
    method: "POST",
    token,
    body: { prompt, limit },
    timeoutMs: 60000
  });

export const getChannelConversationIntelligence = async (
  token,
  channelId,
  limit = 50
) =>
  apiRequest(`/ai/channels/${channelId}/intelligence`, {
    method: "POST",
    token,
    body: { limit },
    timeoutMs: 60000
  });

export const getDirectConversationIntelligence = async (
  token,
  conversationId,
  limit = 50
) =>
  apiRequest(`/ai/direct/${conversationId}/intelligence`, {
    method: "POST",
    token,
    body: { limit },
    timeoutMs: 60000
  });
