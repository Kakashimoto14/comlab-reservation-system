# Web-Based Computer Laboratory Reservation System

A polished full-stack BSIT college project for reserving computer laboratory rooms. The system supports student registration, JWT authentication, role-based dashboards, laboratory and schedule management, reservation approval workflows, reporting, seed data, and automated tests.

## Project Overview

This project is designed to be:

- realistic enough for a college panel demonstration
- small enough to finish and defend within one month
- cleanly structured with Object-Oriented Programming on the backend
- polished in both backend architecture and frontend presentation

## Tech Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express + TypeScript
- Database: MySQL
- ORM: Prisma
- Authentication: JWT + bcrypt
- Validation: Zod
- Data Fetching: React Query
- Charts: Chart.js via `react-chartjs-2`
- Testing: Vitest + Testing Library
- Optional Deployment Support: Docker + Docker Compose

## Main Features

- Student registration and secure login
- JWT-based authentication and role-based route protection
- Admin user management with activation and deactivation controls
- Laboratory CRUD management
- Schedule management with overlap prevention
- Student laboratory browsing and reservation requests
- Reservation approval, rejection, cancellation, and completion workflow
- Admin/staff dashboards with trend reporting and recent activity
- Responsive layout with sidebar navigation, badges, cards, tables, forms, and modals
- Seed/demo data for immediate presentation

## Proposed Folder Structure

```text
ComLab Reservation System/
├── backend/
│   ├── prisma/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── domain/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── validations/
│   └── tests/
├── frontend/
│   └── src/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       ├── layouts/
│       ├── pages/
│       ├── store/
│       ├── types/
│       └── utils/
├── docs/
├── docker-compose.yml
└── README.md
```

## Installation Steps

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

Update `backend/.env` as needed:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL="mysql://root:password@localhost:3306/comlab_reservation_system"
JWT_SECRET=super-secret-jwt-key
JWT_EXPIRES_IN=1d
CLIENT_URL=http://localhost:5173
```

Update `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Prepare the database

Make sure MySQL is running and the target database exists:

```sql
CREATE DATABASE comlab_reservation_system;
```

Then run:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

## Running the Application

### Start both frontend and backend

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

## Production Build

```bash
npm run build
```

## Automated Tests

```bash
npm test
```

Individual workspaces:

```bash
npm run test --workspace backend
npm run test --workspace frontend
```

## Demo Accounts

After seeding:

- Admin
  - Email: `admin@comlab.edu`
  - Password: `Password123!`
- Laboratory Staff
  - Email: `staff@comlab.edu`
  - Password: `Password123!`
- Students
  - Example: `alyssa.cruz@student.edu`
  - Password: `Password123!`

## API Modules

- Auth
- Users
- Laboratories
- Schedules
- Reservations
- Dashboard

Detailed endpoint notes are available in [docs/API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md).

## ERD

The database ERD is documented in [docs/ERD.md](./docs/ERD.md).

## OOP Explanation

The backend intentionally demonstrates the 4 pillars of OOP:

### 1. Encapsulation

- Domain classes such as `User`, `Laboratory`, `Schedule`, and `Reservation` wrap state and expose behavior through methods instead of exposing raw logic everywhere.
- Example: `User` stores email in private state and exposes controlled getters and permission methods.

### 2. Inheritance

- `Student`, `Admin`, and `LaboratoryStaff` extend the base `User` class.
- Shared user behavior lives in `User`, while role-specific permissions are overridden in subclasses.

### 3. Polymorphism

- `UserFactory` returns the correct subclass based on role.
- Methods like `canCreateReservation()`, `canReviewReservations()`, and `getDashboardScope()` behave differently depending on whether the current user is a student, admin, or laboratory staff member.

### 4. Abstraction

- Core business rules are abstracted into service classes such as:
  - `AuthService`
  - `ReservationService`
  - `LaboratoryService`
  - `ScheduleService`
  - `DashboardService`
- Controllers remain thin and mainly delegate to service methods.
- Reservation conflict checking and schedule validation are hidden behind the service layer.

## Reservation Rules Implemented

- End time must be later than start time
- Reservation must fall inside an available schedule
- Overlapping schedules are blocked
- Double booking is blocked
- Only pending reservations may be cancelled by students
- Only pending reservations may be approved or rejected
- Only approved reservations may be completed

## Seed Data Included

- 1 admin
- 1 laboratory staff account
- 5 student accounts
- 3 laboratories
- multiple schedules
- multiple reservations with different statuses

## Optional Docker Setup

If you prefer Docker:

```bash
docker-compose up --build
```

Services:

- Frontend: `http://localhost:4173`
- Backend: `http://localhost:5000/api`
- MySQL: `localhost:3306`

## Notes on Scope

- Image upload is implemented as a clean image URL field to keep the one-month student scope realistic.
- The project prioritizes working reservation flows, clean architecture, and defense-ready UX over enterprise-scale complexity.

## Future Improvements

- Full file upload for laboratory images
- PDF export for reports
- Email notifications for approval updates
- Calendar-style schedule board
- Rich audit trail filtering
- Password reset workflow
