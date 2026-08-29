# YFNC Frontend

The frontend for **Your Friendly Neighborhood Chatster** is a React 19 application built with Vite and connected to the backend through REST APIs and Socket.IO.

## Setup

Copy `.env.example` to `.env` and set `VITE_API_URL` to the backend API base URL. For local development the example uses:

```text
VITE_API_URL=http://localhost:5000/api
```

Then install and run:

```bash
npm ci
npm run dev
```

## Quality checks and production build

```bash
npm run lint
npm run build
```

Production builds require `VITE_API_URL`; this prevents a deployed bundle from silently falling back to a localhost API.

## System/E2E test

With the frontend and backend already running:

```bash
npm run test:e2e
```

Set `E2E_USER_LOGIN` and `E2E_USER_PASSWORD` to enable the authenticated Selenium flow. Additional optional variables are documented in the repository root README.
