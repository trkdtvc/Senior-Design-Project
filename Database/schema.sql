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
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id),
  KEY channel_id (channel_id),
  KEY user_id (user_id),
  CONSTRAINT messages_ibfk_1 FOREIGN KEY (channel_id) REFERENCES channels (channel_id) ON DELETE CASCADE,
  CONSTRAINT messages_ibfk_2 FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
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
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (direct_message_id),
  KEY conversation_id (conversation_id),
  KEY sender_id (sender_id),
  CONSTRAINT direct_messages_ibfk_1 FOREIGN KEY (conversation_id) REFERENCES direct_conversations (conversation_id) ON DELETE CASCADE,
  CONSTRAINT direct_messages_ibfk_2 FOREIGN KEY (sender_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;