import { API_BASE_URL, getAuthHeaders } from "./apiClient";

const ATTACHMENT_REQUEST_TIMEOUT_MS = 30000;

const getAttachmentAccessPath = (attachment) => {
  const attachmentId = Number(attachment?.attachment_id || attachment?.attachmentId);

  if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
    return "";
  }

  const isDirectAttachment = Boolean(
    attachment?.direct_message_id || attachment?.directMessageId
  );

  return isDirectAttachment
    ? `/attachments/direct/${attachmentId}`
    : `/attachments/channel/${attachmentId}`;
};

export const fetchAttachmentBlob = async (token, attachment) => {
  const accessPath = getAttachmentAccessPath(attachment);

  if (!token || !accessPath) {
    throw new Error("Attachment is unavailable.");
  }

  const controller = typeof AbortController !== "undefined"
    ? new AbortController()
    : null;
  const timeoutId = controller
    ? globalThis.setTimeout(() => controller.abort(), ATTACHMENT_REQUEST_TIMEOUT_MS)
    : null;

  try {
    const response = await fetch(`${API_BASE_URL}${accessPath}`, {
      headers: getAuthHeaders(token),
      signal: controller?.signal
    });

    if (!response.ok) {
      let message = "Unable to load attachment.";

      try {
        const data = await response.json();
        message = data?.message || message;
      } catch {
        // The attachment endpoint may return a non-JSON error body.
      }

      throw new Error(message);
    }

    return response.blob();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Attachment request timed out. Please try again.");
    }

    if (error instanceof TypeError) {
      throw new Error("Unable to reach the server. Please try again.");
    }

    throw error;
  } finally {
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }
  }
};
