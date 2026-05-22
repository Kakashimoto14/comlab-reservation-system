# ComPort Deployment Guide

This repository is a monorepo with:

- `backend/` for the Express API, Prisma schema, migrations, SMTP delivery, and AI integrations
- `frontend/` for the Vite + React application

`.env.example` files are templates only. They are not used automatically. Create real runtime files at `backend/.env` and `frontend/.env`, and never commit those files.

## 1. Prerequisites

- Node.js `22.x`
- npm
- A Supabase PostgreSQL project
- An SMTP provider for production email delivery
- Optional AI provider account:
  - Groq
  - OpenRouter
  - a custom OpenAI-compatible provider

## 2. Local Environment Setup

Install dependencies from the repository root:

```bash
npm install
```

Create your real local environment files from the templates:

Windows:

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

macOS or Linux:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## 3. Backend Local Env

Use this local preview configuration in `backend/.env`:

```env
PORT=5000
NODE_ENV=development

CLIENT_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173
APP_BASE_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://localhost:5174

DATABASE_URL="postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
DIRECT_URL="postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

JWT_SECRET=replace_this_with_a_real_long_random_secret
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=replace_this_with_a_second_real_long_random_secret
JWT_REFRESH_EXPIRES_IN=7d

AUTH_COOKIE_NAME=comlab_access_token
AUTH_COOKIE_MAX_AGE_MS=86400000
REFRESH_COOKIE_NAME=comlab_refresh_token
REFRESH_COOKIE_MAX_AGE_MS=604800000
AUTH_COOKIE_SAME_SITE=lax

RESET_TOKEN_TTL_MINUTES=30
EMAIL_VERIFICATION_TOKEN_TTL_HOURS=24
RESET_TOKEN_PREVIEW=true
ENABLE_DEMO_BOOTSTRAP=false
NOTIFICATION_EMAIL_PREVIEW=true

SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_brevo_smtp_login
SMTP_PASS=your_brevo_smtp_key
SMTP_FROM="ComPort <verified_sender@example.com>"
SMTP_FROM_EMAIL=verified_sender@example.com
SMTP_FROM_NAME=ComPort
SMTP_TLS_REJECT_UNAUTHORIZED=true

AI_PROVIDER=
AI_API_KEY=
AI_MODEL=
AI_API_BASE_URL=
OPENROUTER_SITE_URL=
OPENROUTER_APP_NAME=ComPort

RESERVATION_REMINDER_LEAD_MINUTES=60
RESERVATION_REMINDER_INTERVAL_MS=60000
LOGIN_RATE_LIMIT_WINDOW_MS=60000
LOGIN_RATE_LIMIT_MAX=5
REGISTER_RATE_LIMIT_WINDOW_MS=60000
REGISTER_RATE_LIMIT_MAX=5
PASSWORD_RESET_RATE_LIMIT_WINDOW_MS=60000
PASSWORD_RESET_RATE_LIMIT_MAX=5
```

Notes:

- `DATABASE_URL` is the Supabase pooler URL used by the running backend.
- `DIRECT_URL` is the Supabase session pooler URL used by Prisma migrations.
- Replace `PROJECT_REF` with your Supabase project ref.
- Replace `YOUR_PASSWORD` with your Supabase database password.
- `CLIENT_URL`, `FRONTEND_URL`, and `APP_BASE_URL` are single canonical frontend URLs.
- `CORS_ORIGINS` is the only comma-separated frontend origin allowlist.
- Leave SMTP blank in local preview mode if you want preview links instead of real email delivery.

## 4. Frontend Local Env

