const { pool } = require("../config/db");

const findUserByEmail = async (email) => {
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );
  return rows[0];
};

const findUserByUsername = async (username) => {
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE username = ?",
    [username]
  );
  return rows[0];
};

const findUserById = async (userId) => {
  const [rows] = await pool.query(
    "SELECT user_id, username, email, created_at, updated_at FROM users WHERE user_id = ?",
    [userId]
  );
  return rows[0];
};

const createUser = async (username, email, passwordHash) => {
  const [result] = await pool.query(
    "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
    [username, email, passwordHash]
  );
  return result;
};

module.exports = {
  findUserByEmail,
  findUserByUsername,
  findUserById,
  createUser
};