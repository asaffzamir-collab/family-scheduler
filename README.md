# Family Scheduler

A family scheduling assistant that syncs with Google Calendar and proactively notifies you via email and phone push notifications. Capture events instantly from Telegram messages (or optionally WhatsApp).

---

## What It Does

- **Google Calendar sync** — reads your existing calendars and writes new events to a shared "Family - Master" calendar.
- **Smart reminders** — tests get 7-day + 2-day + morning-of alerts; classes get 2-hour + 15-minute; personal gets 1-day + 1-hour.
- **Daily summary email** — every morning you get today + tomorrow + upcoming tests.
- **Phone push notifications** — works on Android and iPhone (when "Added to Home Screen").
- **Telegram capture** — send "Math test for Noam on Mar 10 8:00" and it creates the event.
- **WhatsApp capture** — optional, uses official Meta Business API.
- **Conflict detection** — warns you when two events overlap for the same person.

---

## Tech Stack

| Part | Tool | Cost |
|------|------|------|
| Framework | Next.js 14+ (App Router, TypeScript) | Free |
| Database | Supabase (PostgreSQL) | Free tier |
| Hosting | Vercel | Free (Hobby) |
| Email | Resend | Free (~100/day) |
| Push | Web Push (PWA, VAPID) | Free |
| Telegram | Bot API | Free |
| WhatsApp | Meta Cloud API | Free inbound, optional |
| Cron | Supabase pg_cron | Free |

---

## Setup Guide (Step-by-Step)

### Step 1: Clone and Install

```bash
git clone <your-repo-url> family-scheduler
cd family-scheduler
npm install
cp .env.example .env.local
```

You should see: a folder with all the project files.

### Step 2: Create a Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click **Select a project** (top bar) → **New Project**.
3. Name it "Family Scheduler". Click **Create**.
4. Wait 10 seconds. You should see the project name in the top bar.

### Step 3: Enable the Google Calendar API

1. In Google Cloud Console, go to **APIs & Services** → **Library**.
2. Search for "Google Calendar API".
3. Click it, then click **Enable**.
4. You should see: "API enabled" message.

### Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**.
2. Click **+ Create Credentials** → **OAuth client ID**.
3. If prompted, configure the **OAuth consent screen** first:
   - User Type: **External** (unless you have Google Workspace). Click **Create**.
   - App name: "Family Scheduler".
   - Support email: your email.
   - Developer contact email: your email again.
   - Click **Save and Continue**.
   - **Scopes page**: Click **Add or Remove Scopes**. In the search box that appears, search for **Google Calendar API**. Check the two boxes that say `.../auth/calendar` and `.../auth/calendar.events`. Then scroll up and also check `.../auth/userinfo.email` and `.../auth/userinfo.profile` (these are usually near the top of the list). If you can't find them, that's OK — just click **Update** and continue. Our app requests the right scopes automatically when you sign in.
   - Click **Save and Continue**.
   - **Test users page**: Click **+ Add Users**. Type your email and your wife's email. Click **Add**. Then click **Save and Continue**.
   - Click **Back to Dashboard**.
4. Back in Credentials → **+ Create Credentials** → **OAuth client ID**:
   - Application type: **Web application**.
   - Name: "Family Scheduler".
   - Authorized redirect URIs: add `http://localhost:3000/api/auth/callback/google`
   - Click **Create**.
5. Copy the **Client ID** and **Client Secret**.
6. Paste them into `.env.local`:
   ```
   GOOGLE_CLIENT_ID=your-client-id-here
   GOOGLE_CLIENT_SECRET=your-client-secret-here
   ```

### Step 5: Create a Supabase Project

1. Go to https://supabase.com and sign up (free).
2. Click **New Project**.
3. Name: "family-scheduler". Choose a password. Region: closest to you.
4. Wait 1-2 minutes for it to set up.
5. Go to **Settings** → **API**.
6. Copy:
   - **Project URL** → paste as `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`
   - **service_role key** (under "Project API keys") → paste as `SUPABASE_SERVICE_ROLE_KEY`

