# Database migrations

`Database/schema.sql` is the baseline for a brand-new empty database. After the application has real data, do not rebuild the database to change its schema. Add a numbered SQL migration here instead.

Use filenames such as `001_add_example_index.sql`, `002_add_example_column.sql`, and so on. Migration files are applied in filename order by `npm run db:migrate` from the `Backend` directory. The runner records each applied filename and SHA-256 checksum in the database's `schema_migrations` table and refuses to continue if an already-applied migration has later been edited. Checksums normalize Windows/Unix line endings so the same committed migration remains portable across development environments.

For a new environment, create the empty database first and run `npm run db:setup`. For an existing environment, run only `npm run db:migrate`. `npm run db:seed` is optional development/demo data and refuses to run when `NODE_ENV=production`.

Treat applied migrations as immutable. If a schema change needs correction, create a new migration instead of modifying the old file. Because MySQL can implicitly commit DDL statements, keep each migration focused and test it on a backup/staging copy before applying it to production data.
