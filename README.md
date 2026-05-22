# ComPort: ComLab Reservation System

ComPort is the system name used throughout the codebase for this academic computer laboratory reservation and management platform.

## Abstract and System Overview

ComPort is a full-stack web application for managing academic computer laboratories, published laboratory schedules, and student reservation requests. The system is designed for three implemented roles: `ADMIN`, `LABORATORY_STAFF`, and `STUDENT`. It centralizes account management, laboratory setup, schedule publication, whole-laboratory or per-PC reservations, reservation review, calendar blocking, reports, notifications, and profile management.

From the repository, the system solves a practical campus problem: laboratory schedules and reservations must be organized, conflict-checked, and reviewed within role-based rules rather than handled manually. The backend enforces these rules through Express controllers, service classes, Prisma data access, and validation middleware, while the frontend provides role-specific pages for students, staff, and administrators. The codebase also includes email verification, password reset, in-app notifications, server-sent event streaming, optional SMTP email delivery, and an authenticated reservation assistant with deterministic fallback behavior when no external AI provider is configured.

## Table of Contents

- [Abstract and System Overview](#abstract-and-system-overview)
- [Introduction](#introduction)
- [Project Objectives](#project-objectives)
- [Scope and Limitations](#scope-and-limitations)
- [Target Users and User Roles](#target-users-and-user-roles)
- [System Features](#system-features)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Object-Oriented Programming Concepts](#object-oriented-programming-concepts)
- [APIs and Endpoints](#apis-and-endpoints)
- [External APIs and Integrations](#external-apis-and-integrations)
- [Database Design](#database-design)
- [System Modules](#system-modules)
- [User Flows](#user-flows)
- [Data Flow Diagram](#data-flow-diagram)
- [Use Cases](#use-cases)
- [User Manual](#user-manual)
- [Admin Manual](#admin-manual)
- [Laboratory Staff Manual](#laboratory-staff-manual)
- [Student Manual](#student-manual)
- [Installation and Setup Guide](#installation-and-setup-guide)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Security Features](#security-features)
- [Validation and Error Handling](#validation-and-error-handling)
- [Testing and Quality Assurance](#testing-and-quality-assurance)
- [Deployment Guide](#deployment-guide)
- [System Limitations](#system-limitations)
- [Future Enhancements](#future-enhancements)
- [Defense and Presentation Reviewer Guide](#defense-and-presentation-reviewer-guide)
- [Glossary of Terms](#glossary-of-terms)
- [References](#references)

## Introduction

Academic computer laboratories need more than a simple booking form. They require user accounts, role-based permissions, published schedule windows, room and workstation status tracking, reservation approval workflows, and clear operational visibility for staff and administrators. The repository shows that ComPort was built to address those needs in a structured web system.

At a high level, students can register, verify their email, log in, browse available laboratories, and submit reservation requests. Laboratory staff and administrators can publish schedules, review requests, manage room readiness, and monitor operational activity. Administrators also have dedicated pages for user management, staff assignment, and calendar control. The resulting application is suitable for technical presentation because both the interface layer and the backend business rules are visible in the repository.

## Project Objectives

### General Objective

To provide a centralized, role-based web system for academic computer laboratory reservation, schedule publication, and laboratory operations management.

### Specific Objectives

1. To support secure authentication with email verification, password reset, session refresh, and logout.
2. To allow students to register accounts and submit reservation requests for either an entire laboratory or a specific PC.
3. To enable administrators and laboratory staff to publish and maintain laboratory schedules.
4. To prevent invalid or conflicting reservations through validation and conflict-checking rules.
5. To allow authorized reviewers to approve, reject, complete, and monitor reservations.
6. To manage laboratories, PC records, staff assignments, and management calendar events.
7. To provide dashboards, reports, notifications, and activity logs for operational visibility.
8. To expose an authenticated assistant interface that can answer role-aware questions and prepare draft actions using system data.

## Scope and Limitations

### Scope

The repository explicitly shows support for the following:

- A React single-page application with public authentication pages and protected role-based dashboards.
- Three implemented roles: `ADMIN`, `LABORATORY_STAFF`, and `STUDENT`.
- Student self-registration with email verification before login.
- Password reset and in-session password change.
- Laboratory creation, editing, deletion, and staff assignment.
- Automatic PC record synchronization based on `computerCount`.
- Schedule creation, editing, deletion, and overlap prevention.
- Reservation creation for either `LAB` or `PC`.
- Reservation approval, rejection, completion, and student-side cancellation of pending requests.
- Management calendar events (`MAINTENANCE`, `HOLIDAY`) plus derived schedule and reservation calendar views.
- In-app notifications, notification read tracking, and server-sent event streaming.
- CSV export for reservation management and reports pages.
- Role-scoped dashboards and reports.
- An authenticated reservation assistant with optional external AI integration and deterministic fallback replies.

### Limitations

The following limitations are visible in the repository or are marked when not explicitly shown:

- The implemented role set is fixed to `ADMIN`, `LABORATORY_STAFF`, and `STUDENT`.
- Multi-factor authentication is not explicitly shown in the repository.
- Social login or third-party identity providers are not explicitly shown in the repository.
- A dedicated file storage service for laboratory images is not explicitly shown in the repository. The code accepts image URLs or base64 data URLs.
- Server-side pagination for most list endpoints is not explicitly shown in the repository. Several pages filter and paginate data on the frontend after fetching records.
- End-to-end browser tests and CI/CD pipeline configuration are not explicitly shown in the repository.
- A standalone public laboratory catalog route in the frontend is not explicitly shown in the repository, although the backend does expose optional-auth laboratory listing endpoints.

## Target Users and User Roles

| Role | Description | Permissions | Main Pages and Modules | Restrictions |
| --- | --- | --- | --- | --- |
| `ADMIN` | Full system manager responsible for users, laboratories, schedules, reservations, and calendar events. | Can create and update users, activate or deactivate accounts, manage laboratories, assign staff, manage schedules, review and complete reservations, view dashboards and reports, and manage calendar events. | `/dashboard`, `/management/users`, `/management/laboratories`, `/management/laboratories/assign-staff`, `/management/schedules`, `/management/reservations`, `/management/reports`, `/management/calendar`, `/profile`, `/assistant` | Cannot bypass backend validation rules such as duplicate room codes, schedule overlap prevention, or deletion restrictions tied to history. |
| `LABORATORY_STAFF` | Operational laboratory staff assigned to one or more laboratories. | Can view the assigned laboratory, manage schedules for the assigned laboratory, review reservations for the assigned laboratory, update PC status, view availability of other laboratories, view reports, and access the assistant. | `/dashboard`, `/management/laboratories`, `/management/schedules`, `/management/reservations`, `/management/reports`, `/profile`, `/assistant` | Cannot manage users, cannot manage calendar events, and cannot manage laboratories outside assigned scope. |
| `STUDENT` | End user who requests laboratory or PC reservations. | Can register, verify email, log in, browse available laboratories, inspect room details and schedules, submit reservation requests, view personal reservation history, cancel pending reservations, manage profile, view notifications, and use the assistant within student scope. | `/student/dashboard`, `/student/laboratories`, `/student/laboratories/:id`, `/student/laboratories/:id/reserve`, `/student/reservations`, `/profile`, `/assistant` | Cannot manage users, schedules, laboratories, calendar events, or review other users' reservations. |

Notes:

- The middleware accepts the alias `CUSTODIAN`, but normalizes it to `LABORATORY_STAFF`.
- Public visitors are not modeled as a stored database role. Public access is limited to routes such as `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, and `/verify-email`.

## System Features

| Feature | Description | Related Roles | Related Pages or Routes | Notes |
| --- | --- | --- | --- | --- |
| Student self-registration | Students can create accounts with validated names, email, student number, department, year level, phone number, and strong password rules. | `STUDENT` | Frontend: `/register`; API: `POST /api/auth/register` | Email verification is required before login. |
| Email verification | New accounts receive a verification token and must verify before authenticating. | `STUDENT` | Frontend: `/verify-email`; API: `POST /api/auth/verify-email`, `POST /api/auth/resend-verification` | In preview mode, verification URLs are returned in the response. |
| Login and session refresh | Authenticated access uses JWT access and refresh tokens stored in `HttpOnly` cookies, with session records stored in the database. | All roles | Frontend: `/login`; API: `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me` | Refresh logic is handled in `frontend/src/api/client.ts`. |
| Password recovery and change password | Users can request a reset link, reset via token, and change password while logged in. | All roles | Frontend: `/forgot-password`, `/reset-password`, `/profile`; API: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `POST /api/auth/change-password` | Reset and verification email delivery depends on SMTP or preview mode. |
| Laboratory catalog | Students and unauthenticated backend callers can fetch available laboratories; admins and staff can fetch all laboratory records. | Public, `STUDENT`, `ADMIN`, `LABORATORY_STAFF` | Frontend: `/student/laboratories`; API: `GET /api/laboratories`, `GET /api/laboratories/:id` | Controller logic hides unavailable labs from students and unauthenticated requests. |
| Laboratory details and weekly schedule view | Users can inspect room description, building, capacity, computer count, custodian, upcoming schedules, and reservation windows. | `STUDENT` | Frontend: `/student/laboratories/:id`, `/student/laboratories/:id/reserve`; API: `GET /api/laboratories/:id` | `WeeklyScheduleGrid` is used for date-focused schedule viewing. |
| Reservation request submission | Students can reserve either a whole laboratory or a specific PC within a published schedule window. | `STUDENT` | Frontend: `/student/laboratories/:id/reserve`; API: `POST /api/reservations` | Reservation type is `LAB` or `PC`. |
| Reservation conflict checking | The backend blocks overlapping room reservations, invalid time ranges, unavailable PCs, and out-of-schedule requests. | `STUDENT`, reviewers | `backend/src/services/ReservationService.ts` | Conflict checks run both on create and on approval. |
| Student reservation history and cancellation | Students can view all of their reservations and cancel only pending requests. | `STUDENT` | Frontend: `/student/reservations`; API: `GET /api/reservations`, `PATCH /api/reservations/:id/cancel` | Cancelled reservations remain in history. |
| Schedule management | Authorized users can create, edit, filter, and delete schedules while respecting overlap rules and history restrictions. | `ADMIN`, `LABORATORY_STAFF` | Frontend: `/management/schedules`; API: `GET/POST/PUT/DELETE /api/schedules` and staff schedule routes | Staff scope is restricted to the assigned laboratory. |
| Laboratory management | Admins can create, edit, and delete laboratory records, including image URL or uploaded data URL, capacity, and computer count. | `ADMIN` | Frontend: `/management/laboratories`; API: `POST/PUT/DELETE /api/laboratories` | Deletion is blocked when reservation or calendar history exists. |
| Automatic PC synchronization | PC records are auto-created or updated when `computerCount` changes. | `ADMIN` | `backend/src/services/LaboratoryService.ts` | Historical PCs may be set to `MAINTENANCE` instead of deleted. |
| PC status management | Staff can update PC availability inside the assigned lab; admins can update any laboratory PC. | `ADMIN`, `LABORATORY_STAFF` | Frontend: `/management/laboratories`; API: `PUT /api/laboratories/:id/pcs/:pcId/status`, `PUT /api/staff/my-lab/pcs/:id/status` | Allowed values are `AVAILABLE`, `OCCUPIED`, and `MAINTENANCE`. |
| Reservation review and completion | Admins and staff can approve, reject, remark, and complete reservations. | `ADMIN`, `LABORATORY_STAFF` | Frontend: `/management/reservations`; API: `PATCH /api/reservations/:id/review`, `PATCH /api/reservations/:id/complete`, `PUT /api/staff/my-lab/reservation/:id` | Staff review is limited to the assigned laboratory. |
| Staff assignment | Admins can assign, reassign, or unassign laboratory custodians. | `ADMIN` | Frontend: `/management/laboratories/assign-staff`; API: `GET /api/laboratories/assignments`, `GET /api/laboratories/staff-options`, `PUT /api/laboratories/:id/custodian` | Only active `LABORATORY_STAFF` accounts can be assigned. |
| Management calendar | Admins can create maintenance and holiday events and view derived schedule/reservation events. | `ADMIN` | Frontend: `/management/calendar`; API: `GET/POST/PUT/DELETE /api/calendar` | Calendar view merges editable custom events with derived schedules and reservations. |
| Dashboards and analytics | Role-based dashboards show totals, recent activity, recent reservations, or trends depending on the role. | All roles | Frontend: `/dashboard`, `/student/dashboard`; API: `GET /api/dashboard` | Dashboard payload shape changes by role. |
| Reports and CSV export | Reservation data can be filtered, summarized, charted, and exported to CSV. | `ADMIN`, `LABORATORY_STAFF` | Frontend: `/management/reports`, `/management/reservations` | Report export is implemented in the frontend with CSV utilities. |
| Notifications | The system stores in-app notifications, tracks unread counts, marks notifications as read, and supports live notification streaming. | All authenticated roles | UI: `NotificationCenter`; API: `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/mark-all-read`, `GET /api/notifications/stream` | Live updates use server-sent events. |
| Email notifications | Reservation-created, confirmed, rejected, cancelled, and reminder events can be delivered by email. | Students, staff, admins | `backend/src/services/NotificationService.ts` | Delivery depends on SMTP configuration or preview mode. |
| Reservation assistant | ComPort GPT provides grounded, role-aware answers and can prepare draft actions requiring confirmation. | All authenticated roles | Frontend: `/assistant`; API: `/api/ai/reservation-assistant*` | If no AI provider is configured, deterministic fallback replies are used. |
| Profile management | Users can update profile details and change their password. | All authenticated roles | Frontend: `/profile`; API: `PUT /api/users/profile`, `POST /api/auth/change-password` | Year level remains role-validated. |

## Technology Stack

### Frontend Technologies

| Technology | Evidence in Repository | Purpose |
| --- | --- | --- |
| React 19 | `frontend/package.json` | Component-based user interface |
| Vite 6 | `frontend/package.json`, `frontend/vite.config.ts` | Frontend dev server and build tool |
| TypeScript | `frontend/package.json`, `frontend/tsconfig*.json` | Static typing |
| React Router 7 | `frontend/package.json`, `frontend/src/App.tsx` | Client-side routing |
| TanStack React Query | `frontend/package.json`, `frontend/src/App.tsx` | Data fetching, cache invalidation, mutation handling |
| React Hook Form + Zod | `frontend/package.json`, multiple page forms | Client-side form state and validation |
| Axios | `frontend/package.json`, `frontend/src/api/client.ts` | HTTP client with refresh interceptor |
| Tailwind CSS | `frontend/tailwind.config.js`, `frontend/src/index.css` | Utility-first styling |
| Chart.js + react-chartjs-2 | `frontend/package.json`, dashboard and reports pages | Charts for analytics and reports |
| Lucide React | `frontend/package.json` | Icons |
| React Hot Toast | `frontend/package.json` | UI notifications |

### Backend Technologies

| Technology | Evidence in Repository | Purpose |
| --- | --- | --- |
| Node.js 22 | Root and workspace `package.json` engines | Runtime |
| Express 4 | `backend/package.json`, `backend/src/app.ts` | REST API server |
| TypeScript | `backend/package.json`, `backend/tsconfig.json` | Static typing |
| Prisma ORM | `backend/package.json`, `backend/prisma/schema.prisma` | Database access and migrations |
| PostgreSQL | `backend/prisma/schema.prisma`, `docker-compose.yml` | Relational database |
| Zod | `backend/package.json`, `backend/src/validations/*.ts` | Request validation |
| bcrypt | `backend/package.json`, auth and seed files | Password hashing |
| jsonwebtoken | `backend/package.json`, `backend/src/utils/jwt.ts` | Access and refresh token signing |
| cookie-parser | `backend/package.json`, `backend/src/app.ts` | Cookie parsing |
| cors | `backend/package.json`, `backend/src/app.ts` | Cross-origin configuration |
| helmet | `backend/package.json`, `backend/src/app.ts` | Security headers |
| morgan | `backend/package.json`, `backend/src/app.ts` | Request logging |
| nodemailer | `backend/package.json`, `backend/src/services/EmailService.ts` | SMTP email delivery |
| dayjs | `backend/package.json`, assistant and seed logic | Date handling |

### Database and ORM

- Database provider: PostgreSQL
- ORM: Prisma
- Schema file: `backend/prisma/schema.prisma`
- Migration folder: `backend/prisma/migrations/`
- Seed script: `backend/prisma/seed.ts`

### Authentication Method

The repository explicitly shows:

- JWT access tokens
- JWT refresh tokens
- `HttpOnly` auth cookies
- Database-backed auth sessions in `AuthSession`
- Email verification before login
- Password hashing through `bcrypt`

### Deployment-Related Files

| File | Purpose |
| --- | --- |
| `docker-compose.yml` | Local multi-container setup with PostgreSQL, backend, and frontend |
| `backend/Dockerfile` | Backend container build and startup |
| `frontend/Dockerfile` | Frontend build and Nginx runtime image |
| `frontend/nginx.conf` | SPA routing in Nginx |
| `frontend/vercel.json` | SPA rewrite configuration for static hosting |
| `backend/Procfile` | Procfile-based backend start command |

## System Architecture

### Architectural Style

The repository follows a layered client-server architecture:

- The frontend is a React single-page application.
- The backend is an Express REST API.
- Prisma serves as the data access layer.
- PostgreSQL stores the persistent records.
- Background services handle notifications and reservation reminders.
- Optional SMTP and optional external AI providers extend the core platform.

### Frontend Layer

The frontend includes:

- Public pages for landing, login, registration, password reset, and email verification
- Role-protected pages for dashboards, laboratories, schedules, reservations, reports, calendar, and profile settings
- `AuthContext` for current-user bootstrapping
- Axios request handling with automatic refresh-session retry
- React Query for caching and invalidation
- Notification streaming through `EventSource`

### Backend Layer

The backend is organized into clear responsibilities:

- `routes/` defines route groups and middleware composition
- `controllers/` accepts HTTP requests and returns HTTP responses
- `services/` contains business logic
- `middleware/` handles authentication, authorization, validation, rate limiting, and error processing
- `domain/` contains domain-oriented OOP models
- `notifications/` and notification services support event-driven notification delivery

### Database Layer

The database layer uses Prisma models for:

- Users and sessions
- Laboratories and PCs
- Schedules and reservations
- Activity logs
- Calendar events
- Notifications
- Email verification tokens
- Password reset tokens

### API Communication

- The frontend uses Axios through `frontend/src/api/client.ts`.
- The API base URL comes from `VITE_API_URL`.
- Cookies are sent with `withCredentials: true`.
- On `401` responses, the frontend attempts `POST /api/auth/refresh` before failing the request.

### Authentication and Session Flow

The repository explicitly shows this flow:

1. User logs in through `POST /api/auth/login`.
2. Backend validates email, password, account status, and email verification.
3. Backend signs an access token and a refresh token.
4. Backend stores a refresh-session record in `AuthSession`.
5. Backend sets access and refresh tokens as `HttpOnly` cookies.
6. Frontend requests `GET /api/auth/me` to bootstrap current user state.
7. If an access token expires, the frontend calls `POST /api/auth/refresh`.
8. Logout or sensitive account changes revoke active sessions in the database.

### External Services

- SMTP email delivery for verification, password reset, and reservation notifications
- Optional external AI provider for assistant rewriting
- PostgreSQL deployment examples that target Supabase-compatible connection strings

### Architecture Diagram

```mermaid
flowchart TD
    User[User]
    Frontend[React + Vite Frontend]
    API[Express REST API]
    MW[Middleware Layer\nAuth, Role, Validation, Rate Limit, Error Handling]
    Services[Service Layer\nAuth, Laboratory, Schedule, Reservation,\nCalendar, Notification, Assistant]
    Prisma[Prisma ORM]
    DB[(PostgreSQL Database)]
    SSE[SSE Notification Stream]
    SMTP[SMTP Email Delivery]
    AI[Optional AI Provider]

    User --> Frontend
    Frontend -->|Axios + Cookies| API
    API --> MW
    MW --> Services
    Services --> Prisma
    Prisma --> DB
    Services --> SSE
    SSE --> Frontend
    Services --> SMTP
    Services -.optional.-> AI
```

## Object-Oriented Programming Concepts

### Where OOP Appears in the Repository

The repository uses object-oriented programming most clearly in the backend domain, controller, and service layers.

Examples:

- `backend/src/domain/User.ts`
- `backend/src/domain/Admin.ts`
- `backend/src/domain/Student.ts`
- `backend/src/domain/LaboratoryStaff.ts`
- `backend/src/domain/UserFactory.ts`
- `backend/src/domain/Laboratory.ts`
- `backend/src/domain/Schedule.ts`
- `backend/src/domain/Reservation.ts`
- `backend/src/services/*.ts`
- `backend/src/controllers/*.ts`

### Encapsulation

Encapsulation means combining related data and behavior inside a class so that other parts of the program interact through controlled methods.

Code-based examples:

- `User` stores the email in a private field `#email` and exposes getters such as `email`, `fullName`, `role`, and `status`.
- `Laboratory`, `Schedule`, and `Reservation` wrap Prisma records and expose behavior such as `canAcceptReservations()`, `isBookable()`, `hasValidTimeRange()`, `canBeCancelledByStudent()`, and `canBeCompleted()`.
- Service classes such as `ReservationService` encapsulate the reservation workflow, including validation, locking, conflict checking, activity logging, and notification publishing.

### Abstraction

Abstraction means hiding complex steps behind a simpler interface.

Code-based examples:

- Controllers expose concise entry points like `ReservationController.create`, while the detailed workflow is hidden inside `ReservationService.createReservation`.
- `ScheduleService` hides overlap detection, scope checks, and history restrictions behind methods like `createSchedule`, `updateSchedule`, and `deleteSchedule`.
- `AuthService` abstracts session creation, token rotation, email verification, password reset handling, and logout revocation.
- Middleware such as `authenticate`, `requireRole`, and `requireAssignedLabManager` hides repeated security checks from route handlers.

### Inheritance

Inheritance is explicitly shown in the repository.

Examples:

- `Admin extends User`
- `Student extends User`
- `LaboratoryStaff extends User`

These subclasses inherit shared behavior from the abstract `User` class and override role-specific behavior.

### Polymorphism

Polymorphism is explicitly shown in the repository.

Examples:

- `UserFactory.create()` returns different subclasses depending on the database role.
- The system then calls common methods such as `canCreateReservation()`, `canReviewReservations()`, and `getDashboardScope()` without needing separate conditional logic everywhere.
- `DashboardService` uses `getDashboardScope()` to branch to admin, staff, or student dashboard logic.

### How OOP Helps the Project

- It keeps business rules reusable and easier to maintain.
- It separates role behavior from route wiring.
- It makes the code easier to explain in a defense because each class has a focused responsibility.
- It reduces duplicated permission logic.

### Beginner-Friendly Defense Explanation

If asked during defense, a simple explanation is:

- Encapsulation: “We grouped related data and actions together in classes, such as user behavior and reservation rules.”
- Abstraction: “We hid complex backend processes behind services and controllers so each layer has a simpler job.”
- Inheritance: “Admin, student, and laboratory staff reuse a common user base class.”
- Polymorphism: “The system can treat different user roles as users in general, but each role responds differently when methods like `getDashboardScope()` are called.”

## APIs and Endpoints

All backend routes are registered under `/api`.

### Health

| Method | Endpoint | Purpose | Auth and Role | Key Inputs | Related File |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/health` | Returns API health metadata. | Public | None | `backend/src/routes/index.ts` |

### Authentication

| Method | Endpoint | Purpose | Auth and Role | Key Inputs | Related File |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Registers a student account and creates an email verification token. | Public | `firstName`, `lastName`, `email`, `password`, `studentNumber`, `department`, `yearLevel`, `phone` | `backend/src/routes/auth.routes.ts` |
| `POST` | `/api/auth/login` | Logs in a verified active account and sets auth cookies. | Public | `email`, `password` | `backend/src/routes/auth.routes.ts` |
| `POST` | `/api/auth/refresh` | Rotates refresh session and returns a new authenticated session. | Cookie-based session | Refresh cookie | `backend/src/routes/auth.routes.ts` |
| `POST` | `/api/auth/verify-email` | Verifies a pending email verification token. | Public | `token` | `backend/src/routes/auth.routes.ts` |
| `POST` | `/api/auth/resend-verification` | Sends another verification email for an unverified active account. | Public | `email` | `backend/src/routes/auth.routes.ts` |
| `POST` | `/api/auth/forgot-password` | Creates a password reset token. | Public | `email` | `backend/src/routes/auth.routes.ts` |
| `POST` | `/api/auth/reset-password` | Resets password using a valid token and revokes active sessions. | Public | `token`, `newPassword` | `backend/src/routes/auth.routes.ts` |
| `POST` | `/api/auth/change-password` | Changes password for the current authenticated user. | Authenticated | `currentPassword`, `newPassword` | `backend/src/routes/auth.routes.ts` |
| `POST` | `/api/auth/logout` | Logs out the current session or refresh token. | Optional authentication | Refresh cookie and current auth session when present | `backend/src/routes/auth.routes.ts` |
| `GET` | `/api/auth/me` | Returns the current authenticated user profile. | Authenticated | None | `backend/src/routes/auth.routes.ts` |

### Users

| Method | Endpoint | Purpose | Auth and Role | Key Inputs | Related File |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/users` | Lists all user accounts. | `ADMIN` | None | `backend/src/routes/user.routes.ts` |
| `POST` | `/api/users` | Creates an admin, staff, or student account. | `ADMIN` | `firstName`, `lastName`, `email`, `password`, `role`, optional student fields, department, phone | `backend/src/routes/user.routes.ts` |
| `PUT` | `/api/users/:id` | Updates an existing user account. | `ADMIN` | Path `id`; editable user fields and optional `status` | `backend/src/routes/user.routes.ts` |
| `PATCH` | `/api/users/:id/status` | Activates or deactivates a user account. | `ADMIN` | Path `id`; `status` | `backend/src/routes/user.routes.ts` |
| `PUT` | `/api/users/profile` | Updates the current user's profile. | Authenticated | `firstName`, `lastName`, optional `department`, `yearLevel`, `phone` | `backend/src/routes/user.routes.ts` |

### Laboratories

| Method | Endpoint | Purpose | Auth and Role | Key Inputs | Related File |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/laboratories` | Lists laboratories. Students and unauthenticated requests see available labs only; admins and staff can see unavailable labs too. | Optional authentication | None | `backend/src/routes/laboratory.routes.ts` |
| `GET` | `/api/laboratories/:id` | Returns one laboratory with schedules, reservations, and PCs. | Optional authentication | Path `id` | `backend/src/routes/laboratory.routes.ts` |
| `POST` | `/api/laboratories` | Creates a laboratory. | `ADMIN` | Name, room code, building, location, capacity, computer count, description, status, image URL/data URL, optional `custodianId` | `backend/src/routes/laboratory.routes.ts` |
| `PUT` | `/api/laboratories/:id` | Updates a laboratory. | `ADMIN` | Path `id`; same fields as create | `backend/src/routes/laboratory.routes.ts` |
| `DELETE` | `/api/laboratories/:id` | Deletes a laboratory if no reservation or calendar history exists. | `ADMIN` | Path `id` | `backend/src/routes/laboratory.routes.ts` |
| `GET` | `/api/laboratories/assignments` | Lists laboratories for staff assignment management. | `ADMIN` | Optional query: `building`, `department` | `backend/src/routes/laboratory.routes.ts` |
| `GET` | `/api/laboratories/staff-options` | Lists active laboratory staff options. | `ADMIN` | None | `backend/src/routes/laboratory.routes.ts` |
| `PUT` | `/api/laboratories/:id/custodian` | Assigns or unassigns a laboratory custodian. | `ADMIN` | Path `id`; `custodianId` or `null` | `backend/src/routes/laboratory.routes.ts` |
| `PUT` | `/api/laboratories/:id/pcs/:pcId/status` | Updates the status of a PC in a laboratory. | `ADMIN` | Path `id`, `pcId`; `status` | `backend/src/routes/laboratory.routes.ts` |

### Schedules

| Method | Endpoint | Purpose | Auth and Role | Key Inputs | Related File |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/schedules` | Lists schedules, optionally filtered by laboratory and date. Staff results are scoped when authenticated as staff. | Optional authentication | Optional query: `laboratoryId`, `date` | `backend/src/routes/schedule.routes.ts` |
| `POST` | `/api/schedules` | Creates a schedule block. | `ADMIN`, `LABORATORY_STAFF` | `laboratoryId`, `date`, `startTime`, `endTime`, `status` | `backend/src/routes/schedule.routes.ts` |
| `PUT` | `/api/schedules/:id` | Updates a schedule block. | `ADMIN`, `LABORATORY_STAFF` | Path `id`; same fields as create | `backend/src/routes/schedule.routes.ts` |
| `DELETE` | `/api/schedules/:id` | Deletes a schedule block if no reservation history exists. | `ADMIN`, `LABORATORY_STAFF` | Path `id` | `backend/src/routes/schedule.routes.ts` |

### Reservations

| Method | Endpoint | Purpose | Auth and Role | Key Inputs | Related File |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/reservations` | Lists reservations scoped to the current user role. | `STUDENT`, `LABORATORY_STAFF`, `ADMIN` | None | `backend/src/routes/reservation.routes.ts` |
| `POST` | `/api/reservations` | Creates a reservation request. | `STUDENT` | `scheduleId`, `laboratoryId`, `reservationType`, optional `pcId`, `purpose`, `startTime`, `endTime` | `backend/src/routes/reservation.routes.ts` |
| `PATCH` | `/api/reservations/:id/cancel` | Cancels a student's own pending reservation. | `STUDENT` | Path `id` | `backend/src/routes/reservation.routes.ts` |
| `PATCH` | `/api/reservations/:id/review` | Approves or rejects a pending reservation. | `ADMIN`, `LABORATORY_STAFF` | Path `id`; `status`, optional `remarks` | `backend/src/routes/reservation.routes.ts` |
| `PATCH` | `/api/reservations/:id/complete` | Marks an approved reservation as completed. | `ADMIN`, `LABORATORY_STAFF` | Path `id`; optional `remarks` | `backend/src/routes/reservation.routes.ts` |

### Staff-Scoped Operations

| Method | Endpoint | Purpose | Auth and Role | Key Inputs | Related File |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/staff/my-lab` | Returns the primary assigned laboratory for the current staff member. | `ADMIN`, `LABORATORY_STAFF` | None | `backend/src/routes/staff.routes.ts` |
| `GET` | `/api/staff/my-lab/reservations` | Returns reservations for the assigned laboratory. | `ADMIN`, `LABORATORY_STAFF` | None | `backend/src/routes/staff.routes.ts` |
| `GET` | `/api/staff/my-lab/schedules` | Returns schedules for the assigned laboratory. | `ADMIN`, `LABORATORY_STAFF` | None | `backend/src/routes/staff.routes.ts` |
| `GET` | `/api/staff/my-lab/logs` | Returns recent activity logs for the assigned laboratory. | `ADMIN`, `LABORATORY_STAFF` | None | `backend/src/routes/staff.routes.ts` |
| `GET` | `/api/staff/my-lab/pcs` | Returns PCs for the assigned laboratory. | `ADMIN`, `LABORATORY_STAFF` | None | `backend/src/routes/staff.routes.ts` |
| `GET` | `/api/staff/labs/availability` | Returns availability summaries for laboratories. | `ADMIN`, `LABORATORY_STAFF` | Optional query: `laboratoryId`, `date` | `backend/src/routes/staff.routes.ts` |
| `GET` | `/api/staff/labs/schedules/public` | Returns public schedule blocks from laboratories. | `ADMIN`, `LABORATORY_STAFF` | Optional query: `laboratoryId`, `date` | `backend/src/routes/staff.routes.ts` |
| `PUT` | `/api/staff/my-lab/reservation/:id` | Reviews a reservation in assigned scope. | `ADMIN`, `LABORATORY_STAFF` | Path `id`; `status`, optional `remarks` | `backend/src/routes/staff.routes.ts` |
| `PUT` | `/api/staff/my-lab/schedule/:id` | Updates a schedule in assigned scope. | `ADMIN`, `LABORATORY_STAFF` | Path `id`; `date`, `startTime`, `endTime`, `status` | `backend/src/routes/staff.routes.ts` |
| `PUT` | `/api/staff/my-lab/pcs/:id/status` | Updates a PC status in assigned scope. | `ADMIN`, `LABORATORY_STAFF` | Path `id`; `status` | `backend/src/routes/staff.routes.ts` |

### Dashboard

| Method | Endpoint | Purpose | Auth and Role | Key Inputs | Related File |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/dashboard` | Returns role-scoped dashboard data. | Authenticated | None | `backend/src/routes/dashboard.routes.ts` |

### Calendar

| Method | Endpoint | Purpose | Auth and Role | Key Inputs | Related File |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/calendar` | Lists custom calendar events and derived schedule or reservation events. | `ADMIN` | Optional query: `laboratoryId`, `date` | `backend/src/routes/calendar.routes.ts` |
| `POST` | `/api/calendar` | Creates a calendar event. | `ADMIN` | `title`, `type`, optional `laboratoryId`, optional `pcId`, `date`, optional `startTime`, optional `endTime`, optional `description` | `backend/src/routes/calendar.routes.ts` |
| `PUT` | `/api/calendar/:id` | Updates a calendar event. | `ADMIN` | Path `id`; same fields as create | `backend/src/routes/calendar.routes.ts` |
| `DELETE` | `/api/calendar/:id` | Deletes a calendar event. | `ADMIN` | Path `id` | `backend/src/routes/calendar.routes.ts` |

### Notifications

| Method | Endpoint | Purpose | Auth and Role | Key Inputs | Related File |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/notifications` | Lists in-app notifications and unread count. | Authenticated | Optional query: `unreadOnly`, `limit` | `backend/src/routes/notification.routes.ts` |
| `POST` | `/api/notifications/mark-all-read` | Marks all in-app notifications as read. | Authenticated | None | `backend/src/routes/notification.routes.ts` |
| `PATCH` | `/api/notifications/:id/read` | Marks one in-app notification as read. | Authenticated | Path `id` | `backend/src/routes/notification.routes.ts` |
| `GET` | `/api/notifications/stream` | Opens a server-sent event notification stream. | Authenticated | None | `backend/src/routes/notification.routes.ts` |

### Reservation Assistant

| Method | Endpoint | Purpose | Auth and Role | Key Inputs | Related File |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/ai/reservation-assistant` | Sends a grounded assistant query. | Authenticated | `message` | `backend/src/routes/ai.routes.ts` |
| `POST` | `/api/ai/reservation-assistant/actions/:actionId/confirm` | Confirms a pending assistant draft action. | Authenticated | Path `actionId`; optional `confirmation` | `backend/src/routes/ai.routes.ts` |
| `POST` | `/api/ai/reservation-assistant/actions/:actionId/cancel` | Cancels a pending assistant draft action. | Authenticated | Path `actionId` | `backend/src/routes/ai.routes.ts` |

## External APIs and Integrations

| Integration | Purpose | Where It Is Used | Environment Variables | Notes |
| --- | --- | --- | --- | --- |
| PostgreSQL connection, including Supabase-style connection strings | Main relational database connection | `backend/prisma/schema.prisma`, `backend/src/config/env.ts`, `backend/.env.example` | `DATABASE_URL`, `DIRECT_URL` | The repository shows PostgreSQL use directly; Supabase is referenced as a connection style, not as a replacement API layer. |
| SMTP through Nodemailer | Email verification, password reset, and reservation notification delivery | `backend/src/services/EmailService.ts`, `backend/src/services/AuthService.ts`, `backend/src/services/NotificationService.ts` | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`, `SMTP_TLS_REJECT_UNAUTHORIZED`, `NOTIFICATION_EMAIL_PREVIEW` | Brevo should use `smtp-relay.brevo.com`, port `587`, and `SMTP_SECURE=false`. In development or incomplete SMTP configuration, preview mode can log or expose preview links instead of sending email. |
| Optional AI provider | Assistant response rewriting and optional external completion calls | `backend/src/services/ReservationAssistantService.ts` | `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_API_BASE_URL`, `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME` | Supported values are `groq`, `openrouter`, `openai`, and `custom`. If not configured, deterministic fallback replies are used. |
| Optional Google Calendar API | Creates Google Calendar events after approved reservations | `backend/src/services/GoogleCalendarService.ts`, `backend/src/services/ReservationService.ts` | `GOOGLE_CALENDAR_ENABLED`, `GOOGLE_CALENDAR_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_PROJECT_ID`, `GOOGLE_CALENDAR_TIME_ZONE` | Backend-only service-account integration. If disabled or failing, reservation approval still succeeds and sync status is stored on the reservation. |

No payment API, map API, SMS API, file storage API, or external authentication provider is explicitly shown in the repository.

### Google Calendar Setup

Google Calendar sync is optional and disabled by default. It runs only in the backend after an admin or laboratory staff member approves a reservation. The frontend never receives Google private keys or service-account credentials.

Recommended setup:

1. Create or select a Google Cloud project.
2. Enable the Google Calendar API.
3. Create a service account for ComPort calendar sync.
4. Create a JSON key for that service account and keep it secret.
5. Share the target Google Calendar with the service-account email and grant `Make changes to events`.
6. Set the backend environment variables listed below.
7. Deploy migrations so reservation sync metadata fields exist.

When `GOOGLE_CALENDAR_ENABLED=false`, approved reservations remain valid in ComPort and are marked as calendar-disabled. When it is enabled but credentials or Google API access are invalid, approval still succeeds and the reservation is marked as calendar sync failed.

Use this backend-only key format for deployment dashboards that store single-line values:

```env
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nKEY_CONTENT_HERE\n-----END PRIVATE KEY-----\n"
```

If the log mentions `DECODER routines::unsupported`, the private key is usually missing escaped newline characters or the PEM wrapper was copied incorrectly.

## Database Design

### Database Type

- Type: PostgreSQL
- ORM: Prisma
- Schema file: `backend/prisma/schema.prisma`

### Entities and Relationships

| Table or Entity | Purpose | Important Fields | Relationships |
| --- | --- | --- | --- |
| `User` | Stores admin, student, and laboratory staff accounts. | `firstName`, `lastName`, `email`, `emailVerifiedAt`, `passwordHash`, `role`, `status`, `studentNumber`, `department`, `yearLevel`, `phone` | Related to `Reservation`, `Schedule`, `CalendarEvent`, `Laboratory`, `ActivityLog`, `Notification`, `AuthSession`, `PasswordResetToken`, `EmailVerificationToken` |
| `Laboratory` | Stores laboratory records. | `name`, `roomCode`, `building`, `location`, `capacity`, `computerCount`, `description`, `status`, `imageUrl`, `custodianId` | Parent of `PC`, `Schedule`, `Reservation`, `CalendarEvent`, `ActivityLog`; optional `custodian` is a `User` |
| `PC` | Stores workstation records under a laboratory. | `laboratoryId`, `pcNumber`, `status` | Belongs to `Laboratory`; related to `Reservation`, `CalendarEvent`, `ActivityLog` |
| `Schedule` | Stores published room availability blocks. | `laboratoryId`, `date`, `startTime`, `endTime`, `status`, `createdById` | Belongs to `Laboratory`; created by `User`; linked from `Reservation` |
| `Reservation` | Stores student reservation requests and review state. | `reservationCode`, `studentId`, `laboratoryId`, `scheduleId`, `pcId`, `reservationType`, `purpose`, `reservationDate`, `startTime`, `endTime`, `status`, `remarks`, `reviewedById`, `reviewedAt`, `cancelledAt` | Belongs to `User` as student; optionally belongs to reviewer `User`; belongs to `Laboratory`; optionally links `Schedule` and `PC`; parent of `Notification` |
| `CalendarEvent` | Stores admin-created maintenance and holiday entries. | `title`, `type`, `laboratoryId`, `pcId`, `date`, `startTime`, `endTime`, `description`, `createdById` | Optionally belongs to `Laboratory` and `PC`; created by `User` |
| `Notification` | Stores email and in-app notification records. | `userId`, `reservationId`, `channel`, `type`, `status`, `subject`, `message`, `metadata`, `readAt`, `sentAt` | Belongs to `User`; optionally belongs to `Reservation` |
| `AuthSession` | Stores refresh-session records. | `userId`, `tokenHash`, `userAgent`, `ipAddress`, `expiresAt`, `lastUsedAt`, `revokedAt` | Belongs to `User` |
| `PasswordResetToken` | Stores password reset tokens. | `userId`, `tokenHash`, `expiresAt`, `usedAt` | Belongs to `User` |
| `EmailVerificationToken` | Stores email verification tokens. | `userId`, `tokenHash`, `expiresAt`, `usedAt` | Belongs to `User` |
| `ActivityLog` | Stores audit-style activity entries. | `userId`, `labId`, `pcId`, `action`, `entityType`, `entityId`, `description`, `metadata`, `timestamp` | Optionally belongs to `User`, `Laboratory`, and `PC` |

### Constraints Visible in the Schema

- `User.email` is unique.
- `User.studentNumber` is unique when present.
- `Laboratory.roomCode` is unique.
- `Reservation.reservationCode` is unique.
- `PC` has a composite unique key on `laboratoryId` and `pcNumber`.
- `Notification` has a composite unique key on `userId`, `reservationId`, `channel`, and `type`.
- Indexed fields support frequent lookup by role, status, date, laboratory, PC, and reservation conflict patterns.

### Seed Data

The repository contains a seed script at `backend/prisma/seed.ts`. It explicitly creates:

- One admin account
- Three laboratory staff accounts
- Five student accounts
- Three laboratories
- Auto-generated PCs for each laboratory
- Example schedules
- Example reservations with multiple statuses
- Example calendar events
- Example activity logs

### Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Reservation : "student"
    User ||--o{ Reservation : "reviewedBy"
    User ||--o{ Schedule : "creates"
    User ||--o{ CalendarEvent : "creates"
    User ||--o{ Laboratory : "assigned as custodian"
    User ||--o{ ActivityLog : "logs"
    User ||--o{ Notification : "receives"
    User ||--o{ AuthSession : "has"
    User ||--o{ PasswordResetToken : "has"
    User ||--o{ EmailVerificationToken : "has"

    Laboratory ||--o{ PC : "contains"
    Laboratory ||--o{ Schedule : "has"
    Laboratory ||--o{ Reservation : "hosts"
    Laboratory ||--o{ CalendarEvent : "scopes"
    Laboratory ||--o{ ActivityLog : "appears in"

    Schedule ||--o{ Reservation : "selected by"
    PC ||--o{ Reservation : "assigned to"
    PC ||--o{ CalendarEvent : "scoped by"
    PC ||--o{ ActivityLog : "appears in"
    Reservation ||--o{ Notification : "triggers"
```

## System Modules

| Module | Purpose | Main Features | Key Files | Roles |
| --- | --- | --- | --- | --- |
| Authentication Module | Handles account access and session lifecycle. | Registration, login, refresh, email verification, forgot/reset password, logout, change password | `backend/src/routes/auth.routes.ts`, `backend/src/services/AuthService.ts`, `frontend/src/pages/public/*` | Public, all users |
| User Management Module | Handles account creation and maintenance. | List users, create users, update users, activate or deactivate users, update own profile | `backend/src/routes/user.routes.ts`, `backend/src/services/UserService.ts`, `frontend/src/pages/admin/UserManagementPage.tsx`, `frontend/src/pages/ProfilePage.tsx` | `ADMIN`, all users for profile |
| Laboratory Management Module | Manages room records and PC inventory. | Create/edit/delete laboratories, sync PC records, update PC status, list availability | `backend/src/routes/laboratory.routes.ts`, `backend/src/services/LaboratoryService.ts`, `frontend/src/pages/staff/LaboratoryManagementPage.tsx` | `ADMIN`, `LABORATORY_STAFF` |
| Staff Assignment Module | Assigns laboratory custodians. | Assignment, reassignment, unassignment, filter by building and department | `backend/src/services/LaboratoryService.ts`, `frontend/src/pages/admin/LaboratoryStaffAssignmentPage.tsx` | `ADMIN` |
| Schedule Management Module | Publishes room schedule blocks. | Create, update, delete, filter, staff-scoped schedule control, public schedule view for staff | `backend/src/routes/schedule.routes.ts`, `backend/src/services/ScheduleService.ts`, `frontend/src/pages/staff/ScheduleManagementPage.tsx` | `ADMIN`, `LABORATORY_STAFF` |
| Reservation Module | Handles reservation lifecycle. | Create, list, cancel, approve, reject, complete, conflict checks | `backend/src/routes/reservation.routes.ts`, `backend/src/services/ReservationService.ts`, `frontend/src/pages/student/ReserveLaboratoryPage.tsx`, `frontend/src/pages/student/MyReservationsPage.tsx`, `frontend/src/pages/staff/ReservationManagementPage.tsx` | `STUDENT`, `ADMIN`, `LABORATORY_STAFF` |
| Dashboard Module | Shows role-specific operational data. | Totals, trends, recent activity, recent reservations | `backend/src/services/DashboardService.ts`, `frontend/src/pages/student/StudentDashboardPage.tsx`, `frontend/src/pages/staff/StaffDashboardPage.tsx` | All authenticated roles |
| Reports Module | Summarizes reservation activity for presentation and export. | Filters, charts, CSV export | `frontend/src/pages/staff/ReportsPage.tsx`, `frontend/src/utils/csv.ts` | `ADMIN`, `LABORATORY_STAFF` |
| Notification Module | Delivers and tracks system notices. | In-app list, unread count, mark-as-read, mark-all-read, email delivery, SSE streaming | `backend/src/routes/notification.routes.ts`, `backend/src/services/NotificationService.ts`, `backend/src/services/NotificationInboxService.ts`, `backend/src/services/NotificationRealtimeService.ts`, `frontend/src/components/layout/NotificationCenter.tsx` | All authenticated roles |
| Management Calendar Module | Maintains administrative calendar blocks and merged calendar views. | Create, edit, delete maintenance and holiday events; display derived schedule and reservation events | `backend/src/routes/calendar.routes.ts`, `backend/src/services/CalendarService.ts`, `frontend/src/pages/admin/ManagementCalendarPage.tsx` | `ADMIN` |
| Assistant Module | Provides grounded, role-aware assistant behavior. | Reservation help, availability lookup, statistics summaries, role capability answers, draft actions with confirmation | `backend/src/routes/ai.routes.ts`, `backend/src/services/ReservationAssistantService.ts`, `frontend/src/pages/ReservationAssistantPage.tsx` | All authenticated roles |

## User Flows

### Registration, Verification, and Login Flow

```mermaid
flowchart TD
    A[Student opens Register page] --> B[Submit registration form]
    B --> C[Backend validates fields and checks duplicates]
    C --> D[User record created with emailVerifiedAt = null]
    D --> E[Verification token created]
    E --> F[Verification email or preview link prepared]
    F --> G[Student opens verification link]
    G --> H[Backend verifies token and marks email verified]
    H --> I[Student logs in]
    I --> J[Backend checks password, active status, and verified email]
    J --> K[Access and refresh cookies set]
    K --> L[Frontend loads current user profile]
```

### Reservation Creation and Review Flow

```mermaid
flowchart TD
    A[Student selects laboratory and schedule] --> B[Choose LAB or PC reservation]
    B --> C[Submit purpose and time range]
    C --> D[Backend validates schedule, time range, lab availability, and conflicts]
    D --> E[Reservation saved as PENDING]
    E --> F[Notification event published]
    F --> G[Admin or laboratory staff opens Reservation Management]
    G --> H[Reviewer approves or rejects]
    H --> I{Approved?}
    I -- Yes --> J[Conflict check runs again]
    J --> K[Reservation becomes APPROVED]
    I -- No --> L[Reservation becomes REJECTED]
    K --> M[Reviewer may later mark reservation COMPLETED]
    E --> N[Student may cancel while still PENDING]
```

### Password Reset Flow

```mermaid
flowchart TD
    A[User opens Forgot Password page] --> B[Submit email]
    B --> C[Backend creates reset token for active account]
    C --> D[Reset email or preview link prepared]
    D --> E[User opens reset link]
    E --> F[User submits new password]
    F --> G[Backend validates token and updates password hash]
    G --> H[Existing sessions revoked]
    H --> I[User logs in with new password]
```

### Assistant Draft and Confirmation Flow

```mermaid
flowchart TD
    A[Authenticated user opens /assistant] --> B[Send role-aware question or command]
    B --> C[Assistant inspects user role and system context]
    C --> D{Read-only answer or write draft?}
    D -- Read-only --> E[Reply with grounded summary or availability]
    D -- Write draft --> F[Create pending action preview]
    F --> G[User confirms or cancels]
    G -- Confirm --> H[Backend executes allowed action]
    G -- Cancel --> I[Pending action discarded]
```

## Data Flow Diagram

```mermaid
flowchart LR
    UserInput[User Input]
    Frontend[Frontend UI]
    API[Express API]
    Services[Business Services]
    DB[(PostgreSQL)]
    Mail[SMTP]
    Stream[SSE Stream]
    AI[Optional AI Provider]

    UserInput --> Frontend
    Frontend --> API
    API --> Services
    Services --> DB
    Services --> Mail
    Services --> Stream
    Services -.optional.-> AI
    DB --> Services
    Services --> API
    API --> Frontend
```

## Use Cases

| Use Case | Actor | Description | Precondition | Main Flow | Expected Result |
| --- | --- | --- | --- | --- | --- |
| Register student account | Student | Create a new student account. | User is not yet registered. | Fill registration form, submit, receive verification step. | Student account is created and awaits email verification. |
| Verify email | Student | Activate account for login. | Student has a valid verification token. | Open verification link. | `emailVerifiedAt` is set and login becomes allowed. |
| Log in | Any user | Enter the protected system. | Account is active and verified. | Submit email and password. | Auth cookies are set and dashboard loads. |
| Manage own profile | Any authenticated user | Update name, department, phone, and role-valid fields. | User is authenticated and active. | Open profile page and save changes. | Profile data is updated. |
| Create user account | Admin | Create admin, staff, or student accounts. | Admin is logged in. | Open user management, submit user form. | New user record is created. |
| Manage laboratory | Admin | Create or update a laboratory record. | Admin is logged in. | Open laboratory management, submit lab form. | Laboratory data and PC records are updated. |
| Assign staff to laboratory | Admin | Attach a staff member to a laboratory. | Admin is logged in; staff account is active. | Open staff assignment page and select staff. | `custodianId` is updated. |
| Publish schedule | Admin or laboratory staff | Create a schedule block for reservations. | Authorized user is logged in and has lab scope. | Submit schedule form. | Schedule is created if it does not overlap. |
| Submit reservation | Student | Request a whole lab or a PC reservation. | Student is logged in; schedule exists. | Choose schedule, time, purpose, and optional PC. | Reservation is saved as `PENDING`. |
| Review reservation | Admin or laboratory staff | Approve or reject a pending request. | Reviewer is logged in and has scope over the laboratory. | Open reservation details, add remarks, approve or reject. | Reservation becomes `APPROVED` or `REJECTED`. |
| Complete reservation | Admin or laboratory staff | Mark an approved reservation as finished. | Reservation status is `APPROVED`. | Click complete. | Reservation becomes `COMPLETED`. |
| Cancel pending reservation | Student | Cancel an unreviewed request. | Reservation belongs to student and is `PENDING`. | Open reservations page and confirm cancel. | Reservation becomes `CANCELLED`. |
| Manage calendar event | Admin | Add or edit a maintenance or holiday event. | Admin is logged in. | Open management calendar and submit form. | Calendar event is created or updated. |
| View notifications | Authenticated user | Review in-app notifications and unread count. | User is logged in. | Open notification center. | Notifications are listed and can be marked read. |
| Ask assistant | Authenticated user | Query grounded system information or prepare draft actions. | User is logged in. | Open assistant and send prompt. | Assistant returns an answer or draft action preview. |

## User Manual

This section covers shared usage patterns before the role-specific manuals.

### Public Access and Shared Entry Points

Available public routes in the frontend:

- `/`
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/verify-email`

### How to Log In

1. Open `/login`.
2. Enter the registered email and password.
3. Submit the form.
4. If the account is active and verified, the system redirects to:
   - `/student/dashboard` for students
   - `/dashboard` for admins and laboratory staff

Common login-related messages visible in code:

- `Please verify your email before logging in. Check your inbox.`
- `This account has been deactivated by the administrator.`
- `Invalid email or password.`

### How to Recover a Password

1. Open `/forgot-password`.
2. Enter the account email.
3. Submit the form.
4. Use the email link or preview link to open `/reset-password?token=...`.
5. Enter a new password and confirm it.

### Shared Features After Login

All authenticated users can:

- Open `/profile` to update profile details
- Change password from `/profile`
- Open `/assistant` to use the reservation assistant
- View the notification center in the top bar

## Admin Manual

### Admin Dashboard

Route:

- `/dashboard`

The admin dashboard shows:

- Total users
- Total laboratories
- Total reservations
- Pending, approved, and completed counts
- Seven-day reservation trend
- Recent activity logs

### Managing Users

Route:

- `/management/users`

How to use:

1. Open `User Management`.
2. Click `Add User`.
3. Fill in the form.
4. Select a role.
5. If the role is `STUDENT`, provide student number and year level.
6. Save the form.

Admin-specific actions:

- Create user
- Edit user
- Activate user
- Deactivate user

Important behavior:

- Updating role or status revokes active sessions.
- New admin-created accounts are stored with `emailVerifiedAt` already set.

### Managing Laboratories

Route:

- `/management/laboratories`

How to use:

1. Click `Add Laboratory`.
2. Provide laboratory name, room code, building, optional location, status, capacity, computer count, description, and optional image.
3. Save the form.

Important backend behavior:

- Duplicate room codes are blocked.
- `computerCount` changes can create or reconcile PC records automatically.
- Laboratories with reservation or calendar history cannot be deleted.

### Assigning Laboratory Staff

Route:

- `/management/laboratories/assign-staff`

How to use:

1. Filter by building or department if needed.
2. Search for a laboratory.
3. Use the assignment dropdown.
4. Select an active laboratory staff member or set the lab to `Unassigned`.

### Managing Schedules

Route:

- `/management/schedules`

How to use:

1. Filter by laboratory or date.
2. Click `Add Schedule`.
3. Select laboratory, date, time range, and schedule status.
4. Save the schedule.

Restrictions:

- Overlapping schedules are blocked.
- Schedules with reservation history cannot be changed in reservation-relevant fields.
- Schedules with reservation history cannot be deleted.

### Reviewing Reservations

Route:

- `/management/reservations`

How to use:

1. Filter by student, laboratory, date, or status.
2. Click `View` on a reservation row.
3. Review student, purpose, room, time, and current status.
4. Enter remarks if needed.
5. Click `Approve` or `Reject`.
6. For approved reservations, use `Mark Complete` when appropriate.

### Viewing Reports

Route:

- `/management/reports`

Features:

- Filter by status, laboratory, and date range
- View status chart and top-demand laboratory chart
- Export current filtered report to CSV

### Managing Calendar Events

Route:

- `/management/calendar`

How to use:

1. Filter by date or laboratory if needed.
2. Click `Add Calendar Event`.
3. Choose `MAINTENANCE` or `HOLIDAY`.
4. Provide title, optional laboratory, date, optional time range, and optional description.
5. Save the event.

Notes:

- The same page also displays non-editable derived schedule and reservation calendar items.

## Laboratory Staff Manual

### Staff Dashboard

Route:

- `/dashboard`

The staff dashboard shows:

- Reservation totals in scope
- Pending, approved, rejected, and completed counts
- Assigned laboratory count
- Seven-day reservation trend
- Recent activity

### Viewing Assigned Laboratory

Route:

- `/management/laboratories`

What staff can do:

- View assigned laboratory details
- View PC records
- Update PC status
- See read-only availability summaries for other laboratories

### Updating PC Status

Within `/management/laboratories`:

1. Locate the `PC Status` section.
2. Choose a status from the dropdown.
3. The system saves the change immediately.

Statuses:

- `AVAILABLE`
- `OCCUPIED`
- `MAINTENANCE`

### Managing Schedules

Route:

- `/management/schedules`

What staff can do:

- Create schedules for the assigned laboratory
- Edit schedules for the assigned laboratory
- Delete schedules when allowed
- View read-only public schedules from other laboratories

### Reviewing Reservations

Route:

- `/management/reservations`

What staff can do:

- View reservations for the assigned laboratory
- Approve or reject pending reservations
- Add remarks
- Mark approved reservations as completed
- Export the current reservation list to CSV

Restrictions:

- Staff cannot review reservations outside assigned scope.

### Viewing Reports

Route:

- `/management/reports`

Staff can:

- Review reservation summaries
- View charts
- Export filtered reservation data

## Student Manual

### Student Dashboard

Route:

- `/student/dashboard`

The student dashboard shows:

- Pending reservations
- Approved reservations
- Completed reservations
- Available laboratory count
- Recent reservation history
- Shortcut to the assistant

### Browsing Laboratories

Routes:

- `/student/laboratories`
- `/student/laboratories/:id`

How to use:

1. Open the laboratory list.
2. Search by laboratory name, room code, or building.
3. Open a laboratory card with `View Details`.
4. Review description, capacity, computer count, custodian, and visible schedules.

### Creating a Reservation

Route:

- `/student/laboratories/:id/reserve`

How to use:

1. Choose `Whole Laboratory` or `Specific PC`.
2. Select a schedule block.
3. Enter a reservation purpose.
4. Choose start and end time within the free windows shown.
5. If choosing `Specific PC`, select an available PC.
6. Submit the request.

What the page helps the student see:

- Published schedule window
- Occupied windows
- Remaining free booking windows
- Available PCs for the selected time

### Viewing and Cancelling Reservations

Route:

- `/student/reservations`

How to use:

1. Search reservations by code, purpose, laboratory, or remarks.
2. Filter by status.
3. Review the laboratory, reservation type, schedule, remarks, and reviewer.
4. If the reservation is still `PENDING`, click `Cancel Request`.

### Using the Assistant

Route:

- `/assistant`

Student assistant examples shown in the frontend:

- “Who am I?”
- “My reservations today.”
- “Available ba CL-302 bukas?”
- “Reserve a laboratory.”
- “Reservation rules.”

The backend enforces student-only scope for personal reservation data.

## Installation and Setup Guide

### Prerequisites

- Git
- Node.js `>=22 <23`
- npm
- PostgreSQL, or Docker Desktop if using `docker-compose.yml`

### Clone the Repository

```bash
git clone <repository-url>
cd "ComLab Reservation System"
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Files

Create local environment files from the examples:

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

If you are not on Windows, create equivalent `.env` files manually.

### Configure the Database

Option 1: Local PostgreSQL

- Set `DATABASE_URL` and `DIRECT_URL` in `backend/.env` to your PostgreSQL connection string.

Option 2: Docker Compose database

```bash
docker compose up -d postgres
```

Use the local compose database URL:

```env
postgresql://postgres:password@localhost:5432/comlab_reservation_system
```

Option 3: Supabase-style PostgreSQL deployment

- The example environment file shows pooled and direct connection string formats.
- Use real project-specific connection strings in `backend/.env`.

### Generate Prisma Client

```bash
npm run prisma:generate
```

### Run Migrations

Development migration:

```bash
npm run prisma:migrate:dev
```

Reset development database:

```bash
npm run prisma:migrate:reset
```

Production-style migration deploy:

```bash
npm run prisma:migrate:deploy
```

### Seed Demo Data

Optional:

```bash
npm run seed
```

The seed script is defined in `backend/prisma/seed.ts`.

### Start the Development Servers

Run both workspaces:

```bash
npm run dev
```

Run only backend:

```bash
npm run dev --workspace backend
```

Run only frontend:

```bash
npm run dev --workspace frontend
```

Expected local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000/api`
- Health check: `http://localhost:5000/api/health`

### Build the Project

```bash
npm run build
```

### Run Automated Tests

```bash
npm test
```

Workspace-specific test runs:

```bash
npm run test --workspace backend
npm run test --workspace frontend
```

### Run the Containerized Stack

```bash
docker compose up --build
```

Visible container targets in `docker-compose.yml`:

- `postgres`
- `backend`
- `frontend`

## Environment Variables

### Backend Variables

#### Core Application and Database

| Variable | Purpose | Required | Notes |
| --- | --- | --- | --- |
| `PORT` | Backend listening port | Yes | Defaults to `5000` in examples |
| `NODE_ENV` | Runtime mode | Yes | `development`, `test`, or `production` |
| `DATABASE_URL` | Runtime PostgreSQL connection string | Yes | Used by Prisma datasource |
| `DIRECT_URL` | Direct migration connection string | Yes | Falls back to `DATABASE_URL` if omitted |

#### Authentication and Cookies

| Variable | Purpose | Required | Notes |
| --- | --- | --- | --- |
| `JWT_SECRET` | Access token signing secret | Yes | Must be a real secure value in production |
| `JWT_EXPIRES_IN` | Access token lifetime | Yes | Example: `1d` |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | Yes | Separate from access secret |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime | Yes | Example: `7d` |
| `AUTH_COOKIE_NAME` | Access cookie name | Yes | Example: `comlab_access_token` |
| `AUTH_COOKIE_MAX_AGE_MS` | Access cookie lifetime in ms | Yes | Example: `86400000` |
| `REFRESH_COOKIE_NAME` | Refresh cookie name | Yes | Example: `comlab_refresh_token` |
| `REFRESH_COOKIE_MAX_AGE_MS` | Refresh cookie lifetime in ms | Yes | Example: `604800000` |
| `AUTH_COOKIE_SAME_SITE` | Cookie same-site mode | Conditional | Resolved automatically if omitted |

#### Frontend URL and CORS

| Variable | Purpose | Required | Notes |
| --- | --- | --- | --- |
| `CLIENT_URL` | Canonical client URL | Conditional | Used in CORS resolution |
| `FRONTEND_URL` | Frontend base URL | Conditional | Used in reset and verification links |
| `APP_BASE_URL` | App base URL fallback | Conditional | Used if `FRONTEND_URL` is absent |
| `CORS_ORIGINS` | Comma-separated allowed origins | Conditional | Validated as URL list |

#### Email Verification and Reset

| Variable | Purpose | Required | Notes |
| --- | --- | --- | --- |
| `RESET_TOKEN_TTL_MINUTES` | Reset token expiry | Yes | Default 30 |
| `EMAIL_VERIFICATION_TOKEN_TTL_HOURS` | Verification token expiry | Yes | Default 24 |
| `RESET_TOKEN_PREVIEW` | Expose preview links in non-production flows | Conditional | Defaults based on environment |

#### Optional Bootstrap and Workers

| Variable | Purpose | Required | Notes |
| --- | --- | --- | --- |
| `ENABLE_DEMO_BOOTSTRAP` | Creates demo accounts at startup | Conditional | Defaults to `false` |
| `ENABLE_BACKGROUND_WORKERS` | Enables reminder and notification background workers | Conditional | Defaults to `true` |
| `RESERVATION_REMINDER_LEAD_MINUTES` | Minutes before reservation when reminders trigger | Yes | Used by reminder service |
| `RESERVATION_REMINDER_INTERVAL_MS` | Reminder worker interval | Yes | Used by reminder service |

#### SMTP and Email Delivery

| Variable | Purpose | Required | Notes |
| --- | --- | --- | --- |
| `SMTP_HOST` | SMTP host | Conditional | Required for real email delivery |
| `SMTP_PORT` | SMTP port | Conditional | Required for real email delivery |
| `SMTP_SECURE` | SMTP TLS mode | Conditional | Boolean-like env value |
| `SMTP_USER` | SMTP username | Conditional | Optional if server allows unauthenticated sending |
| `SMTP_PASS` | SMTP password | Conditional | Optional if server allows unauthenticated sending |
| `SMTP_FROM` | Full sender value | Conditional | Alternative to separate sender fields |
| `SMTP_FROM_EMAIL` | Sender email | Conditional | Used if `SMTP_FROM` is absent |
| `SMTP_FROM_NAME` | Sender display name | Conditional | Used with `SMTP_FROM_EMAIL` |
| `SMTP_TLS_REJECT_UNAUTHORIZED` | SMTP TLS certificate validation | No | Keep `true` in production; `false` is only for local development with certificate interception |
| `NOTIFICATION_EMAIL_PREVIEW` | Preview emails instead of sending them | Conditional | Auto-enabled in development without full SMTP config |

For Brevo, use:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_brevo_smtp_login
SMTP_PASS=your_brevo_smtp_key
SMTP_FROM="ComPort <verified_sender@example.com>"
```

Use a Brevo SMTP key, not a Brevo API key, and make sure the sender email is verified in Brevo.

#### Assistant and External AI

| Variable | Purpose | Required | Notes |
| --- | --- | --- | --- |
| `AI_PROVIDER` | Assistant provider selector | Conditional | `groq`, `openrouter`, `openai`, or `custom` |
| `AI_API_KEY` | External AI API key | Conditional | Required for external AI calls |
| `AI_MODEL` | External AI model name | Conditional | Required for external AI calls |
| `AI_API_BASE_URL` | Base URL for custom or overridden provider | Conditional | Used for `custom` and optional overrides |
| `OPENROUTER_SITE_URL` | OpenRouter referer header value | Conditional | Used only for OpenRouter-style requests |
| `OPENROUTER_APP_NAME` | OpenRouter app title header | Conditional | Used only for OpenRouter-style requests |

#### Google Calendar Sync

| Variable | Purpose | Required | Notes |
| --- | --- | --- | --- |
| `GOOGLE_CALENDAR_ENABLED` | Feature flag for reservation calendar sync | Conditional | Defaults to `false`; set `true` only after Google setup is complete |
| `GOOGLE_CALENDAR_ID` | Target Google Calendar ID | Conditional | Required when calendar sync is enabled |
| `GOOGLE_CLIENT_EMAIL` | Google service-account email | Conditional | Required when calendar sync is enabled |
| `GOOGLE_PRIVATE_KEY` | Google service-account private key | Conditional | Required when calendar sync is enabled; keep backend-only |
| `GOOGLE_PROJECT_ID` | Google Cloud project ID | Conditional | Documented for deployment traceability |
| `GOOGLE_CALENDAR_TIME_ZONE` | Event timezone | Conditional | Defaults to `Asia/Manila` |

#### Rate Limiting

| Variable | Purpose | Required | Notes |
| --- | --- | --- | --- |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | Login limiter window | Yes | Default 60000 |
| `LOGIN_RATE_LIMIT_MAX` | Login limiter max requests | Yes | Default 5 |
| `REGISTER_RATE_LIMIT_WINDOW_MS` | Registration limiter window | Yes | Default 60000 |
| `REGISTER_RATE_LIMIT_MAX` | Registration limiter max requests | Yes | Default 5 |
| `FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS` | Forgot-password limiter window | Yes | Default 60000 |
| `FORGOT_PASSWORD_RATE_LIMIT_MAX` | Forgot-password limiter max requests | Yes | Default 5 |
| `RESET_PASSWORD_RATE_LIMIT_WINDOW_MS` | Reset-password limiter window | Yes | Default 60000 |
| `RESET_PASSWORD_RATE_LIMIT_MAX` | Reset-password limiter max requests | Yes | Default 5 |
| `VERIFY_EMAIL_RATE_LIMIT_WINDOW_MS` | Verify-email limiter window | Yes | Default 60000 |
| `VERIFY_EMAIL_RATE_LIMIT_MAX` | Verify-email limiter max requests | Yes | Default 10 |
| `RESEND_VERIFICATION_RATE_LIMIT_WINDOW_MS` | Resend-verification limiter window | Yes | Default 60000 |
| `RESEND_VERIFICATION_RATE_LIMIT_MAX` | Resend-verification limiter max requests | Yes | Default 5 |
| `AI_ASSISTANT_RATE_LIMIT_WINDOW_MS` | Assistant limiter window | Yes | Default 60000 |
| `AI_ASSISTANT_RATE_LIMIT_MAX` | Assistant limiter max requests | Yes | Default 12 |

### Frontend Variables

| Variable | Purpose | Required | Notes |
| --- | --- | --- | --- |
| `VITE_API_URL` | Base API URL used by Axios | Yes | Production builds require this explicitly |

## Project Structure

```text
ComLab Reservation System/
|-- backend/
|   |-- prisma/
|   |   |-- migrations/
|   |   |-- schema.prisma
|   |   `-- seed.ts
|   |-- src/
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- domain/
|   |   |-- middleware/
|   |   |-- notifications/
|   |   |-- routes/
|   |   |-- services/
|   |   |-- utils/
|   |   `-- validations/
|   |-- tests/
|   |-- .env.example
|   |-- Dockerfile
|   `-- Procfile
|-- frontend/
|   |-- public/
|   |-- src/
|   |   |-- api/
|   |   |-- assets/
|   |   |-- components/
|   |   |-- hooks/
|   |   |-- layouts/
|   |   |-- pages/
|   |   |-- store/
|   |   |-- test/
|   |   |-- types/
|   |   `-- utils/
|   |-- .env.example
|   |-- Dockerfile
|   |-- nginx.conf
|   `-- vercel.json
|-- docs/
|-- docker-compose.yml
|-- package.json
`-- README.md
```

### Folder Summary

| Folder | Purpose |
| --- | --- |
| `backend/src/config` | Environment parsing and Prisma setup |
| `backend/src/controllers` | HTTP request handlers |
| `backend/src/domain` | OOP domain models |
| `backend/src/middleware` | Authentication, role checks, lab access, validation, error handling, rate limiting |
| `backend/src/routes` | API route definitions |
| `backend/src/services` | Business logic |
| `backend/src/validations` | Zod request schemas |
| `backend/prisma` | Schema, migrations, seed data |
| `backend/tests` | Backend test suites |
| `frontend/src/api` | API clients and service wrappers |
| `frontend/src/components` | Reusable UI and layout components |
| `frontend/src/hooks` | Reusable React hooks |
| `frontend/src/layouts` | Route layouts |
| `frontend/src/pages` | Public, student, staff, and admin page components |
| `frontend/src/store` | Auth context state |
| `frontend/src/types` | Shared frontend API types |
| `frontend/src/utils` | Formatting, CSV, RBAC, validation, and scheduling helpers |
| `docs` | Supporting project documents included in the repository |

## Security Features

The repository explicitly shows the following security practices:

- Password hashing with `bcrypt`
- JWT access and refresh tokens
- `HttpOnly` auth cookies
- Database-backed refresh sessions in `AuthSession`
- Session revocation on logout, password reset, password change, role change, and status change
- Email verification before login
- Role-based authorization through `requireRole` and `authorizeRoles`
- Laboratory-scope authorization through `requireAssignedLabManager` and `StaffAccessService`
- CORS allowlist validation
- Origin checks for state-changing requests that rely on auth cookies
- Security headers through `helmet`
- Request rate limiting for login, registration, password reset, email verification, and assistant usage
- Input validation using Zod
- Centralized error handling that avoids leaking raw database errors
- Environment validation at startup

Security features not explicitly shown in the repository:

- Multi-factor authentication
- CAPTCHA or bot-detection services
- Full audit trail export tooling beyond existing activity log storage

## Validation and Error Handling

### Backend Validation

The backend uses Zod validation schemas in `backend/src/validations/` for:

- Auth forms
- User management
- Laboratory forms
- Schedule forms
- Reservation forms
- Calendar forms
- Assistant requests

Examples of validated rules:

- Strong password requirements
- Student number format
- Phone number format
- Required year level for student accounts
- Valid time format `HH:MM`
- End time later than start time
- Valid enum values for statuses and roles

### Frontend Validation

The frontend uses:

- `react-hook-form`
- `zodResolver`
- Utility helpers in `frontend/src/utils/userValidation.ts`

Examples:

- Sanitized names and phone inputs
- Formatted student number input
- Password rule feedback during registration
- Role-aware field validation in user management and profile forms

### Business-Rule Validation

The repository also enforces service-level rules beyond field validation:

- No duplicate email or student number
- No duplicate laboratory room code
- No reservation outside the selected schedule window
- No overlapping schedule blocks
- No overlapping reservation conflicts
- No deletion of laboratories with reservation or calendar history
- No deletion or mutation of schedules with reservation history
- No reservation on unavailable laboratory or unavailable PC

### Error Handling

The centralized error handler in `backend/src/middleware/errorHandler.ts` maps:

- `ApiError` to structured JSON errors
- `ZodError` to field-level validation errors
- Prisma unique constraint errors to conflict responses
- Prisma not-found errors to `404`
- Invalid JSON request bodies to `400`
- Blocked CORS origins to `403`
- Unknown failures to `500`

## Testing and Quality Assurance

### Automated Tests Present in the Repository

Automated tests are explicitly shown in the repository.

Backend examples:

- `backend/tests/AuthService.test.ts`
- `backend/tests/ReservationService.test.ts`
- `backend/tests/ReservationReminderService.test.ts`
- `backend/tests/ReservationAssistantService.test.ts`
- `backend/tests/AssistantDateRangeParser.test.ts`
- `backend/tests/UserValidation.test.ts`
- `backend/tests/EnvBoolean.test.ts`

Frontend examples:

- `frontend/src/pages/public/LandingPage.test.tsx`
- `frontend/src/pages/public/VerifyEmailPage.test.tsx`
- `frontend/src/pages/admin/UserManagementPage.test.tsx`
- `frontend/src/components/ui/StatusBadge.test.tsx`
- `frontend/src/hooks/useStartupSplash.test.tsx`
- `frontend/src/utils/userValidation.test.ts`

### What the Existing Tests Cover

Based on the test files, the repository includes coverage for:

- Registration and verification flows
- Auth service behaviors
- Reservation conflict and review logic
- Reservation reminder behavior
- Assistant date parsing and assistant service behavior
- Frontend page rendering and selected UI interactions
- Validation utilities

### Manual Testing Checklist

- Register a new student account.
- Verify the student email.
- Log in as student, staff, and admin.
- Test forgot-password and reset-password flow.
- Create a laboratory as admin.
- Assign a laboratory staff member to a laboratory.
- Create schedule blocks and test overlap prevention.
- Submit both laboratory-wide and PC-specific reservations.
- Approve, reject, complete, and cancel reservations under the correct role.
- Update PC statuses and confirm availability changes.
- Create and delete management calendar events.
- Open the notification center and confirm unread tracking.
- Export CSV files from reports and reservation management.
- Ask the assistant both read-only questions and draft-action prompts.

## Deployment Guide

### Visible Deployment Paths in the Repository

The repository explicitly includes:

- `docker-compose.yml` for local multi-service deployment
- `backend/Dockerfile` for backend containerization
- `frontend/Dockerfile` plus `frontend/nginx.conf` for frontend containerization
- `frontend/vercel.json` for SPA path rewrites
- `backend/Procfile` for process-based backend deployment

### Backend Build and Start

Visible backend commands:

```bash
npm run build --workspace backend
npm run start --workspace backend
```

The backend `start` script runs:

1. `prisma generate`
2. `prisma migrate deploy`
3. `node dist/src/server.js`

### Frontend Build

Visible frontend commands:

```bash
npm run build --workspace frontend
npm run preview --workspace frontend
```

### Container Deployment

Run the full stack:

```bash
docker compose up --build
```

### Production Considerations Visible in Code

- Production requires real `JWT_SECRET` and `JWT_REFRESH_SECRET`.
- Production requires explicit frontend URL configuration.
- Production cookies may need `AUTH_COOKIE_SAME_SITE=none`.
- Production email delivery requires SMTP settings.
- Production assistant rewriting requires AI provider settings.
- Optional Google Calendar sync requires backend-only service-account settings and can be safely disabled with `GOOGLE_CALENDAR_ENABLED=false`.
- Production frontend build requires `VITE_API_URL`.

### What Is Not Explicitly Shown

- A single mandated hosting provider for the backend is not explicitly shown in the repository.
- Full CI/CD deployment automation is not explicitly shown in the repository.
- Kubernetes, Terraform, or infrastructure-as-code definitions are not explicitly shown in the repository.

## System Limitations

- The role model is limited to `ADMIN`, `LABORATORY_STAFF`, and `STUDENT`.
- The assistant is authenticated and role-scoped, but long-term conversation persistence beyond browser session storage is not explicitly shown in the repository.
- Most list endpoints do not show server-side pagination.
- Notifications are limited to `EMAIL` and `IN_APP`.
- Laboratory images are stored as URLs or data URLs rather than through a dedicated media storage service.
- Public guest browsing of the frontend laboratory catalog is not explicitly shown in the repository.
- Multi-factor authentication is not explicitly shown in the repository.

## Future Enhancements

The following are recommendations only. They should not be treated as already implemented features.

- Add end-to-end browser tests and CI/CD pipelines.
- Add server-side pagination and more advanced filtering for large datasets.
- Add file storage or CDN-backed image uploads for laboratory media.
- Add multi-factor authentication or SSO integration.
- Add richer report exports and downloadable audit log reports.
- Add push notifications, SMS, or mobile app support.
- Add more granular permission levels beyond the current three-role model.
- Add stronger assistant audit visibility or longer-lived assistant history.

## Defense and Presentation Reviewer Guide

| Reviewer Question | Suggested Beginner-Friendly Answer |
| --- | --- |
| What is your system? | ComPort is a web-based computer laboratory reservation and management system for schools. |
| What problem does it solve? | It replaces manual or unstructured room scheduling and reservation handling with a role-based, validated workflow. |
| Who are the users? | The implemented users are administrators, laboratory staff, and students. |
| What are your APIs? | The backend exposes REST endpoints for auth, users, laboratories, schedules, reservations, staff operations, dashboard data, calendar events, notifications, and the assistant. |
| How does the database work? | PostgreSQL stores users, labs, PCs, schedules, reservations, sessions, notifications, logs, and token records, all managed through Prisma. |
| How did you use OOP? | We used domain classes, services, controllers, inheritance, and polymorphism to organize behavior cleanly. |
| How did you apply encapsulation? | We grouped data and logic together inside classes, such as user role behavior and reservation rules. |
| How did you apply abstraction? | We hid complex workflows inside service classes and kept controllers focused on HTTP input and output. |
| Did you use inheritance? | Yes. `Admin`, `Student`, and `LaboratoryStaff` inherit from the abstract `User` class. |
| Did you use polymorphism? | Yes. The system calls shared methods like `getDashboardScope()` and role-specific behavior changes depending on the subclass returned by `UserFactory`. |
| What are the main modules? | Auth, user management, laboratory management, staff assignment, schedule management, reservation management, dashboards, reports, notifications, calendar, profile, and assistant. |
| How does the system flow work? | Students create accounts and reservations, then staff or admins review them, while schedules, notifications, and dashboards update around that workflow. |
| What are the security features? | Password hashing, JWT cookies, database sessions, email verification, role-based authorization, scope checks, CORS validation, and rate limiting. |
| What are the limitations? | The repository shows only three fixed roles, no MFA, no dedicated media storage service, and no explicit server-side pagination on most list endpoints. |
| What can be improved in the future? | CI/CD, end-to-end testing, stronger auth, better exports, mobile support, and more granular permissions. |

## Glossary of Terms

| Term | Simple Meaning |
| --- | --- |
| API | A set of backend endpoints the frontend can call. |
| Frontend | The user-facing web interface. |
| Backend | The server-side application that processes requests and business rules. |
| Database | The persistent storage for users, laboratories, reservations, and other records. |
| Authentication | Confirming who the user is. |
| Authorization | Checking what the user is allowed to do. |
| ORM | A tool like Prisma that lets code work with database records more easily. |
| Endpoint | A specific API URL, such as `/api/auth/login`. |
| CRUD | Create, Read, Update, Delete. |
| Environment Variables | Runtime settings such as API URLs, secrets, and database connection strings. |
| Middleware | Logic that runs before the main route handler, such as auth or validation. |
| OOP | Object-Oriented Programming, a way of organizing code using classes and objects. |
| SSE | Server-Sent Events, a browser-friendly way to stream updates from server to client. |

## References

Repository files used as primary sources for this README:

- `package.json`
- `docker-compose.yml`
- `backend/package.json`
- `frontend/package.json`
- `backend/.env.example`
- `frontend/.env.example`
- `backend/prisma/schema.prisma`
- `backend/prisma/seed.ts`
- `backend/src/app.ts`
- `backend/src/server.ts`
- `backend/src/config/env.ts`
- `backend/src/routes/*.ts`
- `backend/src/controllers/*.ts`
- `backend/src/services/*.ts`
- `backend/src/domain/*.ts`
- `backend/src/middleware/*.ts`
- `backend/tests/*.test.ts`
- `frontend/src/App.tsx`
- `frontend/src/api/client.ts`
- `frontend/src/api/services.ts`
- `frontend/src/store/AuthContext.tsx`
- `frontend/src/pages/**/*.tsx`
- `frontend/src/components/**/*.tsx`
- `frontend/src/hooks/useNotifications.ts`
- `frontend/src/types/api.ts`
- `frontend/src/utils/*.ts`
- `frontend/src/**/*.test.tsx`
- `frontend/src/**/*.test.ts`
