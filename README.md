# ComPort System Manuscript

ComPort, short for the ComLab Reservation System, is a full-stack web platform for managing computer laboratory operations, schedule publishing, and student reservations in an academic environment. This document is written for two audiences:

- End-users such as administrators, laboratory staff, faculty coordinators, and students
- Programmers, evaluators, and panel members who need a technical understanding of the system

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture and Tech Stack](#2-system-architecture-and-tech-stack)
3. [Role-Based Access and Permissions](#3-role-based-access-and-permissions)
4. [Comprehensive User Manual](#4-comprehensive-user-manual)
5. [Developer Guide (Local Setup)](#5-developer-guide-local-setup)
6. [System Modules and Data Model Summary](#6-system-modules-and-data-model-summary)

---

## 1. Project Overview

### 1.1 What is ComPort?

ComPort is a reservation and laboratory management platform designed for academic computer laboratories. It replaces manual reservation handling, unstructured schedule posting, and inconsistent approval workflows with a centralized, role-based, auditable web system.

The system supports:

- Student self-registration and secure login
- Public laboratory browsing and schedule visibility
- Reservation requests for either an entire laboratory or a specific computer unit
- Reservation approval, rejection, cancellation, and completion workflows
- Administrator control over users, laboratories, staff assignments, and calendar events
- Laboratory staff management for assigned rooms, schedules, reservations, and PC status
- Real-time and in-app notification support
- Activity logging for accountability and reporting

### 1.2 Problems the System Solves

Before systems like ComPort, laboratory reservation handling is often affected by:

- Manual scheduling and paper-based reservation forms
- Double-booking and overlapping reservations
- Lack of role separation between administrators, staff, and students
- No consistent audit trail for laboratory actions
- Difficulty tracking available rooms, computers, and schedule blocks
- Poor visibility into reservation history and operational status

ComPort solves these problems by enforcing structured workflows and validation rules at both the interface and backend levels.

### 1.3 Core Features

The current codebase implements the following core capabilities:

- Secure authentication with cookie-based sessions and refresh-session rotation
- Student registration with strong password rules
- Admin-managed user creation, updating, activation, and deactivation
- Laboratory creation, editing, deletion, and staff assignment
- Automatic PC record generation based on declared computer count
- Schedule publishing with overlap detection
- Reservation submission within published time windows only
- Whole-lab and PC-specific reservation handling
- Conflict prevention across schedules, laboratory reservations, and PC reservations
- Reservation review and completion workflows for administrators and laboratory staff
- Dashboard summaries for each role
- Notification inbox and live notification stream
- Activity logging and CSV-based reporting support

### 1.4 Intended Users

ComPort serves three main operational user groups:

- `ADMIN`
- `LABORATORY_STAFF`
- `STUDENT`

For backward compatibility in some middleware and route checks, the alias `CUSTODIAN` is normalized internally to `LABORATORY_STAFF`. The active role stored in the database is `LABORATORY_STAFF`.

---

## 2. System Architecture and Tech Stack

### 2.1 Architecture Overview

ComPort follows a modern client-server architecture:

- The frontend is a React single-page application used by students, staff, and administrators
- The backend is a Node.js and Express REST API responsible for authentication, validation, business rules, and persistence
- Prisma ORM acts as the data-access layer between the backend and a Supabase PostgreSQL database
- Supabase PostgreSQL stores users, laboratories, PCs, schedules, reservations, sessions, notifications, logs, and calendar data
- A platform-hosted Node runtime can be used for the backend web service, provided it can run the backend workspace commands and connect to Supabase

### 2.2 High-Level Request Flow

1. A user accesses the React frontend.
2. The frontend submits API requests to the Express backend.
3. The backend validates the request using Zod schemas and route middleware.
4. Business rules are enforced in service classes such as `AuthService`, `LaboratoryService`, `ScheduleService`, and `ReservationService`.
5. Prisma reads from or writes to the Supabase PostgreSQL database.
6. The backend returns structured JSON responses to the frontend.
7. Notifications, dashboard metrics, and logs are updated as part of the business workflow where applicable.

### 2.3 Technology Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | React, Vite, TypeScript | User interface and client-side routing |
| Styling | Tailwind CSS | Responsive styling and layout |
| State / Data | React Query | API data fetching, caching, and invalidation |
| Backend | Node.js, Express, TypeScript | API server and business logic |
| Validation | Zod | Request and form validation |
| ORM | Prisma | Database access, migrations, and schema management |
| Database | Supabase PostgreSQL | Persistent relational data storage |
| Auth | JWT + HttpOnly cookies + bcrypt | Secure login, session refresh, and password hashing |
| Notifications | In-app notifications + SSE stream | User alerts and real-time updates |
| Testing | Vitest, Testing Library, Supertest-ready backend structure | Unit and integration-oriented validation |
| Deployment | Any Node-capable hosting platform + static frontend hosting | Cloud deployment for the backend API and built frontend |

### 2.4 Architectural Characteristics

The current implementation shows the following architectural strengths:

- Separation of concerns through controllers, services, middleware, domain models, and validations
- Strong role-based authorization controls
- Centralized error handling
- Database-backed refresh sessions instead of local token-only auth
- Activity logging for traceability
- Explicit validation of schedules, reservations, and user fields
- Protection against schedule overlaps and reservation conflicts

### 2.5 Important Production Notes

The backend exposes:

- API base path: `/api`
- Health endpoint: `/api/health`

The deployed backend is designed to bind to the configured `PORT`, which is `5000` in the current environment examples.

---

## 3. Role-Based Access and Permissions

### 3.1 Administrator (`ADMIN`)

Administrators have full operational control over the platform.

#### Main Capabilities

- Create, edit, activate, and deactivate user accounts
- Create admin, laboratory staff, or student accounts
- View the full user list
- Create, edit, and delete laboratories
- Assign or unassign laboratory staff to laboratories
- Update PC status for any laboratory
- Create, edit, and delete schedules across laboratories
- Review, approve, reject, and complete reservation requests
- Access system-wide reservation and dashboard summaries
- Manage administrative calendar events such as maintenance and holidays
- View reports and export reservation data

#### Operational Restrictions

- Laboratories with reservation or calendar history cannot be deleted
- Schedules with reservation history cannot be modified or deleted
- Reservation approvals still pass through conflict validation before final approval

### 3.2 Laboratory Staff (`LABORATORY_STAFF`)

Laboratory staff members manage the laboratory assigned to them by an administrator.

#### Main Capabilities

- Access the management dashboard
- View the assigned laboratory profile
- View reservation requests for the assigned laboratory
- Approve or reject pending reservation requests for the assigned laboratory
- Mark approved reservations as completed
- Create, edit, and delete schedule blocks for the assigned laboratory
- Update the status of PCs in the assigned laboratory
- View activity logs for the assigned laboratory
- View read-only public schedule or availability information from other laboratories

#### Operational Restrictions

- Staff cannot manage laboratories that are not assigned to them
- Staff cannot create or manage user accounts
- Staff cannot create calendar events
- Staff cannot override history protections on schedules and laboratories

### 3.3 Student (`STUDENT`)

Students are the primary reservation requestors in the system.

#### Main Capabilities

- Self-register through the public registration page
- Log in securely and manage their profile
- Browse available laboratories
- Inspect laboratory details, published schedules, and room occupancy
- Submit reservation requests for an entire laboratory or for a specific PC
- View reservation history and status
- Cancel only their own pending reservations
- Receive in-app and system notifications related to reservation events

#### Operational Restrictions

- Students cannot create schedules
- Students cannot approve or reject reservations
- Students cannot reserve unavailable laboratories
- Students cannot reserve outside published schedule windows
- Students cannot cancel approved, rejected, completed, or already cancelled reservations

### 3.4 Permission Summary

| Function | Admin | Laboratory Staff | Student |
| --- | --- | --- | --- |
| Register own account | No public self-registration path | No public self-registration path | Yes |
| Login / logout | Yes | Yes | Yes |
| Update own profile | Yes | Yes | Yes |
| Manage users | Yes | No | No |
| Manage laboratories | Yes | Assigned lab only for PC status viewing and maintenance tasks | No |
| Assign staff to laboratories | Yes | No | No |
| Manage schedules | Yes | Yes, assigned lab only | No |
| Create reservation | No | No | Yes |
| Review reservation | Yes | Yes, assigned lab only | No |
| Complete reservation | Yes | Yes, assigned lab only | No |
| Manage calendar events | Yes | No | No |
| View full reports | Yes | Yes, role-scoped | No |

---

## 4. Comprehensive User Manual

This section provides practical, step-by-step operating procedures based on the implemented frontend and backend workflows.

### 4.1 Authentication and User Management

#### A. Student Self-Registration

Public route:

- `/register`

Purpose:

- Allows a new student to create an account without administrator intervention

Required fields:

- First Name
- Last Name
- Email Address
- Student Number
- Department
- Year Level
- Phone Number
- Password

Password requirements:

- At least 10 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

Step-by-step procedure:

1. Open the public registration page.
2. Enter complete student identity information.
3. Enter a valid institutional or personal email address.
4. Create a password that satisfies all password rules shown in the interface.
5. Submit the form.
6. The backend validates all fields and checks for duplicate email or duplicate student number.
7. If validation passes, the account is created with the `STUDENT` role.
8. A verification email is prepared and the student is asked to verify the account before logging in.

System checks performed:

- Email must be unique
- Student number must be unique
- Password must meet complexity rules
- Required fields must not be blank

#### B. Login, Logout, and Session Management

Public route:

- `/login`

Step-by-step procedure:

1. Enter email and password on the login page.
2. Submit the form.
3. The backend verifies the account and compares the password hash using `bcrypt`.
4. If the account is active, ComPort creates an access token and refresh token.
5. Tokens are stored using secure `HttpOnly` cookies rather than browser local storage.
6. The user is redirected to the correct dashboard based on role.

Additional auth workflows:

- `Forgot Password`: requests a reset link token
- `Reset Password`: validates a reset token and stores the new password
- `Change Password`: available to authenticated users from within the system
- `Logout`: revokes the current refresh session

#### C. Administrator User Creation and Maintenance

Protected route:

- `/management/users`

Purpose:

- Allows administrators to create and maintain accounts for admins, laboratory staff, and students

Step-by-step procedure for creating a user:

1. Log in as an administrator.
2. Open `User Management`.
3. Click `Add User`.
4. Enter the required profile details.
5. Select the role:
   - `ADMIN`
   - `LABORATORY_STAFF`
   - `STUDENT`
6. If the selected role is `STUDENT`, also provide:
   - Student Number
   - Year Level
7. Optionally enter department and phone number.
8. Submit the form.

System checks performed:

- Duplicate email is blocked
- Duplicate student number is blocked for student accounts
- Student-only fields are required when the role is `STUDENT`
- Password complexity rules are enforced

Step-by-step procedure for editing a user:

1. Open `User Management`.
2. Locate the target user from the paginated list.
3. Click `Edit`.
4. Update the required fields.
5. Leave password blank if the password should remain unchanged.
6. Save changes.

Step-by-step procedure for activation or deactivation:

1. Open `User Management`.
2. Locate the user account.
3. Click `Deactivate` or `Activate`.
4. Confirm the action.
5. The backend updates the `status` field and revokes active sessions for that user.

Important administrative effect:

- Changing a user's role or status revokes active sessions so that permissions are reapplied cleanly

### 4.2 Creating and Configuring a Computer Laboratory

#### A. Create a Laboratory

Protected route:

- `/management/laboratories`

Administrator steps:

1. Log in as an administrator.
2. Open `Laboratory Management`.
3. Click `Add Laboratory`.
4. Fill in the following details:
   - Laboratory Name
   - Room Code
   - Building
   - Optional custom Location
   - Status
   - Capacity
   - Number of Computers
   - Optional Image URL or uploaded image
   - Description
5. Submit the form.

System behavior after creation:

- The laboratory record is created
- The system generates PC records automatically based on the `computerCount`
- Generated PCs follow the `PC-01`, `PC-02`, `PC-03` numbering pattern
- The action is written to the activity log

Validation and business rules:

- Room code must be unique
- Capacity and computer count must be positive integers
- Description must be meaningful
- Status must be one of:
  - `AVAILABLE`
  - `UNAVAILABLE`
  - `MAINTENANCE`

#### B. Edit a Laboratory

Administrator steps:

1. Open `Laboratory Management`.
2. Find the laboratory from the catalog table.
3. Click `Edit`.
4. Update room details, counts, image, description, or status.
5. Save changes.

Important system behavior when changing computer count:

- If the count increases, new PCs are generated automatically
- If the count decreases, the system checks PCs outside the new count
- PCs with history are not blindly deleted; they are set to `MAINTENANCE`
- PCs with no history may be removed safely

This preserves historical integrity for past reservations and logs.

#### C. Delete a Laboratory

Administrator steps:

1. Open `Laboratory Management`.
2. Click `Delete` for the target laboratory.
3. Confirm the action.

Deletion rule:

- A laboratory cannot be deleted if it already has reservation history or calendar history

#### D. Assign a Laboratory Staff Member

Protected route:

- `/management/laboratories/assign-staff`

Administrator steps:

1. Open `Assign Staff`.
2. Search or filter by building or department if needed.
3. Find the target laboratory.
4. Use the assignment dropdown to choose a staff member or set the lab as `Unassigned`.

Validation rules:

- Only active `LABORATORY_STAFF` users may be assigned
- Inactive staff accounts cannot be assigned

#### E. Update PC Status

There are two supported management contexts:

- Administrator updates any laboratory PC from the laboratory and API management layer
- Laboratory staff update PCs in their assigned laboratory

Supported PC statuses:

- `AVAILABLE`
- `OCCUPIED`
- `MAINTENANCE`

Practical usage:

- `AVAILABLE` means the PC is ready for reservation
- `OCCUPIED` marks a unit as currently in use or unavailable for new PC reservations
- `MAINTENANCE` blocks the PC from reservation selection

### 4.3 Creating, Editing, and Deleting Schedules

#### A. Create a Schedule

Protected route:

- `/management/schedules`

Roles allowed:

- `ADMIN`
- `LABORATORY_STAFF` for assigned laboratory only

Schedule fields:

- Laboratory
- Date
- Start Time
- End Time
- Status

Schedule statuses:

- `AVAILABLE`
- `BLOCKED`
- `CLOSED`

Step-by-step procedure:

1. Open `Schedule Management`.
2. Click `Add Schedule`.
3. Choose the target laboratory.
   - For staff users, the assigned laboratory is fixed automatically.
4. Select the date.
5. Enter the start time and end time.
6. Select the schedule status.
7. Save the schedule.

System checks performed:

- End time must be later than start time
- The laboratory must be available for reservations
- The new schedule must not overlap with an existing schedule in the same laboratory and date
- Staff may only manage their assigned laboratory

#### B. Edit a Schedule

Step-by-step procedure:

1. Open `Schedule Management`.
2. Find the schedule using filters such as laboratory or date.
3. Click `Edit`.
4. Update the date, time, or status.
5. Save changes.

Editing restrictions:

- If a schedule already has reservation history, it cannot be changed when the change would mutate the reservation-relevant fields
- Overlap rules are checked again before saving

#### C. Delete a Schedule

Step-by-step procedure:

1. Open `Schedule Management`.
2. Click `Delete` on the target schedule.
3. Confirm the action.

Deletion rule:

- Schedules with reservation history cannot be deleted

#### D. Why Schedule Status Matters

- `AVAILABLE` schedules may be booked by students
- `BLOCKED` schedules exist but are not bookable
- `CLOSED` schedules represent non-bookable periods and also remain visible for management purposes

### 4.4 How a User Makes a Reservation and How Conflicts Are Handled

#### A. Student Reservation Workflow

Protected student routes:

- `/student/laboratories`
- `/student/laboratories/:id`
- `/student/laboratories/:id/reserve`
- `/student/reservations`

Step-by-step reservation procedure:

1. Log in as a student.
2. Open the laboratory list and choose a laboratory.
3. Review room information, existing schedule blocks, and current occupancy.
4. Open the reservation page for the selected laboratory.
5. Choose the reservation type:
   - `Whole Laboratory`
   - `Specific PC`
6. Select a published `AVAILABLE` schedule block.
7. Enter the reservation purpose.
8. Choose a start time and end time from the remaining free windows only.
9. If choosing a PC reservation, select an available PC.
10. Submit the reservation request.

System behavior after submission:

- A reservation code is generated automatically
- The reservation is stored with `PENDING` status
- A reservation-created notification event is published
- The request appears in the student's reservation history and in the staff/admin review interface

#### B. Reservation Conflict Rules

The system applies strict conflict detection before a reservation is created or approved.

The following rules are enforced:

1. The selected laboratory must be in an available state.
2. The selected schedule must exist and belong to the same laboratory.
3. The schedule must be in `AVAILABLE` status.
4. The reservation time must stay fully inside the published schedule block.
5. End time must be later than start time.
6. Whole-lab reservations block overlapping whole-lab and PC reservations.
7. PC reservations only block the same PC, unless a whole-lab reservation overlaps the same time.
8. A student cannot reserve a PC that is not currently marked `AVAILABLE`.

Examples:

- If Laboratory A already has an approved whole-lab reservation from `09:00` to `11:00`, no overlapping PC reservation may be submitted for that period.
- If `PC-05` is reserved from `10:00` to `11:00`, another student may still reserve `PC-07` during that same time, provided there is no whole-lab reservation conflict.
- If a student selects `08:00` to `12:00` but the published schedule is only `09:00` to `11:00`, the request is rejected.

#### C. Reservation Review Workflow

Roles allowed to review:

- `ADMIN`
- `LABORATORY_STAFF` for assigned laboratory

Protected route:

- `/management/reservations`

Step-by-step review procedure:

1. Open `Reservation Management`.
2. Filter by status, laboratory, student, or date if needed.
3. Open the reservation details modal.
4. Review the request details:
   - Student identity
   - Laboratory
   - Schedule
   - Reservation type
   - Purpose
5. Optionally enter remarks.
6. Click `Approve` or `Reject`.

System checks performed during approval:

- The reservation must still be pending
- The reviewer must have permission over the target laboratory
- Conflict detection is re-run before final approval

This means approval is not just a manual status change. The system protects against race conditions and newly conflicting bookings.

#### D. Reservation Completion

Step-by-step procedure:

1. Open `Reservation Management`.
2. Locate an approved reservation.
3. Click `Mark Complete`.

Completion rule:

- Only approved reservations can be marked as completed

#### E. Student Cancellation

Students may cancel reservations only when:

- The reservation belongs to them
- The status is still `PENDING`

Cancelled reservations are retained in history for tracking and auditability.

### 4.5 Dashboard, Notifications, and Reports

Although not requested as a separate manual section, these modules are part of the user experience and are useful during a panel demonstration.

#### Dashboard

Protected route:

- `/dashboard` for admins and staff
- `/student/dashboard` for students

Dashboard behavior:

- Admin dashboard shows total users, laboratories, reservations, status counts, trends, and recent activity
- Staff dashboard shows reservation metrics for assigned laboratories only
- Student dashboard shows personal reservation counts, recent reservations, and available laboratory counts

#### Notifications

Authenticated routes:

- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `POST /api/notifications/mark-all-read`
- `GET /api/notifications/stream`

Notification behavior:

- Reservation events create notification entries
- Users can view unread and recent notification items
- Live updates are supported through a stream endpoint

#### Reports

Protected route:

- `/management/reports`

Current report support:

- Filtering operational reservation data
- Viewing reservation activity
- Exporting reservation views to CSV

---

## 5. Developer Guide (Local Setup)

This section is intended for future developers, maintainers, and evaluators who need to run the project locally.

### 5.1 Prerequisites

Install the following first:

- Git
- Node.js 22.x or a compatible modern Node.js runtime
- npm
- A Supabase project with PostgreSQL credentials, or a local PostgreSQL 16+ database for development

### 5.2 Clone the Repository

```bash
git clone <your-repository-url>
cd "ComLab Reservation System"
```

### 5.3 Install Dependencies

From the repository root:

```bash
npm install
```

This installs both workspace packages:

- `backend`
- `frontend`

### 5.4 Configure Environment Variables

Create local environment files using the provided examples.
The `.env.example` files are templates only and are not loaded automatically. Your real runtime values must be stored in ignored files at `backend/.env` and `frontend/.env`.

Windows:

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

Or create them manually.

#### Backend Environment Example

```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
DIRECT_URL="postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
JWT_SECRET=replace_me_with_a_long_random_secret
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=replace_me_with_a_second_long_random_secret
JWT_REFRESH_EXPIRES_IN=7d
AUTH_COOKIE_NAME=comlab_access_token
AUTH_COOKIE_MAX_AGE_MS=86400000
REFRESH_COOKIE_NAME=comlab_refresh_token
REFRESH_COOKIE_MAX_AGE_MS=604800000
AUTH_COOKIE_SAME_SITE=lax
CLIENT_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173
APP_BASE_URL=http://localhost:5173
RESET_TOKEN_TTL_MINUTES=30
EMAIL_VERIFICATION_TOKEN_TTL_HOURS=24
RESET_TOKEN_PREVIEW=true
ENABLE_DEMO_BOOTSTRAP=false
NOTIFICATION_EMAIL_PREVIEW=true
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM="ComLab Reservation <no-reply@example.com>"
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=
AI_PROVIDER=groq
AI_API_KEY=
AI_MODEL=llama-3.1-8b-instant
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

- `DATABASE_URL` is the Supabase pooler URL used by the running backend.
- `DIRECT_URL` is the Supabase session pooler URL used by Prisma migrations in environments that cannot reach the direct database host.
- Replace `PROJECT_REF` with your actual Supabase project ref.
- Replace `YOUR_PASSWORD` with your actual database password.

#### Frontend Environment Example

```env
VITE_API_URL=http://localhost:5000/api
```

For static production deployments, `VITE_API_URL` must be set explicitly. Use your backend URL such as `https://your-backend-domain.com/api`, or `/api` only when a reverse proxy is configured for that path.

### 5.5 Configure the Database

For Supabase, create or open a Supabase project and copy both PostgreSQL connection strings from the dashboard Connect panel.

- `DATABASE_URL` is used by the running Express backend. In this repo, use the Supabase pooler connection string for the runtime.
- `DIRECT_URL` is used by Prisma migrations. In this repo, use the Supabase session pooler connection string on port `5432` when the deployment environment cannot reach the direct database host.
- Replace `PROJECT_REF` with the project reference from the Supabase dashboard.
- Replace `YOUR_PASSWORD` with the database password for that project.
- Do not commit real Supabase credentials. Keep them only in local `.env` files and deployment environment settings.

For local-only development without Supabase, the provided Docker Compose file starts PostgreSQL on port `5432`; use `postgresql://postgres:password@localhost:5432/comlab_reservation_system` for both `DATABASE_URL` and `DIRECT_URL`.

### 5.6 Generate Prisma Client

Recommended from the repository root:

```bash
npm run prisma:generate --workspace backend
```

Or directly inside the backend workspace:

```bash
cd backend
npx prisma generate
```

The root shorthand `npm run prisma:generate` also works because it delegates into the backend workspace.

### 5.7 Run Database Migrations

Recommended from the repository root:

```bash
npm run prisma:migrate:reset --workspace backend
npm run prisma:migrate:dev --workspace backend
npm run prisma:migrate:deploy --workspace backend
```

Or from the backend workspace:

```bash
cd backend
npx prisma migrate reset
npx prisma migrate dev
npx prisma migrate deploy
```

`prisma migrate reset` deletes local or test data and replays every migration from scratch. Use it when you are working with disposable data or when Prisma reports that an applied migration was modified and the development database needs to be realigned.

Avoid running raw root-level Prisma commands like the example below:

```bash
npx prisma migrate reset --schema backend/prisma/schema.prisma
```

That form points Prisma at the backend schema file, but it does not automatically load `backend/.env` when run from the repository root. In this repo, use the backend workspace commands above so Prisma picks up `backend/.env` correctly.

### 5.8 Seed Optional Development Data

If you want to run the seed script:

```bash
npm run seed
```

Or:

```bash
cd backend
npx tsx prisma/seed.ts
```

### 5.9 Start the Development Servers

Run both frontend and backend:

```bash
npm run dev
```

Run only the backend:

```bash
npm run dev --workspace backend
```

Run only the frontend:

```bash
npm run dev --workspace frontend
```

Expected local URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000/api`
- Health check: `http://localhost:5000/api/health`

### 5.10 Build the Project

```bash
npm run build
```

### 5.11 Run Tests

```bash
npm test
```

Workspace-specific test commands:

```bash
npm run test --workspace backend
npm run test --workspace frontend
```

### 5.12 Deployment Note

The backend remains an Express API. Supabase is used only as the PostgreSQL database in this migration phase; do not replace Express routes with Supabase APIs, Supabase Auth, Realtime, or Storage yet. In production:

- Set `NODE_ENV=production`
- Set `DATABASE_URL` to the Supabase pooler connection string used by the running backend
- Set `DIRECT_URL` to the Supabase session pooler connection string on port `5432` when the deployment environment cannot reach the direct database host
- Set production `JWT_SECRET` and `JWT_REFRESH_SECRET`
- Set `CLIENT_URL`, `FRONTEND_URL`, and `APP_BASE_URL` to the real frontend domain
- Set SMTP variables and turn preview mode off for real email delivery
- Set AI provider variables for Groq, OpenRouter, or a custom OpenAI-compatible endpoint
- Set the frontend `VITE_API_URL` build-time variable to the deployed backend API URL
- Run `npx prisma migrate deploy` during backend startup or release
- Use the exposed backend health endpoint `/api/health` for readiness checks

Deployment-specific environment examples, local preview setup, production SMTP and AI guidance, and a step-by-step verification checklist are documented in [docs/DEPLOYMENT.md](/C:/Users/Lorraine/Desktop/comlab-reservation-system/docs/DEPLOYMENT.md).

---

## 6. System Modules and Data Model Summary

### 6.1 Main Backend Modules

The backend is organized into clear layers:

- `controllers/`
  - Thin request handlers
- `services/`
  - Business rules and workflow logic
- `routes/`
  - API route definitions and permission binding
- `middleware/`
  - Authentication, authorization, validation, and access controls
- `validations/`
  - Zod schemas for request validation
- `domain/`
  - Domain entities encapsulating role and workflow behavior
- `utils/`
  - Shared helpers such as JWT, time, cookies, and error utilities
- `notifications/`
  - Notification event and delivery support

### 6.2 Main Frontend Modules

- Public pages for landing, login, registration, forgot password, and reset password
- Student pages for dashboards, laboratory browsing, reservation creation, and reservation history
- Staff and admin management pages for laboratories, schedules, reservations, reports, and profile maintenance
- Admin-only pages for user management, staff assignment, and calendar management

### 6.3 Core API Route Groups

- `/api/auth`
- `/api/users`
- `/api/laboratories`
- `/api/schedules`
- `/api/reservations`
- `/api/dashboard`
- `/api/staff`
- `/api/calendar`
- `/api/notifications`
- `/api/health`

### 6.4 Core Database Entities

The Prisma schema currently models these major entities:

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

### 6.5 Operational Highlights for Evaluators

For panel evaluation, the following implemented behaviors are especially important:

- Role-based authorization is enforced on both route and service levels
- Student reservations are not allowed outside published schedule windows
- Schedule overlaps are actively prevented
- Reservation conflicts are checked both at submission time and approval time
- Session revocation occurs when sensitive account changes happen
- Activity logging creates an audit trail for significant actions
- The system supports both whole-lab and per-PC booking strategies
- Staff access is scoped to assigned laboratories

---

## Conclusion

ComPort is not only a laboratory reservation interface, but a complete operational management system for academic computer laboratories. It combines role-based access control, schedule enforcement, reservation conflict prevention, audit logging, and structured administration into one platform.

For end-users, it provides a guided and secure reservation experience.
For programmers and evaluators, it demonstrates a layered architecture, validated workflows, and production-aware backend design.

