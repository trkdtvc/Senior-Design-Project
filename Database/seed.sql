-- Development/demo seed data for Your Friendly Neighborhood Chatster.
-- Run this only after selecting a database that already has Database/schema.sql applied.
-- Do not run this seed against production data.
-- Seed login: testuser@example.com / TestPass123!

START TRANSACTION;

-- Make the seed repeatable without relying on fixed AUTO_INCREMENT IDs.
-- Deleting this dedicated demo account cascades its previous demo server/data.
DELETE FROM users
WHERE email = 'testuser@example.com'
   OR username = 'testuser';

INSERT INTO users (
  username,
  email,
  password_hash,
  is_verified
)
VALUES (
  'testuser',
  'testuser@example.com',
  '$2b$10$7Ng6BdcU8ca5RqBDK3T0J.tVSRqqUKZosJA06tsO.ulALdAocDA4i',
  1
);

SET @test_user_id = LAST_INSERT_ID();

INSERT INTO servers (owner_id, server_name, server_description)
VALUES (
  @test_user_id,
  'Test Server',
  'Development server created by Database/seed.sql.'
);

SET @test_server_id = LAST_INSERT_ID();

INSERT INTO server_members (server_id, user_id, server_role)
VALUES (@test_server_id, @test_user_id, 'member');

INSERT INTO channels (server_id, channel_name)
VALUES (@test_server_id, 'general');

SET @general_channel_id = LAST_INSERT_ID();

INSERT INTO messages (channel_id, user_id, message_content)
VALUES (
  @general_channel_id,
  @test_user_id,
  'Hello! This is the development seed message.'
);

COMMIT;
