# Senior Design Project

**Your Friendly Neighborhood Chatster (YFNC)** is a full-stack real-time chat application I built as my senior design project. The main idea was to create a chat platform where users can create and join servers, communicate through channels and direct messages, manage roles and permissions, share attachments, add friends, use safety features, and interact with an integrated AI assistant.

## Technology Stack

The project is split into a React frontend, a Node.js/Express backend, and a MySQL database.

- **Frontend:** React 19, Vite, React Router, Socket.IO Client, CSS
- **Backend:** Node.js, Express 5, Socket.IO, JWT, MySQL2, Nodemailer, Multer, Swagger/OpenAPI
- **Database:** MySQL 8 / InnoDB
- **Testing:** Jest, Supertest, Selenium WebDriver, ESLint

## Requirements

The project uses **Node.js 22.12.0**, which is pinned in the `.nvmrc` file. Both the frontend and backend also support `^20.19.0 || >=22.12.0`. npm 10 or newer is recommended.

If you use nvm-windows, you can install and switch to the expected Node.js version with:

```powershell
nvm install 22.12.0
nvm use 22.12.0
```

## Environment Setup

The real `.env` files are ignored by Git, so the repository only contains example files. Create your local environment files from those examples:

```bash
cp Backend/.env.example Backend/.env
cp Frontend/.env.example Frontend/.env
```

On Windows PowerShell:

```powershell
Copy-Item Backend/.env.example Backend/.env
Copy-Item Frontend/.env.example Frontend/.env
```

After that, fill in the required database, JWT, SMTP, and optional AI provider values in `Backend/.env`.

For production, the real frontend and backend URLs, allowed CORS origins, proxy-hop count, and persistent upload directory should also be configured.

You can check the backend environment configuration before starting the server with:

```bash
cd Backend
npm run config:check
```

The available AI providers are `local`, `gemini`, and `openai`. An API key is only required if Gemini or OpenAI is selected.

## Database Setup

First, create an empty MySQL database using the same name as the `DB_NAME` value in your backend `.env` file.

For a completely new database:

```bash
cd Backend
npm run db:setup
```

This applies the base schema and sets up the migration system.

The `db:schema` command is intentionally prevented from running on a database that already contains data. Once the application has real data, any future schema changes should be added as numbered SQL files inside `Database/migrations/` and applied with:

```bash
npm run db:migrate
```

Applied migrations are stored in the `schema_migrations` table together with SHA-256 checksums. This prevents an already-applied migration from being edited without being detected.

Optional development/demo data can be added with:

```bash
npm run db:seed
```

The seed command will not run when `NODE_ENV=production`.

## Running the Project Locally

Start the backend:

```bash
cd Backend
npm ci
npm run config:check
npm start
```

Then start the frontend in a second terminal:

```bash
cd Frontend
npm ci
npm run dev
```

With the default local configuration, the application uses:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- API: `http://localhost:5000/api`
- Swagger/OpenAPI: `http://localhost:5000/api-docs` when enabled

Swagger is enabled by default during development. In production it is disabled unless `SWAGGER_ENABLED=true` is set. `API_PUBLIC_URL` controls which backend URL appears in the generated OpenAPI documentation.

## Production Build and Deployment

For a production frontend build, `VITE_API_URL` must be set to the real API URL. This is intentional so a production build cannot accidentally fall back to localhost.

Then run:

```bash
cd Frontend
npm run lint
npm run build
```

The built frontend is generated in `Frontend/dist/`.

More detailed deployment information, including production environment variables, health checks, persistent uploads, scaling notes, release checks, and rollback guidance, is available in [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Continuous Integration

The project includes a GitHub Actions workflow in `.github/workflows/ci.yml`.

On pushes and pull requests to `main`, it automatically runs the backend configuration check, Jest tests, dependency audits, frontend linting, and the production frontend build.

Selenium is kept as a local/release-candidate system test because the authenticated flow needs a running application and a test account.

## Testing

To run the complete backend test suite:

```bash
cd Backend
npm test
```

You can also run the test groups separately:

```bash
npm run test:unit
npm run test:integration
npm run test:coverage
```

For frontend checks:

```bash
cd Frontend
npm run lint
npm run build
```

The Selenium E2E test expects both the frontend and backend to already be running:

```bash
npm run test:e2e
```

Optional E2E environment variables include `E2E_APP_URL`, `E2E_HEADLESS`, `E2E_USER_LOGIN`, `E2E_USER_PASSWORD`, `E2E_CHANNEL_URL`, `E2E_MESSAGE_TEXT`, and `CHROME_BINARY_PATH`.

## Project Structure

```text
Backend/
  scripts/           configuration and database scripts
  src/               Express and Socket.IO application code
  tests/             Jest unit and integration tests
  uploads/           local development upload storage
Database/
  schema.sql         base schema for a new database
  seed.sql           optional development/demo data
  migrations/        database changes added after the base schema
Frontend/
  src/               React application
  tests/selenium/    Selenium system/E2E test
```
