const fs = require("fs/promises");
const path = require("path");
const mysql = require("mysql2/promise");

const { backendRoot } = require("../src/config/paths");

const projectRoot = path.resolve(backendRoot, "..");
const databaseRoot = path.join(projectRoot, "Database");

const createDatabaseConnection = () =>
  mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

const readSqlFile = (filename) =>
  fs.readFile(path.join(databaseRoot, filename), "utf8");

module.exports = {
  createDatabaseConnection,
  databaseRoot,
  readSqlFile
};
