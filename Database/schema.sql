CREATE DATABASE IF NOT EXISTS senior_design_project
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE senior_design_project;

CREATE TABLE users (
  user_id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  verification_token VARCHAR(255) DEFAULT NULL,
  verification_token_expires DATETIME DEFAULT NULL,
  password_reset_token VARCHAR(255) DEFAULT NULL,
  password_reset_token_expires DATETIME DEFAULT NULL,
  status ENUM('online','dnd','invisible') NOT NULL DEFAULT 'online',
  is_online TINYINT(1) NOT NULL DEFAULT 0,
  last_seen_at DATETIME DEFAULT NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY username (username),
  UNIQUE KEY email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE servers (
  server_id INT NOT NULL AUTO_INCREMENT,
  owner_id INT NOT NULL,
  server_name VARCHAR(100) NOT NULL,
  server_description TEXT,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (server_id),
  KEY owner_id (owner_id),
  CONSTRAINT servers_ibfk_1 FOREIGN KEY (owner_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE server_members (
  member_id INT NOT NULL AUTO_INCREMENT,
  server_id INT NOT NULL,
  user_id INT NOT NULL,
  joined_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id),
  UNIQUE KEY server_id (server_id, user_id),
  KEY user_id (user_id),
  CONSTRAINT server_members_ibfk_1 FOREIGN KEY (server_id) REFERENCES servers (server_id) ON DELETE CASCADE,
  CONSTRAINT server_members_ibfk_2 FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE channels (
  channel_id INT NOT NULL AUTO_INCREMENT,
  server_id INT NOT NULL,
  channel_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (channel_id),
  UNIQUE KEY server_id (server_id, channel_name),
  CONSTRAINT channels_ibfk_1 FOREIGN KEY (server_id) REFERENCES servers (server_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE messages (
  message_id INT NOT NULL AUTO_INCREMENT,
  channel_id INT NOT NULL,
  user_id INT NOT NULL,
  message_content TEXT NOT NULL,
  reply_to_message_id INT DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id),
  KEY channel_id (channel_id),
  KEY user_id (user_id),
  KEY reply_to_message_id (reply_to_message_id),
  CONSTRAINT messages_ibfk_1 FOREIGN KEY (channel_id) REFERENCES channels (channel_id) ON DELETE CASCADE,
  CONSTRAINT messages_ibfk_2 FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT messages_reply_to_message_fk FOREIGN KEY (reply_to_message_id) REFERENCES messages (message_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE message_attachments (
  attachment_id INT NOT NULL AUTO_INCREMENT,
  message_id INT NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(150) NOT NULL,
  file_size INT NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (attachment_id),
  KEY fk_message_attachments_message (message_id),
  CONSTRAINT fk_message_attachments_message
    FOREIGN KEY (message_id) REFERENCES messages (message_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE message_mentions (
  mention_id INT NOT NULL AUTO_INCREMENT,
  message_id INT NOT NULL,
  mentioned_user_id INT NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (mention_id),
  UNIQUE KEY unique_message_mention (message_id, mentioned_user_id),
  KEY mentioned_user_id (mentioned_user_id),
  CONSTRAINT message_mentions_ibfk_1
    FOREIGN KEY (message_id) REFERENCES messages (message_id) ON DELETE CASCADE,
  CONSTRAINT message_mentions_ibfk_2
    FOREIGN KEY (mentioned_user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE message_reactions (
  reaction_id INT NOT NULL AUTO_INCREMENT,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  emoji VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reaction_id),
  UNIQUE KEY unique_message_reaction (message_id, user_id, emoji),
  KEY user_id (user_id),
  CONSTRAINT message_reactions_message_fk
    FOREIGN KEY (message_id) REFERENCES messages (message_id) ON DELETE CASCADE,
  CONSTRAINT message_reactions_user_fk
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE message_pins (
  pin_id INT NOT NULL AUTO_INCREMENT,
  message_id INT NOT NULL,
  pinned_by INT NOT NULL,
  pinned_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (pin_id),
  UNIQUE KEY unique_message_pin (message_id),
  KEY pinned_by (pinned_by),
  CONSTRAINT message_pins_message_fk
    FOREIGN KEY (message_id) REFERENCES messages (message_id) ON DELETE CASCADE,
  CONSTRAINT message_pins_user_fk
    FOREIGN KEY (pinned_by) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE channel_read_states (
  read_state_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  channel_id INT NOT NULL,
  last_read_message_id INT DEFAULT NULL,
  last_read_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (read_state_id),
  UNIQUE KEY unique_channel_read_state (user_id, channel_id),
  KEY channel_id (channel_id),
  KEY last_read_message_id (last_read_message_id),
  CONSTRAINT channel_read_states_user_fk
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT channel_read_states_channel_fk
    FOREIGN KEY (channel_id) REFERENCES channels (channel_id) ON DELETE CASCADE,
  CONSTRAINT channel_read_states_message_fk
    FOREIGN KEY (last_read_message_id) REFERENCES messages (message_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE user_muted_servers (
  mute_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  server_id INT NOT NULL,
  muted_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (mute_id),
  UNIQUE KEY unique_user_muted_server (user_id, server_id),
  KEY server_id (server_id),
  CONSTRAINT user_muted_servers_user_fk
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT user_muted_servers_server_fk
    FOREIGN KEY (server_id) REFERENCES servers (server_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_muted_channels (
  mute_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  channel_id INT NOT NULL,
  muted_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (mute_id),
  UNIQUE KEY unique_user_muted_channel (user_id, channel_id),
  KEY channel_id (channel_id),
  CONSTRAINT user_muted_channels_user_fk
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT user_muted_channels_channel_fk
    FOREIGN KEY (channel_id) REFERENCES channels (channel_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE roles (
  role_id INT NOT NULL AUTO_INCREMENT,
  server_id INT NOT NULL,
  role_name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id),
  UNIQUE KEY server_id (server_id, role_name),
  CONSTRAINT roles_ibfk_1 FOREIGN KEY (server_id) REFERENCES servers (server_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE member_roles (
  member_role_id INT NOT NULL AUTO_INCREMENT,
  member_id INT NOT NULL,
  role_id INT NOT NULL,
  assigned_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_role_id),
  UNIQUE KEY member_id (member_id, role_id),
  KEY role_id (role_id),
  CONSTRAINT member_roles_ibfk_1 FOREIGN KEY (member_id) REFERENCES server_members (member_id) ON DELETE CASCADE,
  CONSTRAINT member_roles_ibfk_2 FOREIGN KEY (role_id) REFERENCES roles (role_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE server_invites (
  invite_id INT NOT NULL AUTO_INCREMENT,
  server_id INT NOT NULL,
  created_by INT NOT NULL,
  invite_code VARCHAR(50) NOT NULL,
  expires_at DATETIME DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (invite_id),
  UNIQUE KEY invite_code (invite_code),
  KEY server_id (server_id),
  KEY created_by (created_by),
  CONSTRAINT server_invites_ibfk_1 FOREIGN KEY (server_id) REFERENCES servers (server_id) ON DELETE CASCADE,
  CONSTRAINT server_invites_ibfk_2 FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE friend_requests (
  request_id INT NOT NULL AUTO_INCREMENT,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  status ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (request_id),
  UNIQUE KEY sender_id (sender_id, receiver_id),
  KEY receiver_id (receiver_id),
  CONSTRAINT friend_requests_ibfk_1 FOREIGN KEY (sender_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT friend_requests_ibfk_2 FOREIGN KEY (receiver_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE friendships (
  friendship_id INT NOT NULL AUTO_INCREMENT,
  user_one_id INT NOT NULL,
  user_two_id INT NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (friendship_id),
  UNIQUE KEY user_one_id (user_one_id, user_two_id),
  KEY user_two_id (user_two_id),
  CONSTRAINT friendships_ibfk_1 FOREIGN KEY (user_one_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT friendships_ibfk_2 FOREIGN KEY (user_two_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE direct_conversations (
  conversation_id INT NOT NULL AUTO_INCREMENT,
  user_one_id INT NOT NULL,
  user_two_id INT NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id),
  UNIQUE KEY unique_dm_pair (user_one_id, user_two_id),
  KEY user_two_id (user_two_id),
  CONSTRAINT direct_conversations_ibfk_1 FOREIGN KEY (user_one_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT direct_conversations_ibfk_2 FOREIGN KEY (user_two_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE direct_messages (
  direct_message_id INT NOT NULL AUTO_INCREMENT,
  conversation_id INT NOT NULL,
  sender_id INT NOT NULL,
  content TEXT NOT NULL,
  reply_to_direct_message_id INT DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (direct_message_id),
  KEY conversation_id (conversation_id),
  KEY sender_id (sender_id),
  KEY reply_to_direct_message_id (reply_to_direct_message_id),
  CONSTRAINT direct_messages_ibfk_1 FOREIGN KEY (conversation_id) REFERENCES direct_conversations (conversation_id) ON DELETE CASCADE,
  CONSTRAINT direct_messages_ibfk_2 FOREIGN KEY (sender_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT direct_messages_reply_to_message_fk FOREIGN KEY (reply_to_direct_message_id) REFERENCES direct_messages (direct_message_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE direct_message_attachments (
  attachment_id INT NOT NULL AUTO_INCREMENT,
  direct_message_id INT NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(150) NOT NULL,
  file_size INT NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (attachment_id),
  KEY fk_direct_message_attachments_message (direct_message_id),
  CONSTRAINT fk_direct_message_attachments_message
    FOREIGN KEY (direct_message_id) REFERENCES direct_messages (direct_message_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE direct_message_reactions (
  reaction_id INT NOT NULL AUTO_INCREMENT,
  direct_message_id INT NOT NULL,
  user_id INT NOT NULL,
  emoji VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reaction_id),
  UNIQUE KEY unique_direct_message_reaction (direct_message_id, user_id, emoji),
  KEY user_id (user_id),
  CONSTRAINT direct_message_reactions_message_fk
    FOREIGN KEY (direct_message_id) REFERENCES direct_messages (direct_message_id) ON DELETE CASCADE,
  CONSTRAINT direct_message_reactions_user_fk
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE direct_message_pins (
  pin_id INT NOT NULL AUTO_INCREMENT,
  direct_message_id INT NOT NULL,
  pinned_by INT NOT NULL,
  pinned_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (pin_id),
  UNIQUE KEY unique_direct_message_pin (direct_message_id),
  KEY pinned_by (pinned_by),
  CONSTRAINT direct_message_pins_message_fk
    FOREIGN KEY (direct_message_id) REFERENCES direct_messages (direct_message_id) ON DELETE CASCADE,
  CONSTRAINT direct_message_pins_user_fk
    FOREIGN KEY (pinned_by) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE user_muted_direct_conversations (
  mute_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  conversation_id INT NOT NULL,
  muted_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (mute_id),
  UNIQUE KEY unique_user_muted_direct_conversation (user_id, conversation_id),
  KEY conversation_id (conversation_id),
  CONSTRAINT user_muted_direct_conversations_user_fk
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT user_muted_direct_conversations_conversation_fk
    FOREIGN KEY (conversation_id) REFERENCES direct_conversations (conversation_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_blocks (
  block_id INT NOT NULL AUTO_INCREMENT,
  blocker_id INT NOT NULL,
  blocked_id INT NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (block_id),
  UNIQUE KEY unique_user_block (blocker_id, blocked_id),
  KEY blocked_id (blocked_id),
  CONSTRAINT user_blocks_blocker_fk
    FOREIGN KEY (blocker_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT user_blocks_blocked_fk
    FOREIGN KEY (blocked_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT user_blocks_no_self_check CHECK (blocker_id <> blocked_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_reports (
  report_id INT NOT NULL AUTO_INCREMENT,
  reporter_id INT NOT NULL,
  reported_user_id INT NOT NULL,
  reason TEXT NOT NULL,
  context_type VARCHAR(50) NOT NULL DEFAULT 'profile',
  context_id INT DEFAULT NULL,
  status ENUM('open','reviewed','dismissed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME DEFAULT NULL,
  PRIMARY KEY (report_id),
  KEY reporter_id (reporter_id),
  KEY reported_user_id (reported_user_id),
  CONSTRAINT user_reports_reporter_fk
    FOREIGN KEY (reporter_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT user_reports_reported_user_fk
    FOREIGN KEY (reported_user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT user_reports_no_self_check CHECK (reporter_id <> reported_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE direct_conversation_read_states (
  read_state_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  conversation_id INT NOT NULL,
  last_read_direct_message_id INT DEFAULT NULL,
  last_read_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (read_state_id),
  UNIQUE KEY unique_direct_conversation_read_state (user_id, conversation_id),
  KEY conversation_id (conversation_id),
  KEY last_read_direct_message_id (last_read_direct_message_id),
  CONSTRAINT direct_conversation_read_states_user_fk
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT direct_conversation_read_states_conversation_fk
    FOREIGN KEY (conversation_id) REFERENCES direct_conversations (conversation_id) ON DELETE CASCADE,
  CONSTRAINT direct_conversation_read_states_message_fk
    FOREIGN KEY (last_read_direct_message_id) REFERENCES direct_messages (direct_message_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE email_verification_tokens (
  verification_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (verification_id),
  UNIQUE KEY token (token),
  KEY user_id (user_id),
  CONSTRAINT email_verification_tokens_ibfk_1
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE direct_conversation_deletions (
  deletion_id INT NOT NULL AUTO_INCREMENT,
  conversation_id INT NOT NULL,
  user_id INT NOT NULL,
  deleted_after_message_id INT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (deletion_id),
  UNIQUE KEY unique_direct_conversation_delete (conversation_id, user_id),
  KEY user_id (user_id),
  CONSTRAINT direct_conversation_deletions_conversation_fk
    FOREIGN KEY (conversation_id) REFERENCES direct_conversations (conversation_id)
    ON DELETE CASCADE,
  CONSTRAINT direct_conversation_deletions_user_fk
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
