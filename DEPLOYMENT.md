# Deployment checklist

The current architecture is intended to be deployed as a **single backend instance** with MySQL and persistent file storage. Complete this checklist for the chosen hosting provider before exposing the application publicly.

## 1. Runtime and installation

- Use the Node.js version pinned in `.nvmrc` (22.12.0) or another version accepted by both package `engines` fields.
- Install from the committed lockfiles with `npm ci` in both `Backend` and `Frontend`.
- Do not deploy local `.env` files or commit credentials to Git.

## 2. Production environment

Create production environment values from `Backend/.env.example` and `Frontend/.env.example`.

At minimum, replace all local-development values with the real deployment values:

- `NODE_ENV=production`
- `FRONTEND_URL`
- `CORS_ORIGINS`
- `API_PUBLIC_URL`
- `TRUST_PROXY_HOPS`
- `DB_*`
- `JWT_SECRET`
- `MAIL_*`
- hosted-AI keys/model settings if used
- `UPLOAD_DIR` pointing at persistent storage
- `VITE_API_URL` pointing at the deployed API (or `/api` for a same-origin reverse-proxy setup)

Use HTTPS for the public frontend and backend URLs. Terminate TLS at the hosting platform or reverse proxy and set `TRUST_PROXY_HOPS` to the actual number of trusted proxy hops.

Validate the backend configuration before startup:

```bash
cd Backend
npm run config:check
```

## 3. Database

Use a dedicated MySQL application account with access limited to this project database.

For an existing production database, apply only forward migrations:

```bash
cd Backend
npm run db:migrate
```

Do **not** run `db:schema`, `db:setup`, or `db:seed` against a populated production database.

Back up the database before applying a new production migration and before destructive maintenance.

## 4. Persistent uploads

`UPLOAD_DIR` must be on persistent storage. The default local `Backend/uploads` directory is not appropriate on hosts where the application filesystem is ephemeral.

Back up uploaded files together with the database. Attachment database rows and stored files are related and should be restored consistently.

## 5. Process and health checks

Start the backend with:

```bash
cd Backend
npm start
```

The backend exposes two unauthenticated operational endpoints:

- `GET /api/health/live` — process liveness
- `GET /api/health/ready` — database and upload-storage readiness

Configure the hosting platform to use `/api/health/live` for liveness and `/api/health/ready` for readiness when separate probes are supported.

The server handles `SIGTERM`/`SIGINT` for graceful Socket.IO, presence, HTTP, and database shutdown.

## 6. Frontend build

Build the frontend only after setting the production `VITE_API_URL`:

```bash
cd Frontend
npm ci
npm run lint
npm run build
```

Deploy the contents of `Frontend/dist/` to the static frontend host.

If client-side routing is served by a static host, configure SPA fallback/rewrite behavior so non-file routes such as `/login`, `/register`, and `/dashboard` resolve to `index.html`.

## 7. Single-instance assumption

The current backend intentionally uses in-process state for rate limiting and active Socket.IO connection tracking. Therefore, deploy **one backend application instance** unless shared infrastructure is added.

Before horizontal scaling, add at least:

- a shared rate-limit store (for example Redis),
- a Socket.IO multi-instance adapter/shared pub-sub layer,
- shared/persistent attachment storage accessible from every instance.

Running multiple independent backend instances without those changes can make rate limits and presence/socket behavior inconsistent.

## 8. Pre-release verification

Before each release, run:

```bash
cd Backend
npm ci
npm run config:check
npm test
npm audit
npm run db:migrate
```

and:

```bash
cd Frontend
npm ci
npm run lint
npm run build
npm audit
```

For the final release candidate, also run the Selenium system/E2E test against the running application, including the authenticated flow by supplying `E2E_USER_LOGIN` and `E2E_USER_PASSWORD`.

## 9. Post-deployment smoke check

After deployment, verify:

1. `/api/health/live` returns HTTP 200.
2. `/api/health/ready` returns HTTP 200.
3. Registration/email verification or login works.
4. Server/channel and direct-message flows work.
5. Socket.IO presence and real-time messages work.
6. Attachment upload/download works from persistent storage.
7. Password reset email links use the public frontend URL.
8. The browser makes API calls only to the intended production backend.

## 10. Rollback

Keep the previous deployable application revision available. If a release fails:

1. stop or roll back the application revision,
2. restore the previous application version,
3. restore the database/upload backup only if the failed release performed an incompatible data change,
4. re-run the health and smoke checks.

Database migrations are forward-only, so every future migration should be designed with rollback/compatibility planning before production use.