Use this local frontend configuration in `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

## 5. Database Setup

From the repository root:

```bash
npm run prisma:generate --workspace backend
npm run prisma:migrate:reset --workspace backend
npm run seed --workspace backend
```

Warnings:

- `prisma migrate reset` deletes data and is for development only.
- Do not use `migrate reset` in production.
- Use the backend workspace commands so Prisma loads `backend/.env` correctly.

Fallback from inside `backend/`:

```bash
cd backend
npx prisma generate
npx prisma migrate reset
npx tsx prisma/seed.ts
```

## 6. Run Locally

Start both services from the repository root:

```bash
npm run dev
```

Expected local URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000/api`
- Backend health: `http://localhost:5000/api/health`

## 7. Test Local Features

After the dev servers are running:

1. Open `http://localhost:5173`
2. Register a new student account
3. Confirm the app asks for email verification
4. In preview mode, use the verification link shown in the UI
5. Confirm unverified login is blocked
6. Verify the account and log in
7. Use `/forgot-password` and complete the reset flow with the preview reset link
8. Log in and open `/assistant`
9. Ask:
   - `What are the available schedules this week?`
   - `Which laboratories are available today?`
   - `Show my upcoming reservations.`
   - `What are the reservation rules?`
   - `What time slots are open this week?`
10. Confirm fallback mode works even if no AI key is configured

## 8. Production Environment

Use real environment variables in your hosting platform. Do not upload `.env` files to git.

Backend production example:

```env
PORT=5000
NODE_ENV=production

CLIENT_URL=https://www.comlabreservation.app
FRONTEND_URL=https://www.comlabreservation.app
APP_BASE_URL=https://www.comlabreservation.app
CORS_ORIGINS=https://www.comlabreservation.app,https://comlabreservation.app

DATABASE_URL="postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
DIRECT_URL="postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

JWT_SECRET=generate_a_real_long_random_secret
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=generate_a_second_real_long_random_secret
JWT_REFRESH_EXPIRES_IN=7d

AUTH_COOKIE_NAME=comlab_access_token
AUTH_COOKIE_MAX_AGE_MS=86400000
REFRESH_COOKIE_NAME=comlab_refresh_token
REFRESH_COOKIE_MAX_AGE_MS=604800000
AUTH_COOKIE_SAME_SITE=none

RESET_TOKEN_TTL_MINUTES=30
EMAIL_VERIFICATION_TOKEN_TTL_HOURS=24
RESET_TOKEN_PREVIEW=false
ENABLE_DEMO_BOOTSTRAP=false
NOTIFICATION_EMAIL_PREVIEW=false

SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_brevo_smtp_login
SMTP_PASS=your_brevo_smtp_key
SMTP_FROM="ComPort <verified_sender@your-domain.com>"
SMTP_FROM_EMAIL=verified_sender@your-domain.com
SMTP_FROM_NAME=ComPort
SMTP_TLS_REJECT_UNAUTHORIZED=true

AI_PROVIDER=groq
AI_API_KEY=your_groq_key
AI_MODEL=llama-3.1-8b-instant
AI_API_BASE_URL=
OPENROUTER_SITE_URL=https://www.comlabreservation.app
OPENROUTER_APP_NAME=ComPort

GOOGLE_CALENDAR_ENABLED=false
GOOGLE_CALENDAR_ID=your_calendar_id@group.calendar.google.com
GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nKEY_CONTENT_HERE\n-----END PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID=your-google-cloud-project-id
GOOGLE_CALENDAR_TIME_ZONE=Asia/Manila
```

Frontend production example:

```env
VITE_API_URL=https://comport-pm3ss.ondigitalocean.app/api
```

If a reverse proxy maps the frontend and backend to the same domain, you may use:

```env
VITE_API_URL=/api
```

## 8.1 Google Calendar Setup

Google Calendar sync is optional. Keep it disabled until the Google Cloud setup and production environment variables are complete.

Google Cloud setup:

1. Open Google Cloud Console and create or select a project.
2. Enable Google Calendar API for the project.
3. Create a service account for ComPort.
4. Create a JSON key for the service account.
5. Open the target Google Calendar settings.
6. Share the calendar with the service-account `client_email`.
7. Grant `Make changes to events` permission.

