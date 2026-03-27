USE senior_design_project;

INSERT INTO users (username, email, password_hash)
VALUES ('testuser', 'testuser@example.com', 'test_hash_123');

INSERT INTO servers (owner_id, server_name, server_description)
VALUES (1, 'Test Server', 'This is the first test server.');

INSERT INTO server_members (server_id, user_id)
VALUES (1, 1);

INSERT INTO channels (server_id, channel_name)
VALUES (1, 'general');

INSERT INTO messages (channel_id, user_id, message_content)
VALUES (1, 1, 'Hello, this is my first test message.');

INSERT INTO roles (server_id, role_name)
VALUES (1, 'owner');

INSERT INTO member_roles (member_id, role_id)
VALUES (1, 1);