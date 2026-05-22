---
name: comport-ai-assistant-workflow
description: Use this skill when working on ComPort GPT assistant features, including role-aware commands, multi-turn workflows, pending action drafts, bulk schedule creation, approval workflows, grounded answers, and English/Tagalog/Taglish assistant behavior.
---

# ComPort AI Assistant Workflow Skill

## Purpose

Use this skill when improving or fixing ComPort GPT, the AI assistant of the ComPort / ComLab Reservation System.

The assistant must behave like a reliable system assistant, not a generic chatbot. It must understand the user role, continue multi-turn commands, use grounded system data, and safely prepare drafts before executing sensitive actions.

## Core Rules

1. Always inspect the existing repository before changing code.
2. Do not hallucinate routes, models, services, database tables, API endpoints, or features.
3. Preserve existing assistant features unless the task explicitly asks to change them.
4. Keep all assistant actions role-safe.
5. Students must never access admin or laboratory staff actions.
6. For system-changing actions, always use: draft → review → confirm → execute.
7. Never execute destructive, bulk, or system-changing actions immediately.
8. Support English, Tagalog, and Taglish where practical.
9. Keep assistant responses clear, beginner-friendly, and professional.
10. Do not break existing assistant UI or chat history behavior.

## Role Rules

### Admin

Admin assistant actions may include:
- system summaries
- reservation summaries
- laboratory summaries
- schedule summaries
- pending approval summaries
- schedule draft creation
- bulk schedule draft creation
- safe approval workflow assistance
- safe system-management drafts

### Laboratory Staff

Laboratory Staff assistant actions may include:
- view relevant pending reservations
- review reservation requests
- approve or reject reservation drafts if supported by existing system logic
- check schedules and laboratory availability
- receive reservation and schedule guidance

### Student

Student assistant actions may include:
- ask how to reserve
- view own reservations
- check available schedules
- understand reservation status
- ask reservation rules
- receive beginner-friendly help

Students must not be allowed to:
- create schedules
- bulk-create schedules
- approve reservations
- reject reservations
- manage users
- manage laboratories
- access admin-only reports
- access staff-only workflows

## Multi-Turn Workflow Rule

Before treating any user message as a new request, check if there is an active pending assistant action for that user or session.

If a pending action exists:

1. Parse the latest user message as a possible continuation.
2. Fill missing fields from the latest reply.
3. Merge new information into the existing pending action.
4. If the action is still incomplete, ask only for the next missing field.
5. If the action is complete, create a safe draft.
6. Ask for confirmation before execution.

Never respond with a generic system summary when the user reply clearly fills a missing field.

## Bulk Schedule Workflow

Intent name:

CREATE_BULK_SCHEDULE

Required fields:
- laboratories
- date range
- start time
- end time

Accepted laboratory inputs:
- all active labs
- all labs
- every lab
- lahat ng lab
- lahat ng active labs
- specific laboratory codes such as CL-301, CL-302, CL-303

Accepted date inputs:
- next week
- this week
- May 26-29
- May 26 to May 29
- May 26 until May 29
- specific dates
- Tagalog or Taglish equivalents when practical

Accepted time inputs:
- 8-5
- 8am to 5pm
- 8:00 AM - 5:00 PM
- start time is 8am, end time is 4pm

## Required Validation

Before creating a schedule draft:
- End time must be after start time.
- Date range must be valid.
- Laboratories must exist.
- Laboratories must be active.
- Existing schedules must be checked for overlap.
- Role permission must be verified.
- Bulk creation must require confirmation.

## Correct Behavior Example

User:

Create bulk schedule next week 8-5.

Assistant:

Ask only for the missing laboratory field.

User:

all active labs

Assistant:

Continue the pending CREATE_BULK_SCHEDULE action. Fill laboratories as ALL_ACTIVE_LABS. Prepare a draft. Do not give a generic system summary.

The draft must include:
- laboratories included
- dates included
- start time
- end time
- total schedule blocks
- conflict warnings
- confirmation options

## Confirmation Options

Use clear confirmation options such as:
- Confirm Create Schedule
- Cancel
- Edit Draft

## Before Finishing

Before completing any assistant-related task:
1. Run the relevant build, typecheck, lint, or test commands available in the repo.
2. Test at least one admin assistant command.
3. Test one student restricted-action denial.
4. Confirm existing assistant features still work.
5. Confirm no merge conflict markers remain.
6. Summarize changed files and test results.