### Step 6: Run the Database Migration

1. In Supabase, go to **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open the file `supabase/migrations/001_initial.sql` from the project.
4. Copy its entire content and paste it into the SQL editor.
5. Click **Run**.
6. You should see: "Success. No rows returned" (that's correct — it creates tables).

**Optional: Run additional migrations** (work calendars + WhatsApp linking)  
→ Open **`run-optional-migrations-in-supabase.sql`** in the project root, copy its contents into the Supabase SQL Editor, and run it. See **`NEXT-STEPS.md`** for full details.

### Step 7: Generate Secrets

Open a terminal and run:

```bash
# NextAuth secret
openssl rand -base64 32
# Copy the output → paste as NEXTAUTH_SECRET in .env.local

# Cron secret
openssl rand -base64 32
# Copy the output → paste as CRON_SECRET in .env.local
```

### Step 8: Generate VAPID Keys (for phone notifications)

```bash
npx web-push generate-vapid-keys
```

You should see two lines:
```
Public Key: BLa1b2c3...
Private Key: xYz4a5b6...
```

Copy them into `.env.local`:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLa1b2c3...
VAPID_PRIVATE_KEY=xYz4a5b6...
```

### Step 9: Set Up Resend (Email)

1. Go to https://resend.com and sign up (free).
2. Go to **API Keys** → **Create API Key**.
3. Copy the key → paste as `RESEND_API_KEY` in `.env.local`.
4. The default `EMAIL_FROM` uses Resend's test domain. For production, add your own domain later.

### Step 10: Set NEXTAUTH_URL

In `.env.local`:
```
NEXTAUTH_URL=http://localhost:3000
```

### Step 11: Run Locally

```bash
npm run dev
```

You should see:
```
▲ Next.js 14.x
- Local: http://localhost:3000
```

Open http://localhost:3000 in your browser. You should see the sign-in page with a "Sign in with Google" button.

### Step 12: Test Sign-In

1. Click **Sign in with Google**.
2. Choose your Google account.
3. Allow the permissions (calendar access).
4. You should be redirected to the Setup Wizard.

If you see an error: check that your Google OAuth redirect URI matches exactly `http://localhost:3000/api/auth/callback/google`.

---

## Telegram Setup (Free, Recommended)

### Step 1: Create a Telegram Bot

1. Open Telegram and search for **@BotFather**.
2. Send the message: `/newbot`
3. Name it: "Family Scheduler Bot" (or whatever you like).
4. Username: `family_scheduler_yourname_bot` (must end in `bot`).
5. BotFather will give you a **token** like `7123456789:ABCdef...`.
6. Copy it → paste as `TELEGRAM_BOT_TOKEN` in `.env.local`.

### Step 2: Set the Webhook

After deploying (or for local testing with ngrok), run:

```bash
# Replace YOUR_BOT_TOKEN and YOUR_APP_URL
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=YOUR_APP_URL/api/webhooks/telegram"
```

You should see: `{"ok": true, "result": true, "description": "Webhook was set"}`

### Step 3: Link Your Account

1. In the Family Scheduler app, go to **Settings**.
2. Find the **Telegram** section.
3. Click "Link Telegram" — it opens Telegram with your bot.
4. Send `/start` to the bot. It should reply "Linked!"

### Step 4: Test It

Send a message to your bot:
```
Math test for Noam on Mar 10 8:00
```

The bot should reply:
```
Added: Math test
Mon, Mar 10 at 8:00 AM
For: Noam
```

Check your Google Calendar — the event should be there in "Family - Master".

---

## WhatsApp Setup (Optional — Meta Business API)

WhatsApp uses the official Meta Business Cloud API. You need to run the optional migrations first (see **`run-optional-migrations-in-supabase.sql`** and **`NEXT-STEPS.md`**), then:

### Step 1: Create a Meta App

1. Go to https://developers.facebook.com
2. Click **My Apps** → **Create App**.
3. Choose **Business** type.
4. Name: "Family Scheduler". Click **Create**.

### Step 2: Add WhatsApp Product

1. In your app dashboard, find **WhatsApp** and click **Set Up**.
2. Follow the steps to connect a phone number (you can use the test number provided).
3. Go to **WhatsApp** → **API Setup**.
4. Copy the **Temporary access token** → `META_WHATSAPP_ACCESS_TOKEN` in `.env.local`
5. Copy the **Phone number ID** → `META_WHATSAPP_PHONE_NUMBER_ID` in `.env.local`
6. Choose a verify token (e.g. `my-family-verify-123`) → `META_WHATSAPP_VERIFY_TOKEN` in `.env.local`

### Step 3: Set Webhook

1. Go to **WhatsApp** → **Configuration**.
2. Under Webhook, click **Edit**.
3. Callback URL: `https://your-app.vercel.app/api/webhooks/whatsapp` (or your ngrok URL for local testing).
4. Verify token: **same string** as `META_WHATSAPP_VERIFY_TOKEN`.
5. Click **Verify and save**.
6. Under Webhook fields, subscribe to **messages**.

### Step 4: Link your phone (required before adding events)

1. In the app go to **Settings** → **Messaging Channels** → **WhatsApp**.
2. Click **Get link code** and note the 6-digit code.
3. In WhatsApp, send that code (e.g. `482917`) to your business/test number.
4. The bot replies "Linked!". Now you can add events by texting.

### Step 5: Test

Send a WhatsApp message to your connected number:
```
Gym tomorrow 19:00
```

The system should reply "Added: …" and create the event on your Family calendar. For a full step-by-step guide see **`NEXT-STEPS.md`**.

---

## Deploy to Vercel

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/family-scheduler.git
git push -u origin main
```

### Step 2: Connect to Vercel

1. Go to https://vercel.com and sign up with GitHub.
2. Click **Add New** → **Project**.
3. Import your `family-scheduler` repository.
4. Before deploying, add all environment variables:
   - Click **Environment Variables**.
   - Add each variable from `.env.local` (except NEXTAUTH_URL — see below).
5. Set `NEXTAUTH_URL` to your Vercel URL: `https://your-project.vercel.app`
6. Click **Deploy**.

You should see: build succeeds and the app is live.

### Step 3: Update Google OAuth Redirect

1. Go back to Google Cloud Console → Credentials → your OAuth client.
2. Add redirect URI: `https://your-project.vercel.app/api/auth/callback/google`
3. Save.

### Step 4: Set Up Supabase pg_cron (for reminders)

1. In Supabase SQL Editor, enable extensions:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   CREATE EXTENSION IF NOT EXISTS pg_net;
   ```

2. Store your secrets in Vault:
   ```sql
   SELECT vault.create_secret('https://your-project.vercel.app', 'project_url');
   SELECT vault.create_secret('your-cron-secret-here', 'cron_secret');
   ```

3. Schedule the reminder job (every 15 minutes):
   ```sql
   SELECT cron.schedule(
     'process-reminders',
     '*/15 * * * *',
     $$
     SELECT net.http_post(
       url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/api/cron/reminders',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
       ),
       body := '{}'::jsonb
     ) AS request_id;
     $$
   );
   ```

4. Schedule daily summary (every day at 7:00 AM UTC):
   ```sql
   SELECT cron.schedule(
     'daily-summary',
     '0 7 * * *',
     $$
     SELECT net.http_post(
       url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/api/cron/reminders?action=summary',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
       ),
       body := '{}'::jsonb
     ) AS request_id;
     $$
   );
   ```

### Step 5: Set Telegram Webhook (production)

```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=https://your-project.vercel.app/api/webhooks/telegram"
```

---

## Phone Notifications (iPhone / Android)

### Android
1. Open the app URL in Chrome.
2. Chrome may show "Add to Home Screen" — tap it.
3. Open the app from your home screen.
4. Go to Settings → Enable Phone Notifications.
5. Allow when prompted.

### iPhone
1. Open the app URL in **Safari** (not Chrome).
2. Tap the **Share** button (square with arrow).
3. Scroll down and tap **Add to Home Screen**.
4. Open the app from your home screen (the blue "F" icon).
5. Go to Settings → Enable Phone Notifications.
6. Allow when prompted.

**Important:** On iPhone, notifications only work when you open the app from the Home Screen icon. They won't work in the Safari browser tab.

### Test It
Go to Settings and click "Send Test Notification". You should get a notification on your phone within a few seconds.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Sign in failed" | Check that Google OAuth redirect URI matches exactly. |
| "Missing SUPABASE_URL" | Make sure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. |
| No calendars showing | Make sure you approved calendar permissions during Google sign-in. Try signing out and back in. |
| Test event not appearing | Check Google Calendar — look for "Family - Master" calendar in the left sidebar. |
| No reminders received | Check that pg_cron job is running. In Supabase: `SELECT * FROM cron.job;` |
| Telegram bot not responding | Check TELEGRAM_BOT_TOKEN is correct. Check webhook is set: `curl https://api.telegram.org/botTOKEN/getWebhookInfo` |
| Push not working on iPhone | Must be opened from Home Screen. Go to iPhone Settings → Notifications → find your app and make sure it's enabled. |
| "Unauthorized" on cron endpoint | Check that CRON_SECRET in Vercel matches what you stored in Supabase Vault. |

