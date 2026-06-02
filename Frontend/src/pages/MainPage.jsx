import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMe } from "../services/authService";
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
  markChannelAsRead,
  getUnreadChannelCounts,
  getUnreadMentionCounts
} from "../services/messageService";
import { getServerMembers } from "../services/serverMemberService";
import {
  getDirectConversations,
  getOrCreateDirectConversation,
  getDirectMessages,
  searchDirectMessages,
  sendDirectMessage,
  updateDirectMessage,
  deleteDirectMessage,
  deleteDirectConversation,
  markDirectConversationAsRead,
  getUnreadDirectConversationCounts
} from "../services/directMessageService";
import {
  createServerInvite,
  joinServerByInvite
} from "../services/serverInviteService";
import { connectSocket, disconnectSocket } from "../services/socket";
import "../styles/auth.css";
import EmojiPicker, { Theme } from "emoji-picker-react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const FILE_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;
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

const handleResponse = async (response) => {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Request failed.");
  }

  return data;
};

const getFriends = async (token) => {
  const response = await fetch(`${API_BASE_URL}/friends`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(response);
};

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

const isImageAttachment = (attachment) =>
  getAttachmentType(attachment).startsWith("image/");

const isVideoAttachment = (attachment) =>
  getAttachmentType(attachment).startsWith("video/");

const isAudioAttachment = (attachment) =>
  getAttachmentType(attachment).startsWith("audio/");

const renderAttachmentPreview = (attachment) => {
  const attachmentUrl = getAttachmentUrl(attachment);
  const attachmentName = getAttachmentName(attachment);
  const attachmentSize = formatFileSize(getAttachmentSize(attachment));

  if (!attachmentUrl) {
    return null;
  }

  if (isImageAttachment(attachment)) {
    return (
      <a href={attachmentUrl} target="_blank" rel="noreferrer">
        <img
          src={attachmentUrl}
          alt={attachmentName}
          className="discord-attachment-media"
        />
      </a>
    );
  }

  if (isVideoAttachment(attachment)) {
    return (
      <video
        controls
        src={attachmentUrl}
        className="discord-attachment-media"
      />
    );
  }

  if (isAudioAttachment(attachment)) {
    return (
      <audio
        controls
        src={attachmentUrl}
        className="discord-attachment-audio"
      />
    );
  }

  return (
    <a
      href={attachmentUrl}
      target="_blank"
      rel="noreferrer"
      className="discord-attachment-file"
    >
      <span className="discord-attachment-icon">📎</span>

      <span className="discord-attachment-meta">
        <span className="discord-attachment-name">{attachmentName}</span>

        {attachmentSize ? (
          <span className="discord-attachment-size">{attachmentSize}</span>
        ) : null}
      </span>
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

  const [user, setUser] = useState(null);
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
  const [channelSearchResults, setChannelSearchResults] = useState([]);
  const [directMessages, setDirectMessages] = useState([]);
  const [directSearchResults, setDirectSearchResults] = useState([]);
  const [unreadDirectCounts, setUnreadDirectCounts] = useState({});
  const [unreadChannelCounts, setUnreadChannelCounts] = useState({});
  const [unreadServerCounts, setUnreadServerCounts] = useState({});
  const [mentionChannelCounts, setMentionChannelCounts] = useState({});
  const [mentionServerCounts, setMentionServerCounts] = useState({});
  const [hoveredConversationId, setHoveredConversationId] = useState(null);
  const [openConversationMenuId, setOpenConversationMenuId] = useState(null);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [directConversationError, setDirectConversationError] = useState("");
  const [deletingMessageKey, setDeletingMessageKey] = useState(null);
  const [editingMessageKey, setEditingMessageKey] = useState(null);
  const [editingMessageContent, setEditingMessageContent] = useState("");
  const [savingEditedMessageKey, setSavingEditedMessageKey] = useState(null);
  const [selectedReplyMessage, setSelectedReplyMessage] = useState(null);

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
  const [serverFormData, setServerFormData] = useState({
    server_name: "",
    description: ""
  });

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

  const currentUserIsOwner = useMemo(
    () =>
      (activeServer && currentUserId
        ? String(getServerOwnerId(activeServer)) === String(currentUserId)
        : false) ||
      members.some(
        (member) =>
          String(getMemberUserId(member)) === String(currentUserId) &&
          isOwner(member)
      ),
    [activeServer, currentUserId, members]
  );

  const displayedMessages = isDmView
    ? isMessageSearchActive
      ? directSearchResults
      : directMessages
    : isMessageSearchActive
      ? channelSearchResults
      : channelMessages;

  const activeMessageSearchResults = isDmView
    ? directSearchResults
    : channelSearchResults;

  const activeMessageSearchLabel = isDmView
    ? "direct message"
    : "channel message";

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

  const currentUserPresence = isSocketReady
    ? "online"
    : normalizePresenceStatus(user?.presence_status ?? user?.is_online);

  const showDmHomeView = isDmView && !activeConversationId;
  const showComposer = !isDmView || !!activeConversationId;

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

  const resetMessageSearchState = () => {
    setMessageSearchTerm("");
    setChannelSearchResults([]);
    setDirectSearchResults([]);
    setIsMessageSearchActive(false);
    setIsSearchingMessages(false);
    setMessageSearchError("");
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

  const loadFriendRequests = useCallback(async (token) => {
    const [incomingResponse, outgoingResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/friends/requests/incoming`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }),
      fetch(`${API_BASE_URL}/friends/requests/outgoing`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
    ]);

    const incomingData = await incomingResponse.json().catch(() => null);
    const outgoingData = await outgoingResponse.json().catch(() => null);

    if (!incomingResponse.ok) {
      throw new Error(
        incomingData?.message || "Failed to load incoming friend requests."
      );
    }

    if (!outgoingResponse.ok) {
      throw new Error(
        outgoingData?.message || "Failed to load outgoing friend requests."
      );
    }

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

  const loadChannelMessageList = useCallback(async (token, channelId) => {
    if (!channelId) {
      setChannelMessages([]);
      setMessageError("");
      return [];
    }

    const messageData = await getChannelMessages(token, channelId);
    const normalizedMessageData = normalizeMessages(messageData);
    setChannelMessages(normalizedMessageData);
    return normalizedMessageData;
  }, []);

  const loadDirectMessageList = useCallback(async (token, conversationId) => {
    if (!conversationId) {
      setDirectMessages([]);
      setMessageError("");
      return [];
    }

    const messageData = await getDirectMessages(token, conversationId);
    const normalizedMessageData = normalizeMessages(messageData);
    setDirectMessages(normalizedMessageData);
    return normalizedMessageData;
  }, []);

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
          loadFriendRequests(token)
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
    persistDirectConversationReadState
  ]);

  useEffect(() => {
    if (!activeServerId || !activeChannelId) {
      return;
    }

    clearChannelUnread(activeChannelId, activeServerId);
    persistChannelReadState(activeChannelId);
  }, [
    activeServerId,
    activeChannelId,
    clearChannelUnread,
    persistChannelReadState
  ]);

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
        setIsMessagesLoading(true);
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
      setChannelSearchResults(removeDeletedMessage);
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
      setChannelSearchResults(updateMessageList);
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
      setDirectSearchResults(removeDeletedDirectMessage);

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
      setDirectSearchResults(updateDirectMessageList);

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

    socket.on("presence_update", handlePresenceUpdate);
    socket.on("new_message", handleNewMessage);
    socket.on("message_updated", handleMessageUpdated);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("direct_message", handleDirectMessage);
    socket.on("direct_message_updated", handleDirectMessageUpdated);
    socket.on("direct_message_deleted", handleDirectMessageDeleted);
    socket.on("friend_removed", handleFriendRemoved);
    socket.on("channel_message_notification", handleChannelMessageNotification);
    socket.on("friend_request_received", handleFriendRequestReceived);

    return () => {
      socket.off("presence_update", handlePresenceUpdate);
      socket.off("new_message", handleNewMessage);
      socket.off("message_updated", handleMessageUpdated);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("direct_message", handleDirectMessage);
      socket.off("direct_message_updated", handleDirectMessageUpdated);
      socket.off("direct_message_deleted", handleDirectMessageDeleted);
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
    persistDirectConversationReadState
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

    if (!container || !shouldAutoScrollRef.current) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [displayedMessages]);

  useEffect(() => {
    const handleGlobalClick = (event) => {
      setOpenChannelMenuId(null);
      setOpenConversationMenuId(null);

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

  const handleSearchMessages = async (e) => {
    e.preventDefault();

    const token = getAuthToken();

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

    const trimmedSearchTerm = messageSearchTerm.trim();

    if (!trimmedSearchTerm) {
      setMessageSearchError("Search term is required.");
      return;
    }

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

      const normalizedSearchResults = normalizeMessages(response);

      if (isDmView) {
        setDirectSearchResults(normalizedSearchResults);
        setChannelSearchResults([]);
      } else {
        setChannelSearchResults(normalizedSearchResults);
        setDirectSearchResults([]);
      }

      setIsMessageSearchActive(true);
    } catch (error) {
      setChannelSearchResults([]);
      setDirectSearchResults([]);
      setIsMessageSearchActive(false);
      setMessageSearchError(error.message || "Failed to search messages.");
    } finally {
      setIsSearchingMessages(false);
    }
  };

  const handleClearMessageSearch = () => {
    setMessageSearchTerm("");
    setChannelSearchResults([]);
    setDirectSearchResults([]);
    setIsMessageSearchActive(false);
    setIsSearchingMessages(false);
    setMessageSearchError("");
    shouldAutoScrollRef.current = true;
  };

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;

    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    shouldAutoScrollRef.current = distanceFromBottom < 120;
  };

  const handleLogout = () => {
    disconnectSocket();
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleSelectHome = () => {
    shouldAutoScrollRef.current = true;
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

      const response = await fetch(`${API_BASE_URL}/friends/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          username: friendUsername.trim()
        })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || "Failed to send friend request.");
      }

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

      const response = await fetch(
        `${API_BASE_URL}/friends/requests/${requestId}/${action}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message ||
          `Failed to ${action === "accept" ? "accept" : "reject"} friend request.`
        );
      }

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

      const response = await fetch(`${API_BASE_URL}/friends/${friendId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || "Failed to remove friend.");
      }

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
        setDirectSearchResults(updateDirectMessageList);
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
        setChannelSearchResults(updateChannelMessageList);
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
        setDirectSearchResults(removeDeletedDirectMessage);
      } else {
        await deleteMessage(token, messageId);

        const removeDeletedChannelMessage = (prevMessages) =>
          prevMessages.filter(
            (existingMessage) =>
              String(getMessageId(existingMessage)) !== String(messageId)
          );

        setChannelMessages(removeDeletedChannelMessage);
        setChannelSearchResults(removeDeletedChannelMessage);
      }
    } catch (error) {
      setMessageError(error.message || "Failed to delete message.");
    } finally {
      setDeletingMessageKey(null);
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

      setMessageContent("");
      setIsEmojiPickerOpen(false);
      resetMessageReplyState();

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

  const handleMessageInputChange = (e) => {
    setMessageContent(e.target.value);
    setMessageError("");
    e.target.style.height = "44px";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
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
        const response = await fetch(
          `${API_BASE_URL}/server-members/${getServerId(activeServer)}/leave`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.message || "Failed to leave server.");
        }
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
    } catch (error) {
      setInviteError("Failed to copy invite code.");
    }
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

                              {currentUserIsOwner &&
                                !isGeneralChannel &&
                                (String(hoveredChannelId) === String(channelId) ||
                                  String(openChannelMenuId) === String(channelId)) ? (
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
                                          setOpenChannelMenuId(null);
                                          handleDeleteChannel(channel);
                                        }}
                                        className="auth-button auth-button-danger compact-button discord-menu-button-danger"
                                        disabled={isDeletingChannel}
                                      >
                                        {isDeletingChannel ? "Deleting..." : `Delete #${getChannelName(channel)}`}
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

                  {currentUserIsOwner ? (
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
                </>
              )}
            </div>

            <div className="discord-account-panel">
              <div className="discord-account-panel-user">
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
              </div>

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
          </div>

          <section className="server-messages-panel discord-messages-panel">
            {showComposer && (messageSearchError || isMessageSearchActive) ? (
              <div className="discord-message-search-status">
                {messageSearchError ? (
                  <p className="auth-error server-inline-error server-inline-error-tight">
                    {messageSearchError}
                  </p>
                ) : (
                  <p className="discord-message-search-status-text">
                    Showing {activeMessageSearchResults.length} {activeMessageSearchLabel}
                    {activeMessageSearchResults.length === 1 ? "" : "s"} for “
                    {messageSearchTerm.trim()}”
                  </p>
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
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
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

                  return (
                    <div
                      key={key}
                      className={`discord-message-row${isOwnMessage ? " discord-message-row-own" : ""}`}
                    >
                      {!isOwnMessage ? (
                        <div className="discord-message-avatar">
                          {getInitial(author)}
                        </div>
                      ) : null}

                      <div className="discord-message-body">
                        <div className="discord-message-actions">
                          {!isThisMessageEditing ? (
                            <button
                              type="button"
                              onClick={() => handleStartReplyingToMessage(message)}
                              disabled={!messageIdForDelete}
                              className="discord-message-action"
                            >
                              Reply
                            </button>
                          ) : null}

                          {isOwnMessage && !isThisMessageEditing ? (
                            <button
                              type="button"
                              onClick={() => handleStartEditingMessage(message)}
                              disabled={!messageIdForDelete}
                              className="discord-message-action discord-message-action-edit"
                            >
                              Edit
                            </button>
                          ) : null}

                          {isOwnMessage ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteChatMessage(message)}
                              disabled={isThisMessageDeleting || !messageIdForDelete}
                              className="discord-message-action discord-message-action-danger"
                            >
                              {isThisMessageDeleting ? "Deleting..." : "Delete"}
                            </button>
                          ) : null}
                        </div>

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
                            {content}

                            {isOwnMessage && timestamp ? (
                              <span className="discord-own-message-time">
                                {timestamp}
                                {messageWasEdited ? " · edited" : ""}
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
                                {renderAttachmentPreview(attachment)}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

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
                  onKeyDown={handleMessageKeyDown}
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

              <div className="server-members-list discord-member-groups">
                <div className="discord-members-group">
                  <div className="discord-members-group-title">
                    Online — {onlineMembers.length}
                  </div>

                  {onlineMembers.length === 0 ? (
                    <p className="server-members-empty">No members online.</p>
                  ) : (
                    <div className="server-members-list discord-member-list">
                      {onlineMembers.map((member) => (
                        <div
                          key={getMemberId(member)}
                          className="server-member-item discord-member-item"
                        >
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
                                {isOwner(member) ? " (Owner)" : ""}
                              </div>
                              <div className="server-member-email">
                                {getMemberEmail(member)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
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
                      {offlineMembers.map((member) => (
                        <div
                          key={getMemberId(member)}
                          className="server-member-item discord-member-item"
                        >
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
                                {isOwner(member) ? " (Owner)" : ""}
                              </div>
                              <div className="server-member-email">
                                {getMemberEmail(member)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
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