---
name: comport-prisma-api-validator
description: Use this skill when editing ComPort backend APIs, Prisma schema, migrations, reservation logic, schedule logic, laboratory logic, notification logic, authentication, or Supabase/PostgreSQL integration.
---

# ComPort Prisma API Validator Skill

## Purpose

Use this skill for backend, Prisma, database, and API work in ComPort.

The goal is to make backend changes safely without breaking reservation rules, schedule rules, role permissions, or production database assumptions.

## Core Rules

1. Inspect the existing Prisma schema before editing.
2. Inspect existing services/controllers/routes before adding new logic.
3. Do not hallucinate models, fields, routes, services, or tables.
4. Preserve production data assumptions.
5. Avoid unsafe migrations.
6. Validate input on backend.
7. Validate role permissions on backend.
8. Keep frontend and backend contracts consistent.
9. Run Prisma generate when schema changes.
10. Do not bypass existing business rules.

## Reservation Logic Checks

Check:
- reservation ownership
- reservation status transitions
- pending/approved/cancelled/completed behavior
- schedule availability
- student profile requirements
- overlap prevention
- notification side effects
- email side effects if present

## Schedule Logic Checks

Check:
- start time and end time validity
- end time after start time
- valid dates
- active laboratory requirement
- overlap prevention
- bulk schedule creation safety
- confirmation requirement for assistant-created drafts

## Laboratory Logic Checks

Check:
- laboratory existence
- active/inactive state
- capacity fields
- room code uniqueness
- role restrictions

## API Security Checks

Check:
- authenticated user required
- correct role required
- student can only access own data
- admin/staff endpoints are protected
- assistant actions validate role server-side

## Prisma/Migration Rules

When editing Prisma:
- Run prisma format if available.
- Run prisma generate.
- Avoid destructive migrations unless explicitly required.
- Do not reset production database.
- Use safe migration naming.
- Mention migration risks clearly.

## Before Finishing

Run available commands:
- npm run build
- npm run test
- npm run typecheck
- npx prisma generate
- npx prisma validate

Then summarize:
- files changed
- API behavior changed
- validation added
- migration impact
- tests run
- remaining risks
