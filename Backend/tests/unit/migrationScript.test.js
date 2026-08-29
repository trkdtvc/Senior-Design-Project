const {
  checksum,
  validateMigrationFilenames
} = require("../../scripts/dbMigrate");

test("migration filenames must use an ordered numeric prefix", () => {
  expect(() =>
    validateMigrationFilenames([
      "001_add_users_index.sql",
      "002_add_channel_setting.sql"
    ])
  ).not.toThrow();

  expect(() => validateMigrationFilenames(["add_users_index.sql"]))
    .toThrow(/Invalid migration filename/);
});

test("migration checksums are stable and change with file contents", () => {
  const first = checksum("ALTER TABLE users ADD COLUMN example int;\n");
  const same = checksum("ALTER TABLE users ADD COLUMN example int;\n");
  const windowsLineEndings = checksum(
    "ALTER TABLE users ADD COLUMN example int;\r\n"
  );
  const changed = checksum("ALTER TABLE users ADD COLUMN example bigint;\n");

  expect(first).toHaveLength(64);
  expect(first).toBe(same);
  expect(first).toBe(windowsLineEndings);
  expect(first).not.toBe(changed);
});
