# Connect your private Journal26

Real journal entries live behind `/journal` and Supabase authentication. No sample entries are created for a new cloud account. The browser-local `/demo` sandbox only exists until Supabase is configured; after that it redirects to the journal, so real entries cannot land there by accident.

## 1. Create a Supabase project

1. Sign in at <https://supabase.com/dashboard> and create a Free project. Keep the database password in your password manager; the app does not need it.
2. Open the SQL editor and run the contents of `supabase/migrations/202611010001_initial.sql` once. It creates the owner-protected `workspaces` table and a **private** `journal-images` bucket.
3. In Authentication settings, disable **Allow new users to sign up**. This deployment is intended for a personal account, with no public signup page.
4. In Authentication → Users, use **Add user → Create new user** to create your own email/password account. Enable auto-confirm for this manually provisioned account. Use a strong unique password of at least 12 characters.
5. In Project Settings → API, copy the project URL and **publishable** key. The legacy public `anon` key also works. Never put the service-role/secret key in a `NEXT_PUBLIC_` variable or source control.

## 2. Configure locally

Copy `.env.example` to `.env.local` and replace both values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The app also accepts `NEXT_PUBLIC_SUPABASE_ANON_KEY` in place of the publishable key name.

Then run:

```sh
npm install
npm run dev
```

Visit `http://localhost:3000/login`, sign in, and configure your challenge in Settings. Changing the environment requires restarting the dev server.

## 3. Deploy on Vercel

1. Import `ffllyygod/journal26` into Vercel, using the Next.js preset and repository root as the root directory.
2. Add both environment variables above to Production (and Preview only if you want private preview deployments to use this database).
3. Deploy. Subsequent pushes to the production branch deploy automatically after the Git integration is connected.
4. In Supabase → Authentication → URL Configuration, set **Site URL** to your deployed HTTPS origin.
5. Add your exact callback URL to the allowed redirect URLs, e.g. `https://your-app.vercel.app/auth/callback**`, plus `http://localhost:3000/auth/callback**` for local testing. This accommodates the `?next=/auth/reset` password reset destination. Avoid wildcard hosts in production.
6. Test sign in and password reset at your deployed URL. Open password reset links in the same browser where you requested them, because the flow uses PKCE.

Supabase's built-in email sender has restricted recipients and rate limits. For reliable password-reset emails to your address, configure an SMTP provider in Supabase Auth. A dashboard administrator can also manage the manually created user. The app deliberately has no signup or invitation flow.

## How your data is protected

- `/journal` validates the current user on the server. The proxy refreshes sessions; the page performs its own user check.
- All database operations use the authenticated user's public client. Row-level security restricts reads/writes to `auth.uid() = user_id`.
- Images are in a private bucket, with paths starting with the owner's user ID. Viewing uses temporary signed URLs valid for one hour. Do not share those URLs.
- No service-role key is required by the app. Never disable RLS or make the image bucket public.
- Supabase authentication establishes account-level access; this is not end-to-end encryption. Your hosting/database account administrators can access the stored data.
- Unsynced edits are kept in this browser's localStorage under a per-user key until the cloud confirms them, then removed. Signing out removes them. They are not encrypted, so sign out on a shared device.

## Save and recovery behavior

Edits autosave after a short pause and are copied to this device first, so a closed tab, dead battery or lost signal does not lose them. A failed save retries automatically (5s, 15s, 30s, then every 60s) and immediately when the connection returns. Reopening the app recovers anything that never reached the cloud.

Returning to a tab pulls the latest version. If two devices did save different edits, they are combined automatically, record by record and field by field. Only when both changed the same field to different values does the app ask: **Keep this device's** keeps your value for those fields and everything already combined; **Use the cloud version** downloads your draft as JSON first, then loads the cloud copy.

## Image handling and storage

JPEG, PNG, WebP, and GIF inputs under 10 MB are accepted. The app converts images to a still WebP image, with a maximum dimension of 1600 px and at most 1 MB per saved attachment. GIF animation is not preserved. The storage bucket enforces the output size/type limits too.

Removing an image from an entry removes its reference; it intentionally does not immediately delete the remote file, so a failed journal save cannot leave a broken attachment. Unreferenced files may be deleted manually in Supabase Storage after verifying your latest saved journal and exports. Exported JSON contains cloud object paths, not the image bytes; download any images you want in a separate offline backup.

Free-tier storage is finite, and inactive free Supabase projects may be paused. Check the provider's current limits at <https://supabase.com/pricing>. Export periodically; Free does not provide automatic database backups. An export is your portable record, not an automatic scheduled backup. The Today screen reminds you when your last backup is over a week old, and Settings can restore a JSON backup. Restore brings back the text records; image files stay in Storage, and their bytes in a complete backup are not re-uploaded.

## Required live checks

After connecting your project:

1. Create a task, journal text, habit check-in, application, and closed trade; wait for **Saved**, refresh, then sign out/in and confirm they persist.
2. Upload a screenshot and confirm it still opens after refreshing.
3. Open the app on two devices. Edit different fields on each and confirm both survive. Then edit the same field on each and confirm you are asked which to keep.
4. Disable the network after loading and edit. Confirm the "Not synced yet" state, close the tab, reconnect, reopen and confirm the edit returned.
5. In an incognito browser, open `/journal`; it must redirect to sign in. A public image URL must not expose attachments.
6. Use a second test user to prove RLS rejects another user's row and image paths. Remove that user after the check.
7. Request and complete a password reset using the deployed origin.

These checks require a real project and valid credentials. `npm run test:cloud` proves the app's logic against a local mock; it cannot prove real row-level security or Storage policies. Only checks 5 and 6 above can.
