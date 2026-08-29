require("dotenv").config();
const { validateEnvironment } = require("../src/config/env");
const { createDatabaseConnection, readSqlFile } = require("./dbScriptUtils");

const main = async () => {
  validateEnvironment({ profile: "database" });

  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run development seed data with NODE_ENV=production.");
  }

  const connection = await createDatabaseConnection();

  try {
    const seedSql = await readSqlFile("seed.sql");
    await connection.query(seedSql);
    console.log(`Development seed applied successfully to ${process.env.DB_NAME}.`);
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  console.error(`Database seed failed: ${error.message}`);
  process.exitCode = 1;
});
