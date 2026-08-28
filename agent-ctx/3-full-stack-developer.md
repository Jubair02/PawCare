# Task 3 — Client Foundation + Shell (full-stack-developer)

## Status: DONE (lint clean, tsc clean for owned files)

## Work record
See `/home/z/my-project/worklog.md` → "Task ID: 3" entry for full detail.

## Key handoff notes for later agents (Tasks 4-6)
- Import DTOs from `@/lib/types`, fetch via `apiFetch<T>` from `@/lib/api` (auth header handled), nav state via `useAppStore` granular selectors, nav items via `NAV_ITEMS[role]` from `@/lib/constants`.
- Shared components available: `StatusBadge`, `StatCard` (tones: default|amber|rose|violet|teal), `EmptyState`, `SectionHeader`, `ProfileView`, `NotificationsView` (+ `NotificationsMiniList`).
- Formatters: `formatBDT`, `formatDate`, `formatDateShort`, `formatTime`, `timeAgo`, `petEmoji`, `initials`, `dateRelation`.
- View switching: `setView("<view>")`; role guard in AppShell auto-redirects foreign-prefix views. Profile updates should call `useAppStore.setState({ user })` after PATCH /api/auth/profile.
- Admin has no profile view — AppShell shows ProfileView in a Dialog; admin bell uses the popover.
- Store hydration is gated in AppShell (splash) — no SSR mismatch; do NOT render store-dependent UI outside AppShell gate pattern.
