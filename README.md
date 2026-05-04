# ComLab Reservation System

ComLab Reservation System is a full-stack web application for managing college computer laboratory reservations. It supports student self-service booking, laboratory staff operations, administrator oversight, PC-level reservation handling, approval workflows, calendar blocking, reporting, audit logging, password recovery, and real-time in-app notifications.

The current codebase now includes production-oriented security improvements such as cookie-based authentication, refresh-session rotation, stricter password rules, notification inbox APIs, and a real-time notification stream.

## Highlights

- Student registration, login, forgot-password, reset-password, and change-password flows
- Cookie-based authentication with `HttpOnly` access and refresh cookies
- Refresh-session rotation with server-side session tracking
- Role-based access for `ADMIN`, `LABORATORY_STAFF`, and `STUDENT`
- Public laboratory browsing plus protected reservation workflows
- Whole-lab and PC-specific reservation support
- Schedule overlap prevention and reservation conflict checks
- Staff-scoped management based on assigned laboratories
- Admin calendar management for maintenance and holiday blocking
- In-app notification inbox with unread counts and live updates
- Email notification pipeline with preview mode and SMTP support
- Reservation dashboards, charts, filters, and CSV export
- Activity logging for authentication, reservation actions, and operational changes
- Route-level frontend code splitting to reduce the production bundle
- Responsive UI with improved desktop navigation and quicker logout access

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: MySQL
- ORM: Prisma
- Authentication: JWT, `HttpOnly` cookies, bcrypt
- Validation: Zod
- Data fetching: React Query
- Charts: Chart.js with `react-chartjs-2`
- Testing: Vitest, Testing Library, Supertest-ready backend structure
- Optional local container support: Docker Compose

## Current Security Model

Phase 1 and Phase 2 security work now included in the repository:

- Access tokens are stored in secure `HttpOnly` cookies instead of `localStorage`
- Refresh tokens are stored in a separate `HttpOnly` cookie
- Refresh-session rotation is backed by the `AuthSession` table
- Expired access sessions can be renewed through `POST /api/auth/refresh`
- Logout revokes the current refresh session instead of only clearing client state
- Stronger password rules are enforced for registration and password changes
- CORS is credentials-aware and restricted to configured client origins
- Helmet and request-size limits are enabled
- Rate limiting is applied to login, registration, and password reset endpoints
- Public demo quick-access credentials were removed from the UI
- Demo bootstrap is disabled by default unless explicitly enabled

## Main User Flows

### Student

- Register an account
- Log in securely
- Browse laboratories and schedules
- Reserve either the full laboratory or a specific PC
- View reservation history and staff remarks
- Receive real-time in-app updates for reservation events

### Laboratory Staff

- Access a staff dashboard
- Manage only assigned laboratories
- Create and maintain schedules
- Review and process reservations
- Monitor laboratory activity and reservation reports
- Receive live in-app notifications

### Administrator

- Manage users and statuses
- Assign laboratory staff to laboratories
- Manage laboratories and PC inventory states
- Review reports and reservation trends
- Manage calendar events such as maintenance and holidays

## Folder Structure

```text
ComLab Reservation System/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── domain/
│   │   ├── middleware/
│   │   ├── notifications/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── types/
│   │   ├── utils/
│   │   └── validations/
│   └── tests/
├── docs/
├── frontend/
│   └── src/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       ├── layouts/
│       ├── pages/
│       ├── store/
│       ├── test/
│       ├── types/
│       └── utils/
├── docker-compose.yml
├── package.json
└── README.md
```

## Installation

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example files:

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

Update `backend/.env`:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL="mysql://root:password@localhost:3306/comlab_reservation_system"
JWT_SECRET=super-secret-jwt-key
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=super-secret-refresh-key
JWT_REFRESH_EXPIRES_IN=7d
AUTH_COOKIE_NAME=comlab_access_token
AUTH_COOKIE_MAX_AGE_MS=86400000
REFRESH_COOKIE_NAME=comlab_refresh_token
REFRESH_COOKIE_MAX_AGE_MS=604800000
AUTH_COOKIE_SAME_SITE=none
CLIENT_URL=http://localhost:5173
APP_BASE_URL=http://localhost:5173
RESET_TOKEN_TTL_MINUTES=30
RESET_TOKEN_PREVIEW=true
ENABLE_DEMO_BOOTSTRAP=false
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM_EMAIL=no-reply@comlab.local
SMTP_FROM_NAME=ComLab Reservation System
NOTIFICATION_EMAIL_PREVIEW=true
RESERVATION_REMINDER_LEAD_MINUTES=60
RESERVATION_REMINDER_INTERVAL_MS=60000
LOGIN_RATE_LIMIT_WINDOW_MS=60000
LOGIN_RATE_LIMIT_MAX=5
REGISTER_RATE_LIMIT_WINDOW_MS=60000
REGISTER_RATE_LIMIT_MAX=5
PASSWORD_RESET_RATE_LIMIT_WINDOW_MS=60000
PASSWORD_RESET_RATE_LIMIT_MAX=5
```

Update `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Prepare the database

Create the database:

```sql
CREATE DATABASE comlab_reservation_system;
```

Then run:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

Important migration notes:

- The latest schema includes the `Notification` layer
- Phase 2 adds the `AuthSession` table for refresh-session rotation
- If you already have an existing database, pull the latest code and rerun Prisma migrations

## Running the App

### Start frontend and backend together

```bash
npm run dev
```

