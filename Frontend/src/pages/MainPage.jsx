import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMe, updateProfile } from "../services/authService";
import {
  getUserServers,
  createServer,
  deleteServer
} from "../services/serverService";
import {
  getServerChannels,
  createChannel,
  deleteChannel as deleteChannelById
} from "../services/channelService";
import {
  getChannelMessages,
  searchChannelMessages,
  createMessage,
  updateMessage,
  deleteMessage,
  toggleMessageReaction,
  pinMessage,
  unpinMessage,
  getPinnedChannelMessages,
  markChannelAsRead,
  getUnreadChannelCounts,
  getUnreadMentionCounts
} from "../services/messageService";
import {
  getServerMembers,
  leaveServer,
  removeServerMember,
  updateServerMemberRole
} from "../services/serverMemberService";
import {
  getDirectConversations,
  getOrCreateDirectConversation,
  getDirectMessages,
  searchDirectMessages,
  sendDirectMessage,
  updateDirectMessage,
  deleteDirectMessage,
  toggleDirectMessageReaction,
  pinDirectMessage,
  unpinDirectMessage,
  getPinnedDirectMessages,
  deleteDirectConversation,
  markDirectConversationAsRead,
  getUnreadDirectConversationCounts
} from "../services/directMessageService";
import {
  createServerInvite,
  joinServerByInvite
} from "../services/serverInviteService";
import { connectSocket, disconnectSocket } from "../services/socket";
import { getFileBaseUrl } from "../services/apiClient";
import {
  getNotificationSettings,
  setServerMute,
  setChannelMute,
  setDirectConversationMute
} from "../services/notificationSettingsService";
import {
  getBlockedUsers,
  blockUser,
  unblockUser,
  reportUser
} from "../services/userSafetyService";
import {
  getFriends,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend
} from "../services/friendService";
import "../styles/auth.css";
import EmojiPicker, { Theme } from "emoji-picker-react";

const FILE_BASE_URL = getFileBaseUrl();
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;
const MESSAGE_PAGE_SIZE = 30;
const QUICK_REACTION_EMOJIS = ["👍", "❤️", "😂", "🔥", "😮", "🙏"];
const getAuthToken = () => localStorage.getItem("token");

const ATTACHMENT_ACCEPT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed"
].join(",");

const normalizeServers = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.servers)) return data.servers;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const normalizeChannels = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.channels)) return data.channels;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const normalizeMessages = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.messages)) return data.messages;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const normalizeMembers = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.members)) return data.members;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const normalizeDirectConversations = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.conversations)) return data.conversations;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const normalizeFriends = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.friends)) return data.friends;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const normalizeFriendRequests = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.requests)) return data.requests;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const normalizePresenceStatus = (value) => {
  if (value === 1 || value === true || value === "online") {
    return "online";
  }

  return "offline";
};

const getServerId = (server) =>
  server?.server_id || server?.id || server?.serverId || null;

const getServerName = (server) =>
  server?.server_name || server?.name || "Untitled Server";

const getServerDescription = (server) =>
  server?.description || server?.server_description || "";

const getServerOwnerId = (server) =>
  server?.owner_id || server?.ownerId || null;

const getChannelId = (channel) =>
  channel?.channel_id || channel?.id || channel?.channelId || null;

const getChannelName = (channel) =>
  channel?.channel_name || channel?.name || "untitled-channel";

const getMessageId = (message) =>
  message?.message_id || message?.id || message?.messageId || null;

const getMessageAuthor = (message) =>
  message?.username || message?.user?.username || "Unknown user";

const getMessageAuthorId = (message) =>
  message?.user_id ||
  message?.userId ||
  message?.sender_id ||
  message?.senderId ||
  message?.user?.user_id ||
  null;

const getMessageContent = (message) =>
  message?.content || message?.message || "";

const getMessageTimestamp = (message) =>
  message?.created_at || message?.createdAt || message?.timestamp || null;

const getMessageUpdatedTimestamp = (message) =>
  message?.updated_at || message?.updatedAt || null;

const getMemberId = (member) =>
  member?.member_id || member?.id || member?.memberId || null;

const getMemberName = (member) =>
  member?.username || member?.name || "Unknown user";

const getMemberEmail = (member) => member?.email || "";

const getMemberUserId = (member) =>
  member?.user_id || member?.userId || member?.id || null;

const getMemberPresenceStatus = (member) =>
  normalizePresenceStatus(member?.presence_status || member?.presenceStatus);

const isOwner = (member) =>
  member?.is_owner === 1 || member?.is_owner === true || false;

const getMemberServerRole = (member) => {
  if (isOwner(member)) {
    return "owner";
  }

  return String(member?.server_role || member?.serverRole || "member")
    .trim()
    .toLowerCase();
};

const formatMemberRole = (member) => {
  const role = getMemberServerRole(member);

  if (role === "owner") {
    return "Owner";
  }

  if (role === "admin") {
    return "Admin";
  }

  return "Member";
};

const getFriendId = (friend) =>
  friend?.user_id || friend?.id || friend?.friendId || null;

const getFriendName = (friend) =>
  friend?.username || friend?.name || "Unknown user";

const getFriendEmail = (friend) => friend?.email || "";

const getFriendPresenceStatus = (friend) =>
  normalizePresenceStatus(
    friend?.presence_status ?? friend?.presenceStatus ?? friend?.is_online
  );

const getConversationId = (conversation) =>
  conversation?.conversation_id ||
  conversation?.id ||
  conversation?.conversationId ||
  null;

const getConversationOtherUserId = (conversation) =>
  conversation?.other_user?.user_id ||
  conversation?.other_user_id ||
  conversation?.otherUser?.user_id ||
  null;

const getConversationOtherUsername = (conversation) =>
  conversation?.other_user?.username ||
  conversation?.other_username ||
  conversation?.otherUser?.username ||
  "Unknown user";

const getConversationOtherEmail = (conversation) =>
  conversation?.other_user?.email ||
  conversation?.other_email ||
  conversation?.otherUser?.email ||
  "";

const getConversationPresenceStatus = (conversation) =>
  normalizePresenceStatus(
    conversation?.other_user?.is_online ??
    conversation?.other_is_online ??
    conversation?.otherUser?.is_online ??
    conversation?.presence_status
  );

const getConversationLastMessage = (conversation) =>
  conversation?.last_message_content ||
  conversation?.lastMessageContent ||
  "";

const getConversationLastTimestamp = (conversation) =>
  conversation?.last_message_created_at ||
  conversation?.lastMessageCreatedAt ||
  conversation?.updated_at ||
  conversation?.created_at ||
  null;

const getDirectMessageId = (message) =>
  message?.direct_message_id ||
  message?.id ||
  message?.directMessageId ||
  null;

const getDirectMessageSenderId = (message) =>
  message?.sender_id ||
  message?.senderId ||
  message?.sender_user_id ||
  null;

const getDirectMessageAuthor = (message) =>
  message?.sender_username ||
  message?.username ||
  message?.sender?.username ||
  "Unknown user";

const getDirectMessageContent = (message) =>
  message?.content || "";

const getDirectMessageTimestamp = (message) =>
  message?.created_at || message?.createdAt || null;

const getDirectMessageUpdatedTimestamp = (message) =>
  message?.updated_at || message?.updatedAt || null;

const getReplyPreview = (message) => {
  const existingReplyPreview = message?.reply_to || message?.replyTo || null;

  if (existingReplyPreview) {
    return existingReplyPreview;
  }

  const replyContent =
    message?.reply_to_content ||
    message?.reply_to_message_content ||
    message?.replyToContent ||
    "";

  const replyAuthor =
    message?.reply_to_sender_username ||
    message?.reply_to_username ||
    message?.replyToSenderUsername ||
    "";

  if (!replyContent && !replyAuthor) {
    return null;
  }

  return {
    content: replyContent,
    username: replyAuthor,
    sender_username: replyAuthor
  };
};

const getReplyPreviewAuthor = (replyPreview) =>
  replyPreview?.username ||
  replyPreview?.sender_username ||
  replyPreview?.senderUsername ||
  "Unknown user";

const getReplyPreviewContent = (replyPreview) =>
  replyPreview?.content ||
  replyPreview?.message_content ||
  replyPreview?.message ||
  "";

const formatReplyPreviewContent = (content) => {
  const safeContent = String(content || "").trim();

  if (!safeContent) {
    return "Attachment";
  }

  return safeContent.length > 90
    ? `${safeContent.slice(0, 90)}...`
    : safeContent;
};

const isEditedMessage = (message, createdAt, updatedAt) => {
  if (message?.edited || message?.is_edited || message?.isEdited) {
    return true;
  }

  if (!createdAt || !updatedAt) {
    return false;
  }

  const createdTime = new Date(createdAt).getTime();
  const updatedTime = new Date(updatedAt).getTime();

  if (Number.isNaN(createdTime) || Number.isNaN(updatedTime)) {
    return false;
  }

  return updatedTime > createdTime;
};

const getFriendRequestId = (request) =>
  request?.request_id || request?.id || request?.friend_request_id || null;

const getFriendRequestSenderName = (request) =>
  request?.sender?.username ||
  request?.requester?.username ||
  request?.from_user?.username ||
  request?.sender_username ||
  request?.requester_username ||
  request?.from_username ||
  "Unknown user";

const getFriendRequestSenderEmail = (request) =>
  request?.sender?.email ||
  request?.requester?.email ||
  request?.from_user?.email ||
  request?.sender_email ||
  request?.requester_email ||
  request?.from_email ||
  "";

const getFriendRequestReceiverName = (request) =>
  request?.receiver?.username ||
  request?.recipient?.username ||
  request?.to_user?.username ||
  request?.receiver_username ||
  request?.recipient_username ||
  request?.to_username ||
  "Unknown user";

const getFriendRequestReceiverEmail = (request) =>
  request?.receiver?.email ||
  request?.recipient?.email ||
  request?.to_user?.email ||
  request?.receiver_email ||
  request?.recipient_email ||
  request?.to_email ||
  "";

const getFriendRequestTimestamp = (request) =>
  request?.created_at || request?.createdAt || null;

const formatTimestamp = (timestamp) => {
  if (!timestamp) return "";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
};

const getPresenceColorClass = (status) => {
  return normalizePresenceStatus(status) === "online"
    ? "status-online"
    : "status-offline";
};

const getInitial = (value) => {
  const safeValue = String(value || "?").trim();
  return safeValue.charAt(0).toUpperCase() || "?";
};

const getUnreadValue = (unreadMap, id) => {
  if (!id) return 0;
  return Number(unreadMap?.[String(id)] || 0);
};

const getTotalUnreadCount = (unreadMap) =>
  Object.values(unreadMap).reduce((total, value) => total + Number(value || 0), 0);

const formatBadgeCount = (count) => {
  const safeCount = Number(count || 0);

  if (safeCount <= 0) {
    return "";
  }

  return safeCount > 99 ? "99+" : String(safeCount);
};

const formatMentionBadgeCount = (count) => {
  const formattedCount = formatBadgeCount(count);

  return formattedCount ? `@${formattedCount}` : "";
};

const getMessageAttachments = (message) => {
  if (Array.isArray(message?.attachments)) {
    return message.attachments;
  }

  return [];
};

const getMessageReactions = (message) => {
  if (Array.isArray(message?.reactions)) {
    return message.reactions;
  }

  return [];
};

const getReactionEmoji = (reaction) => reaction?.emoji || "";

const getReactionCount = (reaction) => Number(reaction?.count || reaction?.reaction_count || 0);

const userReactedToReaction = (reaction) =>
  reaction?.reacted_by_me === true ||
  reaction?.reactedByMe === true ||
  Number(reaction?.reacted_by_me || 0) === 1;

const messageIsPinned = (message) =>
  Boolean(message?.pinned || message?.is_pinned || message?.pinned_at || message?.pinnedAt);

const getMessagePinnedBy = (message) =>
  message?.pinned_by_username || message?.pinnedByUsername || "someone";

const getMessagePinnedAt = (message) =>
  message?.pinned_at || message?.pinnedAt || null;