---

## Project Structure

```
src/
├── app/
│   ├── (app)/               # Protected pages (need sign-in)
│   │   ├── dashboard/       # Week view, upcoming events
│   │   ├── capture/         # Add event form + quick-add
│   │   ├── settings/        # Family, calendars, notifications
│   │   └── wizard/          # First-time setup wizard
│   ├── api/
│   │   ├── auth/            # NextAuth Google sign-in
│   │   ├── calendar/        # List, sync, events, quick-add, test
│   │   ├── cron/            # Reminder processing endpoint
│   │   ├── family/          # Members, reminder rules
│   │   ├── push/            # Subscribe + test push
│   │   └── webhooks/        # Telegram + WhatsApp inbound
│   ├── signin/              # Sign-in page
│   └── layout.tsx           # Root layout with providers
├── components/
│   ├── nav.tsx              # Sidebar navigation
│   └── providers.tsx        # NextAuth session provider
├── lib/
│   ├── auth.ts              # NextAuth config
│   ├── conflicts.ts         # Conflict detection
│   ├── db.ts                # Supabase client
│   ├── email.ts             # Resend email
│   ├── google-calendar.ts   # Google Calendar API
│   ├── parser.ts            # Natural language → event
│   ├── reminder-engine.ts   # Reminder processing + daily summary
│   ├── session.ts           # Auth helpers
│   └── web-push-util.ts     # Web Push sending
├── types/
│   └── index.ts             # TypeScript types
public/
├── manifest.json            # PWA manifest
├── sw.js                    # Service worker
└── icon-192.svg             # App icon
supabase/
└── migrations/
    └── 001_initial.sql      # Database schema
```

---

## How Events Flow

1. **Manual** — You fill out the form or type "Math test for Noam Mar 10" in Quick Add.
2. **Telegram** — You send a message to the bot. It parses and creates the event.
3. **WhatsApp** — Same as Telegram but via WhatsApp Cloud API.

All paths:
- Parse the text into title, person, category, date/time.
- Create the event in Google Calendar ("Family - Master").
- Store it in the database.
- Check for conflicts.
- Reminders fire automatically based on category rules.

---

## License

MIT
