const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const { validateEnvironment } = require("../src/config/env");
const { createDatabaseConnection, databaseRoot } = require("./dbScriptUtils");

const migrationsDirectory = path.join(databaseRoot, "migrations");
const migrationFilenamePattern = /^\d{3,}_[a-z0-9][a-z0-9_-]*\.sql$/;

const checksum = (contents) =>
  crypto
    .createHash("sha256")
    .update(String(contents).replace(/\r\n/g, "\n"), "utf8")
    .digest("hex");

const loadMigrationFiles = async () => {
  const entries = await fs.readdir(migrationsDirectory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
};

const validateMigrationFilenames = (migrationFiles) => {
  const invalidFilename = migrationFiles.find(
    (filename) => !migrationFilenamePattern.test(filename)
  );

  if (invalidFilename) {
    throw new Error(
      `Invalid migration filename "${invalidFilename}". Use a name such as 001_add_example_index.sql.`
    );
  }
};

const main = async () => {
  validateEnvironment({ profile: "database" });
  const migrationFiles = await loadMigrationFiles();
  validateMigrationFilenames(migrationFiles);

  const connection = await createDatabaseConnection();

  try {
    const [baselineTables] = await connection.query(
      "SHOW TABLES LIKE 'users'"
    );

    if (baselineTables.length === 0) {
      throw new Error(
        "Baseline schema is missing. Run npm run db:schema against a new empty database before running migrations."
      );
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name varchar(255) NOT NULL,
        checksum char(64) NOT NULL,
        applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (migration_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    const [appliedRows] = await connection.query(
      "SELECT migration_name, checksum FROM schema_migrations"
    );
    const appliedMigrations = new Map(
      appliedRows.map((row) => [row.migration_name, row.checksum])
    );

    let appliedCount = 0;

    for (const filename of migrationFiles) {
      const filePath = path.join(migrationsDirectory, filename);
      const sql = await fs.readFile(filePath, "utf8");
      const fileChecksum = checksum(sql);
      const priorChecksum = appliedMigrations.get(filename);

      if (priorChecksum) {
        if (priorChecksum !== fileChecksum) {
          throw new Error(
            `Migration ${filename} was modified after it was applied. Create a new migration instead of editing an applied migration.`
          );
        }

        continue;
      }

      if (!sql.trim()) {
        throw new Error(`Migration ${filename} is empty.`);
      }

      await connection.query(sql);
      await connection.execute(
        "INSERT INTO schema_migrations (migration_name, checksum) VALUES (?, ?)",
        [filename, fileChecksum]
      );
      appliedCount += 1;
      console.log(`Applied migration: ${filename}`);
    }

    if (appliedCount === 0) {
      console.log("Database migrations are up to date.");
    }
  } finally {
    await connection.end();
  }
};

if (require.main === module) {
  require("dotenv").config();

  main().catch((error) => {
    console.error(`Database migration failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  checksum,
  validateMigrationFilenames
};