const formatTypingUsers = (typingUsers) => {
  const names = typingUsers.map((typingUser) => typingUser.username).filter(Boolean);

  if (names.length === 0) {
    return "";
  }

  if (names.length === 1) {
    return `${names[0]} is typing...`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are typing...`;
  }

  return `${names[0]}, ${names[1]}, and ${names.length - 2} more are typing...`;
};

const getAttachmentUrl = (attachment) => {
  const fileUrl =
    attachment?.file_url ||
    attachment?.fileUrl ||
    attachment?.url ||
    "";

  if (!fileUrl) {
    return "";
  }

  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl;
  }

  return `${FILE_BASE_URL}${fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`}`;
};

const getAttachmentName = (attachment) =>
  attachment?.file_name || attachment?.fileName || "Attachment";

const getAttachmentType = (attachment) =>
  attachment?.file_type || attachment?.fileType || "";

const getAttachmentSize = (attachment) =>
  Number(attachment?.file_size || attachment?.fileSize || 0);

const formatFileSize = (sizeInBytes) => {
  if (!sizeInBytes) {
    return "";
  }

  if (sizeInBytes < 1024 * 1024) {
    return `${Math.round(sizeInBytes / 1024)} KB`;
  }

  return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getAttachmentKind = (attachment) => {
  const attachmentType = getAttachmentType(attachment).toLowerCase();

  if (attachmentType.startsWith("image/")) return "Image";
  if (attachmentType.startsWith("video/")) return "Video";
  if (attachmentType.startsWith("audio/")) return "Audio";
  if (attachmentType.includes("pdf")) return "PDF";
  if (attachmentType.includes("word")) return "Document";
  if (attachmentType.includes("spreadsheet") || attachmentType.includes("excel")) return "Spreadsheet";
  if (attachmentType.includes("presentation") || attachmentType.includes("powerpoint")) return "Presentation";
  if (attachmentType.includes("zip")) return "Archive";
  if (attachmentType.startsWith("text/")) return "Text file";

  return "File";
};

const normalizeIdList = (list) =>
  Array.isArray(list) ? list.map((id) => String(id)) : [];

const applyNotificationSettingsPayload = (payload) =>
  payload?.settings || payload?.data?.settings || payload || {
    muted_server_ids: [],
    muted_channel_ids: [],
    muted_direct_conversation_ids: []
  };

const normalizeBlockedUsers = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.blockedUsers)) return payload.blockedUsers;
  if (Array.isArray(payload?.blocked_users)) return payload.blocked_users;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const getMentionedUserIds = (message) => {
  const mentionedIds =
    message?.mentioned_user_ids ||
    message?.mentionedUserIds ||
    message?.mentioned_users ||
    message?.mentionedUsers ||
    [];

  if (!Array.isArray(mentionedIds)) {
    return [];
  }

  return mentionedIds.map((mentionedId) => String(mentionedId));
};

const contentMentionsUsername = (content, username) => {
  const safeContent = String(content || "");
  const safeUsername = String(username || "").trim().toLowerCase();

  if (!safeContent || !safeUsername) {
    return false;
  }

  const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
  let match = mentionRegex.exec(safeContent);

  while (match) {
    if (String(match[1] || "").toLowerCase() === safeUsername) {
      return true;
    }

    match = mentionRegex.exec(safeContent);
  }

  return false;
};

const messageMentionsCurrentUser = ({
  message,
  content,
  currentUserId,
  currentUsername,
  isOwnMessage
}) => {
  if (isOwnMessage) {
    return false;
  }

  const mentionedUserIds = getMentionedUserIds(message);

  if (
    currentUserId &&
    mentionedUserIds.some(
      (mentionedUserId) => String(mentionedUserId) === String(currentUserId)
    )
  ) {
    return true;
  }

  return contentMentionsUsername(content, currentUsername);
};

const buildMessageTextHighlights = ({ content, searchTerm, mentionUsername }) => {
  const safeContent = String(content || "");
  const ranges = [];

  const safeSearchTerm = String(searchTerm || "").trim();

  if (safeSearchTerm) {
    const lowerContent = safeContent.toLowerCase();
    const lowerSearchTerm = safeSearchTerm.toLowerCase();
    let matchIndex = lowerContent.indexOf(lowerSearchTerm, 0);

    while (matchIndex !== -1) {
      ranges.push({
        start: matchIndex,
        end: matchIndex + safeSearchTerm.length,
        type: "search"
      });

      matchIndex = lowerContent.indexOf(
        lowerSearchTerm,
        matchIndex + safeSearchTerm.length
      );
    }
  }

  const safeMentionUsername = String(mentionUsername || "").trim().toLowerCase();

  if (safeMentionUsername) {
    const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
    let mentionMatch = mentionRegex.exec(safeContent);

    while (mentionMatch) {
      const fullMention = mentionMatch[0];
      const mentionedUsername = String(mentionMatch[1] || "").toLowerCase();
      const start = mentionMatch.index;
      const end = start + fullMention.length;
      const overlapsSearchHighlight = ranges.some(
        (range) => start < range.end && end > range.start
      );

      if (mentionedUsername === safeMentionUsername && !overlapsSearchHighlight) {
        ranges.push({
          start,
          end,
          type: "mention"
        });
      }

      mentionMatch = mentionRegex.exec(safeContent);
    }
  }

  return ranges.sort((firstRange, secondRange) => {
    if (firstRange.start !== secondRange.start) {
      return firstRange.start - secondRange.start;
    }

    return secondRange.end - firstRange.end;
  });
};

const renderHighlightedMessageText = ({
  content,
  searchTerm,
  mentionUsername
}) => {
  const safeContent = String(content || "");
  const highlightRanges = buildMessageTextHighlights({
    content: safeContent,
    searchTerm,
    mentionUsername
  });

  if (highlightRanges.length === 0) {
    return safeContent;
  }

  const highlightedParts = [];
  let currentIndex = 0;

  highlightRanges.forEach((range, rangeIndex) => {
    if (range.start > currentIndex) {
      highlightedParts.push(safeContent.slice(currentIndex, range.start));
    }

    const highlightedText = safeContent.slice(range.start, range.end);

    if (range.type === "search") {
      highlightedParts.push(
        <mark
          key={`search-highlight-${range.start}-${rangeIndex}`}
          className="discord-message-search-highlight"
        >
          {highlightedText}
        </mark>
      );
    } else {
      highlightedParts.push(
        <span
          key={`mention-highlight-${range.start}-${rangeIndex}`}
          className="discord-message-mention-highlight"
        >
          {highlightedText}
        </span>
      );
    }

    currentIndex = range.end;
  });

  if (currentIndex < safeContent.length) {
    highlightedParts.push(safeContent.slice(currentIndex));
  }

  return highlightedParts;
};

const isImageAttachment = (attachment) =>
  getAttachmentType(attachment).startsWith("image/");

const isVideoAttachment = (attachment) =>
  getAttachmentType(attachment).startsWith("video/");

const isAudioAttachment = (attachment) =>
  getAttachmentType(attachment).startsWith("audio/");

const renderAttachmentPreview = (attachment, onPreviewAttachment) => {
  const attachmentUrl = getAttachmentUrl(attachment);
  const attachmentName = getAttachmentName(attachment);
  const attachmentSize = formatFileSize(getAttachmentSize(attachment));
  const attachmentKind = getAttachmentKind(attachment);

  if (!attachmentUrl) {
    return null;
  }

  if (isImageAttachment(attachment)) {
    return (
      <div className="discord-attachment-card discord-attachment-card-media">
        <button
          type="button"
          className="discord-attachment-preview-button"
          onClick={() => onPreviewAttachment?.(attachment)}
          title="Open image preview"
        >
          <img
            src={attachmentUrl}
            alt={attachmentName}
            className="discord-attachment-media"
          />
        </button>

        <div className="discord-attachment-footer">
          <span className="discord-attachment-kind">{attachmentKind}</span>
          <span className="discord-attachment-name">{attachmentName}</span>
          {attachmentSize ? <span>{attachmentSize}</span> : null}
          <a href={attachmentUrl} target="_blank" rel="noreferrer" download>
            Download
          </a>
        </div>
      </div>
    );
  }

  if (isVideoAttachment(attachment)) {
    return (
      <div className="discord-attachment-card discord-attachment-card-media">
        <video
          controls
          src={attachmentUrl}
          className="discord-attachment-media"
        />

        <div className="discord-attachment-footer">
          <span className="discord-attachment-kind">{attachmentKind}</span>
          <span className="discord-attachment-name">{attachmentName}</span>
          {attachmentSize ? <span>{attachmentSize}</span> : null}
          <button type="button" onClick={() => onPreviewAttachment?.(attachment)}>
            Preview
          </button>
          <a href={attachmentUrl} target="_blank" rel="noreferrer" download>
            Download
          </a>
        </div>
      </div>
    );
  }

  if (isAudioAttachment(attachment)) {
    return (
      <div className="discord-attachment-file discord-attachment-audio-card">
        <span className="discord-attachment-icon">🎧</span>

        <span className="discord-attachment-meta">
          <span className="discord-attachment-name">{attachmentName}</span>
          <span className="discord-attachment-size">
            {attachmentKind}{attachmentSize ? ` · ${attachmentSize}` : ""}
          </span>
          <audio
            controls
            src={attachmentUrl}
            className="discord-attachment-audio"
          />
        </span>

        <a href={attachmentUrl} target="_blank" rel="noreferrer" download>
          Download
        </a>
      </div>
    );
  }

  return (
    <a
      href={attachmentUrl}
      target="_blank"
      rel="noreferrer"
      className="discord-attachment-file"
      download
    >
      <span className="discord-attachment-icon">📎</span>

      <span className="discord-attachment-meta">
        <span className="discord-attachment-name">{attachmentName}</span>
        <span className="discord-attachment-size">
          {attachmentKind}{attachmentSize ? ` · ${attachmentSize}` : ""}
        </span>
      </span>

      <span className="discord-attachment-download">Download</span>
    </a>
  );
};

const MainPage = () => {
  const navigate = useNavigate();
  const {
    serverId: routeServerId,
    channelId: routeChannelId,
    conversationId: routeConversationId
  } = useParams();

  const messagesContainerRef = useRef(null);
  const messageInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const fileInputRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const socketRef = useRef(null);
  const previousServerIdRef = useRef(null);
  const previousChannelIdRef = useRef(null);
  const messageSearchRequestRef = useRef(0);
  const scrollRestoreRef = useRef(null);
  const searchJumpPendingRef = useRef(null);
  const channelMessagesRef = useRef([]);
  const directMessagesRef = useRef([]);
  const typingStopTimeoutRef = useRef(null);
  const remoteTypingTimeoutsRef = useRef({});

  const [user, setUser] = useState(null);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    username: "",
    email: ""
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [removeFriendError, setRemoveFriendError] = useState("");
  const [removingFriendId, setRemovingFriendId] = useState(null);
  const [hoveredChannelId, setHoveredChannelId] = useState(null);
  const [inviteError, setInviteError] = useState("");
  const [openChannelMenuId, setOpenChannelMenuId] = useState(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [isInviteCopied, setIsInviteCopied] = useState(false);
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [joinInviteError, setJoinInviteError] = useState("");
  const [joinInviteSuccess, setJoinInviteSuccess] = useState("");
  const [isJoiningInvite, setIsJoiningInvite] = useState(false);
  const [incomingFriendRequests, setIncomingFriendRequests] = useState([]);
  const [outgoingFriendRequests, setOutgoingFriendRequests] = useState([]);
  const [friendRequestsError, setFriendRequestsError] = useState("");
  const [isFriendRequestsLoading, setIsFriendRequestsLoading] = useState(false);
  const [processingFriendRequestId, setProcessingFriendRequestId] = useState(null);
  const [friendUsername, setFriendUsername] = useState("");
  const [addFriendError, setAddFriendError] = useState("");
  const [addFriendSuccess, setAddFriendSuccess] = useState("");
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [servers, setServers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [directConversations, setDirectConversations] = useState([]);
  const [channels, setChannels] = useState([]);
  const [members, setMembers] = useState([]);
  const [channelMessages, setChannelMessages] = useState([]);
  const [directMessages, setDirectMessages] = useState([]);
  const [hasOlderChannelMessages, setHasOlderChannelMessages] = useState(false);
  const [hasOlderDirectMessages, setHasOlderDirectMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [unreadDirectCounts, setUnreadDirectCounts] = useState({});
  const [unreadChannelCounts, setUnreadChannelCounts] = useState({});
  const [unreadServerCounts, setUnreadServerCounts] = useState({});
  const [mentionChannelCounts, setMentionChannelCounts] = useState({});
  const [mentionServerCounts, setMentionServerCounts] = useState({});
  const [activeMentionHighlight, setActiveMentionHighlight] = useState(null);
  const [hoveredConversationId, setHoveredConversationId] = useState(null);
  const [openConversationMenuId, setOpenConversationMenuId] = useState(null);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [directConversationError, setDirectConversationError] = useState("");
  const [deletingMessageKey, setDeletingMessageKey] = useState(null);
  const [editingMessageKey, setEditingMessageKey] = useState(null);
  const [editingMessageContent, setEditingMessageContent] = useState("");
  const [savingEditedMessageKey, setSavingEditedMessageKey] = useState(null);
  const [selectedReplyMessage, setSelectedReplyMessage] = useState(null);
  const [openMessageMenuKey, setOpenMessageMenuKey] = useState(null);
  const [channelTypingUsers, setChannelTypingUsers] = useState([]);
  const [directTypingUsers, setDirectTypingUsers] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [isPinnedMessagesOpen, setIsPinnedMessagesOpen] = useState(false);
  const [reactingMessageKey, setReactingMessageKey] = useState(null);
  const [pinningMessageKey, setPinningMessageKey] = useState(null);
  const [notificationSettings, setNotificationSettings] = useState({
    muted_server_ids: [],
    muted_channel_ids: [],
    muted_direct_conversation_ids: []
  });
  const [settingsActionError, setSettingsActionError] = useState("");
  const [settingsActionKey, setSettingsActionKey] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [safetyActionError, setSafetyActionError] = useState("");
  const [safetyActionKey, setSafetyActionKey] = useState(null);
  const [reportModal, setReportModal] = useState({
    isOpen: false,
    userId: null,
    username: "",
    contextType: "profile",
    contextId: null
  });
  const [reportReason, setReportReason] = useState("");
  const [reportSuccess, setReportSuccess] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const [activeServerId, setActiveServerId] = useState(null);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeDmSection, setActiveDmSection] = useState("friends");
  const [isJoinServerModalOpen, setIsJoinServerModalOpen] = useState(false);

  const [isSocketReady, setIsSocketReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  const [isCreateServerModalOpen, setIsCreateServerModalOpen] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isDeletingServer, setIsDeletingServer] = useState(false);
  const [isDeletingChannel, setIsDeletingChannel] = useState(false);

  const [error, setError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [serverError, setServerError] = useState("");
  const [channelError, setChannelError] = useState("");
  const [membersError, setMembersError] = useState("");
  const [serverMemberActionError, setServerMemberActionError] = useState("");
  const [removingServerMemberId, setRemovingServerMemberId] = useState(null);
  const [updatingMemberRoleId, setUpdatingMemberRoleId] = useState(null);
  const [createServerError, setCreateServerError] = useState("");
  const [createChannelError, setCreateChannelError] = useState("");
  const [deleteChannelError, setDeleteChannelError] = useState("");
  const [deleteServerError, setDeleteServerError] = useState("");

  const [messageContent, setMessageContent] = useState("");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [channelName, setChannelName] = useState("");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [messageSearchTerm, setMessageSearchTerm] = useState("");
  const [isMessageSearchActive, setIsMessageSearchActive] = useState(false);
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const [messageSearchError, setMessageSearchError] = useState("");
  const [messageSearchMatches, setMessageSearchMatches] = useState([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [activeSearchMessageId, setActiveSearchMessageId] = useState(null);
  const [serverFormData, setServerFormData] = useState({
    server_name: "",
    description: ""
  });
  const [isMentionMenuOpen, setIsMentionMenuOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(null);
  const [mentionEndIndex, setMentionEndIndex] = useState(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);

  const isDmView = !activeServerId;

  const activeServer = useMemo(
    () =>
      servers.find(
        (server) => String(getServerId(server)) === String(activeServerId)
      ),
    [servers, activeServerId]
  );

  const activeChannel = useMemo(
    () =>
      channels.find(
        (channel) => String(getChannelId(channel)) === String(activeChannelId)
      ),
    [channels, activeChannelId]
  );

  const activeConversation = useMemo(
    () =>
      directConversations.find(
        (conversation) =>
          String(getConversationId(conversation)) === String(activeConversationId)
      ),
    [directConversations, activeConversationId]
  );

  const activeConversationUser = useMemo(
    () =>
      activeConversation
        ? {
          user_id: getConversationOtherUserId(activeConversation),
          username: getConversationOtherUsername(activeConversation),
          email: getConversationOtherEmail(activeConversation),
          presence_status: getConversationPresenceStatus(activeConversation)
        }
        : null,
    [activeConversation]
  );

  channelMessagesRef.current = channelMessages;
  directMessagesRef.current = directMessages;

  const currentUserId = user?.user_id || user?.id || null;

  const clearDirectUnread = useCallback((conversationId) => {
    if (!conversationId) {
      return;
    }

    setUnreadDirectCounts((prevCounts) => {
      const key = String(conversationId);

      if (!prevCounts[key]) {
        return prevCounts;
      }

      const nextCounts = { ...prevCounts };
      delete nextCounts[key];
      return nextCounts;
    });
  }, []);

  const clearChannelUnread = useCallback(
    (channelId, serverId = activeServerId) => {
      if (!channelId) {
        return;
      }

      const unreadCount = getUnreadValue(unreadChannelCounts, channelId);
      const mentionCount = getUnreadValue(mentionChannelCounts, channelId);

      if (!unreadCount && !mentionCount) {
        return;
      }

      if (unreadCount) {
        setUnreadChannelCounts((prevCounts) => {
          const key = String(channelId);

          if (!prevCounts[key]) {
            return prevCounts;
          }

          const nextCounts = { ...prevCounts };
          delete nextCounts[key];
          return nextCounts;
        });

        if (serverId) {
          setUnreadServerCounts((prevCounts) => {
            const key = String(serverId);
            const nextServerCount = Math.max(
              Number(prevCounts[key] || 0) - unreadCount,
              0
            );

            if (nextServerCount === 0) {
              const nextCounts = { ...prevCounts };
              delete nextCounts[key];
              return nextCounts;
            }

            return {
              ...prevCounts,
              [key]: nextServerCount
            };
          });
        }
      }

      if (mentionCount) {
        setMentionChannelCounts((prevCounts) => {
          const key = String(channelId);

          if (!prevCounts[key]) {
            return prevCounts;
          }

          const nextCounts = { ...prevCounts };
          delete nextCounts[key];
          return nextCounts;
        });

        if (serverId) {
          setMentionServerCounts((prevCounts) => {
            const key = String(serverId);
            const nextServerCount = Math.max(
              Number(prevCounts[key] || 0) - mentionCount,
              0
            );

            if (nextServerCount === 0) {
              const nextCounts = { ...prevCounts };
              delete nextCounts[key];
              return nextCounts;
            }

            return {
              ...prevCounts,
              [key]: nextServerCount
            };
          });
        }
      }
    },
    [activeServerId, mentionChannelCounts, unreadChannelCounts]
  );

  const currentUserMember = useMemo(
    () =>
      members.find(
        (member) => String(getMemberUserId(member)) === String(currentUserId)
      ) || null,
    [currentUserId, members]
  );

  const currentUserServerRole = useMemo(() => {
    if (
      activeServer &&
      currentUserId &&
      String(getServerOwnerId(activeServer)) === String(currentUserId)
    ) {
      return "owner";
    }

    return currentUserMember ? getMemberServerRole(currentUserMember) : "member";
  }, [activeServer, currentUserId, currentUserMember]);

  const currentUserIsOwner = currentUserServerRole === "owner";
  const currentUserCanManageServer =
    currentUserServerRole === "owner" || currentUserServerRole === "admin";
  const currentUserCanManageRoles = currentUserServerRole === "owner";

  const highlightedMentionMessageIds = useMemo(() => {
    if (
      isDmView ||
      !activeMentionHighlight ||
      !activeChannelId ||
      String(activeMentionHighlight.channelId) !== String(activeChannelId)
    ) {
      return new Set();
    }

    const newestMentionedMessage = [...channelMessages]
      .reverse()
      .find((message) => {
        const content = getMessageContent(message);
        const messageAuthorId = getMessageAuthorId(message);
        const isOwnMessage =
          currentUserId && String(messageAuthorId) === String(currentUserId);

        return messageMentionsCurrentUser({
          message,
          content,
          currentUserId,
          currentUsername: user?.username,
          isOwnMessage
        });
      });

    const newestMentionedMessageId = newestMentionedMessage
      ? getMessageId(newestMentionedMessage)
      : null;

    return newestMentionedMessageId
      ? new Set([String(newestMentionedMessageId)])
      : new Set();
  }, [
    activeChannelId,
    activeMentionHighlight,
    channelMessages,
    currentUserId,
    isDmView,
    user?.username
  ]);

  const displayedMessages = isDmView ? directMessages : channelMessages;
  const activeTypingText = formatTypingUsers(
    isDmView ? directTypingUsers : channelTypingUsers
  );
  const pinnedMessageCount = pinnedMessages.length;
  const mutedServerIds = useMemo(
    () => normalizeIdList(notificationSettings.muted_server_ids),
    [notificationSettings.muted_server_ids]
  );
  const mutedChannelIds = useMemo(
    () => normalizeIdList(notificationSettings.muted_channel_ids),
    [notificationSettings.muted_channel_ids]
  );
  const mutedDirectConversationIds = useMemo(
    () => normalizeIdList(notificationSettings.muted_direct_conversation_ids),
    [notificationSettings.muted_direct_conversation_ids]
  );
  const activeServerMuted = activeServerId
    ? mutedServerIds.includes(String(activeServerId))
    : false;
  const activeChannelMuted = activeChannelId
    ? mutedChannelIds.includes(String(activeChannelId))
    : false;
  const activeConversationMuted = activeConversationId
    ? mutedDirectConversationIds.includes(String(activeConversationId))
    : false;

  const activeMessageSearchLabel = isDmView
    ? "direct message"
    : "channel message";

  const activeSearchCount = messageSearchMatches.length;

  const activeMessageSearchEmptyText = isDmView
    ? `No direct messages found for "${messageSearchTerm.trim()}".`
    : `No channel messages found for "${messageSearchTerm.trim()}".`;

  const totalUnreadDirectCount = useMemo(
    () => getTotalUnreadCount(unreadDirectCounts),
    [unreadDirectCounts]
  );

  const pendingFriendRequestCount = incomingFriendRequests.length;
  const totalDmNotificationCount =
    totalUnreadDirectCount + pendingFriendRequestCount;

  const normalizedSidebarSearch = useMemo(
    () => sidebarSearch.trim().toLowerCase(),
    [sidebarSearch]
  );

  const filteredChannels = useMemo(
    () =>
      channels.filter((channel) =>
        getChannelName(channel).toLowerCase().includes(normalizedSidebarSearch)
      ),
    [channels, normalizedSidebarSearch]
  );

  const filteredFriends = useMemo(
    () =>
      friends.filter((friend) => {
        const name = getFriendName(friend).toLowerCase();
        const email = getFriendEmail(friend).toLowerCase();

        return (
          name.includes(normalizedSidebarSearch) ||
          email.includes(normalizedSidebarSearch)
        );
      }),
    [friends, normalizedSidebarSearch]
  );

  const activeConversationIsFriend = useMemo(
    () =>
      activeConversationUser
        ? friends.some(
          (friend) =>
            String(getFriendId(friend)) ===
            String(activeConversationUser.user_id)
        )
        : false,
    [activeConversationUser, friends]
  );

  const filteredDirectConversations = useMemo(
    () =>
      directConversations.filter((conversation) => {
        const username = getConversationOtherUsername(conversation).toLowerCase();
        const email = getConversationOtherEmail(conversation).toLowerCase();
        const lastMessage = getConversationLastMessage(conversation).toLowerCase();

        return (
          username.includes(normalizedSidebarSearch) ||
          email.includes(normalizedSidebarSearch) ||
          lastMessage.includes(normalizedSidebarSearch)
        );
      }),
    [directConversations, normalizedSidebarSearch]
  );

  const onlineMembers = useMemo(
    () =>
      members.filter(
        (member) => getMemberPresenceStatus(member) === "online"
      ),
    [members]
  );

  const offlineMembers = useMemo(
    () =>
      members.filter(
        (member) => getMemberPresenceStatus(member) !== "online"
      ),
    [members]
  );

  const mentionSuggestions = useMemo(() => {
    if (!isMentionMenuOpen || isDmView || !activeChannelId) {
      return [];
    }

    const normalizedQuery = mentionQuery.trim().toLowerCase();
    const uniqueMembers = new Map();

    members.forEach((member) => {
      const username = getMemberName(member);
      const memberKey = String(getMemberUserId(member) || username);

      if (!username || username === "Unknown user" || uniqueMembers.has(memberKey)) {
        return;
      }

      uniqueMembers.set(memberKey, member);
    });

    return Array.from(uniqueMembers.values())
      .filter((member) => {
        const username = getMemberName(member).toLowerCase();

        return !normalizedQuery || username.includes(normalizedQuery);
      })
      .sort((firstMember, secondMember) => {
        const firstUsername = getMemberName(firstMember).toLowerCase();
        const secondUsername = getMemberName(secondMember).toLowerCase();
        const firstStartsWithQuery = normalizedQuery
          ? firstUsername.startsWith(normalizedQuery)
          : true;
        const secondStartsWithQuery = normalizedQuery
          ? secondUsername.startsWith(normalizedQuery)
          : true;

        if (firstStartsWithQuery !== secondStartsWithQuery) {
          return firstStartsWithQuery ? -1 : 1;
        }

        const firstOnline = getMemberPresenceStatus(firstMember) === "online";
        const secondOnline = getMemberPresenceStatus(secondMember) === "online";

        if (firstOnline !== secondOnline) {
          return firstOnline ? -1 : 1;
        }

        return firstUsername.localeCompare(secondUsername);
      })
      .slice(0, 8);
  }, [activeChannelId, isDmView, isMentionMenuOpen, members, mentionQuery]);

  const currentUserPresence = isSocketReady
    ? "online"
    : normalizePresenceStatus(user?.presence_status ?? user?.is_online);

  const showDmHomeView = isDmView && !activeConversationId;
  const showComposer = !isDmView || !!activeConversationId;

  const applyUserProfileUpdate = useCallback((updatedUser) => {
    if (!updatedUser?.user_id) {
      return;
    }

    const updatedUserId = String(updatedUser.user_id);

    setUser((prevUser) => {
      if (!prevUser || String(prevUser.user_id || prevUser.id) !== updatedUserId) {
        return prevUser;
      }

      return {
        ...prevUser,
        ...updatedUser
      };
    });

    setMembers((prevMembers) =>
      prevMembers.map((member) => {
        if (String(getMemberUserId(member)) !== updatedUserId) {
          return member;
        }

        return {
          ...member,
          username: updatedUser.username,
          email: updatedUser.email
        };
      })
    );

    setFriends((prevFriends) =>
      prevFriends.map((friend) => {
        if (String(getFriendId(friend)) !== updatedUserId) {
          return friend;
        }

        return {
          ...friend,
          username: updatedUser.username,
          email: updatedUser.email
        };
      })
    );

    setDirectConversations((prevConversations) =>
      prevConversations.map((conversation) => {
        if (String(getConversationOtherUserId(conversation)) !== updatedUserId) {
          return conversation;
        }

        return {
          ...conversation,
          other_username: updatedUser.username,
          other_email: updatedUser.email,
          other_user: conversation?.other_user
            ? {
              ...conversation.other_user,
              username: updatedUser.username,
              email: updatedUser.email
            }
            : conversation?.other_user
        };
      })
    );

    setChannelMessages((prevMessages) =>
      prevMessages.map((message) => {
        if (String(getMessageAuthorId(message)) !== updatedUserId) {
          return message;
        }

        return {
          ...message,
          username: updatedUser.username,
          email: updatedUser.email,
          user: message?.user
            ? {
              ...message.user,
              username: updatedUser.username,
              email: updatedUser.email
            }
            : message?.user
        };
      })
    );

    setDirectMessages((prevMessages) =>
      prevMessages.map((message) => {
        if (String(getDirectMessageSenderId(message)) !== updatedUserId) {
          return message;
        }

        return {
          ...message,
          sender_username: updatedUser.username,
          sender_email: updatedUser.email,
          username: updatedUser.username,
          sender: message?.sender
            ? {
              ...message.sender,
              username: updatedUser.username,
              email: updatedUser.email
            }
            : message?.sender
        };
      })
    );
  }, []);

  const resetMessageInputHeight = () => {
    if (!messageInputRef.current) {
      return;
    }

    messageInputRef.current.style.height = "44px";
  };

  const resetMessageEditingState = () => {
    setEditingMessageKey(null);
    setEditingMessageContent("");
    setSavingEditedMessageKey(null);
  };

  const resetMessageReplyState = () => {
    setSelectedReplyMessage(null);
  };

  const closeMentionMenu = () => {
    setIsMentionMenuOpen(false);
    setMentionQuery("");
    setMentionStartIndex(null);
    setMentionEndIndex(null);
    setActiveMentionIndex(0);
  };

  const resetMessageSearchState = () => {
    setMessageSearchTerm("");
    setIsMessageSearchActive(false);
    setIsSearchingMessages(false);
    setMessageSearchError("");
    setMessageSearchMatches([]);
    setActiveSearchIndex(0);
    setActiveSearchMessageId(null);
    closeMentionMenu();
  };

  const loadServers = useCallback(async (token) => {
    const serverData = await getUserServers(token);
    const normalizedServers = normalizeServers(serverData);
    setServers(normalizedServers);
    return normalizedServers;
  }, []);

  const loadFriends = useCallback(async (token) => {
    const friendData = await getFriends(token);
    const normalizedFriends = normalizeFriends(friendData);
    setFriends(normalizedFriends);
    return normalizedFriends;
  }, []);

  const loadDirectConversationList = useCallback(async (token) => {
    const conversationData = await getDirectConversations(token);
    const normalizedConversations =
      normalizeDirectConversations(conversationData);
    setDirectConversations(normalizedConversations);
    return normalizedConversations;
  }, []);

  const loadUnreadCounts = useCallback(async (token) => {
    const [channelUnreadData, directUnreadData, mentionUnreadData] =
      await Promise.all([
        getUnreadChannelCounts(token),
        getUnreadDirectConversationCounts(token),
        getUnreadMentionCounts(token)
      ]);

    setUnreadChannelCounts(
      channelUnreadData?.channels || channelUnreadData?.data?.channels || {}
    );

    setUnreadServerCounts(
      channelUnreadData?.servers || channelUnreadData?.data?.servers || {}
    );

    setUnreadDirectCounts(
      directUnreadData?.conversations ||
      directUnreadData?.data?.conversations ||
      {}
    );

    setMentionChannelCounts(
      mentionUnreadData?.channels || mentionUnreadData?.data?.channels || {}
    );

    setMentionServerCounts(
      mentionUnreadData?.servers || mentionUnreadData?.data?.servers || {}
    );
  }, []);


  const loadNotificationSettings = useCallback(async (token) => {
    const settingsData = await getNotificationSettings(token);
    const normalizedSettings = applyNotificationSettingsPayload(settingsData);

    setNotificationSettings({
      muted_server_ids: normalizedSettings.muted_server_ids || [],
      muted_channel_ids: normalizedSettings.muted_channel_ids || [],
      muted_direct_conversation_ids:
        normalizedSettings.muted_direct_conversation_ids || []
    });

    return normalizedSettings;
  }, []);

  const loadBlockedUsers = useCallback(async (token) => {
    const blockedUsersData = await getBlockedUsers(token);
    const normalizedBlockedUsers = normalizeBlockedUsers(blockedUsersData);
    setBlockedUsers(normalizedBlockedUsers);
    return normalizedBlockedUsers;
  }, []);

  const loadFriendRequests = useCallback(async (token) => {
    const [incomingData, outgoingData] = await Promise.all([
      getIncomingFriendRequests(token),
      getOutgoingFriendRequests(token)
    ]);

    setIncomingFriendRequests(normalizeFriendRequests(incomingData));
    setOutgoingFriendRequests(normalizeFriendRequests(outgoingData));
  }, []);

  const fetchFriendRequests = useCallback(
    async (token) => {
      try {
        setIsFriendRequestsLoading(true);
        setFriendRequestsError("");
        await loadFriendRequests(token);
      } catch (error) {
        setIncomingFriendRequests([]);
        setOutgoingFriendRequests([]);
        setFriendRequestsError(
          error.message || "Failed to load friend requests."
        );
      } finally {
        setIsFriendRequestsLoading(false);
      }
    },
    [loadFriendRequests]
  );

  const loadServerChannels = useCallback(async (token, serverId) => {
    if (!serverId) {
      setChannels([]);
      setActiveChannelId(null);
      return [];
    }

    const channelData = await getServerChannels(token, serverId);
    const normalizedChannels = normalizeChannels(channelData);

    setChannels(normalizedChannels);

    if (normalizedChannels.length === 0) {
      setActiveChannelId(null);
      setChannelMessages([]);
      return [];
    }

    setActiveChannelId((prevActiveChannelId) => {
      const routeChannelStillExists = routeChannelId
        ? normalizedChannels.some(
          (channel) =>
            String(getChannelId(channel)) === String(routeChannelId)
        )
        : false;

      if (routeChannelStillExists) {
        return routeChannelId;
      }

      const previousStillExists = normalizedChannels.some(
        (channel) =>
          String(getChannelId(channel)) === String(prevActiveChannelId)
      );

      if (previousStillExists) {
        return prevActiveChannelId;
      }

      return getChannelId(normalizedChannels[0]);
    });

    return normalizedChannels;
  }, [routeChannelId]);

  const loadServerMembers = useCallback(async (token, serverId) => {
    if (!serverId) {
      setMembers([]);
      return [];
    }

    const memberData = await getServerMembers(serverId, token);
    const normalizedMembers = normalizeMembers(memberData);
    setMembers(normalizedMembers);
    return normalizedMembers;
  }, []);

  const loadChannelMessageList = useCallback(
    async (token, channelId, options = {}) => {
      if (!channelId) {
        setChannelMessages([]);
        setHasOlderChannelMessages(false);
        setMessageError("");
        return [];
      }

      const messageData = await getChannelMessages(token, channelId, {
        limit: MESSAGE_PAGE_SIZE,
        ...options
      });
      const normalizedMessageData = normalizeMessages(messageData);
      const pagination = messageData?.pagination || messageData?.data?.pagination || {};

      if (options.beforeMessageId) {
        setChannelMessages((prevMessages) => [
          ...normalizedMessageData,
          ...prevMessages.filter(
            (existingMessage) =>
              !normalizedMessageData.some(
                (newMessage) =>
                  String(getMessageId(newMessage)) === String(getMessageId(existingMessage))
              )
          )
        ]);
      } else {
        setChannelMessages(normalizedMessageData);
      }

      setHasOlderChannelMessages(Boolean(pagination.hasOlder));
      return normalizedMessageData;
    },
    []
  );

  const loadDirectMessageList = useCallback(
    async (token, conversationId, options = {}) => {
      if (!conversationId) {
        setDirectMessages([]);
        setHasOlderDirectMessages(false);
        setMessageError("");
        return [];
      }

      const messageData = await getDirectMessages(token, conversationId, {
        limit: MESSAGE_PAGE_SIZE,
        ...options
      });
      const normalizedMessageData = normalizeMessages(messageData);
      const pagination = messageData?.pagination || messageData?.data?.pagination || {};

      if (options.beforeDirectMessageId) {
        setDirectMessages((prevMessages) => [
          ...normalizedMessageData,
          ...prevMessages.filter(
            (existingMessage) =>
              !normalizedMessageData.some(
                (newMessage) =>
                  String(getDirectMessageId(newMessage)) === String(getDirectMessageId(existingMessage))
              )
          )
        ]);
      } else {
        setDirectMessages(normalizedMessageData);
      }

      setHasOlderDirectMessages(Boolean(pagination.hasOlder));
      return normalizedMessageData;
    },
    []
  );


  const loadPinnedMessageList = useCallback(
    async (token, options = {}) => {
      const directView = options.isDirect ?? isDmView;
      const channelId = options.channelId ?? activeChannelId;
      const conversationId = options.conversationId ?? activeConversationId;

      if (directView) {
        if (!conversationId) {
          setPinnedMessages([]);
          return [];
        }

        const response = await getPinnedDirectMessages(token, conversationId);
        const normalizedPinnedMessages = normalizeMessages(response);
        setPinnedMessages(normalizedPinnedMessages);
        return normalizedPinnedMessages;
      }

      if (!channelId) {
        setPinnedMessages([]);
        return [];
      }

      const response = await getPinnedChannelMessages(token, channelId);
      const normalizedPinnedMessages = normalizeMessages(response);
      setPinnedMessages(normalizedPinnedMessages);
      return normalizedPinnedMessages;
    },
    [activeChannelId, activeConversationId, isDmView]
  );

  const updateMessageReactionsInState = useCallback((payload, directView) => {
    const messageId = directView
      ? payload?.direct_message_id || payload?.directMessageId || payload?.id
      : payload?.message_id || payload?.messageId || payload?.id;

    if (!messageId) {
      return;
    }

    const reactions = Array.isArray(payload?.reactions) ? payload.reactions : [];

    const updateMessages = (messages) =>
      messages.map((message) => {
        const currentMessageId = directView
          ? getDirectMessageId(message)
          : getMessageId(message);

        if (String(currentMessageId) !== String(messageId)) {
          return message;
        }

        return {
          ...message,
          reactions
        };
      });

    if (directView) {
      setDirectMessages(updateMessages);
    } else {
      setChannelMessages(updateMessages);
    }

    setPinnedMessages(updateMessages);
  }, []);

  const updatePinnedMessageInState = useCallback((message, directView) => {
    const messageId = directView ? getDirectMessageId(message) : getMessageId(message);

    if (!messageId) {
      return;
    }

    const pinned = messageIsPinned(message);

    const updateMessages = (messages) =>
      messages.map((existingMessage) => {
        const existingMessageId = directView
          ? getDirectMessageId(existingMessage)
          : getMessageId(existingMessage);

        if (String(existingMessageId) !== String(messageId)) {
          return existingMessage;
        }

        return {
          ...existingMessage,
          pinned,
          pinned_by: message.pinned_by || null,
          pinned_by_username: message.pinned_by_username || null,
          pinned_at: message.pinned_at || null
        };
      });

    if (directView) {
      setDirectMessages(updateMessages);
    } else {
      setChannelMessages(updateMessages);
    }

    setPinnedMessages((prevPinnedMessages) => {
      const withoutCurrentMessage = prevPinnedMessages.filter((pinnedMessage) => {
        const pinnedMessageId = directView
          ? getDirectMessageId(pinnedMessage)
          : getMessageId(pinnedMessage);

        return String(pinnedMessageId) !== String(messageId);
      });

      if (!pinned) {
        return withoutCurrentMessage;
      }

      return [message, ...withoutCurrentMessage].sort((firstMessage, secondMessage) => {
        const firstTime = new Date(getMessagePinnedAt(firstMessage) || 0).getTime();
        const secondTime = new Date(getMessagePinnedAt(secondMessage) || 0).getTime();

        return secondTime - firstTime;
      });
    });
  }, []);

  const emitTypingStatus = useCallback(
    (isTyping) => {
      const socket = socketRef.current;

      if (!socket?.connected) {
        return;
      }

      if (isDmView) {
        if (!activeConversationId) {
          return;
        }

        socket.emit(isTyping ? "direct_typing_start" : "direct_typing_stop", {
          conversation_id: activeConversationId
        });
        return;
      }

      if (!activeChannelId) {
        return;
      }

      socket.emit(isTyping ? "channel_typing_start" : "channel_typing_stop", {
        channel_id: activeChannelId
      });
    },
    [activeChannelId, activeConversationId, isDmView]
  );

  const stopTyping = useCallback(() => {
    if (typingStopTimeoutRef.current) {
      window.clearTimeout(typingStopTimeoutRef.current);
      typingStopTimeoutRef.current = null;
    }

    emitTypingStatus(false);
  }, [emitTypingStatus]);

  const startTyping = useCallback(() => {
    emitTypingStatus(true);

    if (typingStopTimeoutRef.current) {
      window.clearTimeout(typingStopTimeoutRef.current);
    }

    typingStopTimeoutRef.current = window.setTimeout(() => {
      emitTypingStatus(false);
      typingStopTimeoutRef.current = null;
    }, 1800);
  }, [emitTypingStatus]);

  const persistChannelReadState = useCallback(async (channelId) => {
    const token = getAuthToken();

    if (!token || !channelId) {
      return;
    }

    try {
      await markChannelAsRead(token, channelId);
    } catch (error) {
      console.error("Failed to mark channel as read:", error);
    }
  }, []);

  const persistDirectConversationReadState = useCallback(async (conversationId) => {
    const token = getAuthToken();

    if (!token || !conversationId) {
      return;
    }

    try {
      await markDirectConversationAsRead(token, conversationId);
    } catch (error) {
      console.error("Failed to mark direct conversation as read:", error);
    }
  }, []);

  useEffect(() => {
    const loadMainPageData = async () => {
      const token = getAuthToken();

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        setServerError("");
        setChannelError("");
        setMembersError("");
        setMessageError("");
        setCreateServerError("");
        setCreateChannelError("");
        setDeleteChannelError("");
        setDeleteServerError("");

        const userData = await getMe(token);
        setUser(userData);

        await Promise.all([
          loadServers(token),
          loadFriends(token),
          loadDirectConversationList(token),
          loadFriendRequests(token),
          loadNotificationSettings(token),
          loadBlockedUsers(token)
        ]);

        try {
          await loadUnreadCounts(token);
        } catch (unreadError) {
          console.error("Failed to load unread counts:", unreadError);

          setUnreadChannelCounts({});
          setUnreadServerCounts({});
          setUnreadDirectCounts({});
          setMentionChannelCounts({});
          setMentionServerCounts({});
        }
      } catch (error) {
        disconnectSocket();
        localStorage.removeItem("token");
        setError(error.message || "Failed to load the app. Please log in again.");
        navigate("/login");
      } finally {
        setIsLoading(false);
      }
    };

    loadMainPageData();
  }, [
    navigate,
    loadServers,
    loadFriends,
    loadDirectConversationList,
    loadFriendRequests,
    loadNotificationSettings,
    loadBlockedUsers,
    loadUnreadCounts
  ]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    clearDirectUnread(activeConversationId);
    persistDirectConversationReadState(activeConversationId);
  }, [
    activeConversationId,
    clearDirectUnread,
    persistDirectConversationReadState,
    applyUserProfileUpdate,
    updateMessageReactionsInState,
    updatePinnedMessageInState
  ]);

  useEffect(() => {
    if (!activeServerId || !activeChannelId) {
      return;
    }

    const currentMentionCount = getUnreadValue(
      mentionChannelCounts,
      activeChannelId
    );

    if (currentMentionCount > 0) {
      setActiveMentionHighlight({
        channelId: String(activeChannelId),
        count: currentMentionCount,
        openedAt: Date.now()
      });
    }

    clearChannelUnread(activeChannelId, activeServerId);
    persistChannelReadState(activeChannelId);
  }, [
    activeServerId,
    activeChannelId,
    clearChannelUnread,
    mentionChannelCounts,
    persistChannelReadState
  ]);

  useEffect(() => {
    if (!activeMentionHighlight) {
      return;
    }

    const highlightTimer = window.setTimeout(() => {
      setActiveMentionHighlight(null);
    }, 5200);

    return () => {
      window.clearTimeout(highlightTimer);
    };
  }, [activeMentionHighlight]);

  useEffect(() => {
    const token = getAuthToken();

    if (!token || !isDmView) {
      return;
    }

    if (activeDmSection !== "requests" && activeDmSection !== "add-friend") {
      return;
    }

    fetchFriendRequests(token);
  }, [isDmView, activeDmSection, fetchFriendRequests]);

  useEffect(() => {
    if (routeConversationId) {
      setActiveServerId(null);
      setActiveConversationId(routeConversationId);
      setActiveDmSection("friends");
      return;
    }

    if (!routeServerId) {
      setActiveServerId(null);
      setActiveConversationId(null);
      setChannels([]);
      setMembers([]);
      setActiveChannelId(null);
      setChannelMessages([]);
      return;
    }

    const matchedServer = servers.find(
      (server) => String(getServerId(server)) === String(routeServerId)
    );

    if (matchedServer) {
      setActiveServerId(getServerId(matchedServer));
      setActiveConversationId(null);
      return;
    }

    if (!isLoading) {
      navigate("/dashboard");
    }
  }, [routeServerId, routeConversationId, servers, isLoading, navigate]);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    if (!activeServerId) {
      setServerError("");
      setChannelError("");
      setMembersError("");
      setChannels([]);
      setMembers([]);
      setActiveChannelId(null);
      setChannelMessages([]);
      return;
    }

    const loadSelectedServerData = async () => {
      try {
        setServerError("");
        setChannelError("");
        setMembersError("");

        await Promise.all([
          loadServerChannels(token, activeServerId),
          loadServerMembers(token, activeServerId)
        ]);
      } catch (error) {
        setChannels([]);
        setMembers([]);
        setActiveChannelId(null);
        setChannelMessages([]);
        setServerError(error.message || "Failed to load selected server.");
      }
    };

    loadSelectedServerData();
  }, [activeServerId, loadServerChannels, loadServerMembers, navigate]);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    if (!activeServerId || !activeChannelId) {
      setChannelMessages([]);
      return;
    }

    const loadSelectedChannelMessages = async () => {
      try {
        setMessageError("");
        shouldAutoScrollRef.current = true;
        await loadChannelMessageList(token, activeChannelId);
      } catch (error) {
        setChannelMessages([]);
        setMessageError(error.message || "Failed to load channel messages.");
      } finally {
        setIsMessagesLoading(false);
      }
    };

    loadSelectedChannelMessages();
  }, [activeServerId, activeChannelId, loadChannelMessageList, navigate]);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    if (!isDmView || !activeConversationId) {
      if (isDmView) {
        setDirectMessages([]);
      }
      return;
    }

    const loadSelectedDirectMessages = async () => {
      try {
        setIsMessagesLoading(true);
        setMessageError("");
        shouldAutoScrollRef.current = true;
        await loadDirectMessageList(token, activeConversationId);
      } catch (error) {
        setDirectMessages([]);
        setMessageError(error.message || "Failed to load direct messages.");
      } finally {
        setIsMessagesLoading(false);
      }
    };

    loadSelectedDirectMessages();
  }, [isDmView, activeConversationId, loadDirectMessageList, navigate]);


  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      return;
    }

    if (isDmView) {
      setChannelTypingUsers([]);

      if (!activeConversationId) {
        setPinnedMessages([]);
        setDirectTypingUsers([]);
        return;
      }

      loadPinnedMessageList(token, {
        isDirect: true,
        conversationId: activeConversationId
      }).catch((error) => {
        console.error("Failed to load pinned direct messages:", error);
        setPinnedMessages([]);
      });
      return;
    }

    setDirectTypingUsers([]);

    if (!activeChannelId) {
      setPinnedMessages([]);
      setChannelTypingUsers([]);
      return;
    }

    loadPinnedMessageList(token, {
      isDirect: false,
      channelId: activeChannelId
    }).catch((error) => {
      console.error("Failed to load pinned channel messages:", error);
      setPinnedMessages([]);
    });
  }, [activeChannelId, activeConversationId, isDmView, loadPinnedMessageList]);

  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, [activeChannelId, activeConversationId, isDmView, stopTyping]);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    const socket = connectSocket(token);
    socketRef.current = socket;

    const handleConnect = () => {
      setIsSocketReady(true);
    };

    const handleDisconnect = () => {
      setIsSocketReady(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      if (socket.connected) {
        if (previousChannelIdRef.current) {
          socket.emit("leave_channel", String(previousChannelIdRef.current));
        }

        if (previousServerIdRef.current) {
          socket.emit("leave_server", String(previousServerIdRef.current));
        }
      }

      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socketRef.current = null;
      previousServerIdRef.current = null;
      previousChannelIdRef.current = null;
      setIsSocketReady(false);
    };
  }, [navigate]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket || !isSocketReady) {
      return;
    }

    const previousServerId = previousServerIdRef.current;

    if (
      previousServerId &&
      String(previousServerId) !== String(activeServerId)
    ) {
      socket.emit("leave_server", String(previousServerId));
    }

    if (activeServerId) {
      socket.emit("join_server", String(activeServerId));
      previousServerIdRef.current = activeServerId;
    } else {
      previousServerIdRef.current = null;
    }

    return () => {
      if (
        socket.connected &&
        activeServerId &&
        String(previousServerIdRef.current) === String(activeServerId)
      ) {
        if (previousChannelIdRef.current) {
          socket.emit("leave_channel", String(previousChannelIdRef.current));
          previousChannelIdRef.current = null;
        }

        socket.emit("leave_server", String(activeServerId));
        previousServerIdRef.current = null;
      }
    };
  }, [activeServerId, isSocketReady]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket || !isSocketReady) {
      return;
    }

    const previousChannelId = previousChannelIdRef.current;

    if (
      previousChannelId &&
      String(previousChannelId) !== String(activeChannelId)
    ) {
      socket.emit("leave_channel", String(previousChannelId));
    }

    if (activeServerId && activeChannelId) {
      socket.emit("join_channel", String(activeChannelId));
      previousChannelIdRef.current = activeChannelId;
    } else {
      previousChannelIdRef.current = null;
    }

    return () => {
      if (
        socket.connected &&
        activeChannelId &&
        String(previousChannelIdRef.current) === String(activeChannelId)
      ) {
        socket.emit("leave_channel", String(activeChannelId));
        previousChannelIdRef.current = null;
      }
    };
  }, [activeServerId, activeChannelId, isSocketReady]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket || !isSocketReady) {
      return;
    }

    const handlePresenceUpdate = (presenceData) => {
      if (!presenceData?.user_id) {
        return;
      }

      const nextPresenceStatus = normalizePresenceStatus(presenceData.status);

      setMembers((prevMembers) =>
        prevMembers.map((member) => {
          if (String(getMemberUserId(member)) !== String(presenceData.user_id)) {
            return member;
          }

          return {
            ...member,
            presence_status: nextPresenceStatus
          };
        })
      );

      setFriends((prevFriends) =>
        prevFriends.map((friend) => {
          if (String(getFriendId(friend)) !== String(presenceData.user_id)) {
            return friend;
          }

          return {
            ...friend,
            presence_status: nextPresenceStatus
          };
        })
      );

      setDirectConversations((prevConversations) =>
        prevConversations.map((conversation) => {
          if (
            String(getConversationOtherUserId(conversation)) !==
            String(presenceData.user_id)
          ) {
            return conversation;
          }

          return {
            ...conversation,
            other_is_online: nextPresenceStatus === "online" ? 1 : 0,
            other_user: conversation?.other_user
              ? {
                ...conversation.other_user,
                is_online: nextPresenceStatus === "online" ? 1 : 0
              }
              : conversation?.other_user
          };
        })
      );
    };

    const handleProfileUpdated = (updatedUser) => {
      applyUserProfileUpdate(updatedUser);
    };

    const handleNewMessage = (incomingMessage) => {
      if (
        !incomingMessage ||
        !activeServerId ||
        String(
          incomingMessage.channel_id ||
          incomingMessage.channelId ||
          incomingMessage.channel?.channel_id ||
          incomingMessage.channel?.id
        ) !== String(activeChannelId)
      ) {
        return;
      }

      shouldAutoScrollRef.current = true;

      setChannelMessages((prevMessages) => {
        const incomingMessageId = getMessageId(incomingMessage);

        if (
          incomingMessageId &&
          prevMessages.some(
            (message) => String(getMessageId(message)) === String(incomingMessageId)
          )
        ) {
          return prevMessages;
        }

        return [...prevMessages, incomingMessage];
      });
      persistChannelReadState(activeChannelId);
    };

    const handleMessageDeleted = (deletedMessage) => {
      const deletedMessageId =
        deletedMessage?.message_id ||
        deletedMessage?.messageId ||
        deletedMessage?.id;

      if (!deletedMessageId) {
        return;
      }

      const removeDeletedMessage = (prevMessages) =>
        prevMessages.filter(
          (message) => String(getMessageId(message)) !== String(deletedMessageId)
        );

      setChannelMessages(removeDeletedMessage);
    };

    const handleMessageUpdated = (updatedMessage) => {
      const updatedMessageId =
        updatedMessage?.message_id ||
        updatedMessage?.messageId ||
        updatedMessage?.id;

      if (!updatedMessageId) {
        return;
      }

      const updateMessageList = (prevMessages) =>
        prevMessages.map((message) => {
          if (String(getMessageId(message)) !== String(updatedMessageId)) {
            return message;
          }

          const existingAttachments = getMessageAttachments(message);
          const incomingAttachments = getMessageAttachments(updatedMessage);

          return {
            ...message,
            ...updatedMessage,
            content: getMessageContent(updatedMessage),
            attachments: existingAttachments.length
              ? existingAttachments
              : incomingAttachments,
            edited: true
          };
        });

      setChannelMessages(updateMessageList);
    };

    const handleDirectMessage = (payload) => {
      if (!payload?.conversation_id || !payload?.directMessage) {
        return;
      }

      const conversationId = payload.conversation_id;
      const isCurrentConversation =
        String(conversationId) === String(activeConversationId);
      const isOwnMessage =
        currentUserId &&
        String(payload.sender_user_id) === String(currentUserId);

      if (isCurrentConversation) {
        shouldAutoScrollRef.current = true;

        setDirectMessages((prevMessages) => {
          const incomingMessageId = getDirectMessageId(payload.directMessage);

          if (
            incomingMessageId &&
            prevMessages.some(
              (message) =>
                String(getDirectMessageId(message)) === String(incomingMessageId)
            )
          ) {
            return prevMessages;
          }

          return [...prevMessages, payload.directMessage];
        });
        persistDirectConversationReadState(conversationId);
      } else if (!isOwnMessage) {
        setUnreadDirectCounts((prevCounts) => {
          const key = String(conversationId);

          return {
            ...prevCounts,
            [key]: Number(prevCounts[key] || 0) + 1
          };
        });
      }

      const token = getAuthToken();

      if (token) {
        loadDirectConversationList(token);
      }
    };

    const handleDirectMessageDeleted = (deletedMessage) => {
      const deletedMessageId =
        deletedMessage?.direct_message_id ||
        deletedMessage?.directMessageId ||
        deletedMessage?.id;

      if (!deletedMessageId) {
        return;
      }

      const removeDeletedDirectMessage = (prevMessages) =>
        prevMessages.filter(
          (message) =>
            String(getDirectMessageId(message)) !== String(deletedMessageId)
        );

      setDirectMessages(removeDeletedDirectMessage);

      const token = getAuthToken();

      if (token) {
        loadDirectConversationList(token);
      }
    };

    const handleDirectMessageUpdated = (payload) => {
      const updatedMessage = payload?.directMessage || payload;
      const updatedMessageId =
        updatedMessage?.direct_message_id ||
        updatedMessage?.directMessageId ||
        updatedMessage?.id;

      if (!updatedMessageId) {
        return;
      }

      const updateDirectMessageList = (prevMessages) =>
        prevMessages.map((message) => {
          if (String(getDirectMessageId(message)) !== String(updatedMessageId)) {
            return message;
          }

          const existingAttachments = getMessageAttachments(message);
          const incomingAttachments = getMessageAttachments(updatedMessage);

          return {
            ...message,
            ...updatedMessage,
            content: getDirectMessageContent(updatedMessage),
            attachments: existingAttachments.length
              ? existingAttachments
              : incomingAttachments,
            edited: true
          };
        });

      setDirectMessages(updateDirectMessageList);

      const token = getAuthToken();

      if (token) {
        loadDirectConversationList(token);
      }
    };

    const handleChannelMessageNotification = (payload) => {
      if (!payload) {
        return;
      }

      const channelId =
        payload.channel_id || payload.channelId || payload.message?.channel_id;
      const serverId =
        payload.server_id || payload.serverId || payload.message?.server_id;
      const senderUserId =
        payload.sender_user_id || payload.senderId || payload.message?.user_id;
      const mentionedUserIds =
        payload.mentioned_user_ids ||
        payload.mentionedUserIds ||
        payload.message?.mentioned_user_ids ||
        [];
      const currentUserWasMentioned = mentionedUserIds.some(
        (mentionedUserId) => String(mentionedUserId) === String(currentUserId)
      );

      if (!channelId || !serverId || !senderUserId || !currentUserId) {
        return;
      }

      const isOwnMessage = String(senderUserId) === String(currentUserId);
      const isCurrentChannel =
        String(channelId) === String(activeChannelId) &&
        String(serverId) === String(activeServerId);

      if (isOwnMessage || isCurrentChannel) {
        return;
      }

      setUnreadChannelCounts((prevCounts) => {
        const key = String(channelId);

        return {
          ...prevCounts,
          [key]: Number(prevCounts[key] || 0) + 1
        };
      });

      setUnreadServerCounts((prevCounts) => {
        const key = String(serverId);

        return {
          ...prevCounts,
          [key]: Number(prevCounts[key] || 0) + 1
        };
      });

      if (currentUserWasMentioned) {
        setMentionChannelCounts((prevCounts) => {
          const key = String(channelId);

          return {
            ...prevCounts,
            [key]: Number(prevCounts[key] || 0) + 1
          };
        });

        setMentionServerCounts((prevCounts) => {
          const key = String(serverId);

          return {
            ...prevCounts,
            [key]: Number(prevCounts[key] || 0) + 1
          };
        });
      }
    };

    const handleFriendRequestReceived = (payload) => {
      const request = payload?.request || payload;

      if (!request?.request_id) {
        const token = getAuthToken();

        if (token) {
          fetchFriendRequests(token);
        }

        return;
      }

      setIncomingFriendRequests((prevRequests) => {
        const alreadyExists = prevRequests.some(
          (existingRequest) =>
            String(getFriendRequestId(existingRequest)) ===
            String(getFriendRequestId(request))
        );

        if (alreadyExists) {
          return prevRequests;
        }

        return [request, ...prevRequests];
      });
    };

    const handleFriendRemoved = (payload) => {
      if (!payload?.user_id || !payload?.friend_id || !currentUserId) {
        return;
      }

      let removedFriendId = null;

      if (String(payload.user_id) === String(currentUserId)) {
        removedFriendId = payload.friend_id;
      } else if (String(payload.friend_id) === String(currentUserId)) {
        removedFriendId = payload.user_id;
      }

      if (!removedFriendId) {
        return;
      }

      setFriends((prevFriends) =>
        prevFriends.filter(
          (friend) => String(getFriendId(friend)) !== String(removedFriendId)
        )
      );
    };


    const removeTypingUser = (payload, directView) => {
      const typingUserId = payload?.user_id || payload?.userId;

      if (!typingUserId) {
        return;
      }

      const timeoutKey = `${directView ? "dm" : "channel"}-${typingUserId}`;

      if (remoteTypingTimeoutsRef.current[timeoutKey]) {
        window.clearTimeout(remoteTypingTimeoutsRef.current[timeoutKey]);
        delete remoteTypingTimeoutsRef.current[timeoutKey];
      }

      const updateTypingUsers = (prevTypingUsers) =>
        prevTypingUsers.filter(
          (typingUser) => String(typingUser.user_id) !== String(typingUserId)
        );

      if (directView) {
        setDirectTypingUsers(updateTypingUsers);
      } else {
        setChannelTypingUsers(updateTypingUsers);
      }
    };

    const addTypingUser = (payload, directView) => {
      const typingUserId = payload?.user_id || payload?.userId;
      const typingUsername = payload?.username || "Someone";

      if (!typingUserId || String(typingUserId) === String(currentUserId)) {
        return;
      }

      if (directView) {
        const conversationId = payload?.conversation_id || payload?.conversationId;

        if (String(conversationId) !== String(activeConversationId)) {
          return;
        }
      } else {
        const channelId = payload?.channel_id || payload?.channelId;

        if (String(channelId) !== String(activeChannelId)) {
          return;
        }
      }

      const timeoutKey = `${directView ? "dm" : "channel"}-${typingUserId}`;

      if (remoteTypingTimeoutsRef.current[timeoutKey]) {
        window.clearTimeout(remoteTypingTimeoutsRef.current[timeoutKey]);
      }

      const updateTypingUsers = (prevTypingUsers) => {
        const alreadyTyping = prevTypingUsers.some(
          (typingUser) => String(typingUser.user_id) === String(typingUserId)
        );

        if (alreadyTyping) {
          return prevTypingUsers.map((typingUser) =>
            String(typingUser.user_id) === String(typingUserId)
              ? { ...typingUser, username: typingUsername }
              : typingUser
          );
        }

        return [
          ...prevTypingUsers,
          {
            user_id: typingUserId,
            username: typingUsername
          }
        ];
      };

      if (directView) {
        setDirectTypingUsers(updateTypingUsers);
      } else {
        setChannelTypingUsers(updateTypingUsers);
      }

      remoteTypingTimeoutsRef.current[timeoutKey] = window.setTimeout(() => {
        removeTypingUser(payload, directView);
      }, 3500);
    };

    const handleChannelTypingStart = (payload) => addTypingUser(payload, false);
    const handleChannelTypingStop = (payload) => removeTypingUser(payload, false);
    const handleDirectTypingStart = (payload) => addTypingUser(payload, true);
    const handleDirectTypingStop = (payload) => removeTypingUser(payload, true);

    const handleMessageReactionUpdated = (payload) => {
      updateMessageReactionsInState(payload, false);
    };

    const handleDirectMessageReactionUpdated = (payload) => {
      updateMessageReactionsInState(payload, true);
    };

    const handleMessagePinUpdated = (message) => {
      updatePinnedMessageInState(message, false);
    };

    const handleDirectMessagePinUpdated = (message) => {
      updatePinnedMessageInState(message, true);
    };

    socket.on("presence_update", handlePresenceUpdate);
    socket.on("user_profile_updated", handleProfileUpdated);
    socket.on("new_message", handleNewMessage);
    socket.on("message_updated", handleMessageUpdated);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("message_reaction_updated", handleMessageReactionUpdated);
    socket.on("message_pin_updated", handleMessagePinUpdated);
    socket.on("channel_typing_start", handleChannelTypingStart);
    socket.on("channel_typing_stop", handleChannelTypingStop);
    socket.on("direct_message", handleDirectMessage);
    socket.on("direct_message_updated", handleDirectMessageUpdated);
    socket.on("direct_message_deleted", handleDirectMessageDeleted);
    socket.on("direct_message_reaction_updated", handleDirectMessageReactionUpdated);
    socket.on("direct_message_pin_updated", handleDirectMessagePinUpdated);
    socket.on("direct_typing_start", handleDirectTypingStart);
    socket.on("direct_typing_stop", handleDirectTypingStop);
    socket.on("friend_removed", handleFriendRemoved);
    socket.on("channel_message_notification", handleChannelMessageNotification);
    socket.on("friend_request_received", handleFriendRequestReceived);

    return () => {
      socket.off("presence_update", handlePresenceUpdate);
      socket.off("user_profile_updated", handleProfileUpdated);
      socket.off("new_message", handleNewMessage);
      socket.off("message_updated", handleMessageUpdated);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("message_reaction_updated", handleMessageReactionUpdated);
      socket.off("message_pin_updated", handleMessagePinUpdated);
      socket.off("channel_typing_start", handleChannelTypingStart);
      socket.off("channel_typing_stop", handleChannelTypingStop);
      socket.off("direct_message", handleDirectMessage);
      socket.off("direct_message_updated", handleDirectMessageUpdated);
      socket.off("direct_message_deleted", handleDirectMessageDeleted);
      socket.off("direct_message_reaction_updated", handleDirectMessageReactionUpdated);
      socket.off("direct_message_pin_updated", handleDirectMessagePinUpdated);
      socket.off("direct_typing_start", handleDirectTypingStart);
      socket.off("direct_typing_stop", handleDirectTypingStop);
      socket.off("friend_removed", handleFriendRemoved);
      socket.off("channel_message_notification", handleChannelMessageNotification);
      socket.off("friend_request_received", handleFriendRequestReceived);
    };
  }, [
    isSocketReady,
    activeServerId,
    activeChannelId,
    activeConversationId,
    loadDirectConversationList,
    fetchFriendRequests,
    currentUserId,
    persistChannelReadState,
    persistDirectConversationReadState,
    applyUserProfileUpdate,
    updateMessageReactionsInState,
    updatePinnedMessageInState
  ]);

  useEffect(() => {
    if (!messageInputRef.current || isSendingMessage) {
      return;
    }

    if ((isDmView && activeConversationId) || (!isDmView && activeChannelId)) {
      messageInputRef.current.focus();
    }
  }, [isDmView, activeConversationId, activeChannelId, isSendingMessage]);

  useEffect(() => {
    const container = messagesContainerRef.current;

    if (!container) {
      return;
    }

    if (scrollRestoreRef.current) {
      const { previousScrollHeight, previousScrollTop } = scrollRestoreRef.current;
      scrollRestoreRef.current = null;
      container.scrollTop =
        container.scrollHeight - previousScrollHeight + previousScrollTop;
      return;
    }

    if (searchJumpPendingRef.current) {
      const pendingMessageId = searchJumpPendingRef.current;
      searchJumpPendingRef.current = null;

      requestAnimationFrame(() => {
        const targetMessage = container.querySelector(
          `[data-message-key="${pendingMessageId}"]`
        );

        if (targetMessage) {
          targetMessage.scrollIntoView({ block: "center" });
        }
      });

      return;
    }

    if (!shouldAutoScrollRef.current) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [displayedMessages]);

  useEffect(() => {
    const handleGlobalClick = (event) => {
      setOpenChannelMenuId(null);
      setOpenConversationMenuId(null);
      setOpenMessageMenuKey(null);

      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setIsEmojiPickerOpen(false);
      }
    };

    window.addEventListener("click", handleGlobalClick);

    return () => {
      window.removeEventListener("click", handleGlobalClick);
    };
  }, []);

  useEffect(() => {
    setActiveMentionIndex(0);
  }, [mentionQuery, isMentionMenuOpen]);

  const getSearchMatchMessageId = useCallback(
    (match) =>
      isDmView
        ? match?.direct_message_id || match?.directMessageId || match?.id
        : match?.message_id || match?.messageId || match?.id,
    [isDmView]
  );

  const scrollToLoadedMessage = useCallback((messageId) => {
    const container = messagesContainerRef.current;

    if (!container || !messageId) {
      return false;
    }

    const targetMessage = container.querySelector(
      `[data-message-key="${messageId}"]`
    );

    if (!targetMessage) {
      return false;
    }

    targetMessage.scrollIntoView({ block: "center" });
    return true;
  }, []);

  const jumpToSearchMatch = useCallback(
    async (nextIndex, matchesOverride = []) => {
      const matches = matchesOverride;

      if (!matches.length) {
        setActiveSearchIndex(0);
        setActiveSearchMessageId(null);
        return;
      }

      const safeIndex = Math.min(Math.max(nextIndex, 0), matches.length - 1);
      const targetMessageId = getSearchMatchMessageId(matches[safeIndex]);

      if (!targetMessageId) {
        return;
      }

      setActiveSearchIndex(safeIndex);
      setActiveSearchMessageId(targetMessageId);
      shouldAutoScrollRef.current = false;

      const currentMessages = isDmView
        ? directMessagesRef.current
        : channelMessagesRef.current;
      const targetAlreadyLoaded = currentMessages.some((message) => {
        const currentMessageId = isDmView
          ? getDirectMessageId(message)
          : getMessageId(message);

        return String(currentMessageId) === String(targetMessageId);
      });

      if (targetAlreadyLoaded) {
        requestAnimationFrame(() => {
          scrollToLoadedMessage(targetMessageId);
        });
        return;
      }

      const token = getAuthToken();

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        setMessageError("");
        searchJumpPendingRef.current = String(targetMessageId);

        if (isDmView) {
          if (!activeConversationId) {
            return;
          }

          const response = await getDirectMessages(token, activeConversationId, {
            limit: MESSAGE_PAGE_SIZE,
            aroundDirectMessageId: targetMessageId
          });
          const normalizedMessages = normalizeMessages(response);
          const pagination = response?.pagination || response?.data?.pagination || {};

          setDirectMessages(normalizedMessages);
          setHasOlderDirectMessages(Boolean(pagination.hasOlder));
        } else {
          if (!activeChannelId) {
            return;
          }

          const response = await getChannelMessages(token, activeChannelId, {
            limit: MESSAGE_PAGE_SIZE,
            aroundMessageId: targetMessageId
          });
          const normalizedMessages = normalizeMessages(response);
          const pagination = response?.pagination || response?.data?.pagination || {};

          setChannelMessages(normalizedMessages);
          setHasOlderChannelMessages(Boolean(pagination.hasOlder));
        }
      } catch (error) {
        setMessageError(error.message || "Failed to jump to search result.");
        searchJumpPendingRef.current = null;
      }
    },
    [
      activeChannelId,
      activeConversationId,
      getSearchMatchMessageId,
      isDmView,
      navigate,
      scrollToLoadedMessage
    ]
  );

  const runMessageSearch = useCallback(
    async (searchTerm, options = {}) => {
      const token = getAuthToken();
      const trimmedSearchTerm = String(searchTerm || "").trim();

      if (!token) {
        navigate("/login");
        return;
      }

      if (isDmView && !activeConversationId) {
        return;
      }

      if (!isDmView && !activeChannelId) {
        return;
      }

      if (!trimmedSearchTerm) {
        if (options.showRequiredError) {
          setMessageSearchError("Search term is required.");
        }

        return;
      }

      const requestId = messageSearchRequestRef.current + 1;
      messageSearchRequestRef.current = requestId;

      try {
        setIsSearchingMessages(true);
        setMessageSearchError("");
        shouldAutoScrollRef.current = false;

        const response = isDmView
          ? await searchDirectMessages(
              token,
              activeConversationId,
              trimmedSearchTerm
            )
          : await searchChannelMessages(
              token,
              activeChannelId,
              trimmedSearchTerm
            );

        if (requestId !== messageSearchRequestRef.current) {
          return;
        }

        const matches =
          response?.matches ||
          response?.data?.matches ||
          response?.messages ||
          response?.data ||
          [];

        setMessageSearchMatches(matches);
        setIsMessageSearchActive(true);
        setActiveSearchIndex(0);
        setActiveSearchMessageId(matches.length ? getSearchMatchMessageId(matches[0]) : null);

        if (matches.length) {
          await jumpToSearchMatch(0, matches);
        }
      } catch (error) {
        if (requestId !== messageSearchRequestRef.current) {
          return;
        }

        setMessageSearchMatches([]);
        setActiveSearchIndex(0);
        setActiveSearchMessageId(null);
        setIsMessageSearchActive(false);
        setMessageSearchError(error.message || "Failed to search messages.");
      } finally {
        if (requestId === messageSearchRequestRef.current) {
          setIsSearchingMessages(false);
        }
      }
    },
    [
      activeChannelId,
      activeConversationId,
      getSearchMatchMessageId,
      isDmView,
      jumpToSearchMatch,
      navigate
    ]
  );

  useEffect(() => {
    const trimmedSearchTerm = messageSearchTerm.trim();

    if (!trimmedSearchTerm) {
      messageSearchRequestRef.current += 1;
          setMessageSearchMatches([]);
      setActiveSearchIndex(0);
      setActiveSearchMessageId(null);
      setIsMessageSearchActive(false);
      setIsSearchingMessages(false);
      setMessageSearchError("");
      shouldAutoScrollRef.current = true;
      return;
    }

    if (isDmView && !activeConversationId) {
      return;
    }

    if (!isDmView && !activeChannelId) {
      return;
    }

    const debounceTimer = window.setTimeout(() => {
      runMessageSearch(trimmedSearchTerm);
    }, 350);

    return () => {
      window.clearTimeout(debounceTimer);
    };
  }, [
    messageSearchTerm,
    isDmView,
    activeConversationId,
    activeChannelId,
    runMessageSearch
  ]);

  const handleSearchMessages = (e) => {
    e.preventDefault();
    runMessageSearch(messageSearchTerm, { showRequiredError: true });
  };

  const handleClearMessageSearch = () => {
    messageSearchRequestRef.current += 1;
    setMessageSearchTerm("");
    setMessageSearchMatches([]);
    setActiveSearchIndex(0);
    setActiveSearchMessageId(null);
    setIsMessageSearchActive(false);
    setIsSearchingMessages(false);
    setMessageSearchError("");
    shouldAutoScrollRef.current = true;
  };

  const handlePreviousSearchMatch = () => {
    if (!messageSearchMatches.length || activeSearchIndex <= 0) {
      return;
    }

    jumpToSearchMatch(activeSearchIndex - 1, messageSearchMatches);
  };

  const handleNextSearchMatch = () => {
    if (
      !messageSearchMatches.length ||
      activeSearchIndex >= messageSearchMatches.length - 1
    ) {
      return;
    }

    jumpToSearchMatch(activeSearchIndex + 1, messageSearchMatches);
  };

  const loadOlderMessages = async () => {
    const token = getAuthToken();
    const container = messagesContainerRef.current;

    if (!token) {
      navigate("/login");
      return;
    }

    if (!container || isLoadingOlderMessages) {
      return;
    }

    if (isDmView) {
      if (!activeConversationId || !hasOlderDirectMessages || !directMessages.length) {
        return;
      }

      const oldestDirectMessageId = getDirectMessageId(directMessages[0]);

      if (!oldestDirectMessageId) {
        return;
      }

      scrollRestoreRef.current = {
        previousScrollHeight: container.scrollHeight,
        previousScrollTop: container.scrollTop
      };

      try {
        setIsLoadingOlderMessages(true);
        await loadDirectMessageList(token, activeConversationId, {
          beforeDirectMessageId: oldestDirectMessageId
        });
      } catch (error) {
        setMessageError(error.message || "Failed to load older direct messages.");
        scrollRestoreRef.current = null;
      } finally {
        setIsLoadingOlderMessages(false);
      }

      return;
    }

    if (!activeChannelId || !hasOlderChannelMessages || !channelMessages.length) {
      return;
    }

    const oldestMessageId = getMessageId(channelMessages[0]);

    if (!oldestMessageId) {
      return;
    }

    scrollRestoreRef.current = {
      previousScrollHeight: container.scrollHeight,
      previousScrollTop: container.scrollTop
    };

    try {
      setIsLoadingOlderMessages(true);
      await loadChannelMessageList(token, activeChannelId, {
        beforeMessageId: oldestMessageId
      });
    } catch (error) {
      setMessageError(error.message || "Failed to load older channel messages.");
      scrollRestoreRef.current = null;
    } finally {
      setIsLoadingOlderMessages(false);
    }
  };

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;

    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    shouldAutoScrollRef.current = distanceFromBottom < 120;

    if (container.scrollTop < 120) {
      loadOlderMessages();
    }
  };

  const handleOpenEditProfile = () => {
    setProfileFormData({
      username: user?.username || "",
      email: user?.email || ""
    });
    setProfileError("");
    setProfileSuccess("");
    setIsEditProfileModalOpen(true);
  };

  const handleCloseEditProfile = () => {
    if (isUpdatingProfile) {
      return;
    }

    setIsEditProfileModalOpen(false);
    setProfileError("");
  };

  const handleProfileFormChange = (e) => {
    const { name, value } = e.target;

    setProfileFormData((prevData) => ({
      ...prevData,
      [name]: value
    }));

    setProfileError("");
    setProfileSuccess("");
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();

    const token = getAuthToken();
    const username = profileFormData.username.trim();
    const email = profileFormData.email.trim();

    if (!token) {
      navigate("/login");
      return;
    }

    if (!username || !email) {
      setProfileError("Username and email are required");
      return;
    }

    try {
      setIsUpdatingProfile(true);
      setProfileError("");
      setProfileSuccess("");

      const data = await updateProfile(token, { username, email });
      const updatedUser = data?.user || data;

      if (data?.token) {
        localStorage.setItem("token", data.token);

        if (socketRef.current) {
          socketRef.current.auth = { token: data.token };

          if (socketRef.current.connected) {
            socketRef.current.disconnect().connect();
          }
        }
      }

      applyUserProfileUpdate(updatedUser);
      setProfileSuccess(data?.message || "Profile updated successfully");
      setIsEditProfileModalOpen(false);
    } catch (error) {
      setProfileError(error.message || "Failed to update profile.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleLogout = () => {
    disconnectSocket();
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleSelectHome = () => {
    shouldAutoScrollRef.current = true;
    setActiveMentionHighlight(null);
    setActiveServerId(null);
    setActiveConversationId(null);
    setActiveDmSection("friends");
    setSidebarSearch("");
    setMessageContent("");
    setServerError("");
    setMessageError("");
    setAddFriendError("");
    setAddFriendSuccess("");
    setFriendRequestsError("");
    setRemoveFriendError("");
    resetMessageEditingState();
    resetMessageReplyState();
    resetMessageSearchState();
    navigate("/dashboard");

    requestAnimationFrame(() => {
      resetMessageInputHeight();
    });
  };

  const handleSelectDmSection = (section) => {
    shouldAutoScrollRef.current = true;
    setActiveMentionHighlight(null);
    setActiveServerId(null);
    setActiveConversationId(null);
    setActiveDmSection(section);
    setMessageContent("");
    setMessageError("");
    setAddFriendError("");
    setAddFriendSuccess("");
    setFriendRequestsError("");
    setRemoveFriendError("");
    resetMessageEditingState();
    resetMessageReplyState();
    resetMessageSearchState();
    navigate("/dashboard");

    requestAnimationFrame(() => {
      resetMessageInputHeight();
    });
  };

  const handleSelectServer = (serverId) => {
    shouldAutoScrollRef.current = true;
    setActiveMentionHighlight(null);
    setActiveConversationId(null);
    setSidebarSearch("");
    setMessageContent("");
    setServerError("");
    setMessageError("");
    setAddFriendError("");
    setAddFriendSuccess("");
    setFriendRequestsError("");
    setRemoveFriendError("");
    setIsCreateServerModalOpen(false);
    resetMessageEditingState();
    resetMessageReplyState();
    resetMessageSearchState();
    navigate(`/server/${serverId}`);

    requestAnimationFrame(() => {
      resetMessageInputHeight();
    });
  };

  const handleSelectChannel = (channelId) => {
    if (!activeServerId) {
      return;
    }

    shouldAutoScrollRef.current = true;
    setActiveMentionHighlight(null);
    setActiveChannelId(channelId);
    setDeleteChannelError("");
    setMessageError("");
    setMessageContent("");
    resetMessageEditingState();
    resetMessageReplyState();
    resetMessageSearchState();
    navigate(`/server/${activeServerId}/channel/${channelId}`);

    requestAnimationFrame(() => {
      resetMessageInputHeight();
    });
  };

  const handleSelectConversation = (conversationId) => {
    shouldAutoScrollRef.current = true;
    setActiveMentionHighlight(null);
    setActiveServerId(null);
    setActiveConversationId(conversationId);
    setActiveDmSection("friends");
    setMessageError("");
    setMessageContent("");
    setAddFriendError("");
    setAddFriendSuccess("");
    setFriendRequestsError("");
    setRemoveFriendError("");
    resetMessageEditingState();
    resetMessageReplyState();
    resetMessageSearchState();
    navigate(`/dm/${conversationId}`);

    requestAnimationFrame(() => {
      resetMessageInputHeight();
    });
  };

  const handleDeleteDirectConversation = async (conversation) => {
    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    const conversationId = getConversationId(conversation);

    if (!conversationId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete this DM with ${getConversationOtherUsername(conversation)}? This only deletes it for you.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeletingConversation(true);
      setDirectConversationError("");

      await deleteDirectConversation(token, conversationId);

      setDirectConversations((prevConversations) =>
        prevConversations.filter(
          (existingConversation) =>
            String(getConversationId(existingConversation)) !==
            String(conversationId)
        )
      );

      setUnreadDirectCounts((prevCounts) => {
        const key = String(conversationId);

        if (!prevCounts[key]) {
          return prevCounts;
        }

        const nextCounts = { ...prevCounts };
        delete nextCounts[key];
        return nextCounts;
      });

      setOpenConversationMenuId(null);

      if (String(activeConversationId) === String(conversationId)) {
        setActiveConversationId(null);
        setDirectMessages([]);
        setMessageContent("");
        setActiveDmSection("friends");
        navigate("/dashboard");
      }
    } catch (error) {
      setDirectConversationError(
        error.message || "Failed to delete direct conversation."
      );
    } finally {
      setIsDeletingConversation(false);
    }
  };

  const handleStartDirectConversation = async (friend) => {
    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setError("");
      const response = await getOrCreateDirectConversation(token, getFriendId(friend));
      const conversationId = getConversationId(response?.conversation);

      await loadDirectConversationList(token);

      setActiveServerId(null);
      setActiveConversationId(conversationId);
      setActiveDmSection("friends");
      setMessageContent("");
      navigate(`/dm/${conversationId}`);

      requestAnimationFrame(() => {
        resetMessageInputHeight();
      });
    } catch (error) {
      setError(error.message || "Failed to start direct conversation.");
    }
  };

  const handleAddFriend = async (e) => {
    e.preventDefault();

    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    if (!friendUsername.trim()) {
      setAddFriendError("Username is required.");
      setAddFriendSuccess("");
      return;
    }

    try {
      setIsAddingFriend(true);
      setAddFriendError("");
      setAddFriendSuccess("");

      const data = await sendFriendRequest(token, friendUsername);

      setAddFriendSuccess(data?.message || "Friend request sent.");
      setFriendUsername("");
      await fetchFriendRequests(token);
    } catch (error) {
      setAddFriendError(error.message || "Failed to send friend request.");
      setAddFriendSuccess("");
    } finally {
      setIsAddingFriend(false);
    }
  };

  const handleRespondToFriendRequest = async (requestId, action) => {
    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setProcessingFriendRequestId(requestId);
      setFriendRequestsError("");

      await respondToFriendRequest(token, requestId, action);

      await loadFriends(token);
      await fetchFriendRequests(token);
    } catch (error) {
      setFriendRequestsError(
        error.message || "Failed to update friend request."
      );
    } finally {
      setProcessingFriendRequestId(null);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    if (!friendId) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to remove this friend?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setRemovingFriendId(friendId);
      setRemoveFriendError("");

      await removeFriend(token, friendId);

      setFriends((prevFriends) =>
        prevFriends.filter(
          (friend) => String(getFriendId(friend)) !== String(friendId)
        )
      );
    } catch (error) {
      setRemoveFriendError(error.message || "Failed to remove friend.");
    } finally {
      setRemovingFriendId(null);
    }
  };

  const handleRemoveServerMember = async (member) => {
    const token = getAuthToken();
    const memberId = getMemberId(member);

    if (!token) {
      navigate("/login");
      return;
    }

    if (!activeServerId || !memberId) {
      return;
    }

    const confirmed = window.confirm(
      `Remove ${getMemberName(member)} from this server?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setRemovingServerMemberId(memberId);
      setServerMemberActionError("");

      await removeServerMember(activeServerId, memberId, token);

      setMembers((prevMembers) =>
        prevMembers.filter(
          (existingMember) => String(getMemberId(existingMember)) !== String(memberId)
        )
      );
    } catch (error) {
      setServerMemberActionError(error.message || "Failed to remove member.");
    } finally {
      setRemovingServerMemberId(null);
    }
  };

  const handleUpdateServerMemberRole = async (member, role) => {
    const token = getAuthToken();
    const memberId = getMemberId(member);

    if (!token) {
      navigate("/login");
      return;
    }

    if (!activeServerId || !memberId || !role) {
      return;
    }

    try {
      setUpdatingMemberRoleId(memberId);
      setServerMemberActionError("");

      const response = await updateServerMemberRole(
        activeServerId,
        memberId,
        role,
        token
      );
      const updatedMember = response?.member;

      if (updatedMember) {
        setMembers((prevMembers) =>
          prevMembers.map((existingMember) =>
            String(getMemberId(existingMember)) === String(memberId)
              ? { ...existingMember, ...updatedMember }
              : existingMember
          )
        );
      } else {
        await loadServerMembers(token, activeServerId);
      }
    } catch (error) {
      setServerMemberActionError(error.message || "Failed to update member role.");
    } finally {
      setUpdatingMemberRoleId(null);
    }
  };

  const handleCreateServer = async (e) => {
    e.preventDefault();

    const token = getAuthToken();
    const trimmedName = serverFormData.server_name.trim();
    const trimmedDescription = serverFormData.description.trim();

    if (!trimmedName) {
      setCreateServerError("Server name is required.");
      return;
    }

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setIsCreatingServer(true);
      setCreateServerError("");

      const payload = {
        server_name: trimmedName,
        description: trimmedDescription
      };

      const createdServer = await createServer(token, payload);

      setServerFormData({
        server_name: "",
        description: ""
      });

      setIsCreateServerModalOpen(false);

      await loadServers(token);

      const newServerId =
        createdServer?.server?.server_id ||
        createdServer?.server?.id ||
        createdServer?.server_id ||
        createdServer?.id ||
        createdServer?.serverId;

      if (newServerId) {
        handleSelectServer(newServerId);
      }
    } catch (error) {
      setCreateServerError(
        error.message || "Failed to create server. Please try again."
      );
    } finally {
      setIsCreatingServer(false);
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();

    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    if (!activeServerId) {
      setCreateChannelError("Select a server first.");
      return;
    }

    if (!channelName.trim()) {
      setCreateChannelError("Channel name is required.");
      return;
    }

    try {
      setIsCreatingChannel(true);
      setCreateChannelError("");
      setDeleteChannelError("");

      const response = await createChannel(token, {
        server_id: activeServerId,
        channel_name: channelName.trim()
      });

      const createdChannel = response?.channel || response?.data || response;

      await loadServerChannels(token, activeServerId);

      const createdChannelId = getChannelId(createdChannel);

      if (createdChannelId) {
        setActiveChannelId(createdChannelId);
        navigate(`/server/${activeServerId}/channel/${createdChannelId}`);
      }

      setChannelName("");
    } catch (error) {
      setCreateChannelError(error.message || "Failed to create channel.");
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleDeleteChannel = async (channelToDelete) => {
    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    if (!channelToDelete) {
      setDeleteChannelError("Select a channel first.");
      return;
    }

    const channelIdToDelete = getChannelId(channelToDelete);
    const channelNameToDelete = getChannelName(channelToDelete);
    const isGeneralChannel =
      channelNameToDelete.trim().toLowerCase() === "general";

    if (isGeneralChannel) {
      setDeleteChannelError("The general channel cannot be deleted.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete #${channelNameToDelete}? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeletingChannel(true);
      setDeleteChannelError("");
      shouldAutoScrollRef.current = true;

      await deleteChannelById(token, channelIdToDelete);
      const remainingChannels = await loadServerChannels(token, activeServerId);
      setMessageContent("");
      setOpenChannelMenuId(null);

      const fallbackChannelId = remainingChannels.length
        ? getChannelId(remainingChannels[0])
        : null;

      if (fallbackChannelId) {
        navigate(`/server/${activeServerId}/channel/${fallbackChannelId}`);
      } else {
        navigate(`/server/${activeServerId}`);
      }
    } catch (error) {
      setDeleteChannelError(error.message || "Failed to delete channel.");
    } finally {
      setIsDeletingChannel(false);
    }
  };

  const handleStartReplyingToMessage = (message) => {
    const messageId = isDmView
      ? getDirectMessageId(message)
      : getMessageId(message);

    if (!messageId) {
      return;
    }

    resetMessageEditingState();
    setMessageError("");
    setSelectedReplyMessage(message);

    requestAnimationFrame(() => {
      if (messageInputRef.current) {
        messageInputRef.current.focus();
      }
    });
  };

  const handleCancelReplyingToMessage = () => {
    resetMessageReplyState();
  };

  const handleStartEditingMessage = (message) => {
    const messageId = isDmView
      ? getDirectMessageId(message)
      : getMessageId(message);

    if (!messageId) {
      return;
    }

    const content = isDmView
      ? getDirectMessageContent(message)
      : getMessageContent(message);

    setMessageError("");
    resetMessageReplyState();
    setEditingMessageKey(`${isDmView ? "dm" : "channel"}-${messageId}`);
    setEditingMessageContent(content);
  };

  const handleCancelEditingMessage = () => {
    resetMessageEditingState();
  };

  const handleSaveEditedMessage = async (message) => {
    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    const messageId = isDmView
      ? getDirectMessageId(message)
      : getMessageId(message);

    if (!messageId) {
      return;
    }

    const trimmedContent = editingMessageContent.trim();

    if (!trimmedContent) {
      setMessageError("Message content is required.");
      return;
    }

    const messageKey = `${isDmView ? "dm" : "channel"}-${messageId}`;

    try {
      setSavingEditedMessageKey(messageKey);
      setMessageError("");

      if (isDmView) {
        const response = await updateDirectMessage(token, messageId, trimmedContent);
        const updatedMessage =
          response?.directMessage || response?.data || response;

        const updateDirectMessageList = (prevMessages) =>
          prevMessages.map((existingMessage) => {
            if (
              String(getDirectMessageId(existingMessage)) !== String(messageId)
            ) {
              return existingMessage;
            }

            return {
              ...existingMessage,
              ...updatedMessage,
              content: getDirectMessageContent(updatedMessage),
              attachments: getMessageAttachments(existingMessage),
              edited: true
            };
          });

        setDirectMessages(updateDirectMessageList);
        } else {
        const response = await updateMessage(token, messageId, trimmedContent);
        const updatedMessage = response?.data || response?.message || response;

        const updateChannelMessageList = (prevMessages) =>
          prevMessages.map((existingMessage) => {
            if (String(getMessageId(existingMessage)) !== String(messageId)) {
              return existingMessage;
            }

            return {
              ...existingMessage,
              ...updatedMessage,
              content: getMessageContent(updatedMessage),
              attachments: getMessageAttachments(existingMessage),
              edited: true
            };
          });

        setChannelMessages(updateChannelMessageList);
      }

      resetMessageEditingState();
    } catch (error) {
      setMessageError(error.message || "Failed to edit message.");
    } finally {
      setSavingEditedMessageKey(null);
    }
  };

  const handleDeleteChatMessage = async (message) => {
    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    const messageId = isDmView
      ? getDirectMessageId(message)
      : getMessageId(message);

    if (!messageId) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this message? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    const nextDeletingMessageKey = `${isDmView ? "dm" : "channel"}-${messageId}`;

    try {
      setDeletingMessageKey(nextDeletingMessageKey);
      setMessageError("");

      if (isDmView) {
        await deleteDirectMessage(token, messageId);

        const removeDeletedDirectMessage = (prevMessages) =>
          prevMessages.filter(
            (existingMessage) =>
              String(getDirectMessageId(existingMessage)) !== String(messageId)
          );

        setDirectMessages(removeDeletedDirectMessage);
        } else {
        await deleteMessage(token, messageId);

        const removeDeletedChannelMessage = (prevMessages) =>
          prevMessages.filter(
            (existingMessage) =>
              String(getMessageId(existingMessage)) !== String(messageId)
          );

        setChannelMessages(removeDeletedChannelMessage);
      }
    } catch (error) {
      setMessageError(error.message || "Failed to delete message.");
    } finally {
      setDeletingMessageKey(null);
    }
  };

  const handleToggleMessageReaction = async (message, emoji) => {
    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    const messageId = isDmView ? getDirectMessageId(message) : getMessageId(message);

    if (!messageId || !emoji) {
      return;
    }

    const messageKey = `${isDmView ? "dm" : "channel"}-${messageId}-${emoji}`;

    try {
      setReactingMessageKey(messageKey);
      setMessageError("");

      const response = isDmView
        ? await toggleDirectMessageReaction(token, messageId, emoji)
        : await toggleMessageReaction(token, messageId, emoji);

      updateMessageReactionsInState(response?.data || response, isDmView);
    } catch (error) {
      setMessageError(error.message || "Failed to update reaction.");
    } finally {
      setReactingMessageKey(null);
    }
  };

  const handleTogglePinMessage = async (message) => {
    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    const messageId = isDmView ? getDirectMessageId(message) : getMessageId(message);

    if (!messageId) {
      return;
    }

    const messageKey = `${isDmView ? "dm" : "channel"}-${messageId}`;

    try {
      setPinningMessageKey(messageKey);
      setMessageError("");

      const response = messageIsPinned(message)
        ? isDmView
          ? await unpinDirectMessage(token, messageId)
          : await unpinMessage(token, messageId)
        : isDmView
          ? await pinDirectMessage(token, messageId)
          : await pinMessage(token, messageId);

      updatePinnedMessageInState(response?.data || response, isDmView);
    } catch (error) {
      setMessageError(error.message || "Failed to update pinned message.");
    } finally {
      setPinningMessageKey(null);
    }
  };

  const handleApplyNotificationSettings = (payload) => {
    const nextSettings = applyNotificationSettingsPayload(payload);

    setNotificationSettings({
      muted_server_ids: nextSettings.muted_server_ids || [],
      muted_channel_ids: nextSettings.muted_channel_ids || [],
      muted_direct_conversation_ids:
        nextSettings.muted_direct_conversation_ids || []
    });
  };

  const handleToggleMute = async (type, targetId, currentlyMuted) => {
    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    if (!targetId) {
      return;
    }

    const actionKey = `${type}-${targetId}`;

    try {
      setSettingsActionKey(actionKey);
      setSettingsActionError("");

      let response;

      if (type === "server") {
        response = await setServerMute(token, targetId, !currentlyMuted);
      } else if (type === "channel") {
        response = await setChannelMute(token, targetId, !currentlyMuted);
      } else {
        response = await setDirectConversationMute(token, targetId, !currentlyMuted);
      }

      handleApplyNotificationSettings(response);
      await loadUnreadCounts(token);
    } catch (error) {
      setSettingsActionError(error.message || "Failed to update notification settings.");
    } finally {
      setSettingsActionKey(null);
    }
  };

  const handleOpenReportModal = ({ userId, username, contextType = "profile", contextId = null }) => {
    if (!userId) {
      return;
    }

    setReportModal({
      isOpen: true,
      userId,
      username: username || "this user",
      contextType,
      contextId
    });
    setReportReason("");
    setReportSuccess("");
    setSafetyActionError("");
  };

  const handleCloseReportModal = () => {
    setReportModal({
      isOpen: false,
      userId: null,
      username: "",
      contextType: "profile",
      contextId: null
    });
    setReportReason("");
    setIsSubmittingReport(false);
  };

  const handleSubmitReport = async (event) => {
    event.preventDefault();

    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    const reason = reportReason.trim();

    if (!reason) {
      setSafetyActionError("Please write a short reason before submitting the report.");
      return;
    }

    try {
      setIsSubmittingReport(true);
      setSafetyActionError("");
      await reportUser(token, reportModal.userId, {
        reason,
        context_type: reportModal.contextType,
        context_id: reportModal.contextId
      });
      setReportSuccess("Report submitted successfully.");
      handleCloseReportModal();
    } catch (error) {
      setSafetyActionError(error.message || "Failed to submit report.");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleBlockUser = async (targetUserId, targetUsername = "this user") => {
    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    if (!targetUserId) {
      return;
    }

    const confirmed = window.confirm(
      `Block ${targetUsername}? This will remove them from your friends and stop direct messages between you.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setSafetyActionKey(`block-${targetUserId}`);
      setSafetyActionError("");
      const response = await blockUser(token, targetUserId);
      setBlockedUsers(normalizeBlockedUsers(response));
      await Promise.all([
        loadFriends(token),
        loadDirectConversationList(token),
        loadFriendRequests(token),
        loadUnreadCounts(token)
      ]);

      if (
        activeConversationUser &&
        String(activeConversationUser.user_id) === String(targetUserId)
      ) {
        setActiveConversationId(null);
      }
    } catch (error) {
      setSafetyActionError(error.message || "Failed to block user.");
    } finally {
      setSafetyActionKey(null);
    }
  };

  const handleUnblockUser = async (targetUserId) => {
    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setSafetyActionKey(`unblock-${targetUserId}`);
      setSafetyActionError("");
      const response = await unblockUser(token, targetUserId);
      setBlockedUsers(normalizeBlockedUsers(response));
    } catch (error) {
      setSafetyActionError(error.message || "Failed to unblock user.");
    } finally {
      setSafetyActionKey(null);
    }
  };

  const handleJumpToPinnedMessage = async (message) => {
    const messageId = isDmView ? getDirectMessageId(message) : getMessageId(message);

    if (!messageId) {
      return;
    }

    shouldAutoScrollRef.current = false;

    if (scrollToLoadedMessage(messageId)) {
      setIsPinnedMessagesOpen(false);
      return;
    }

    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      searchJumpPendingRef.current = String(messageId);

      if (isDmView) {
        const response = await getDirectMessages(token, activeConversationId, {
          limit: MESSAGE_PAGE_SIZE,
          aroundDirectMessageId: messageId
        });
        const normalizedMessages = normalizeMessages(response);
        const pagination = response?.pagination || response?.data?.pagination || {};

        setDirectMessages(normalizedMessages);
        setHasOlderDirectMessages(Boolean(pagination.hasOlder));
      } else {
        const response = await getChannelMessages(token, activeChannelId, {
          limit: MESSAGE_PAGE_SIZE,
          aroundMessageId: messageId
        });
        const normalizedMessages = normalizeMessages(response);
        const pagination = response?.pagination || response?.data?.pagination || {};

        setChannelMessages(normalizedMessages);
        setHasOlderChannelMessages(Boolean(pagination.hasOlder));
      }

      setIsPinnedMessagesOpen(false);
    } catch (error) {
      setMessageError(error.message || "Failed to jump to pinned message.");
      searchJumpPendingRef.current = null;
    }
  };

  const handleSendMessage = async (e) => {
    if (e) {
      e.preventDefault();
    }

    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    const trimmedMessageContent = messageContent.trim();

    if (!trimmedMessageContent && !selectedAttachment) {
      setMessageError("Message content or attachment is required.");
      return;
    }

    const replyToMessageId = selectedReplyMessage
      ? isDmView
        ? getDirectMessageId(selectedReplyMessage)
        : getMessageId(selectedReplyMessage)
      : null;

    try {
      setIsSendingMessage(true);
      setMessageError("");
      shouldAutoScrollRef.current = true;

      if (isDmView) {
        if (!activeConversationId) {
          setMessageError("Select a direct conversation first.");
          return;
        }

        await sendDirectMessage(token, {
          conversationId: activeConversationId,
          content: trimmedMessageContent,
          attachment: selectedAttachment,
          reply_to_direct_message_id: replyToMessageId
        });
      } else {
        if (!activeChannelId) {
          setMessageError("Select a channel first.");
          return;
        }

        await createMessage(token, {
          channel_id: activeChannelId,
          content: trimmedMessageContent,
          attachment: selectedAttachment,
          reply_to_message_id: replyToMessageId
        });
      }

      stopTyping();
      setMessageContent("");
      setIsEmojiPickerOpen(false);
      resetMessageReplyState();
      closeMentionMenu();

      if (isMessageSearchActive) {
        handleClearMessageSearch();
      }

      setSelectedAttachment(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      requestAnimationFrame(() => {
        resetMessageInputHeight();

        if (messageInputRef.current) {
          messageInputRef.current.focus();
        }
      });
    } catch (error) {
      setMessageError(error.message || "Failed to send message.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const updateMentionMenuFromInput = (value, cursorPosition) => {
    if (isDmView || !activeChannelId) {
      closeMentionMenu();
      return;
    }

    const safeCursorPosition = Number.isInteger(cursorPosition)
      ? cursorPosition
      : value.length;
    const textBeforeCursor = value.slice(0, safeCursorPosition);
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_.-]*)$/);

    if (!mentionMatch) {
      closeMentionMenu();
      return;
    }

    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex < 0) {
      closeMentionMenu();
      return;
    }

    setMentionStartIndex(atIndex);
    setMentionEndIndex(safeCursorPosition);
    setMentionQuery(mentionMatch[1] || "");
    setIsMentionMenuOpen(true);
  };

  const insertMention = (member) => {
    const username = getMemberName(member);

    if (!username || mentionStartIndex === null || mentionEndIndex === null) {
      closeMentionMenu();
      return;
    }

    const textBeforeMention = messageContent.slice(0, mentionStartIndex);
    const textAfterMention = messageContent.slice(mentionEndIndex);
    const normalizedTextAfterMention = textAfterMention.startsWith(" ")
      ? textAfterMention.slice(1)
      : textAfterMention;
    const nextContent = `${textBeforeMention}@${username} ${normalizedTextAfterMention}`;
    const nextCursorPosition = textBeforeMention.length + username.length + 2;

    setMessageContent(nextContent);
    closeMentionMenu();

    requestAnimationFrame(() => {
      if (!messageInputRef.current) {
        return;
      }

      messageInputRef.current.focus();
      messageInputRef.current.setSelectionRange(
        nextCursorPosition,
        nextCursorPosition
      );
      messageInputRef.current.style.height = "44px";
      messageInputRef.current.style.height = `${Math.min(
        messageInputRef.current.scrollHeight,
        160
      )}px`;
    });
  };

  const handleMessageInputChange = (e) => {
    const nextValue = e.target.value;

    setMessageContent(nextValue);
    setMessageError("");

    if (nextValue.trim()) {
      startTyping();
    } else {
      stopTyping();
    }
    e.target.style.height = "44px";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
    updateMentionMenuFromInput(nextValue, e.target.selectionStart);
  };

  const handleMessageInputCursorChange = (e) => {
    updateMentionMenuFromInput(e.target.value, e.target.selectionStart);
  };

  const handleMessageInputKeyUp = (e) => {
    if (["ArrowUp", "ArrowDown", "Enter", "Escape", "Tab"].includes(e.key)) {
      return;
    }

    updateMentionMenuFromInput(e.target.value, e.target.selectionStart);
  };

  const handleAttachmentChange = (e) => {
    const file = e.target.files?.[0];

    setMessageError("");

    if (!file) {
      setSelectedAttachment(null);
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
      setSelectedAttachment(null);
      setMessageError("Attachment must be 25 MB or smaller.");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    setSelectedAttachment(file);
  };

  const handleRemoveSelectedAttachment = () => {
    setSelectedAttachment(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddEmoji = (emojiData) => {
    const emoji = emojiData?.emoji;

    if (!emoji) {
      return;
    }

    setMessageError("");

    setMessageContent((previousContent) => {
      const input = messageInputRef.current;

      if (!input) {
        return `${previousContent}${emoji}`;
      }

      const selectionStart = input.selectionStart ?? previousContent.length;
      const selectionEnd = input.selectionEnd ?? previousContent.length;

      const nextContent =
        previousContent.slice(0, selectionStart) +
        emoji +
        previousContent.slice(selectionEnd);

      requestAnimationFrame(() => {
        input.focus();

        const nextCursorPosition = selectionStart + emoji.length;
        input.setSelectionRange(nextCursorPosition, nextCursorPosition);

        input.style.height = "44px";
        input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
      });

      return nextContent;
    });
  };

  const handleMessageKeyDown = (e) => {
    if (isMentionMenuOpen && mentionSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveMentionIndex((currentIndex) =>
          currentIndex + 1 >= mentionSuggestions.length ? 0 : currentIndex + 1
        );
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveMentionIndex((currentIndex) =>
          currentIndex - 1 < 0 ? mentionSuggestions.length - 1 : currentIndex - 1
        );
        return;
      }

      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionSuggestions[activeMentionIndex] || mentionSuggestions[0]);
        return;
      }
    }

    if (isMentionMenuOpen && e.key === "Escape") {
      e.preventDefault();
      closeMentionMenu();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      if (!messageContent.trim() && !selectedAttachment) {
        return;
      }

      handleSendMessage();
    }
  };

  const handleDeleteOrLeaveServer = async () => {
    const token = getAuthToken();

    if (!token || !activeServer) {
      navigate("/login");
      return;
    }

    const confirmed = window.confirm(
      currentUserIsOwner
        ? `Are you sure you want to delete "${getServerName(activeServer)}"? This cannot be undone.`
        : `Are you sure you want to leave "${getServerName(activeServer)}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeletingServer(true);
      setDeleteServerError("");

      if (currentUserIsOwner) {
        await deleteServer(token, getServerId(activeServer));
      } else {
        await leaveServer(getServerId(activeServer), token);
      }

      await loadServers(token);
      handleSelectHome();
    } catch (error) {
      setDeleteServerError(error.message || "Failed to update server membership.");
    } finally {
      setIsDeletingServer(false);
    }
  };

  const handleCreateInvite = async () => {
    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    if (!activeServerId) {
      setInviteError("Select a server first.");
      return;
    }

    try {
      setIsCreatingInvite(true);
      setInviteError("");

      const response = await createServerInvite(activeServerId, token);
      const inviteCode =
        response?.invite?.invite_code ||
        response?.invite_code ||
        response?.code ||
        "";

      if (!inviteCode) {
        throw new Error("Invite created, but no invite code was returned.");
      }

      setInviteCode(inviteCode);
    } catch (error) {
      setInviteError(error.message || "Failed to create invite.");
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleJoinInvite = async (e) => {
    e.preventDefault();

    const token = getAuthToken();

    if (!token) {
      navigate("/login");
      return;
    }

    if (!joinInviteCode.trim()) {
      setJoinInviteError("Invite code is required.");
      setJoinInviteSuccess("");
      return;
    }

    try {
      setIsJoiningInvite(true);
      setJoinInviteError("");
      setJoinInviteSuccess("");

      const normalizedInviteCode = joinInviteCode.trim().toUpperCase();
      const response = await joinServerByInvite(normalizedInviteCode, token);

      const joinedServerId =
        response?.server?.server_id ||
        response?.server_id ||
        response?.server?.id ||
        response?.id ||
        response?.serverId ||
        null;

      await loadServers(token);

      setJoinInviteSuccess("Joined server successfully.");
      setJoinInviteCode("");
      setIsJoinServerModalOpen(false);

      if (joinedServerId) {
        navigate(`/server/${joinedServerId}`);
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      setJoinInviteError(error.message || "Failed to join server.");
      setJoinInviteSuccess("");
    } finally {
      setIsJoiningInvite(false);
    }
  };

  const handleCopyInviteCode = async () => {
    if (!inviteCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteCode);
      setIsInviteCopied(true);
      setInviteError("");

      setTimeout(() => {
        setIsInviteCopied(false);
      }, 2500);
    } catch {
      setInviteError("Failed to copy invite code.");
    }
  };

  const renderServerMember = (member) => {
    const memberId = getMemberId(member);
    const memberRole = getMemberServerRole(member);
    const memberIsCurrentUser =
      currentUserId && String(getMemberUserId(member)) === String(currentUserId);
    const canRemoveMember =
      currentUserCanManageServer &&
      !memberIsCurrentUser &&
      memberRole !== "owner" &&
      !(currentUserServerRole === "admin" && memberRole !== "member");
    const canChangeMemberRole =
      currentUserCanManageRoles && !memberIsCurrentUser && memberRole !== "owner";
    const nextRole = memberRole === "admin" ? "member" : "admin";
    const isRemovingMember = String(removingServerMemberId) === String(memberId);
    const isUpdatingRole = String(updatingMemberRoleId) === String(memberId);

    return (
      <div key={memberId} className="server-member-item discord-member-item">
        <div className="discord-member-row-top">
          <div className="discord-profile-avatar member-avatar">
            {getInitial(getMemberName(member))}
            <span
              className={`discord-status-dot discord-profile-status ${getPresenceColorClass(
                getMemberPresenceStatus(member)
              )}`}
            />
          </div>

          <div className="discord-member-text">
            <div className="server-member-name">
              {getMemberName(member)}
              <span className={`discord-member-role-badge discord-member-role-${memberRole}`}>
                {formatMemberRole(member)}
              </span>
            </div>
            <div className="server-member-email">{getMemberEmail(member)}</div>
          </div>
        </div>

        {(canChangeMemberRole || canRemoveMember) ? (
          <div className="discord-member-actions">
            {canChangeMemberRole ? (
              <button
                type="button"
                className="auth-button compact-button discord-member-action-button"
                onClick={() => handleUpdateServerMemberRole(member, nextRole)}
                disabled={isUpdatingRole}
              >
                {isUpdatingRole
                  ? "Updating..."
                  : memberRole === "admin"
                    ? "Make member"
                    : "Make admin"}
              </button>
            ) : null}

            {canRemoveMember ? (
              <button
                type="button"
                className="auth-button auth-button-danger compact-button discord-member-action-button"
                onClick={() => handleRemoveServerMember(member)}
                disabled={isRemovingMember}
              >
                {isRemovingMember ? "Removing..." : "Remove"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-logo">YFNC</h1>
          <p>Loading app...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="server-page main-page-shell">
      <div className="server-layout main-layout-grid">
        <aside className="server-sidebar discord-sidebar-shell">
          <div className="discord-guilds-bar">
            <button
              type="button"
              onClick={handleSelectHome}
              className={`discord-guild-button discord-home-button${isDmView ? " discord-guild-button-active" : ""
                }`}
              title="Direct Messages"
            >
              <span className="discord-guild-initial">DM</span>

              {totalDmNotificationCount > 0 ? (
                <span className="discord-notification-badge discord-guild-notification-badge">
                  {formatBadgeCount(totalDmNotificationCount)}
                </span>
              ) : null}
            </button>

            <div className="discord-guild-divider" />

            <div className="discord-guild-list">
              {servers.map((server) => {
                const serverId = getServerId(server);
                const serverName = getServerName(server);
                const isActive = String(serverId) === String(activeServerId);
                const serverUnreadCount = getUnreadValue(unreadServerCounts, serverId);
                const serverMentionCount = getUnreadValue(mentionServerCounts, serverId);
                const hasServerActivity = serverUnreadCount > 0 || serverMentionCount > 0;


                return (
                  <button
                    key={serverId}
                    type="button"
                    onClick={() => handleSelectServer(serverId)}
                    className={`discord-guild-button${isActive ? " discord-guild-button-active" : ""
                      }${hasServerActivity && !isActive
                        ? " discord-guild-button-unread"
                        : ""
                      }`}
                    title={serverName}
                  >
                    <span className="discord-guild-initial">
                      {getInitial(serverName)}
                    </span>

                    {serverMentionCount > 0 ? (
                      <span className="discord-notification-badge discord-guild-notification-badge">
                        {formatMentionBadgeCount(serverMentionCount)}
                      </span>
                    ) : serverUnreadCount > 0 ? (
                      <span className="discord-notification-badge discord-guild-notification-badge">
                        {formatBadgeCount(serverUnreadCount)}
                      </span>
                    ) : null}
                  </button>
                );
              })}

              <button
                type="button"
                className="discord-guild-button discord-guild-create-button"
                onClick={() => {
                  setCreateServerError("");
                  setIsCreateServerModalOpen(true);
                }}
                title="Create Server"
              >
                <span className="discord-guild-create-plus">+</span>
              </button>
              <button
                type="button"
                className="discord-guild-button"
                onClick={() => {
                  setJoinInviteError("");
                  setJoinInviteSuccess("");
                  setJoinInviteCode("");
                  setIsJoinServerModalOpen(true);
                }}
                title="Join Server"
              >
                <span className="discord-guild-create-plus">→</span>
              </button>
            </div>
          </div>

          <div className="discord-sidebar-pane">
            {isDmView ? (
              <div className="discord-sidebar-pane-top">
                <div className="discord-search-wrap">
                  <input
                    type="text"
                    className="discord-search-input"
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    placeholder="Find or start a conversation"
                  />
                </div>

                <div className="discord-dm-nav">
                  <button
                    type="button"
                    className={`discord-dm-nav-button${showDmHomeView && activeDmSection === "friends"
                      ? " discord-dm-nav-button-active"
                      : ""
                      }`}
                    onClick={() => handleSelectDmSection("friends")}
                  >
                    Friends
                  </button>

                  <button
                    type="button"
                    className={`discord-dm-nav-button${showDmHomeView && activeDmSection === "add-friend"
                      ? " discord-dm-nav-button-active"
                      : ""
                      }`}
                    onClick={() => handleSelectDmSection("add-friend")}
                  >
                    Add Friend
                  </button>

                  <button
                    type="button"
                    className={`discord-dm-nav-button${showDmHomeView && activeDmSection === "requests"
                      ? " discord-dm-nav-button-active"
                      : ""
                      }${pendingFriendRequestCount > 0 ? " discord-dm-nav-button-unread" : ""}`}
                    onClick={() => handleSelectDmSection("requests")}
                  >
                    <span>Friend Requests</span>

                    {pendingFriendRequestCount > 0 ? (
                      <span className="discord-notification-badge discord-list-notification-badge">
                        {formatBadgeCount(pendingFriendRequestCount)}
                      </span>
                    ) : null}
                  </button>
                </div>

                <div className="discord-sidebar-divider" />
              </div>
            ) : (
              <div className="discord-sidebar-pane-top">
                <div className="discord-pane-header">
                  <p className="discord-pane-label">Server</p>
                  <h1 className="discord-pane-title">
                    {getServerName(activeServer)}
                  </h1>
                  <p className="discord-pane-subtitle">
                    {getServerDescription(activeServer) || "No description provided."}
                  </p>
                </div>

                <div className="discord-search-wrap">
                  <input
                    type="text"
                    className="discord-search-input"
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    placeholder="Search channels"
                  />
                </div>
              </div>
            )}

            {error && <p className="auth-error server-inline-error">{error}</p>}
            {serverError && !isDmView && (
              <p className="auth-error server-inline-error">{serverError}</p>
            )}
            {channelError && !isDmView && (
              <p className="auth-error server-inline-error">{channelError}</p>
            )}

            <div className="discord-sidebar-scroll">
              {isDmView ? (
                <section className="discord-section-block">
                  <div className="discord-section-heading">Direct Messages</div>
                  {directConversationError ? (
                    <p className="auth-error server-inline-error">
                      {directConversationError}
                    </p>
                  ) : null}

                  {filteredDirectConversations.length === 0 ? (
                    <p className="discord-helper-text">No direct conversations yet.</p>
                  ) : (
                    <div className="discord-dm-list">
                      {filteredDirectConversations.map((conversation) => {
                        const conversationId = getConversationId(conversation);
                        const isActive =
                          String(conversationId) === String(activeConversationId);
                        const presenceStatus =
                          getConversationPresenceStatus(conversation);
                        const unreadCount = getUnreadValue(
                          unreadDirectCounts,
                          conversationId
                        );

                        return (
                          <div
                            key={conversationId}
                            onMouseEnter={() => setHoveredConversationId(conversationId)}
                            onMouseLeave={() =>
                              setHoveredConversationId((current) =>
                                String(current) === String(conversationId) ? null : current
                              )
                            }
                            className="discord-list-row"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectConversation(conversationId);
                                setOpenConversationMenuId(null);
                              }}
                              className={`discord-dm-item${isActive ? " discord-dm-item-active" : ""
                                }${unreadCount > 0 && !isActive ? " discord-dm-item-unread" : ""
                                }`}

                            >
                              <div className="discord-dm-avatar">
                                {getInitial(getConversationOtherUsername(conversation))}
                                <span
                                  className={`discord-status-dot ${getPresenceColorClass(
                                    presenceStatus
                                  )}`}
                                />
                              </div>

                              <div className="discord-dm-content">
                                <div className="discord-dm-name-row">
                                  <span className="discord-dm-name">
                                    {getConversationOtherUsername(conversation)}
                                  </span>

                                  {unreadCount > 0 ? (
                                    <span className="discord-notification-badge discord-list-notification-badge">
                                      {formatBadgeCount(unreadCount)}
                                    </span>
                                  ) : (
                                    <span className="discord-dm-time">
                                      {formatTimestamp(
                                        getConversationLastTimestamp(conversation)
                                      )}
                                    </span>
                                  )}
                                </div>

                                <p className="discord-dm-preview">
                                  {getConversationLastMessage(conversation) || "No messages yet."}
                                </p>
                              </div>
                            </button>

                            {String(hoveredConversationId) === String(conversationId) ||
                              String(openConversationMenuId) === String(conversationId) ? (
                              <div className="discord-menu-anchor">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenConversationMenuId((current) =>
                                      String(current) === String(conversationId)
                                        ? null
                                        : conversationId
                                    );
                                  }}
                                  className="discord-account-action"
                                >
                                  ⋯
                                </button>

                                {String(openConversationMenuId) === String(conversationId) ? (
                                  <div className="discord-popover-menu">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleMute(
                                          "direct",
                                          conversationId,
                                          mutedDirectConversationIds.includes(String(conversationId))
                                        );
                                        setOpenConversationMenuId(null);
                                      }}
                                      className="auth-button compact-button"
                                      disabled={settingsActionKey === `direct-${conversationId}`}
                                    >
                                      {mutedDirectConversationIds.includes(String(conversationId))
                                        ? "Unmute DM"
                                        : "Mute DM"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenReportModal({
                                          userId: getConversationOtherUserId(conversation),
                                          username: getConversationOtherUsername(conversation),
                                          contextType: "direct_conversation",
                                          contextId: conversationId
                                        });
                                        setOpenConversationMenuId(null);
                                      }}
                                      className="auth-button compact-button"
                                    >
                                      Report user
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleBlockUser(
                                          getConversationOtherUserId(conversation),
                                          getConversationOtherUsername(conversation)
                                        );
                                        setOpenConversationMenuId(null);
                                      }}
                                      className="auth-button auth-button-danger compact-button discord-menu-button-danger"
                                      disabled={safetyActionKey === `block-${getConversationOtherUserId(conversation)}`}
                                    >
                                      Block user
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteDirectConversation(conversation);
                                      }}
                                      className="auth-button auth-button-danger compact-button discord-menu-button-danger"
                                      disabled={isDeletingConversation}
                                    >
                                      {isDeletingConversation ? "Deleting..." : "Delete DM"}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              ) : (
                <>
                  <section className="discord-section-block">
                    <div className="discord-section-heading">Text Channels</div>

                    {filteredChannels.length === 0 ? (
                      <p className="discord-helper-text">No channels found.</p>
                    ) : (
                      <div className="channel-list discord-channel-list">
                        {filteredChannels.map((channel) => {
                          const channelId = getChannelId(channel);
                          const isActive =
                            String(channelId) === String(activeChannelId);
                          const isGeneralChannel =
                            getChannelName(channel).trim().toLowerCase() === "general";
                          const unreadCount = getUnreadValue(
                            unreadChannelCounts,
                            channelId
                          );
                          const mentionCount = getUnreadValue(
                            mentionChannelCounts,
                            channelId
                          );
                          const hasChannelActivity = unreadCount > 0 || mentionCount > 0;

                          return (
                            <div
                              key={channelId}
                              onMouseEnter={() => setHoveredChannelId(channelId)}
                              onMouseLeave={() => setHoveredChannelId((current) =>
                                String(current) === String(channelId) ? null : current
                              )}
                              className="discord-list-row"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  handleSelectChannel(channelId);
                                  setOpenChannelMenuId(null);
                                }}
                                className={`channel-button discord-channel-button${isActive ? " channel-button-active" : ""
                                  }${hasChannelActivity && !isActive ? " discord-channel-button-unread" : ""
                                  }`}

                              >
                                <span className="channel-hash">#</span>
                                <span className="channel-name">
                                  {getChannelName(channel)}
                                </span>
                                {mentionCount > 0 ? (
                                  <span className="discord-notification-badge discord-list-notification-badge">
                                    {formatMentionBadgeCount(mentionCount)}
                                  </span>
                                ) : null}

                                {unreadCount > 0 ? (
                                  <span className="discord-notification-badge discord-list-notification-badge">
                                    {formatBadgeCount(unreadCount)}
                                  </span>
                                ) : null}
                              </button>

                              {String(hoveredChannelId) === String(channelId) ||
                                String(openChannelMenuId) === String(channelId) ? (
                                <div className="discord-menu-anchor">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenChannelMenuId((current) =>
                                        String(current) === String(channelId) ? null : channelId
                                      );
                                    }}
                                    className="discord-account-action"
                                  >
                                    ⋯
                                  </button>

                                  {String(openChannelMenuId) === String(channelId) ? (
                                    <div className="discord-popover-menu">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleMute(
                                            "channel",
                                            channelId,
                                            mutedChannelIds.includes(String(channelId))
                                          );
                                          setOpenChannelMenuId(null);
                                        }}
                                        className="auth-button compact-button"
                                        disabled={settingsActionKey === `channel-${channelId}`}
                                      >
                                        {mutedChannelIds.includes(String(channelId))
                                          ? `Unmute #${getChannelName(channel)}`
                                          : `Mute #${getChannelName(channel)}`}
                                      </button>

                                      {currentUserCanManageServer && !isGeneralChannel ? (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenChannelMenuId(null);
                                            handleDeleteChannel(channel);
                                          }}
                                          className="auth-button auth-button-danger compact-button discord-menu-button-danger"
                                          disabled={isDeletingChannel}
                                        >
                                          {isDeletingChannel ? "Deleting..." : `Delete #${getChannelName(channel)}`}
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {currentUserCanManageServer ? (
                    <section className="discord-section-block discord-utility-section">
                      <div className="discord-section-heading">Create Channel</div>

                      {createChannelError && (
                        <p className="auth-error server-inline-error">
                          {createChannelError}
                        </p>
                      )}

                      <form onSubmit={handleCreateChannel} className="discord-form-stack">
                        <input
                          id="channelName"
                          type="text"
                          className="auth-input compact-input"
                          value={channelName}
                          onChange={(e) => {
                            setChannelName(e.target.value);
                            setCreateChannelError("");
                          }}
                          placeholder="Enter channel name"
                        />

                        <button
                          type="submit"
                          className="auth-button compact-button"
                          disabled={isCreatingChannel}
                        >
                          {isCreatingChannel ? "Creating..." : "Create channel"}
                        </button>
                      </form>
                    </section>
                  ) : null}

                  {currentUserCanManageServer ? (
                    <section className="discord-section-block discord-utility-section">
                      <div className="discord-section-heading">Create Invite</div>

                    {inviteError && (
                      <p className="auth-error server-inline-error">{inviteError}</p>
                    )}

                    {inviteCode ? (
                      <button
                        type="button"
                        onClick={handleCopyInviteCode}
                        title="Copy code"
                        aria-label="Copy code"
                        className="discord-invite-code-button"
                      >
                        <div className="discord-invite-code-value">
                          {isInviteCopied ? "✓" : inviteCode}
                        </div>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className="auth-button compact-button"
                      onClick={handleCreateInvite}
                      disabled={isCreatingInvite || !activeServerId}
                    >
                      {isCreatingInvite ? "Generating code..." : "Generate code"}
                    </button>

                    {deleteChannelError && (
                      <p className="auth-error server-inline-error">
                        {deleteChannelError}
                      </p>
                    )}




                    </section>
                  ) : null}
                </>
              )}
            </div>

            <div className="discord-account-panel">
              <button
                type="button"
                className="discord-account-panel-user"
                onClick={handleOpenEditProfile}
                title="Edit profile"
                aria-label="Edit profile"
              >
                <div className="discord-account-avatar">
                  {getInitial(user?.username)}
                  <span
                    className={`discord-status-dot ${getPresenceColorClass(
                      currentUserPresence
                    )}`}
                  />
                </div>

                <div className="discord-account-meta">
                  <div className="discord-account-name">{user?.username}</div>
                  <div className="discord-account-status">
                    {currentUserPresence === "online" ? "Online" : "Offline"}
                  </div>
                </div>
              </button>

              <div className="discord-account-actions">
                <button
                  type="button"
                  className="discord-account-action"
                  onClick={handleLogout}
                  title="Log out"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        </aside>

        <main className="server-main discord-chat-panel">
          <div className="server-main-header discord-chat-header">
            <div className="discord-chat-header-left">
              {isDmView ? (
                activeConversationUser ? (
                  <>
                    <span
                      className={`discord-status-dot discord-header-status ${getPresenceColorClass(
                        activeConversationUser.presence_status
                      )}`}
                    />
                    <div>
                      <h2 className="server-main-title discord-chat-title">
                        {activeConversationUser.username}
                      </h2>
                      <p className="discord-chat-subtitle">
                        {activeConversationUser.presence_status === "online"
                          ? "Online"
                          : "Offline"}
                      </p>
                    </div>
                  </>
                ) : (
                  <div>
                    <h2 className="server-main-title discord-chat-title">
                      {activeDmSection === "requests"
                        ? "Friend Requests"
                        : activeDmSection === "add-friend"
                          ? "Add Friend"
                          : "Friends"}
                    </h2>
                    <p className="discord-chat-subtitle">
                      {activeDmSection === "requests"
                        ? "Manage incoming and outgoing requests"
                        : activeDmSection === "add-friend"
                          ? "Send a friend request by username"
                          : `${filteredFriends.length} friend${filteredFriends.length === 1 ? "" : "s"
                          }`}
                    </p>
                  </div>
                )
              ) : (
                <>
                  <span className="discord-channel-symbol">#</span>
                  <div>
                    <h2 className="server-main-title discord-chat-title">
                      {activeChannel ? getChannelName(activeChannel) : "Select a channel"}
                    </h2>
                    <p className="discord-chat-subtitle">
                      {activeServer
                        ? getServerName(activeServer)
                        : "No server selected"}
                    </p>
                  </div>
                </>
              )}
            </div>

            {((!isDmView && activeChannelId) || (isDmView && activeConversationId)) ? (
              <form
                onSubmit={handleSearchMessages}
                className="discord-message-search"
              >
                <input
                  type="text"
                  className="discord-message-search-input"
                  value={messageSearchTerm}
                  onChange={(e) => {
                    setMessageSearchTerm(e.target.value);
                    setMessageSearchError("");
                  }}
                  placeholder={isDmView ? "Search direct messages" : "Search messages"}
                />

                {isMessageSearchActive ? (
                  <button
                    type="button"
                    onClick={handleClearMessageSearch}
                    className="discord-message-search-button discord-message-search-clear"
                    disabled={isSearchingMessages}
                  >
                    Clear
                  </button>
                ) : null}

                <button
                  type="submit"
                  className="discord-message-search-button"
                  disabled={isSearchingMessages || !messageSearchTerm.trim()}
                >
                  {isSearchingMessages ? "Searching..." : "Search"}
                </button>
              </form>
            ) : null}

            {settingsActionError ? (
              <p className="auth-error server-inline-error discord-header-inline-error">
                {settingsActionError}
              </p>
            ) : null}

            {safetyActionError ? (
              <p className="auth-error server-inline-error discord-header-inline-error">
                {safetyActionError}
              </p>
            ) : null}

            {reportSuccess ? (
              <p className="auth-success server-inline-success discord-header-inline-error">
                {reportSuccess}
              </p>
            ) : null}

            {((!isDmView && activeServerId) || (isDmView && activeConversationId)) ? (
              <div className="discord-chat-header-actions">
                {!isDmView && activeServerId ? (
                  <button
                    type="button"
                    className="discord-header-action-button"
                    onClick={() => handleToggleMute("server", activeServerId, activeServerMuted)}
                    disabled={settingsActionKey === `server-${activeServerId}`}
                  >
                    {activeServerMuted ? "Unmute server" : "Mute server"}
                  </button>
                ) : null}

                {!isDmView && activeChannelId ? (
                  <button
                    type="button"
                    className="discord-header-action-button"
                    onClick={() => handleToggleMute("channel", activeChannelId, activeChannelMuted)}
                    disabled={settingsActionKey === `channel-${activeChannelId}`}
                  >
                    {activeChannelMuted ? "Unmute channel" : "Mute channel"}
                  </button>
                ) : null}

                {isDmView && activeConversationId ? (
                  <>
                    <button
                      type="button"
                      className="discord-header-action-button"
                      onClick={() => handleToggleMute("direct", activeConversationId, activeConversationMuted)}
                      disabled={settingsActionKey === `direct-${activeConversationId}`}
                    >
                      {activeConversationMuted ? "Unmute DM" : "Mute DM"}
                    </button>

                    {activeConversationUser ? (
                      <button
                        type="button"
                        className="discord-header-action-button"
                        onClick={() =>
                          handleOpenReportModal({
                            userId: activeConversationUser.user_id,
                            username: activeConversationUser.username,
                            contextType: "direct_conversation",
                            contextId: activeConversationId
                          })
                        }
                      >
                        Report
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <section className="server-messages-panel discord-messages-panel">
            {showComposer && pinnedMessageCount > 0 ? (
              <div className="discord-pinned-messages-panel">
                <button
                  type="button"
                  className="discord-pinned-messages-toggle"
                  onClick={() => setIsPinnedMessagesOpen((isOpen) => !isOpen)}
                >
                  <span>📌 {pinnedMessageCount} pinned message{pinnedMessageCount === 1 ? "" : "s"}</span>
                  <span>{isPinnedMessagesOpen ? "Hide" : "Show"}</span>
                </button>

                {isPinnedMessagesOpen ? (
                  <div className="discord-pinned-messages-list">
                    {pinnedMessages.map((pinnedMessage) => {
                      const pinnedMessageId = isDmView
                        ? getDirectMessageId(pinnedMessage)
                        : getMessageId(pinnedMessage);
                      const pinnedAuthor = isDmView
                        ? getDirectMessageAuthor(pinnedMessage)
                        : getMessageAuthor(pinnedMessage);
                      const pinnedContent = isDmView
                        ? getDirectMessageContent(pinnedMessage)
                        : getMessageContent(pinnedMessage);

                      return (
                        <button
                          key={pinnedMessageId}
                          type="button"
                          className="discord-pinned-message-item"
                          onClick={() => handleJumpToPinnedMessage(pinnedMessage)}
                        >
                          <span className="discord-pinned-message-author">
                            {pinnedAuthor}
                          </span>
                          <span className="discord-pinned-message-content">
                            {formatReplyPreviewContent(pinnedContent)}
                          </span>
                          <span className="discord-pinned-message-meta">
                            Pinned by {getMessagePinnedBy(pinnedMessage)}
                            {getMessagePinnedAt(pinnedMessage)
                              ? ` · ${formatTimestamp(getMessagePinnedAt(pinnedMessage))}`
                              : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            {showComposer && (messageSearchError || isMessageSearchActive) ? (
              <div className="discord-message-search-status">
                {messageSearchError ? (
                  <p className="auth-error server-inline-error server-inline-error-tight">
                    {messageSearchError}
                  </p>
                ) : activeSearchCount === 0 ? (
                  <p className="discord-message-search-status-text">
                    {activeMessageSearchEmptyText}
                  </p>
                ) : (
                  <div className="discord-message-search-navigation">
                    <span className="discord-message-search-status-text">
                      {activeSearchIndex + 1} of {activeSearchCount} {activeMessageSearchLabel}
                      {activeSearchCount === 1 ? "" : "s"} for “{messageSearchTerm.trim()}”
                    </span>

                    <button
                      type="button"
                      className="discord-message-search-button discord-message-search-nav-button"
                      onClick={handlePreviousSearchMatch}
                      disabled={isSearchingMessages || activeSearchIndex <= 0}
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      className="discord-message-search-button discord-message-search-nav-button"
                      onClick={handleNextSearchMatch}
                      disabled={
                        isSearchingMessages ||
                        activeSearchIndex >= activeSearchCount - 1
                      }
                    >
                      ↓
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {showDmHomeView ? (
              <div className="discord-home-panel">
                {activeDmSection === "friends" ? (
                  <>
                    <div className="discord-home-header">
                      <p className="discord-home-section-label">Friends</p>
                      <h3 className="discord-home-title">All Friends</h3>
                      <p className="discord-home-subtitle-large">
                        Start a direct message by clicking on a friend below.
                      </p>
                    </div>

                    {removeFriendError ? (
                      <p className="auth-error server-inline-error server-inline-error-tight">
                        {removeFriendError}
                      </p>
                    ) : null}

                    {filteredFriends.length === 0 ? (
                      <div className="discord-home-empty-card">
                        No friends found.
                      </div>
                    ) : (
                      <div className="discord-friends-home-list">
                        {filteredFriends.map((friend) => {
                          const presenceStatus = getFriendPresenceStatus(friend);

                          return (
                            <div
                              key={getFriendId(friend)}
                              className="discord-friend-home-card"
                            >
                              <div className="discord-friend-home-main">
                                <div className="discord-dm-avatar">
                                  {getInitial(getFriendName(friend))}
                                  <span
                                    className={`discord-status-dot ${getPresenceColorClass(
                                      presenceStatus
                                    )}`}
                                  />
                                </div>

                                <div className="discord-friend-home-info">
                                  <div className="discord-friend-home-name">
                                    {getFriendName(friend)}
                                  </div>
                                  <div className="discord-friend-home-email">
                                    {getFriendEmail(friend)}
                                  </div>
                                  <div className="discord-friend-home-status">
                                    {presenceStatus === "online"
                                      ? "Online"
                                      : "Offline"}
                                  </div>
                                </div>
                              </div>

                              <div className="discord-friend-home-actions">
                                <button
                                  type="button"
                                  className="auth-button discord-friend-home-action"
                                  onClick={() => handleStartDirectConversation(friend)}
                                >
                                  Message
                                </button>

                                <button
                                  type="button"
                                  className="auth-button auth-button-danger discord-friend-home-action discord-friend-home-action-danger"
                                  onClick={() => handleRemoveFriend(getFriendId(friend))}
                                  disabled={String(removingFriendId) === String(getFriendId(friend))}
                                >
                                  {String(removingFriendId) === String(getFriendId(friend))
                                    ? "Removing..."
                                    : "Remove"}
                                </button>
                                <button
                                  type="button"
                                  className="auth-button discord-friend-home-action"
                                  onClick={() =>
                                    handleOpenReportModal({
                                      userId: getFriendId(friend),
                                      username: getFriendName(friend),
                                      contextType: "profile"
                                    })
                                  }
                                >
                                  Report
                                </button>

                                <button
                                  type="button"
                                  className="auth-button auth-button-danger discord-friend-home-action discord-friend-home-action-danger"
                                  onClick={() => handleBlockUser(getFriendId(friend), getFriendName(friend))}
                                  disabled={safetyActionKey === `block-${getFriendId(friend)}`}
                                >
                                  {safetyActionKey === `block-${getFriendId(friend)}`
                                    ? "Blocking..."
                                    : "Block"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {blockedUsers.length > 0 ? (
                      <div className="discord-blocked-users-panel">
                        <div className="discord-section-heading">Blocked Users</div>
                        <div className="discord-blocked-users-list">
                          {blockedUsers.map((blockedUser) => (
                            <div
                              key={blockedUser.user_id || blockedUser.block_id}
                              className="discord-blocked-user-row"
                            >
                              <span>{blockedUser.username}</span>
                              <button
                                type="button"
                                className="auth-button compact-button"
                                onClick={() => handleUnblockUser(blockedUser.user_id)}
                                disabled={safetyActionKey === `unblock-${blockedUser.user_id}`}
                              >
                                {safetyActionKey === `unblock-${blockedUser.user_id}`
                                  ? "Unblocking..."
                                  : "Unblock"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : activeDmSection === "add-friend" ? (
                  <>
                    <div className="discord-home-header">
                      <p className="discord-home-section-label">Add Friend</p>
                      <h3 className="discord-home-title">Add Friend by Username</h3>
                      <p className="discord-home-subtitle-large">
                        Usernames are unique, so enter the exact username to send a request.
                      </p>
                    </div>

                    <div className="discord-home-empty-card discord-add-friend-card">
                      <form onSubmit={handleAddFriend} className="discord-add-friend-form">
                        {addFriendError && (
                          <p className="auth-error server-inline-error">{addFriendError}</p>
                        )}

                        {addFriendSuccess && (
                          <p className="auth-success discord-inline-success">
                            {addFriendSuccess}
                          </p>
                        )}

                        <input
                          type="text"
                          className="auth-input compact-input"
                          value={friendUsername}
                          onChange={(e) => {
                            setFriendUsername(e.target.value);
                            setAddFriendError("");
                            setAddFriendSuccess("");
                          }}
                          placeholder="Enter username"
                        />

                        <button
                          type="submit"
                          className="auth-button compact-button"
                          disabled={isAddingFriend}
                        >
                          {isAddingFriend ? "Sending..." : "Send friend request"}
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="discord-home-header">
                      <p className="discord-home-section-label">Friend Requests</p>
                      <h3 className="discord-home-title">Incoming and Outgoing Requests</h3>
                      <p className="discord-home-subtitle-large">
                        Review incoming requests and track the ones you already sent.
                      </p>
                    </div>

                    {friendRequestsError ? (
                      <p className="auth-error server-inline-error">
                        {friendRequestsError}
                      </p>
                    ) : null}

                    {isFriendRequestsLoading ? (
                      <div className="discord-home-empty-card">
                        Loading friend requests...
                      </div>
                    ) : (
                      <div className="discord-friends-home-list">
                        <div className="discord-home-header">
                          <p className="discord-home-section-label">
                            Incoming — {incomingFriendRequests.length}
                          </p>
                        </div>

                        {incomingFriendRequests.length === 0 ? (
                          <div className="discord-home-empty-card">
                            No incoming friend requests.
                          </div>
                        ) : (
                          incomingFriendRequests.map((request) => {
                            const requestId = getFriendRequestId(request);
                            const isProcessing =
                              String(processingFriendRequestId) === String(requestId);

                            return (
                              <div
                                key={requestId}
                                className="discord-friend-home-card"
                              >
                                <div className="discord-friend-home-main">
                                  <div className="discord-dm-avatar">
                                    {getInitial(getFriendRequestSenderName(request))}
                                  </div>

                                  <div className="discord-friend-home-info">
                                    <div className="discord-friend-home-name">
                                      {getFriendRequestSenderName(request)}
                                    </div>
                                    <div className="discord-friend-home-email">
                                      {getFriendRequestSenderEmail(request)}
                                    </div>
                                    <div className="discord-friend-home-status">
                                      Received{" "}
                                      {formatTimestamp(
                                        getFriendRequestTimestamp(request)
                                      ) || "recently"}
                                    </div>
                                  </div>
                                </div>

                                <div className="discord-request-actions-row">
                                  <button
                                    type="button"
                                    className="auth-button discord-friend-home-action"
                                    onClick={() =>
                                      handleRespondToFriendRequest(requestId, "accept")
                                    }
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? "Working..." : "Accept"}
                                  </button>

                                  <button
                                    type="button"
                                    className="auth-button auth-button-danger discord-friend-home-action"
                                    onClick={() =>
                                      handleRespondToFriendRequest(requestId, "reject")
                                    }
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? "Working..." : "Reject"}
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}

                        <div className="discord-home-header">
                          <p className="discord-home-section-label">
                            Outgoing — {outgoingFriendRequests.length}
                          </p>
                        </div>

                        {outgoingFriendRequests.length === 0 ? (
                          <div className="discord-home-empty-card">
                            No outgoing friend requests.
                          </div>
                        ) : (
                          outgoingFriendRequests.map((request) => (
                            <div
                              key={getFriendRequestId(request)}
                              className="discord-friend-home-card"
                            >
                              <div className="discord-friend-home-main">
                                <div className="discord-dm-avatar">
                                  {getInitial(getFriendRequestReceiverName(request))}
                                </div>

                                <div className="discord-friend-home-info">
                                  <div className="discord-friend-home-name">
                                    {getFriendRequestReceiverName(request)}
                                  </div>
                                  <div className="discord-friend-home-email">
                                    {getFriendRequestReceiverEmail(request)}
                                  </div>
                                  <div className="discord-friend-home-status">
                                    Pending{" "}
                                    {formatTimestamp(
                                      getFriendRequestTimestamp(request)
                                    ) || ""}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : isMessagesLoading ? (
              <div className="server-state-message discord-empty-state">
                Loading messages...
              </div>
            ) : messageError ? (
              <div className="server-state-message server-state-error discord-empty-state">
                {messageError}
              </div>
            ) : !isDmView && !activeChannelId ? (
              <div className="server-state-message discord-empty-state">
                Select a channel to view messages.
              </div>
            ) : displayedMessages.length === 0 ? (
              <div className="server-state-message discord-empty-state">
                {isMessageSearchActive
                  ? activeMessageSearchEmptyText
                  : "No messages yet."}
              </div>
            ) : (
              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="message-list discord-message-list"
              >
                {isLoadingOlderMessages ? (
                  <div className="discord-loading-older-messages">
                    Loading older messages...
                  </div>
                ) : null}

                {displayedMessages.map((message, index) => {
                  const createdTimestampValue = isDmView
                    ? getDirectMessageTimestamp(message)
                    : getMessageTimestamp(message);

                  const updatedTimestampValue = isDmView
                    ? getDirectMessageUpdatedTimestamp(message)
                    : getMessageUpdatedTimestamp(message);

                  const timestamp = formatTimestamp(createdTimestampValue);

                  const messageWasEdited = isEditedMessage(
                    message,
                    createdTimestampValue,
                    updatedTimestampValue
                  );

                  const author = isDmView
                    ? getDirectMessageAuthor(message)
                    : getMessageAuthor(message);

                  const content = isDmView
                    ? getDirectMessageContent(message)
                    : getMessageContent(message);

                  const replyPreview = getReplyPreview(message);

                  const attachments = getMessageAttachments(message);
                  const reactions = getMessageReactions(message);
                  const isThisMessagePinned = messageIsPinned(message);

                  const key = isDmView
                    ? getDirectMessageId(message) || index
                    : getMessageId(message) || index;

                  const messageAuthorId = isDmView
                    ? getDirectMessageSenderId(message)
                    : getMessageAuthorId(message);

                  const isOwnMessage =
                    currentUserId &&
                    String(messageAuthorId) === String(currentUserId);

                  const messageIdForDelete = isDmView
                    ? getDirectMessageId(message)
                    : getMessageId(message);

                  const messageDeleteKey = `${isDmView ? "dm" : "channel"}-${messageIdForDelete}`;
                  const isThisMessageDeleting = deletingMessageKey === messageDeleteKey;
                  const isThisMessageEditing = editingMessageKey === messageDeleteKey;
                  const isThisMessageSaving = savingEditedMessageKey === messageDeleteKey;
                  const isThisMessagePinning = pinningMessageKey === messageDeleteKey;
                  const canPinThisMessage = isDmView || currentUserCanManageServer;
                  const isActiveSearchMessage =
                    activeSearchMessageId &&
                    messageIdForDelete &&
                    String(activeSearchMessageId) === String(messageIdForDelete);

                  const currentUserWasMentioned =
                    !isDmView &&
                    messageMentionsCurrentUser({
                      message,
                      content,
                      currentUserId,
                      currentUsername: user?.username,
                      isOwnMessage
                    });

                  const shouldShowMentionEmphasis =
                    currentUserWasMentioned &&
                    messageIdForDelete &&
                    highlightedMentionMessageIds.has(String(messageIdForDelete));

                  return (
                    <div
                      key={key}
                      data-message-key={String(messageIdForDelete || key)}
                      className={`discord-message-row${isOwnMessage ? " discord-message-row-own" : ""}${isActiveSearchMessage ? " discord-message-row-search-active" : ""}${shouldShowMentionEmphasis ? " discord-message-row-mentioned" : ""}`}
                    >
                      {!isOwnMessage ? (
                        <div className="discord-message-avatar">
                          {getInitial(author)}
                        </div>
                      ) : null}

                      <div className="discord-message-body">
                        {!isThisMessageEditing ? (
                          <div
                            className={`discord-message-menu${openMessageMenuKey === messageDeleteKey ? " discord-message-menu-open" : ""}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="discord-message-menu-trigger"
                              onClick={() =>
                                setOpenMessageMenuKey((currentKey) =>
                                  currentKey === messageDeleteKey ? null : messageDeleteKey
                                )
                              }
                              disabled={!messageIdForDelete}
                              aria-label="Message actions"
                              title="Message actions"
                            >
                              ⋯
                            </button>

                            {openMessageMenuKey === messageDeleteKey ? (
                              <div className="discord-message-options-menu">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMessageMenuKey(null);
                                    handleStartReplyingToMessage(message);
                                  }}
                                  disabled={!messageIdForDelete}
                                  className="discord-message-option"
                                >
                                  Reply
                                </button>

                                {canPinThisMessage ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMessageMenuKey(null);
                                      handleTogglePinMessage(message);
                                    }}
                                    disabled={!messageIdForDelete || isThisMessagePinning}
                                    className="discord-message-option"
                                  >
                                    {isThisMessagePinning
                                      ? "Updating..."
                                      : isThisMessagePinned
                                        ? "Unpin"
                                        : "Pin"}
                                  </button>
                                ) : null}

                                <div className="discord-message-reaction-picker">
                                  {QUICK_REACTION_EMOJIS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => {
                                        setOpenMessageMenuKey(null);
                                        handleToggleMessageReaction(message, emoji);
                                      }}
                                      disabled={
                                        !messageIdForDelete ||
                                        reactingMessageKey === `${messageDeleteKey}-${emoji}`
                                      }
                                      className="discord-message-reaction-option"
                                      aria-label={`React with ${emoji}`}
                                      title={`React with ${emoji}`}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>

                                {isOwnMessage ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMessageMenuKey(null);
                                      handleStartEditingMessage(message);
                                    }}
                                    disabled={!messageIdForDelete}
                                    className="discord-message-option"
                                  >
                                    Edit
                                  </button>
                                ) : null}

                                {isOwnMessage || (!isDmView && currentUserCanManageServer) ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMessageMenuKey(null);
                                      handleDeleteChatMessage(message);
                                    }}
                                    disabled={isThisMessageDeleting || !messageIdForDelete}
                                    className="discord-message-option discord-message-option-danger"
                                  >
                                    {isThisMessageDeleting ? "Deleting..." : "Delete"}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {replyPreview ? (
                          <div className="discord-reply-preview">
                            <div className="discord-reply-author">
                              Replying to {getReplyPreviewAuthor(replyPreview)}
                            </div>

                            <div className="discord-reply-content">
                              {formatReplyPreviewContent(getReplyPreviewContent(replyPreview))}
                            </div>
                          </div>
                        ) : null}

                        {!isOwnMessage ? (
                          <div className="discord-message-meta">
                            <span className="discord-message-author">{author}</span>

                            {timestamp && (
                              <span className="discord-message-time">{timestamp}</span>
                            )}

                            {messageWasEdited ? (
                              <span className="discord-message-time">edited</span>
                            ) : null}

                            {isThisMessagePinned ? (
                              <span className="discord-message-pinned-pill">Pinned</span>
                            ) : null}

                            {shouldShowMentionEmphasis ? (
                              <span className="discord-message-mentioned-pill">
                                new mention
                              </span>
                            ) : null}
                          </div>
                        ) : null}

                        {isThisMessageEditing ? (
                          <div className="discord-edit-form">
                            <textarea
                              value={editingMessageContent}
                              onChange={(e) => {
                                setEditingMessageContent(e.target.value);
                                setMessageError("");
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSaveEditedMessage(message);
                                }

                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  handleCancelEditingMessage();
                                }
                              }}
                              className="discord-edit-textarea"
                              autoFocus
                            />

                            <div className="discord-edit-actions">
                              <button
                                type="button"
                                onClick={handleCancelEditingMessage}
                                disabled={isThisMessageSaving}
                                className="auth-button auth-button-secondary discord-edit-button"
                              >
                                Cancel
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSaveEditedMessage(message)}
                                disabled={isThisMessageSaving}
                                className="auth-button discord-edit-button"
                              >
                                {isThisMessageSaving ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : content ? (
                          <p className="discord-message-text">
                            {renderHighlightedMessageText({
                              content,
                              searchTerm: isMessageSearchActive ? messageSearchTerm : "",
                              mentionUsername: shouldShowMentionEmphasis
                                ? user?.username
                                : ""
                            })}

                            {isOwnMessage && timestamp ? (
                              <span className="discord-own-message-time">
                                {timestamp}
                                {messageWasEdited ? " · edited" : ""}
                                {isThisMessagePinned ? " · pinned" : ""}
                                {isThisMessagePinned ? " · pinned" : ""}
                              </span>
                            ) : null}
                          </p>
                        ) : isOwnMessage && timestamp ? (
                          <p className="discord-message-text">
                            <span className="discord-own-message-time">
                              {timestamp}
                              {messageWasEdited ? " · edited" : ""}
                            </span>
                          </p>
                        ) : null}

                        {attachments.length > 0 ? (
                          <div className="discord-attachments">
                            {attachments.map((attachment) => (
                              <div
                                key={
                                  attachment.attachment_id ||
                                  attachment.direct_message_id ||
                                  attachment.file_url
                                }
                              >
                                {renderAttachmentPreview(attachment, setPreviewAttachment)}
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {reactions.length > 0 ? (
                          <div className="discord-message-reactions">
                            {reactions.map((reaction) => {
                              const emoji = getReactionEmoji(reaction);
                              const reactionCount = getReactionCount(reaction);

                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  className={`discord-message-reaction-chip${
                                    userReactedToReaction(reaction)
                                      ? " discord-message-reaction-chip-active"
                                      : ""
                                  }`}
                                  onClick={() => handleToggleMessageReaction(message, emoji)}
                                  disabled={
                                    !messageIdForDelete ||
                                    reactingMessageKey === `${messageDeleteKey}-${emoji}`
                                  }
                                  title={`React with ${emoji}`}
                                >
                                  <span>{emoji}</span>
                                  <span>{reactionCount}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {showComposer && activeTypingText ? (
            <div className="discord-typing-indicator">{activeTypingText}</div>
          ) : null}

          {showComposer ? (
            <form onSubmit={handleSendMessage} className="server-message-form discord-composer">
              {messageError && (
                <p className="auth-error server-inline-error server-inline-error-tight">
                  {messageError}
                </p>
              )}

              {selectedReplyMessage ? (
                <div className="discord-composer-preview">
                  <div className="discord-composer-preview-body">
                    <div className="discord-composer-preview-title">
                      Replying to{" "}
                      {isDmView
                        ? getDirectMessageAuthor(selectedReplyMessage)
                        : getMessageAuthor(selectedReplyMessage)}
                    </div>

                    <div className="discord-composer-preview-content">
                      {formatReplyPreviewContent(
                        isDmView
                          ? getDirectMessageContent(selectedReplyMessage)
                          : getMessageContent(selectedReplyMessage)
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelReplyingToMessage}
                    className="discord-remove-preview-button"
                    aria-label="Cancel reply"
                    title="Cancel reply"
                  >
                    ×
                  </button>
                </div>
              ) : null}

              {selectedAttachment ? (
                <div className="discord-selected-attachment">
                  <span className="discord-selected-attachment-name">
                    📎 {selectedAttachment.name}{" "}
                    <span className="discord-selected-attachment-size">
                      {formatFileSize(selectedAttachment.size)}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={handleRemoveSelectedAttachment}
                    className="discord-remove-preview-button"
                    aria-label="Remove attachment"
                    title="Remove attachment"
                  >
                    ×
                  </button>
                </div>
              ) : null}

              <div className="discord-composer-shell">
                <div
                  ref={emojiPickerRef}
                  className="discord-composer-tools"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ATTACHMENT_ACCEPT_TYPES}
                    onChange={handleAttachmentChange}
                    hidden
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={
                      isSendingMessage ||
                      (isDmView && !activeConversationId) ||
                      (!isDmView && !activeChannelId)
                    }
                    title="Add attachment"
                    aria-label="Add attachment"
                    className="discord-icon-button"
                  >
                    📎
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEmojiPickerOpen((isOpen) => !isOpen)}
                    disabled={
                      (isDmView && !activeConversationId) ||
                      (!isDmView && !activeChannelId)
                    }
                    title="Add emoji"
                    aria-label="Add emoji"
                    className="discord-icon-button"
                  >
                    😊
                  </button>

                  {isEmojiPickerOpen ? (
                    <div className="discord-emoji-picker-popover">
                      <EmojiPicker
                        theme={Theme.DARK}
                        onEmojiClick={handleAddEmoji}
                        previewConfig={{
                          showPreview: false
                        }}
                        searchDisabled={false}
                        skinTonesDisabled={false}
                        height={420}
                        width={330}
                      />
                    </div>
                  ) : null}
                </div>

                {isMentionMenuOpen ? (
                  <div className="discord-mention-suggestions">
                    {mentionSuggestions.length > 0 ? (
                      mentionSuggestions.map((member, index) => {
                        const memberName = getMemberName(member);
                        const memberEmail = getMemberEmail(member);
                        const presenceStatus = getMemberPresenceStatus(member);

                        return (
                          <button
                            key={getMemberUserId(member) || memberName}
                            type="button"
                            className={`discord-mention-suggestion${
                              index === activeMentionIndex
                                ? " discord-mention-suggestion-active"
                                : ""
                            }`}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              insertMention(member);
                            }}
                            onMouseEnter={() => setActiveMentionIndex(index)}
                          >
                            <span className="discord-mention-avatar">
                              {getInitial(memberName)}
                              <span
                                className={`discord-status-dot ${getPresenceColorClass(
                                  presenceStatus
                                )}`}
                              />
                            </span>

                            <span className="discord-mention-meta">
                              <span className="discord-mention-name">
                                @{memberName}
                              </span>

                              {memberEmail ? (
                                <span className="discord-mention-email">
                                  {memberEmail}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="discord-mention-empty">
                        No matching members
                      </div>
                    )}
                  </div>
                ) : null}

                <textarea
                  ref={messageInputRef}
                  className="message-input discord-composer-input"
                  placeholder={
                    isDmView
                      ? activeConversationUser
                        ? `Message @${activeConversationUser.username}`
                        : "Select a direct conversation"
                      : activeChannel
                        ? `Message #${getChannelName(activeChannel)}`
                        : "Select a channel"
                  }
                  value={messageContent}
                  onChange={handleMessageInputChange}
                  onClick={handleMessageInputCursorChange}
                  onKeyUp={handleMessageInputKeyUp}
                  onKeyDown={handleMessageKeyDown}
                  onBlur={() => {
                    stopTyping();
                    window.setTimeout(() => closeMentionMenu(), 120);
                  }}
                  disabled={
                    (isDmView && !activeConversationId) ||
                    (!isDmView && !activeChannelId)
                  }
                />

                <button
                  type="submit"
                  className="auth-button discord-send-button"
                  disabled={
                    isSendingMessage ||
                    (isDmView && !activeConversationId) ||
                    (!isDmView && !activeChannelId)
                  }
                >
                  {isSendingMessage ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          ) : null}
        </main>

        <aside className="server-members-panel discord-right-pane">
          {isDmView ? (
            <>
              <div className="discord-right-pane-header">
                <h2 className="server-members-title">
                  {activeConversationUser ? "Profile" : "Account"}
                </h2>
              </div>

              {activeConversationUser ? (
                <div className="discord-profile-card">
                  <div className="discord-profile-banner" />
                  <div className="discord-profile-avatar large-avatar">
                    {getInitial(activeConversationUser.username)}
                    <span
                      className={`discord-status-dot discord-profile-status ${getPresenceColorClass(
                        activeConversationUser.presence_status
                      )}`}
                    />
                  </div>
                  <div className="discord-profile-name">
                    {activeConversationUser.username}
                  </div>
                  <div className="discord-profile-meta">
                    {activeConversationUser.email}
                  </div>
                  <div className="discord-profile-meta discord-profile-presence">
                    {activeConversationUser.presence_status === "online"
                      ? "Online"
                      : "Offline"}
                  </div>
                  {activeConversationIsFriend ? (
                    <>
                      {removeFriendError ? (
                        <p className="auth-error discord-profile-action-error">
                          {removeFriendError}
                        </p>
                      ) : null}

                      <button
                        type="button"
                        className="auth-button auth-button-danger discord-profile-action-button"
                        onClick={() => handleRemoveFriend(activeConversationUser.user_id)}
                        disabled={
                          String(removingFriendId) === String(activeConversationUser.user_id)
                        }
                      >
                        {String(removingFriendId) === String(activeConversationUser.user_id)
                          ? "Removing..."
                          : "Remove friend"}
                      </button>
                    </>
                  ) : null}
                </div>
              ) : (
                <div className="discord-profile-card compact-profile-card">
                  <div className="discord-profile-name">{user?.username}</div>
                  <div className="discord-profile-meta">{user?.email}</div>
                  <div className="discord-profile-meta">
                    Status: {currentUserPresence === "online" ? "Online" : "Offline"}
                  </div>
                  <div className="discord-profile-meta">Friends: {friends.length}</div>
                  <div className="discord-profile-meta">
                    Direct conversations: {directConversations.length}
                  </div>

                  {profileSuccess ? (
                    <p className="auth-success discord-profile-action-success">
                      {profileSuccess}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    className="auth-button discord-profile-action-button"
                    onClick={handleOpenEditProfile}
                  >
                    Edit profile
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="discord-right-pane-header">
                <h2 className="server-members-title">Members</h2>
              </div>

              {membersError && (
                <p className="auth-error server-inline-error">{membersError}</p>
              )}

              {serverMemberActionError && (
                <p className="auth-error server-inline-error">
                  {serverMemberActionError}
                </p>
              )}

              <div className="server-members-list discord-member-groups">
                <div className="discord-members-group">
                  <div className="discord-members-group-title">
                    Online — {onlineMembers.length}
                  </div>

                  {onlineMembers.length === 0 ? (
                    <p className="server-members-empty">No members online.</p>
                  ) : (
                    <div className="server-members-list discord-member-list">
                      {onlineMembers.map(renderServerMember)}
                    </div>
                  )}
                </div>

                <div className="discord-members-group">
                  <div className="discord-members-group-title">
                    Offline — {offlineMembers.length}
                  </div>

                  {offlineMembers.length === 0 ? (
                    <p className="server-members-empty">No members offline.</p>
                  ) : (
                    <div className="server-members-list discord-member-list">
                      {offlineMembers.map(renderServerMember)}
                    </div>
                  )}
                </div>
              </div>

              {deleteServerError && (
                <p className="auth-error server-inline-error">
                  {deleteServerError}
                </p>
              )}

              {activeServer && (
                <button
                  type="button"
                  className="auth-button auth-button-danger compact-button discord-danger-button"
                  onClick={handleDeleteOrLeaveServer}
                  disabled={isDeletingServer}
                >
                  {isDeletingServer
                    ? currentUserIsOwner
                      ? "Deleting..."
                      : "Leaving..."
                    : currentUserIsOwner
                      ? "Delete server"
                      : "Leave server"}
                </button>
              )}
            </>
          )}
        </aside>
      </div>

      {isEditProfileModalOpen ? (
        <div
          className="discord-create-server-backdrop"
          onClick={handleCloseEditProfile}
        >
          <div
            className="discord-create-server-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="discord-modal-header">
              <h2 className="discord-modal-title">Edit Profile</h2>
              <p className="discord-modal-subtitle">
                Update the username and email shown across your account.
              </p>
            </div>

            {profileError ? (
              <p className="auth-error server-inline-error">{profileError}</p>
            ) : null}

            <form onSubmit={handleUpdateProfile} className="discord-form-stack">
              <label className="auth-label" htmlFor="profile_username">
                Username
              </label>
              <input
                id="profile_username"
                name="username"
                type="text"
                className="auth-input compact-input"
                value={profileFormData.username}
                onChange={handleProfileFormChange}
                placeholder="Username"
                maxLength="50"
              />

              <label className="auth-label" htmlFor="profile_email">
                Email
              </label>
              <input
                id="profile_email"
                name="email"
                type="email"
                className="auth-input compact-input"
                value={profileFormData.email}
                onChange={handleProfileFormChange}
                placeholder="Email address"
                maxLength="100"
              />

              <div className="discord-modal-actions">
                <button
                  type="button"
                  className="auth-button auth-button-secondary compact-button"
                  onClick={handleCloseEditProfile}
                  disabled={isUpdatingProfile}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="auth-button compact-button"
                  disabled={isUpdatingProfile}
                >
                  {isUpdatingProfile ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {previewAttachment ? (
        <div
          className="discord-create-server-backdrop discord-attachment-preview-backdrop"
          onClick={() => setPreviewAttachment(null)}
        >
          <div
            className="discord-attachment-preview-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="discord-modal-header discord-attachment-preview-header">
              <div>
                <h2 className="discord-modal-title">{getAttachmentName(previewAttachment)}</h2>
                <p className="discord-modal-subtitle">
                  {getAttachmentKind(previewAttachment)}
                  {getAttachmentSize(previewAttachment)
                    ? ` · ${formatFileSize(getAttachmentSize(previewAttachment))}`
                    : ""}
                </p>
              </div>

              <button
                type="button"
                className="discord-remove-preview-button"
                onClick={() => setPreviewAttachment(null)}
                aria-label="Close preview"
                title="Close preview"
              >
                ×
              </button>
            </div>

            <div className="discord-attachment-preview-body">
              {isImageAttachment(previewAttachment) ? (
                <img
                  src={getAttachmentUrl(previewAttachment)}
                  alt={getAttachmentName(previewAttachment)}
                  className="discord-attachment-preview-image"
                />
              ) : isVideoAttachment(previewAttachment) ? (
                <video
                  controls
                  src={getAttachmentUrl(previewAttachment)}
                  className="discord-attachment-preview-video"
                />
              ) : isAudioAttachment(previewAttachment) ? (
                <audio
                  controls
                  src={getAttachmentUrl(previewAttachment)}
                  className="discord-attachment-audio"
                />
              ) : null}
            </div>

            <div className="discord-modal-actions">
              <a
                href={getAttachmentUrl(previewAttachment)}
                target="_blank"
                rel="noreferrer"
                download
                className="auth-button compact-button discord-modal-link-button"
              >
                Download
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {reportModal.isOpen ? (
        <div
          className="discord-create-server-backdrop"
          onClick={handleCloseReportModal}
        >
          <div
            className="discord-create-server-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="discord-modal-header">
              <h2 className="discord-modal-title">Report {reportModal.username}</h2>
              <p className="discord-modal-subtitle">
                Send a short moderation note so the report can be reviewed later.
              </p>
            </div>

            {safetyActionError ? (
              <p className="auth-error server-inline-error">{safetyActionError}</p>
            ) : null}

            <form onSubmit={handleSubmitReport} className="discord-form-stack">
              <textarea
                className="auth-input compact-input compact-textarea"
                value={reportReason}
                onChange={(e) => {
                  setReportReason(e.target.value);
                  setSafetyActionError("");
                }}
                placeholder="Reason for reporting this user"
                rows="4"
                maxLength="1000"
              />

              <div className="discord-modal-actions">
                <button
                  type="button"
                  className="auth-button auth-button-secondary compact-button"
                  onClick={handleCloseReportModal}
                  disabled={isSubmittingReport}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="auth-button compact-button"
                  disabled={isSubmittingReport}
                >
                  {isSubmittingReport ? "Submitting..." : "Submit report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isJoinServerModalOpen ? (
        <div
          className="discord-create-server-backdrop"
          onClick={() => setIsJoinServerModalOpen(false)}
        >
          <div
            className="discord-create-server-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="discord-modal-header">
              <h2 className="discord-modal-title">Join a Server</h2>
              <p className="discord-modal-subtitle">
                Enter an invite code to join a server.
              </p>
            </div>

            {joinInviteError ? (
              <p className="auth-error server-inline-error">{joinInviteError}</p>
            ) : null}

            {joinInviteSuccess ? (
              <p className="auth-success discord-inline-success">{joinInviteSuccess}</p>
            ) : null}

            <form onSubmit={handleJoinInvite} className="discord-form-stack">
              <input
                type="text"
                className="auth-input compact-input"
                value={joinInviteCode}
                onChange={(e) => {
                  setJoinInviteCode(e.target.value);
                  setJoinInviteError("");
                  setJoinInviteSuccess("");
                }}
                placeholder="Enter server invite code"
              />

              <div className="discord-modal-actions">
                <button
                  type="button"
                  className="auth-button auth-button-secondary compact-button"
                  onClick={() => setIsJoinServerModalOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="auth-button compact-button"
                  disabled={isJoiningInvite}
                >
                  {isJoiningInvite ? "Joining..." : "Join server"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isCreateServerModalOpen ? (
        <div
          className="discord-create-server-backdrop"
          onClick={() => setIsCreateServerModalOpen(false)}
        >
          <div
            className="discord-create-server-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="discord-modal-header">
              <h2 className="discord-modal-title">Create a Server</h2>

              <p className="discord-modal-subtitle">
                Make a new server and start organizing your chats.
              </p>
            </div>

            {createServerError ? (
              <p className="auth-error server-inline-error">{createServerError}</p>
            ) : null}

            <form onSubmit={handleCreateServer} className="discord-form-stack">
              <input
                id="server_name"
                name="server_name"
                type="text"
                className="auth-input compact-input"
                value={serverFormData.server_name}
                onChange={(e) => {
                  const { name, value } = e.target;

                  setServerFormData((prevData) => ({
                    ...prevData,
                    [name]: value
                  }));

                  setCreateServerError("");
                }}
                placeholder="Server name"
              />

              <textarea
                id="description"
                name="description"
                className="auth-input compact-input compact-textarea"
                value={serverFormData.description}
                onChange={(e) => {
                  const { name, value } = e.target;

                  setServerFormData((prevData) => ({
                    ...prevData,
                    [name]: value
                  }));

                  setCreateServerError("");
                }}
                placeholder="Server description"
                rows="3"
              />

              <div className="discord-modal-actions">
                <button
                  type="button"
                  className="auth-button auth-button-secondary compact-button"
                  onClick={() => setIsCreateServerModalOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="auth-button compact-button"
                  disabled={isCreatingServer}
                >
                  {isCreatingServer ? "Creating..." : "Create server"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MainPage;