Backend variables:

```env
GOOGLE_CALENDAR_ENABLED=true
GOOGLE_CALENDAR_ID=your_calendar_id@group.calendar.google.com
GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID=your-google-cloud-project-id
GOOGLE_CALENDAR_TIME_ZONE=Asia/Manila
```

DigitalOcean notes:

- Add these values only to the backend app or backend service environment.
- Do not add Google private keys to the frontend app.
- Store `GOOGLE_PRIVATE_KEY` with escaped newline characters (`\n`) if the dashboard accepts single-line values.
- Keep the full key wrapper: `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n`.
- Keep `GOOGLE_CALENDAR_ENABLED=false` if the calendar is not ready. Reservation approval will continue to work.
- After adding the migration, let the backend start command run `prisma migrate deploy`, or run `npm run prisma:migrate:deploy --workspace backend` during release.

## 9. Production Database Migration

Run these from the repository root during deploy or release:

```bash
npm run prisma:migrate:deploy --workspace backend
npm run prisma:generate --workspace backend
```

Warning:

- Never run `npm run prisma:migrate:reset --workspace backend` in production.

## 10. Production Build

Build from the repository root:

```bash
npm run build
```

Start the backend from the repository root:

```bash
npm run start --workspace backend
```

Important:

- Backend `start:deploy` runs `prisma generate`, `prisma migrate deploy`, then starts the API server.
- The frontend is a Vite build. Deploy its built output with your chosen static host or frontend platform.
- Set `VITE_API_URL` before building the frontend.
- The backend currently starts reminder and notification workers inside the API process. Run a single backend instance in production unless you intentionally redesign worker coordination.

## 11. SMTP Setup

Local preview mode:

- `RESET_TOKEN_PREVIEW=true`
- `NOTIFICATION_EMAIL_PREVIEW=true`
- SMTP values may be blank
- verification and reset links are exposed only in development preview flows

Production real SMTP mode:

- `RESET_TOKEN_PREVIEW=false`
- `NOTIFICATION_EMAIL_PREVIEW=false`
- for Brevo, use `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, and `SMTP_SECURE=false`
- use the Brevo SMTP login and SMTP key, not a Brevo API key
- configure `SMTP_FROM` with a sender email that is verified in Brevo
- keep `SMTP_TLS_REJECT_UNAUTHORIZED=true` in production

Behavior:

- In development, missing SMTP falls back to safe preview mode
- In production, missing SMTP does not crash the app at boot, but email-required flows such as registration verification and password reset will fail clearly until SMTP is configured
- `SMTP_TLS_REJECT_UNAUTHORIZED=false` is a development-only escape hatch for local certificate interception and is ignored in production

## 12. AI Provider Setup

Recommended default: Groq

```env
AI_PROVIDER=groq
AI_API_KEY=your_groq_key
AI_MODEL=llama-3.1-8b-instant
AI_API_BASE_URL=
```

OpenRouter:

```env
AI_PROVIDER=openrouter
AI_API_KEY=your_openrouter_key
AI_MODEL=choose_a_valid_model
AI_API_BASE_URL=
OPENROUTER_SITE_URL=https://your-frontend-domain.com
OPENROUTER_APP_NAME=ComPort
```

Custom OpenAI-compatible provider:

```env
AI_PROVIDER=custom
AI_API_KEY=your_provider_key
AI_MODEL=your_model_name
AI_API_BASE_URL=https://your-provider.example.com/openai/v1
```

Fallback mode:

- If `AI_PROVIDER`, `AI_API_KEY`, or `AI_MODEL` are missing, the assistant uses deterministic system-data replies instead of crashing.

## 13. Post-Deployment Smoke Test

After deploying:

1. Check `GET /api/health`
2. Open the frontend and confirm login/register pages load
3. Register a new student
4. Confirm email verification works with real SMTP
5. Confirm unverified login is blocked
6. Confirm forgot/reset password works
7. Log in and open `/assistant`
8. Confirm the assistant answers reservation questions
9. Confirm unrelated questions are refused
10. Test a basic reservation flow end to end
11. With `GOOGLE_CALENDAR_ENABLED=false`, approve a reservation and confirm approval succeeds with calendar disabled status
12. With Google variables configured, approve a test reservation and confirm a Google Calendar event is created
13. Temporarily use an invalid calendar ID in a non-production test environment and confirm approval still succeeds while sync status becomes failed

## 14. Troubleshooting

### `EADDRINUSE: address already in use :::5000`

- Another process is already using port `5000`
- Stop the old process or change `PORT` in `backend/.env`

### `P1001: Can't reach database server`

