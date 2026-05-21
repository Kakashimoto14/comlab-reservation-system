---
name: comport-ai-assistant-workflow
description: Use this skill when working on ComPort GPT assistant features, especially role-aware AI commands, multi-turn workflows, pending action drafts, schedule creation, approval workflows, and grounded system answers.
---

# ComPort AI Assistant Workflow Skill

You are working on the ComPort / ComLab Reservation System.

## Main goal

Improve ComPort GPT so it behaves like a reliable role-aware system assistant, not a generic chatbot.

## Required principles

1. Always inspect the existing repository before changing code.
2. Do not hallucinate routes, models, services, tables, or features.
3. Preserve existing assistant features unless the task explicitly asks to change them.
4. Keep AI actions role-safe.
5. Never let students access admin or laboratory staff actions.
6. For system-changing actions, always use draft → review → confirm → execute.
7. Do not execute destructive or bulk actions immediately after one message.
8. Support English, Tagalog, and Taglish where practical.
9. Keep responses beginner-friendly and clear.

## Role rules

### Admin

Allowed assistant actions may include:
- system summaries
- user, reservation, laboratory, and schedule summaries
- schedule draft creation
- bulk schedule draft creation
- approval workflow assistance
- safe system-management drafts

### Laboratory Staff

Allowed assistant actions may include:
- view assigned or pending reservations
- approve or reject reservation drafts if supported
- schedule-related assistance if the existing system allows it

### Student

Allowed assistant actions may include:
- ask how to reserve
- view own reservations
- check available schedules
- understand reservation status
- receive reservation guidance

Students must not be allowed to:
- create schedules
- bulk-create schedules
- approve all reservations
- manage users
- manage laboratories
- access admin summaries

## Multi-turn workflow rule

Before treating a user message as a new request, check if there is an active pending assistant action for that user/session.

If a pending action exists:
1. Try to fill missing fields from the new message.
2. Merge the new information into the pending action.
3. If the action is still incomplete, ask only for the next missing field.
4. If complete, generate a safe draft.
5. Ask for confirmation before execution.

Never respond with a generic system summary when the user reply clearly fills a missing field.

## Bulk schedule workflow

Intent:

CREATE_BULK_SCHEDULE

Required fields:
- laboratories
- date range
- start time
- end time

Accepted laboratory values:
- all active labs
- all labs
- every lab
- lahat ng lab
- lahat ng active labs
- specific laboratory codes such as CL-301 or CL-302

Accepted date inputs:
- next week
- this week
- May 26-29
- May 26 to May 29
- May 26 until May 29

Accepted time inputs:
- 8-5
- 8am to 5pm
- 8:00 AM - 5:00 PM
- start time is 8am, end time is 4pm

Validation:
- End time must be after start time.
- Date range must be valid.
- Laboratories must exist and be active.
- Check existing schedules for overlap.
- Warn or block conflicts based on existing business logic.
- Require confirmation before actual creation.

## Required checks before finishing

Before completing any assistant-related task:
1. Run the relevant typecheck, build, or test commands available in the repo.
2. Manually test at least one admin assistant command.
3. Manually test one student denial case for restricted actions.
4. Confirm existing assistant features still work.
5. Summarize changed files and test results.