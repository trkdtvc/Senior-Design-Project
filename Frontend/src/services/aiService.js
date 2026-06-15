import { apiRequest } from "./apiClient";

const normalizeAiHistory = (history = []) =>
  Array.isArray(history)
    ? history
        .filter((item) => item?.role && item?.content)
        .slice(-8)
        .map((item) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: String(item.content).slice(0, 1200)
        }))
    : [];

export const askChannelAi = async (
  token,
  channelId,
  prompt,
  limit = 60,
  history = []
) =>
  apiRequest(`/ai/channels/${channelId}/ask`, {
    method: "POST",
    token,
    body: { prompt, limit, history: normalizeAiHistory(history) },
    timeoutMs: 90000
  });

export const askDirectAi = async (
  token,
  conversationId,
  prompt,
  limit = 60,
  history = []
) =>
  apiRequest(`/ai/direct/${conversationId}/ask`, {
    method: "POST",
    token,
    body: { prompt, limit, history: normalizeAiHistory(history) },
    timeoutMs: 90000
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
    timeoutMs: 90000
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
    timeoutMs: 90000
  });