- Verify the Supabase project is running
- Verify `DATABASE_URL` and `DIRECT_URL`
- Use the Supabase session pooler on port `5432` for `DIRECT_URL`
- Check firewall or network restrictions

### `Environment variable not found: DIRECT_URL`

- You are likely running Prisma from the wrong location
- Use:

```bash
npm run prisma:migrate:reset --workspace backend
```

or:

```bash
cd backend
npx prisma migrate reset
```

### Prisma says a migration was modified after being applied

- In development with disposable data, reset the database:

```bash
npm run prisma:migrate:reset --workspace backend
```

- Do not use reset in production

### Registration or password reset returns `503`

- SMTP is not configured for production delivery, or preview mode is disabled without valid SMTP settings
- Check `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`
- Confirm `SMTP_PASS` is a Brevo SMTP key and the sender email in `SMTP_FROM` is verified
- In local development, enable preview mode

### `VITE_API_URL` is missing during production build

- Set `VITE_API_URL` before running the frontend build
- Example:

```env
VITE_API_URL=https://comport-pm3ss.ondigitalocean.app/api
```

### CORS or frontend/backend URL mismatch

- Confirm `CLIENT_URL`, `FRONTEND_URL`, and `APP_BASE_URL` are single canonical frontend URLs such as `https://www.comlabreservation.app`
- Do not put comma-separated values in `CLIENT_URL`, `FRONTEND_URL`, or `APP_BASE_URL`
- Add every browser origin to `CORS_ORIGINS`, including both `https://www.comlabreservation.app` and `https://comlabreservation.app` if both domains serve the frontend
- Keep `AUTH_COOKIE_SAME_SITE=none` in production so cookie auth works cross-site

### Assistant returns `400 Bad Request`

- Very short greetings such as `Hi` should return a friendly assistant response after this deployment
- If a future validation error happens, the frontend shows the backend message instead of a generic outage message
- If the assistant returns `401`, log in again so the cross-site auth cookies are refreshed

### AI provider is missing or invalid

- Double-check `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, and `AI_API_BASE_URL` when using `custom`
- If values are absent, the assistant falls back to deterministic replies using live system data

### Google Calendar event is not created

- Confirm `GOOGLE_CALENDAR_ENABLED=true` on the backend service
- Confirm Google Calendar API is enabled in the Google Cloud project
- Confirm the target calendar is shared with `GOOGLE_CLIENT_EMAIL`
- Confirm `GOOGLE_CALENDAR_ID` is the calendar ID, not the human display name
- Confirm `GOOGLE_PRIVATE_KEY` includes valid escaped newline characters
- If the server logs mention `DECODER routines::unsupported`, re-copy `private_key` from the service-account JSON and store it as `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`
- Check the reservation row: `calendarSyncStatus` should show `SYNCED`, `FAILED`, `DISABLED`, or `NOT_ATTEMPTED`

### Reservation approval works but calendar sync failed

- This is expected fail-open behavior. ComPort saves the approval first, then records the calendar failure.
- Fix the backend Google variables or calendar sharing, then manually recreate the event or re-review a fresh test reservation.
- Do not expose service-account credentials to the frontend while troubleshooting.
