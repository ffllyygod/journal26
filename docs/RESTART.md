# Restart a challenge

Sign in at https://journal26.vercel.app. Close other journal tabs and reload the app on other devices so they use the current sync protection.

1. Open Settings, then **A fresh start → Restart this challenge**.
2. Set **New challenge starts** to **2026-11-06** for the requested restart. A 60-day challenge then ends on January 4, 2027.
3. Type **RESTART**. The action stays disabled while changes are unsaved or conflicted.
4. Choose **Back up and restart** and keep the downloaded JSON file private.
5. Wait for **All changes saved** before closing the page.

The action clears daily entries, priorities, tasks, habit check-ins, moods, trades, applications, learning notes, weekly notes/commitments, and craving logs. Preferences, habit names, account credentials and the account itself remain. The current device's running focus timer is removed; timers from an earlier challenge are ignored on other updated devices.

The backup contains image references. Storage image files remain available for recovery; this operation does not permanently purge Storage. Use the separate complete-backup action first if you need image bytes in a portable backup.

Updated clients identify each restart with a new generation ID and do not combine drafts from older challenges. Already-open copies of an older app version do not implement that protection, so close/reload them before restarting. When two updated devices restart at once, the persisted cloud generation wins rather than mixing histories.

A reset is an authenticated data operation. Deploying the app does not erase records automatically, and a successful deployment is not proof that a live reset occurred.
