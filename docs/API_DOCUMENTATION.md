# API Documentation

Base URL: `http://localhost:5000/api`

## Authentication

### `POST /auth/register`
- Registers a new student account.
- Public endpoint.

Request body:

```json
{
  "firstName": "Alyssa",
  "lastName": "Cruz",
  "email": "alyssa@student.edu",
  "password": "Password123!",
  "studentNumber": "2024-0001",
  "department": "BS Information Technology",
  "yearLevel": 2,
  "phone": "09171234567"
}
```

### `POST /auth/login`
- Logs in any active user role and returns a JWT.
- Rate limited to reduce brute-force attempts.

### `POST /auth/forgot-password`
- Prepares a password reset token for an active account.
- Returns a generic success message even if the email does not exist.
- Can optionally return a preview reset link when `RESET_TOKEN_PREVIEW=true`.

Request body:

```json
{
  "email": "admin@comlab.edu"
}
```

### `POST /auth/reset-password`
- Validates a reset token and stores the new password.

Request body:

```json
{
  "token": "raw-reset-token",
  "password": "NewPassword123!"
}
```

### `POST /auth/change-password`
- Changes the password for the authenticated account.
- Requires `Authorization: Bearer <token>`.

Request body:

```json
{
  "currentPassword": "Password123!",
  "newPassword": "NewPassword123!"
}
```

### `GET /auth/me`
- Returns the authenticated user profile.
- Requires `Authorization: Bearer <token>`.

### `POST /auth/logout`
- Stateless logout endpoint for UI confirmation.

## Users

### `GET /users`
- Lists all users.
- Admin only.

### `POST /users`
- Creates admin, staff, or student accounts.
- Admin only.

### `PUT /users/:id`
- Updates user details.
- Admin only.

### `PATCH /users/:id/status`
- Activates or deactivates a user.
- Admin only.

Request body:

```json
{
  "status": "DEACTIVATED"
}
```

### `PUT /users/profile`
- Updates the current user's profile details.
- Any authenticated role.

## Laboratories

### `GET /laboratories`
- Public browsing endpoint.
- Returns all available laboratories for guests/students.
- Returns all laboratories for authenticated admin/staff.

### `GET /laboratories/:id`
- Returns a laboratory, its schedules, and active reservation occupancy so the frontend can render availability views.

### `POST /laboratories`
- Creates a laboratory.
- Admin only.

### `PUT /laboratories/:id`
- Updates a laboratory.
- Admin only.

### `DELETE /laboratories/:id`
- Deletes a laboratory with no reservation history.
- Admin only.

## Schedules

### `GET /schedules`
- Lists schedules.
- Supports optional query parameters:
  - `laboratoryId`
  - `date`

Example:

`GET /schedules?laboratoryId=1&date=2026-05-20`

### `POST /schedules`
- Creates a schedule and prevents overlaps.
- Admin or Laboratory Staff.

### `PUT /schedules/:id`
- Updates a schedule and rechecks overlap rules.
- Admin or Laboratory Staff.

### `DELETE /schedules/:id`
- Deletes a schedule if there is no reservation history.
- Admin or Laboratory Staff.

## Reservations

### `GET /reservations`
- Students receive only their own reservations.
- Admin and Laboratory Staff receive all reservations.

### `POST /reservations`
- Creates a reservation request.
- Student only.
- Prevents:
  - invalid time ranges
  - booking outside the available schedule
  - overlapping reservations

Request body:

```json
{
  "scheduleId": 12,
  "laboratoryId": 1,
  "purpose": "Database laboratory activity for BSIT 2A students.",
  "startTime": "09:00",
  "endTime": "10:30"
}
```

### `PATCH /reservations/:id/cancel`
- Cancels a pending reservation.
- Student owner only.

### `PATCH /reservations/:id/review`
- Approves or rejects a pending reservation.
- Admin or Laboratory Staff.

Request body:

```json
{
  "status": "APPROVED",
  "remarks": "Approved for scheduled laboratory use."
}
```

### `PATCH /reservations/:id/complete`
- Marks an approved reservation as completed.
- Admin or Laboratory Staff.

## Dashboard

### `GET /dashboard`
- Returns role-aware dashboard data.
- Student:
  - personal reservation counts
  - recent reservations
- Admin:
  - total users
  - total laboratories
  - total reservations
  - reservation status counts
  - recent activity
  - reservation trend data
- Laboratory Staff:
  - operational reservation counts
  - recent activity
  - reservation trend data

## Health

### `GET /health`
- Returns API availability metadata for deployment monitoring.

Example response:

```json
{
  "status": "ok",
  "message": "ComLab Reservation System API is running.",
  "timestamp": "2026-04-18T10:30:00.000Z",
  "uptimeSeconds": 1234
}
```

## Common Error Format

```json
{
  "message": "Validation failed."
}
```

Validation errors may also include an `errors` object from Zod.
Rate-limited endpoints return HTTP `429` with a human-readable retry message.
