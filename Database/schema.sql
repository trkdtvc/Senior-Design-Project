SET NAMES utf8mb4;

CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_verified` tinyint(1) NOT NULL DEFAULT 0,
  `verification_token` varchar(255) DEFAULT NULL,
  `verification_token_expires` datetime DEFAULT NULL,
  `password_reset_token` varchar(255) DEFAULT NULL,
  `password_reset_token_expires` datetime DEFAULT NULL,
  `status` enum('online','dnd','invisible') NOT NULL DEFAULT 'online',
  `is_online` tinyint(1) NOT NULL DEFAULT 0,
  `last_seen_at` datetime DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `servers` (
  `server_id` int NOT NULL AUTO_INCREMENT,
  `owner_id` int NOT NULL,
  `server_name` varchar(100) NOT NULL,
  `server_description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`server_id`),
  KEY `owner_id` (`owner_id`),
  CONSTRAINT `servers_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `server_members` (
  `member_id` int NOT NULL AUTO_INCREMENT,
  `server_id` int NOT NULL,
  `user_id` int NOT NULL,
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`member_id`),
  UNIQUE KEY `server_id` (`server_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `server_members_ibfk_1` FOREIGN KEY (`server_id`) REFERENCES `servers` (`server_id`) ON DELETE CASCADE,
  CONSTRAINT `server_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `server_bans` (
  `ban_id` int NOT NULL AUTO_INCREMENT,
  `server_id` int NOT NULL,
  `user_id` int NOT NULL,
  `banned_by` int DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ban_id`),
  UNIQUE KEY `unique_server_ban` (`server_id`,`user_id`),
  KEY `user_id` (`user_id`),
  KEY `banned_by` (`banned_by`),
  CONSTRAINT `server_bans_moderator_fk` FOREIGN KEY (`banned_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `server_bans_server_fk` FOREIGN KEY (`server_id`) REFERENCES `servers` (`server_id`) ON DELETE CASCADE,
  CONSTRAINT `server_bans_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `channels` (
  `channel_id` int NOT NULL AUTO_INCREMENT,
  `server_id` int NOT NULL,
  `channel_name` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`channel_id`),
  UNIQUE KEY `server_id` (`server_id`,`channel_name`),
  CONSTRAINT `channels_ibfk_1` FOREIGN KEY (`server_id`) REFERENCES `servers` (`server_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `messages` (
  `message_id` int NOT NULL AUTO_INCREMENT,
  `channel_id` int NOT NULL,
  `user_id` int NOT NULL,
  `message_content` text NOT NULL,
  `reply_to_message_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`message_id`),
  KEY `user_id` (`user_id`),
  KEY `reply_to_message_id` (`reply_to_message_id`),
  KEY `idx_messages_channel_message` (`channel_id`,`message_id`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`channel_id`) REFERENCES `channels` (`channel_id`) ON DELETE CASCADE,
  CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `messages_reply_to_message_fk` FOREIGN KEY (`reply_to_message_id`) REFERENCES `messages` (`message_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `message_attachments` (
  `attachment_id` int NOT NULL AUTO_INCREMENT,
  `message_id` int NOT NULL,
  `file_url` varchar(500) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_type` varchar(150) NOT NULL,
  `file_size` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`attachment_id`),
  KEY `fk_message_attachments_message` (`message_id`),
  CONSTRAINT `fk_message_attachments_message` FOREIGN KEY (`message_id`) REFERENCES `messages` (`message_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `message_mentions` (
  `mention_id` int NOT NULL AUTO_INCREMENT,
  `message_id` int NOT NULL,
  `mentioned_user_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`mention_id`),
  UNIQUE KEY `unique_message_mention` (`message_id`,`mentioned_user_id`),
  KEY `idx_message_mentions_user_message` (`mentioned_user_id`,`message_id`),
  CONSTRAINT `message_mentions_ibfk_1` FOREIGN KEY (`message_id`) REFERENCES `messages` (`message_id`) ON DELETE CASCADE,
  CONSTRAINT `message_mentions_ibfk_2` FOREIGN KEY (`mentioned_user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `message_reactions` (
  `reaction_id` int NOT NULL AUTO_INCREMENT,
  `message_id` int NOT NULL,
  `user_id` int NOT NULL,
  `emoji` varchar(32) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reaction_id`),
  UNIQUE KEY `unique_message_reaction` (`message_id`,`user_id`,`emoji`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `message_reactions_message_fk` FOREIGN KEY (`message_id`) REFERENCES `messages` (`message_id`) ON DELETE CASCADE,
  CONSTRAINT `message_reactions_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `message_pins` (
  `pin_id` int NOT NULL AUTO_INCREMENT,
  `message_id` int NOT NULL,
  `pinned_by` int NOT NULL,
  `pinned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`pin_id`),
  UNIQUE KEY `unique_message_pin` (`message_id`),
  KEY `pinned_by` (`pinned_by`),
  CONSTRAINT `message_pins_message_fk` FOREIGN KEY (`message_id`) REFERENCES `messages` (`message_id`) ON DELETE CASCADE,
  CONSTRAINT `message_pins_user_fk` FOREIGN KEY (`pinned_by`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `channel_read_states` (
  `read_state_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `channel_id` int NOT NULL,
  `last_read_message_id` int DEFAULT NULL,
  `last_read_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`read_state_id`),
  UNIQUE KEY `unique_channel_read_state` (`user_id`,`channel_id`),
  KEY `channel_id` (`channel_id`),
  KEY `last_read_message_id` (`last_read_message_id`),
  CONSTRAINT `channel_read_states_channel_fk` FOREIGN KEY (`channel_id`) REFERENCES `channels` (`channel_id`) ON DELETE CASCADE,
  CONSTRAINT `channel_read_states_message_fk` FOREIGN KEY (`last_read_message_id`) REFERENCES `messages` (`message_id`) ON DELETE SET NULL,
  CONSTRAINT `channel_read_states_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `roles` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `server_id` int NOT NULL,
  `role_name` varchar(50) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `server_id` (`server_id`,`role_name`),
  CONSTRAINT `roles_ibfk_1` FOREIGN KEY (`server_id`) REFERENCES `servers` (`server_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `member_roles` (
  `member_role_id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `role_id` int NOT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`member_role_id`),
  UNIQUE KEY `member_id` (`member_id`,`role_id`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `member_roles_ibfk_1` FOREIGN KEY (`member_id`) REFERENCES `server_members` (`member_id`) ON DELETE CASCADE,
  CONSTRAINT `member_roles_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `server_invites` (
  `invite_id` int NOT NULL AUTO_INCREMENT,
  `server_id` int NOT NULL,
  `created_by` int NOT NULL,
  `invite_code` varchar(50) NOT NULL,
  `expires_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`invite_id`),
  UNIQUE KEY `invite_code` (`invite_code`),
  KEY `created_by` (`created_by`),
  KEY `idx_server_invites_active` (`server_id`,`is_active`,`expires_at`),
  CONSTRAINT `server_invites_ibfk_1` FOREIGN KEY (`server_id`) REFERENCES `servers` (`server_id`) ON DELETE CASCADE,
  CONSTRAINT `server_invites_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `friend_requests` (
  `request_id` int NOT NULL AUTO_INCREMENT,
  `sender_id` int NOT NULL,
  `receiver_id` int NOT NULL,
  `status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `responded_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`request_id`),
  UNIQUE KEY `sender_id` (`sender_id`,`receiver_id`),
  KEY `receiver_id` (`receiver_id`),
  CONSTRAINT `friend_requests_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `friend_requests_ibfk_2` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `friendships` (
  `friendship_id` int NOT NULL AUTO_INCREMENT,
  `user_one_id` int NOT NULL,
  `user_two_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`friendship_id`),
  UNIQUE KEY `user_one_id` (`user_one_id`,`user_two_id`),
  KEY `user_two_id` (`user_two_id`),
  CONSTRAINT `friendships_ibfk_1` FOREIGN KEY (`user_one_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `friendships_ibfk_2` FOREIGN KEY (`user_two_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_blocks` (
  `block_id` int NOT NULL AUTO_INCREMENT,
  `blocker_id` int NOT NULL,
  `blocked_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`block_id`),
  UNIQUE KEY `unique_user_block` (`blocker_id`,`blocked_id`),
  KEY `blocked_id` (`blocked_id`),
  CONSTRAINT `user_blocks_blocked_fk` FOREIGN KEY (`blocked_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `user_blocks_blocker_fk` FOREIGN KEY (`blocker_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `user_blocks_no_self_check` CHECK ((`blocker_id` <> `blocked_id`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `direct_conversations` (
  `conversation_id` int NOT NULL AUTO_INCREMENT,
  `user_one_id` int NOT NULL,
  `user_two_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`conversation_id`),
  UNIQUE KEY `unique_dm_pair` (`user_one_id`,`user_two_id`),
  KEY `user_two_id` (`user_two_id`),
  CONSTRAINT `direct_conversations_ibfk_1` FOREIGN KEY (`user_one_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `direct_conversations_ibfk_2` FOREIGN KEY (`user_two_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `direct_messages` (
  `direct_message_id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL,
  `sender_id` int NOT NULL,
  `content` text NOT NULL,
  `reply_to_direct_message_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`direct_message_id`),
  KEY `sender_id` (`sender_id`),
  KEY `reply_to_direct_message_id` (`reply_to_direct_message_id`),
  KEY `idx_direct_messages_conversation_message` (`conversation_id`,`direct_message_id`),
  KEY `idx_direct_messages_conversation_sender` (`conversation_id`,`sender_id`,`direct_message_id`),
  CONSTRAINT `direct_messages_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `direct_conversations` (`conversation_id`) ON DELETE CASCADE,
  CONSTRAINT `direct_messages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `direct_messages_reply_to_message_fk` FOREIGN KEY (`reply_to_direct_message_id`) REFERENCES `direct_messages` (`direct_message_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `direct_message_attachments` (
  `attachment_id` int NOT NULL AUTO_INCREMENT,
  `direct_message_id` int NOT NULL,
  `file_url` varchar(500) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_type` varchar(150) NOT NULL,
  `file_size` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`attachment_id`),
  KEY `fk_direct_message_attachments_message` (`direct_message_id`),
  CONSTRAINT `fk_direct_message_attachments_message` FOREIGN KEY (`direct_message_id`) REFERENCES `direct_messages` (`direct_message_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `direct_message_reactions` (
  `reaction_id` int NOT NULL AUTO_INCREMENT,
  `direct_message_id` int NOT NULL,
  `user_id` int NOT NULL,
  `emoji` varchar(32) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reaction_id`),
  UNIQUE KEY `unique_direct_message_reaction` (`direct_message_id`,`user_id`,`emoji`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `direct_message_reactions_message_fk` FOREIGN KEY (`direct_message_id`) REFERENCES `direct_messages` (`direct_message_id`) ON DELETE CASCADE,
  CONSTRAINT `direct_message_reactions_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `direct_message_pins` (
  `pin_id` int NOT NULL AUTO_INCREMENT,
  `direct_message_id` int NOT NULL,
  `pinned_by` int NOT NULL,
  `pinned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`pin_id`),
  UNIQUE KEY `unique_direct_message_pin` (`direct_message_id`),
  KEY `pinned_by` (`pinned_by`),
  CONSTRAINT `direct_message_pins_message_fk` FOREIGN KEY (`direct_message_id`) REFERENCES `direct_messages` (`direct_message_id`) ON DELETE CASCADE,
  CONSTRAINT `direct_message_pins_user_fk` FOREIGN KEY (`pinned_by`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `direct_conversation_read_states` (
  `read_state_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `conversation_id` int NOT NULL,
  `last_read_direct_message_id` int DEFAULT NULL,
  `last_read_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`read_state_id`),
  UNIQUE KEY `unique_direct_conversation_read_state` (`user_id`,`conversation_id`),
  KEY `conversation_id` (`conversation_id`),
  KEY `last_read_direct_message_id` (`last_read_direct_message_id`),
  CONSTRAINT `direct_conversation_read_states_conversation_fk` FOREIGN KEY (`conversation_id`) REFERENCES `direct_conversations` (`conversation_id`) ON DELETE CASCADE,
  CONSTRAINT `direct_conversation_read_states_message_fk` FOREIGN KEY (`last_read_direct_message_id`) REFERENCES `direct_messages` (`direct_message_id`) ON DELETE SET NULL,
  CONSTRAINT `direct_conversation_read_states_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `direct_conversation_deletions` (
  `deletion_id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL,
  `user_id` int NOT NULL,
  `deleted_after_message_id` int NOT NULL DEFAULT 0,
  `deleted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`deletion_id`),
  UNIQUE KEY `unique_direct_conversation_delete` (`conversation_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `direct_conversation_deletions_conversation_fk` FOREIGN KEY (`conversation_id`) REFERENCES `direct_conversations` (`conversation_id`) ON DELETE CASCADE,
  CONSTRAINT `direct_conversation_deletions_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_muted_servers` (
  `mute_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `server_id` int NOT NULL,
  `muted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`mute_id`),
  UNIQUE KEY `unique_user_muted_server` (`user_id`,`server_id`),
  KEY `server_id` (`server_id`),
  CONSTRAINT `user_muted_servers_server_fk` FOREIGN KEY (`server_id`) REFERENCES `servers` (`server_id`) ON DELETE CASCADE,
  CONSTRAINT `user_muted_servers_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_muted_channels` (
  `mute_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `channel_id` int NOT NULL,
  `muted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`mute_id`),
  UNIQUE KEY `unique_user_muted_channel` (`user_id`,`channel_id`),
  KEY `channel_id` (`channel_id`),
  CONSTRAINT `user_muted_channels_channel_fk` FOREIGN KEY (`channel_id`) REFERENCES `channels` (`channel_id`) ON DELETE CASCADE,
  CONSTRAINT `user_muted_channels_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_muted_direct_conversations` (
  `mute_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `conversation_id` int NOT NULL,
  `muted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`mute_id`),
  UNIQUE KEY `unique_user_muted_direct_conversation` (`user_id`,`conversation_id`),
  KEY `conversation_id` (`conversation_id`),
  CONSTRAINT `user_muted_direct_conversations_conversation_fk` FOREIGN KEY (`conversation_id`) REFERENCES `direct_conversations` (`conversation_id`) ON DELETE CASCADE,
  CONSTRAINT `user_muted_direct_conversations_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `email_verification_tokens` (
  `verification_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`verification_id`),
  UNIQUE KEY `token` (`token`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `email_verification_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
