const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const connectDB = async () => {
  const connection = await pool.getConnection();

  try {
    await connection.ping();
    console.log("MySQL connected successfully");
  } finally {
    connection.release();
  }
};

const withTransaction = async (work) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("Database rollback failed:", rollbackError.message);
    }

    throw error;
  } finally {
    connection.release();
  }
};

const closeDB = async () => {
  await pool.end();
};

module.exports = connectDB;
module.exports.pool = pool;
module.exports.withTransaction = withTransaction;
module.exports.closeDB = closeDB;
