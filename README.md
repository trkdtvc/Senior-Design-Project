# Senior Design Project

**Your Friendly Neighborhood Chatster (YFNC)** is a full-stack real-time chat application built as a senior design project. Users can create and join servers, communicate in channels and direct messages, manage roles and permissions, share attachments, manage friends and safety settings, and use an integrated AI assistant.

## Technology stack

- **Frontend:** React 19, Vite, React Router, Socket.IO Client, CSS
- **Backend:** Node.js, Express 5, Socket.IO, JWT, MySQL2, Nodemailer, Multer, Swagger/OpenAPI
- **Database:** MySQL 8 / InnoDB
- **Testing:** Jest, Supertest, Selenium WebDriver, ESLint

## Runtime requirements

The repository pins **Node.js 22.12.0** in `.nvmrc`. The supported Node.js range in both packages is `^20.19.0 || >=22.12.0`, which also satisfies the current Vite runtime requirement. npm 10 or newer is recommended/required by the package metadata.

The `.nvmrc` file can be used by Node version managers that support it. With nvm-windows, use:

```powershell
nvm install 22.12.0
nvm use 22.12.0
```

## Environment configuration

Real `.env` files are intentionally ignored by Git. Start from the committed examples:

```bash
cp Backend/.env.example Backend/.env
cp Frontend/.env.example Frontend/.env
```

On Windows PowerShell, the equivalent is:

```powershell
Copy-Item Backend/.env.example Backend/.env
Copy-Item Frontend/.env.example Frontend/.env
```

Fill in the database, JWT, SMTP, and optional hosted-AI credentials in `Backend/.env`. For a production deployment, also set the real frontend/API URLs, CORS origins, proxy-hop count, and a persistent `UPLOAD_DIR` if the host uses an ephemeral filesystem.

The backend validates required configuration before opening the HTTP server. You can validate it explicitly with:

```bash
cd Backend
npm run config:check
```

`AI_PROVIDER` can be `local`, `gemini`, or `openai`. A provider API key is required only when that hosted provider is selected.

## Database setup and migrations

Create the empty MySQL database named by `DB_NAME` first. The application database user should have only the permissions needed for this project.

For a brand-new empty database:

```bash
cd Backend
npm run db:setup
```

`db:setup` applies the baseline schema and then initializes/runs the migration ledger.

`db:schema` deliberately refuses to run against a non-empty database. Once real data exists, schema changes must be added as numbered SQL files under `Database/migrations/` and applied with:

```bash
npm run db:migrate
```

The migration runner records filenames and SHA-256 checksums in `schema_migrations` and refuses to silently accept edits to already-applied migrations.

Optional development/demo data can be loaded with:

```bash
npm run db:seed
```

The seed command refuses to run when `NODE_ENV=production`.

## Install and run

Backend:

```bash
cd Backend
npm ci
npm run config:check
npm start
```

Frontend, in a second terminal:

```bash
cd Frontend
npm ci
npm run dev
```

The default local addresses in the example configuration are:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- API: `http://localhost:5000/api`
- Swagger/OpenAPI: `http://localhost:5000/api-docs` when enabled

Swagger is enabled by default outside production and disabled by default in production unless `SWAGGER_ENABLED=true` is explicitly configured. `API_PUBLIC_URL` controls the server URL advertised in the generated OpenAPI specification.

## Production build and deployment

The frontend intentionally requires `VITE_API_URL` for production builds so there is no silent localhost fallback. Before deployment, set it to the real production API URL (or `/api` for same-origin hosting):

```bash
cd Frontend
npm run lint
npm run build
```

The generated production assets are written to `Frontend/dist/`.

For provider-neutral production requirements, health-check endpoints, persistent upload guidance, scaling assumptions, and the release checklist, see [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Continuous integration

GitHub Actions runs the backend configuration check, complete Jest suite, dependency audit, frontend lint, production build, and frontend dependency audit on pushes and pull requests to `main` (`.github/workflows/ci.yml`). Selenium remains a release-candidate/local system test because its authenticated flow requires a running application and test account.

## Tests

Backend full suite:

```bash
cd Backend
npm test
```

Backend subsets:

```bash
npm run test:unit
npm run test:integration
npm run test:coverage
```

Frontend quality checks:

```bash
cd Frontend
npm run lint
npm run build
```

Selenium system/E2E testing expects the frontend and backend to already be running:

```bash
npm run test:e2e
```

Optional E2E environment variables include `E2E_APP_URL`, `E2E_HEADLESS`, `E2E_USER_LOGIN`, `E2E_USER_PASSWORD`, `E2E_CHANNEL_URL`, `E2E_MESSAGE_TEXT`, and `CHROME_BINARY_PATH`.

## Repository layout

```text
Backend/
  scripts/           operational/configuration and database scripts
  src/               Express/Socket.IO application code
  tests/             Jest unit and integration tests
  uploads/           local development upload storage
Database/
  schema.sql         baseline schema for a new empty database
  seed.sql           repeatable development/demo seed
  migrations/        forward-only schema changes after the baseline
Frontend/
  src/               React application
  tests/selenium/    system/E2E smoke test
```
