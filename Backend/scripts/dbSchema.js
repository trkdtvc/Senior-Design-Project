require("dotenv").config();
const { validateEnvironment } = require("../src/config/env");
const { createDatabaseConnection, readSqlFile } = require("./dbScriptUtils");

const main = async () => {
  validateEnvironment({ profile: "database" });
  const connection = await createDatabaseConnection();

  try {
    const [tables] = await connection.query("SHOW TABLES");

    if (tables.length > 0) {
      throw new Error(
        "Refusing to apply Database/schema.sql because the selected database is not empty. Use npm run db:migrate for an existing database."
      );
    }

    const schemaSql = await readSqlFile("schema.sql");
    await connection.query(schemaSql);
    console.log(`Database schema applied successfully to ${process.env.DB_NAME}.`);
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  console.error(`Database schema setup failed: ${error.message}`);
  process.exitCode = 1;
});