### Start only the backend

```bash
npm run dev --workspace backend
```

### Start only the frontend

```bash
npm run dev --workspace frontend
```

## Build

```bash
npm run build
```

## Tests

```bash
npm test
```

Workspace-specific commands:

```bash
npm run test --workspace backend
npm run test --workspace frontend
```

## API Modules

Current route groups:

- `Auth`
- `Users`
- `Laboratories`
- `Schedules`
- `Reservations`
- `Dashboard`
- `Staff`
- `Calendar`
- `Notifications`

Important auth routes:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/change-password`

Important notification routes:

- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `POST /api/notifications/mark-all-read`
- `GET /api/notifications/stream`

Other notable route groups:

- `GET /api/staff/my-lab`
- `GET /api/staff/my-lab/reservations`
- `GET /api/staff/my-lab/schedules`
- `GET /api/staff/my-lab/logs`
- `GET /api/staff/my-lab/pcs`
- `GET /api/staff/labs/availability`
- `GET /api/staff/labs/schedules/public`
- `PUT /api/laboratories/:id/custodian`
- `GET /api/calendar`
- `POST /api/calendar`
- `GET /api/health`

See [docs/API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md) for the broader API reference.

## Data Model Summary

Core entities currently modeled in Prisma:

- `User`
- `AuthSession`
- `Laboratory`
- `PC`
- `Schedule`
- `Reservation`
- `CalendarEvent`
- `Notification`
- `PasswordResetToken`
- `ActivityLog`

ERD notes are available in [docs/ERD.md](./docs/ERD.md).

## Notification System

The current notification system supports both email and in-app delivery.

- Reservation events publish to the internal event bus
- In-app notifications are stored in the database
- The topbar bell shows unread counts and recent inbox items
- Live updates are delivered through Server-Sent Events
- Email delivery supports SMTP or preview mode for development

Supported notification types:

- `RESERVATION_CREATED`
- `RESERVATION_CONFIRMED`
- `RESERVATION_CANCELLED`
- `RESERVATION_REMINDER`

## Reservation Rules Implemented

- End time must be later than start time
- Reservations must stay within the chosen schedule block
- Overlapping schedules are blocked
- Overlapping reservations are blocked
- Whole-lab reservations block overlapping PC reservations
- PC reservations only block the selected PC unless a whole-lab reservation overlaps
- Students may only cancel their own pending reservations
- Staff and admins may only review pending reservations
- Only approved reservations may be completed
- Laboratory staff are restricted to their assigned laboratory scope

## OOP Architecture Notes

The backend uses an object-oriented structure for presentation and maintainability:

- `User`, `Student`, `Admin`, and `LaboratoryStaff` model role behavior
- `UserFactory` returns the correct role implementation
- Service classes hold business rules and workflow logic
- Controllers stay thin and delegate to services

Key services include:

- `AuthService`
- `ReservationService`
- `NotificationService`
- `NotificationInboxService`
- `DashboardService`
- `LaboratoryService`
- `ScheduleService`
- `CalendarService`

## Demo Bootstrap Policy

Public quick-access credentials are no longer exposed in the UI.

Current behavior:

- `ENABLE_DEMO_BOOTSTRAP=false` by default
- Admin and staff demo accounts are only created if you explicitly enable bootstrap
- The login page no longer displays admin or staff credentials

## Production Cookie Note

If your frontend and backend are deployed on different domains, such as:

- frontend on `https://www.comlabreservation.app`
- backend on `https://comlab-reservation-system-production.up.railway.app`

then the authentication cookies must be cross-site compatible.

Recommended production settings:

```env
NODE_ENV=production
AUTH_COOKIE_SAME_SITE=none
CLIENT_URL=https://www.comlabreservation.app
APP_BASE_URL=https://www.comlabreservation.app
```

If `AUTH_COOKIE_SAME_SITE` is left unset, the backend now defaults to:

- `none` in production
- `lax` in development

If you intentionally want demo accounts in a local presentation environment, set:

```env
ENABLE_DEMO_BOOTSTRAP=true
```

## Docker

If you want to run the stack with Docker:

```bash
docker-compose up --build
```

Expected services:

- Frontend: `http://localhost:4173`
- Backend: `http://localhost:5000/api`
- MySQL: `localhost:3306`

## What Changed Recently

Recent implementation changes now present in the repository:

- Removed public demo quick-access credentials from the login flow
- Changed authentication from browser-stored JWTs to secure cookie-based sessions
- Added refresh-session rotation backed by the `AuthSession` table
- Added automatic session refresh handling on the frontend
- Added live in-app notifications and notification inbox APIs
- Improved desktop logout usability with a pinned sidebar and top-level logout access
- Added route-level lazy loading to reduce the large frontend bundle
- Updated auth validation to require stronger passwords

## Known Limitations

- The system still uses in-memory rate limiting; Redis-backed distributed throttling is not yet implemented
- Notification email delivery is synchronous and can later be moved to a queue worker
- MFA is not yet implemented
- The notification center currently focuses on recent in-app notifications rather than a full archive page

## Recommended Next Steps

- Add Redis-backed rate limiting and session invalidation caching
- Add MFA for admin and laboratory staff accounts
- Add queued email delivery and retry workers
- Add a full notification archive page with filters
- Add richer audit trail filtering and export
- Add cloud object storage for laboratory images
- Add report PDF export
- Add deployment guidance for Railway, Render, Vercel, or Docker production targets
