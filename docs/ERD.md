# Entity Relationship Diagram

```mermaid
erDiagram
  USER {
    int id PK
    string firstName
    string lastName
    string email UK
    string passwordHash
    enum role
    enum status
    string studentNumber UK
    string department
    int yearLevel
    string phone
    datetime createdAt
    datetime updatedAt
  }

  LABORATORY {
    int id PK
    string name
    string roomCode UK
    string building
    int capacity
    int computerCount
    string description
    enum status
    string imageUrl
    datetime createdAt
    datetime updatedAt
  }

  SCHEDULE {
    int id PK
    int laboratoryId FK
    datetime date
    string startTime
    string endTime
    enum status
    int createdById FK
    datetime createdAt
    datetime updatedAt
  }

  RESERVATION {
    int id PK
    string reservationCode UK
    int studentId FK
    int laboratoryId FK
    int scheduleId FK
    string purpose
    datetime reservationDate
    string startTime
    string endTime
    enum status
    string remarks
    int reviewedById FK
    datetime reviewedAt
    datetime cancelledAt
    datetime createdAt
    datetime updatedAt
  }

  ACTIVITY_LOG {
    int id PK
    int userId FK
    string action
    string entityType
    int entityId
    string description
    datetime createdAt
  }

  USER ||--o{ RESERVATION : "student submits"
  USER ||--o{ RESERVATION : "reviewer processes"
  USER ||--o{ SCHEDULE : "creates"
  USER ||--o{ ACTIVITY_LOG : "produces"
  LABORATORY ||--o{ SCHEDULE : "contains"
  LABORATORY ||--o{ RESERVATION : "hosts"
  SCHEDULE ||--o{ RESERVATION : "supports"
```

## Notes

- `users` stores all account roles: Admin, Student, and Laboratory Staff.
- `laboratories` is separated from `schedules` so room information stays reusable.
- `reservations` references both the student and the reviewed-by user for a full approval audit trail.
- `activity_logs` supports recent activity cards in the admin and staff dashboards.
