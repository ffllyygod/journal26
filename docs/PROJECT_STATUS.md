# Journal26: project status

Shared reference for every agent and the owner. **Update this in the same commit as your work.**
Last updated: 2026-11-02.

## What this is

A private, single-owner journal for a 60-day personal challenge: two habits to quit, learning to trade (mainly XAUUSD, BTC, ETH), and landing a software job. Next.js on Vercel, Supabase free tier, phone and laptop.

**The product goal is daily use for 60 days, not a feature list.** Judge every change by whether it makes tonight's entry more likely. If it adds typing to the daily path, it needs a very good reason.

## The daily loop

The Today screen is a sheet of five steps that opens on whatever is next. A day counts as complete when all five are done (`dayLoop` in `src/lib/analytics.ts`), and the 60-square board shows how far each day got:

1. **Plan**: priorities or tasks exist, normally written the evening before
2. **Check-in**: both habits logged as kept or slip
3. **Trades**: closed trades reviewed and open ones documented (a reason and whether the plan was followed), or an explicit "no trade" decision. A position held overnight must not block the day.
4. **Journal**: at least one line
5. **Tomorrow**: the next day has a plan

## Stack and map

| Area | Where |
| --- | --- |
| Next.js 16 (`proxy.ts`, not `middleware.ts`) | `src/app` |
| Types and pure logic, unit tested | `src/lib/{types,domain,analytics,insights,focus,task-operations,merge,reminders}.ts` |
| Save, sync, draft recovery | `src/lib/use-workspace.ts` |
| Screens | `src/components/{workspace,board,daily,focus,patterns,setup,trades,career,review,settings,urge,charts}.tsx` |
| Schema, RLS, private bucket | `supabase/migrations/` |
| Setup and live checks | `docs/SETUP.md` |

`npm run check` runs lint, types, unit tests and build. `npm run test:e2e` drives the demo at desktop and phone sizes. `npm run test:cloud` drives the real client against `e2e/cloud/mock-supabase.mjs`.

## Status

### Done and tested

- First-run setup: name, start date, habit names, reason and craving plan, before anything else
- 60-square board: the challenge at a glance and the way to open any day
- Focus timer per track or per task. Survives reloads, stored on the device only, and credits actual time exactly once (`logSession`)
- Patterns (`findInsights`): rule-based findings across habits, trades, focus and cravings, each with a minimum sample and its evidence shown. Top one on Today, all in Review
- One change per week: set in Review, shown on Today all the next week
- Trade form: quick entry first, details folded, separate close flow that leads with the result
- Automatic dark mode
- Password login, private route, password reset flow, no public signup
- Plan-ahead days with carry-over of unfinished tasks; tasks, priorities, journal, images, mood
- Habit check-ins, current and best streak, 60-day calendar; renamable habits
- Craving button: 5-minute timer, your written plan, trigger and outcome log, honest slip recording
- Trade journal: open-to-reviewed flow, any symbol, sessions, pre-trade checklist, mistake tags, setup grade, stop and target validation, planned R:R, demo and live kept separate
- Trade analytics: net, win rate, avg R, expectancy, profit factor, max drawdown, equity curve, breakdown by market, setup, session, feeling and mistake
- Guardrails: max trades per day, max daily loss, losing-streak warning
- Career pipeline, follow-ups, weekly application target, learning notes
- Weekly review across time, tasks, trades, cravings and applications
- Sync: autosave, device draft, automatic retry, pull on focus, three-way merge, field-level conflict prompt
- Backups: Markdown, JSON, complete with images, restore from JSON, backup nudge
- Calendar reminders by `.ics`, late-night day boundary, installable PWA manifest and icons

### Done but unproven against real services

The Supabase project exists and the app is deployed to Vercel, but the mock still proves app logic only. **Not yet verified live:** RLS isolation between users, Storage policies, image upload and signed URLs, password-reset email. Run the "Required live checks" in `docs/SETUP.md`, then move these up.

### Left to do

Blocked on the owner:

1. [x] Create the Supabase project, run the migration, disable signups
2. [ ] Confirm the single user exists by signing in on the deployed site
3. [x] Create the Vercel project, set the two environment variables, deploy to production by CLI
4. [ ] Set Site URL and the redirect URLs in Supabase (`docs/SETUP.md` section 3), or password reset links will not work
5. [ ] Connect the GitHub repo to Vercel. The CLI could not connect it, so a push does not deploy yet
6. [ ] Run the live checks in `docs/SETUP.md`
7. [ ] Decide whether the repo stays public (see risks)

After a week of real use, decide from what actually got used:

- [ ] Web push reminders, if calendar alerts get ignored (needs a service worker and a subscriptions table)
- [ ] Scheduled automatic backups off Supabase (the free tier has none)
- [ ] Deleting orphaned images from Storage; removal only drops the reference today
- [ ] CSV import of broker history
- [ ] Offline reading through a service worker; today the first load needs a network
- [ ] A local-time fix for sessions: `sessionAt` uses fixed UTC hours and ignores daylight saving. It is an editable default.

## Decisions

| Decision | Why |
| --- | --- |
| One JSON document per user, not relational tables | Single user, small data, and fields can evolve without migrations. `normalizeWorkspace` fills new fields on load. Keep `version: 1` unless the shape truly breaks, because the database check constraint pins it. |
| Optimistic revision plus three-way merge | Phone and laptop together are the normal case. Whole-document overwrite would lose entries, and a "you have a conflict, export and reload" flow would be hit daily. |
| Calendar reminders instead of push | Free, works on iOS without installing anything, no backend. |
| Manual net P&L, no broker sync or live prices | The broker's number is the truth; no fabricated results. |
| Habit labels default to neutral words in code | The repo is public; the owner sets personal wording in Settings, stored privately. |
| `/demo` redirects once Supabase is configured | Real entries must not land in unsynced browser storage. |
| Day starts at 3am by default | Late New York session journaling still belongs to that day. Editable. |
| The board is the identity; everything else stays quiet | It carries real information and doubles as navigation. Blue ink on cool paper, dark at night. |
| Serif means the owner wrote it | `.own-words` marks their words (journal, priorities, reasons). The interface speaks in the sans. |
| Plain copy only | The first build's motivational taglines read as a template and got in the way. Say what a thing is or does. |
| Patterns are rules, not AI | Private data stays out of third-party APIs, and every claim is a count that can be checked. They report what happened together, never a cause. |
| A task's minutes are its remaining estimate | Lets a timer and a finished checkbox credit time exactly once. Stopping early shrinks the estimate; finishing replaces it with time spent. |

## Non-goals

Trade execution, signals, live price feeds, social features, multi-user, paid services.

## Known risks

- **The repo is public** under the owner's GitHub account during a job search. It holds code only, no entries, but the owner may prefer private. Vercel works with private repos.
- **Supabase free projects pause after about a week without activity.** Daily use prevents it; a long gap needs a manual restore from the dashboard.
- **No automatic database backups on the free tier.** Exports are the only backup; the app nudges weekly.
- **Unsynced drafts sit unencrypted in localStorage** until confirmed, and are cleared on sign-out. A running focus session (task title and start time) sits there too, and is also cleared.
- **The focus timer is per device.** A session started on the phone is not visible on the laptop.
- **Under 20 closed trades, the analytics are not evidence of an edge.** The UI says so. Do not remove that line.

## History

- **Codex**: first build. Good design and data-safety instincts, but nothing was ever committed, lint and one test failed, `.sr-only` was never defined, and source was on single lines over 2,000 characters.
- **Claude Code, 2026-11-02**: first production deploy to Vercel by CLI from the working tree, against the real Supabase project. All three test suites passed first; the live checks have not run.
- **Codex, then Claude Code, 2026-11-02**: Codex left an uncommitted reskin plus sound fixes (task time credits, uploads that follow their date, documented open trades) that broke the build through type errors in its spec. Claude Code fixed that, then reworked the product after the owner said it felt like a demo: board, step sheet, focus timer, patterns, weekly change, trade flow, first-run setup, new visual system and plain copy.
- **Claude Code, 2026-11-01**: put it under version control and fixed the above. Added the daily loop, sync merge and recovery, trade depth, cravings, restore, reminders and both browser test suites. Raised text contrast to WCAG AA across the app. Independent security and correctness reviews ran; their findings (a CSP, a false merge conflict, lost fees) are fixed. No exploitable security issue was found.
