---
name: comport-notification-ui-guardian
description: Use this skill when changing ComPort notification UI, bell popover, unread badge, notification drawer, notification list, responsive notification layout, or topbar notification behavior.
---

# ComPort Notification UI Guardian Skill

## Purpose

Use this skill to prevent notification UI regressions across desktop and mobile.

The notification component appears across important pages, so changes must preserve layout, usability, and functionality.

## Core Rules

1. Do not break the bell notification trigger.
2. Preserve unread badge behavior.
3. Preserve mark all read behavior.
4. Preserve close button behavior.
5. Preserve notification scrolling.
6. Preserve read/unread state behavior.
7. Do not let the panel overflow off-screen.
8. Do not allow mobile layouts to be cut off.
9. Do not use hardcoded widths that break responsive layouts.
10. Do not break topbar layout.

## Desktop Behavior

On desktop:
- Notification panel should open near the bell icon.
- Panel should be visually aligned and professional.
- Width should be comfortable and readable.
- Cards should have good spacing.
- Internal scrolling should work.
- Panel should not cover important controls unnecessarily.
- Z-index should be high enough to appear above page content.

## Mobile Behavior

On mobile:
- Notification UI must stay fully inside the viewport.
- It should not overflow left or right.
- It should behave as a responsive popover, modal, drawer, or sheet.
- It must be easy to close.
- Notification cards must remain readable.
- Internal scrolling must work.
- The page behind it should not create confusing horizontal scroll.

## Common Issues To Check

Check for:
- incorrect fixed positioning
- incorrect absolute positioning
- missing max-width
- missing max-height
- broken overflow behavior
- wrong transform translate values
- low z-index
- viewport width overflow
- popover clipped by parent container
- mobile layout using desktop width

## Preservation Requirements

Do not remove:
- notification data fetching
- unread count
- mark all read
- notification card content
- timestamps
- close action
- read/unread indicator

## Before Finishing

Test:
1. Desktop dashboard notification popover.
2. Desktop Reserve Laboratory notification popover.
3. Mobile dashboard notification popover.
4. Mobile Reserve Laboratory notification popover.
5. Mark all read.
6. Close action.
7. Unread badge.
8. Internal scrolling.
9. No horizontal overflow.
10. No merge conflict markers.
