# Journaling experience review, 2026-11-02

## Evidence and critique

Reviewed Daily, Journal, Board, Setup and Workspace source, plus desktop (1366px) and phone (390px) screenshots of the local demo. An independent read-only agent reached the same product findings. This is an expert review, not measured user research.

1. **High: writing is buried.** Today opens Plan and Check-in; Journal is fourth, below a long task list. On a phone the core activity is several scrolls away. Lead with a direct writing action.
2. **High: success is all-or-nothing.** A five-step routine streak can be zero for someone who writes every day. Recognize writing separately and retain the truthful routine metric.
3. **High: the blank page offers no help.** A broad question and several empty fields require effort before a tired user can start. Offer optional specific prompts that never overwrite or manufacture entries.
4. **Medium: the tone feels like work.** “Waiting on you” and “for this day to count” foreground obligation. Use gentler copy and acknowledge small contributions without declaring cloud saves prematurely.
5. **Medium: the day map is hard to touch.** Phone day buttons are roughly 22px and mostly unlabelled. Give them readable labels and larger targets while retaining navigation to all days.
6. **Bug: setup end date is wrong after start-date edits.** Derive the preview from the selected date.
7. **Bug: Plan tomorrow from history targets actual tomorrow.** The action should plan the day after the date being viewed.

## Correction scope

Implement the daily writing loop first: writing invitation, seven-day participation, optional reflection prompts, expressive mood controls, supportive copy, accessible challenge map, and the two date fixes. Keep the existing journal data shape, routine scoring, sync, trade and career logic. No new dependencies.

The full challenge map is initially collapsed to keep writing in view; a native details disclosure makes every day available. The seven-day writing row is immediately navigable.

## Validation

Exercise prompts without changing existing text, typing/reload persistence, date navigation, participation independent of routine completion, setup dates, desktop/mobile layouts, dark mode and reduced motion. Run npm run check, npm run test:e2e and npm run test:cloud. Screenshot artifacts are local under .omx/visual-audit/journal.

The optional Impeccable detector could not run: its CLI reported “bundled detector not found.” Browser inspection and behavioral checks are the fallback evidence.

Final automated results: `npm run check` passed (lint, TypeScript, 63 unit tests, production build); `npm run test:e2e` passed 50 desktop/phone scenarios; `npm run test:cloud` passed 11 mock-service scenarios. Reduced-motion behavior, board target sizes, no horizontal overflow, and intentional editor focus are covered. Real Supabase policies and real-device mobile keyboards remain outside these checks.

## Next product questions

Observe whether the owner starts writing faster and returns after missed days before adding reminders or more rewards. Follow-up candidates: journal browsing by mood, easier weekly reflection, and reducing task/trade form friction based on actual usage. Habit improvement remains a hypothesis until real use is observed.
