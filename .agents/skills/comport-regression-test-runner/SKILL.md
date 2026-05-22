---
name: comport-regression-test-runner
description: Use this skill after any major ComPort change to verify frontend, backend, assistant behavior, notification UI, role navigation, builds, tests, and merge conflict safety before committing or pushing.
---

# ComPort Regression Test Runner Skill

## Purpose

Use this skill before committing, merging, or pushing changes to ComPort.

This skill prevents regressions like broken builds, missing navigation items, broken notification popovers, assistant failures, and committed merge conflict markers.

## Required Git Checks

Run:

git status

Check for merge conflict markers with a grep pattern that searches for the three merge-marker tokens while excluding `node_modules`.

If conflict markers are found in source files, fix them before continuing.

## Frontend Checks

Run available frontend commands such as:
- npm run build
- npm run lint
- npm run typecheck
- npm run dev for manual testing

Check:
- Login page loads.
- Student dashboard loads.
- Reserve Laboratory page loads.
- My Reservations page loads.
- ComPort Assistant route loads.
- Sidebar navigation works.
- Topbar works.
- Notification bell works.
- Mobile layout does not overflow.

## Backend Checks

Run available backend commands such as:
- npm run build
- npm run test
- npm run lint
- npm run typecheck
- npm run dev

Check:
- Backend starts successfully.
- Health endpoint works.
- Login works.
- Dashboard API works.
- Notifications API works.
- Assistant endpoint works if assistant code changed.
- Prisma generate runs if schema changed.

## Role Checks

Verify:
- Student cannot access admin-only pages.
- Student cannot create or bulk-create schedules.
- Admin can access admin features.
- Laboratory Staff access remains correct.
- Assistant respects user role.

## Notification Checks

Verify:
- Bell icon opens notification panel.
- Unread badge appears correctly.
- Mark all read works.
- Close button works.
- Desktop popover is aligned.
- Mobile popover/sheet stays inside viewport.
- Notification panel does not break other pages.

## Assistant Checks

If assistant code changed, test:
- Admin bulk schedule command.
- Multi-turn pending action continuation.
- Student restricted-action denial.
- General system summary still works.
- Student help questions still work.

## Before Finishing

Summarize:
- Commands run
- Files changed
- Manual tests performed
- Passed checks
- Failed checks, if any
- Remaining risks, if any
