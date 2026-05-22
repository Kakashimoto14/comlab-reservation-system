---
name: comport-role-access-guard
description: Use this skill when changing ComPort role-based routes, permissions, dashboards, navigation, API authorization, frontend guards, or access control for Admin, Laboratory Staff, and Student users.
---

# ComPort Role Access Guard Skill

## Purpose

Use this skill to protect role-based access in the ComPort / ComLab Reservation System.

Any change involving navigation, dashboards, routes, APIs, assistant actions, or protected pages must preserve correct access control for Admin, Laboratory Staff, and Student users.

## Core Rules

1. Always inspect the current role system before editing.
2. Do not assume roles, permissions, or routes.
3. Do not expose Admin or Laboratory Staff actions to Students.
4. Do not rely only on frontend hiding.
5. Backend authorization must validate protected actions.
6. Do not remove existing role protections.
7. Do not break existing dashboards or navigation.
8. Keep role navigation clear and consistent.

## Student Allowed Features

Students may:
- view student dashboard
- reserve laboratories
- view available schedules
- view their own reservations
- check reservation status
- open ComPort Assistant
- manage their own profile
- receive notifications

Students must not:
- manage users
- manage laboratories
- create schedules
- bulk-create schedules
- approve reservations
- reject reservations
- access admin reports
- access staff-only workflows
- execute system-wide assistant actions

## Laboratory Staff Allowed Features

Laboratory Staff may:
- view assigned or relevant reservations
- approve or reject reservation requests if supported
- check schedules
- monitor laboratory usage
- receive notifications
- use assistant workflows allowed by existing system logic

Laboratory Staff must not receive unrestricted Admin privileges unless the existing system explicitly allows it.

## Admin Allowed Features

Admins may:
- manage users
- manage laboratories
- manage schedules
- manage reservations
- access reports
- access admin summaries
- use admin assistant workflows
- perform safe system-management actions

## Required Checks

When changing role-related code:
- Check frontend routes.
- Check sidebar/navigation items.
- Check backend middleware.
- Check API service authorization.
- Check assistant role validation.
- Check direct URL access.
- Check mobile navigation.
- Check that students cannot access admin/staff pages.

## Preferred Student Sidebar

Student navigation should include:
1. Dashboard
2. Reserve Laboratory
3. My Reservations
4. ComPort Assistant
5. Profile

Do not remove student access to ComPort Assistant.

## Before Finishing

Before completing role-related work:
1. Test student navigation.
2. Test admin navigation.
3. Test laboratory staff navigation if available.
4. Test at least one restricted student action.
5. Run build/typecheck if available.
6. Confirm no merge conflict markers remain.
7. Summarize changed files and verification steps.
