# What to Do Next — Detailed Guide

This guide covers everything after your initial Family Scheduler setup: optional database migrations, creating your Vercel project (if you don’t have one yet), WhatsApp, and the new dashboard.

---

## Checklist (in order)

| # | Task | Where |
|---|------|--------|
| 0 | Create Vercel project (if you don’t have one yet) | GitHub + Vercel |
| 1 | Run optional DB migrations (work calendars + WhatsApp) | Supabase |
| 2 | (Optional) Set up WhatsApp so you can add events by text | Meta Developer + App |
| 3 | Use the new dashboard (no setup) | App |

---

## 0. Create your Vercel project (first time)

Do this once so you have a live URL (e.g. for WhatsApp webhook and production sign-in).

### 0.1 Push your code to GitHub

1. Create a new repo on **https://github.com** (e.g. `family-scheduler`). Don’t add a README (you already have one).
2. In your project folder, run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/family-scheduler.git
git push -u origin main
```

Replace `YOUR_USERNAME` and `family-scheduler` with your GitHub username and repo name.

### 0.2 Create the project on Vercel

1. Go to **https://vercel.com** and sign in (e.g. with GitHub).
2. Click **Add New…** → **Project**.
3. **Import** your `family-scheduler` repository (or the one you just pushed).
4. **Before** clicking Deploy, open **Environment Variables** and add every variable from your `.env.local`:

   - `NEXTAUTH_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `CRON_SECRET`
   - `TELEGRAM_BOT_TOKEN` (if you use Telegram)
   - `META_WHATSAPP_VERIFY_TOKEN`
   - `META_WHATSAPP_ACCESS_TOKEN`
   - `META_WHATSAPP_PHONE_NUMBER_ID`

5. **Important:** Add one more variable:
   - **Name:** `NEXTAUTH_URL`
   - **Value:** leave empty for now — you’ll set it right after the first deploy (see below).
6. Click **Deploy**. Wait for the build to finish.

### 0.3 Set NEXTAUTH_URL and optional redirects

1. On Vercel, open your project → **Settings** → **Environment Variables**.
2. Add or edit **`NEXTAUTH_URL`** and set it to your live URL, e.g.  
   `https://family-scheduler-xxxx.vercel.app`  
   (Use the exact URL Vercel shows under **Domains**.)
3. In **Google Cloud Console** → **APIs & Services** → **Credentials** → your OAuth client:
   - Add **Authorized redirect URI:**  
     `https://family-scheduler-xxxx.vercel.app/api/auth/callback/google`  
     (same base URL as above).
4. **Redeploy** so the new `NEXTAUTH_URL` is used: **Deployments** → ⋮ on the latest → **Redeploy**.

After this you have a live app. Use that URL for the WhatsApp webhook (section 2) and for production sign-in.

---

## 1. Run optional migrations in Supabase

These add support for **linked work calendars** and **WhatsApp linking**.

### Steps

1. Open **Supabase**: https://supabase.com → your project.
2. In the left sidebar click **SQL Editor**.
3. Click **New query**.
4. Open the file **`run-optional-migrations-in-supabase.sql`** in your project (same folder as this README).
5. Select all (Cmd+A or Ctrl+A), copy, and paste into the Supabase SQL editor.
6. Click **Run** (or Cmd+Enter).
7. You should see **Success** (and possibly “Success. No rows returned” — that’s fine).

**Done.** Your DB now has:

- `user_calendars.account_email` — so work vs personal calendars are tracked correctly.
- `whatsapp_links` and `whatsapp_link_codes` — so users can link their WhatsApp number and add events by text.

---

## 2. WhatsApp setup (optional)

If you want to add events by sending a simple WhatsApp message (e.g. *“Gym tomorrow 7pm”*), do the following.

### 2.1 Create a Meta Developer app and add WhatsApp

1. Go to **https://developers.facebook.com** and log in.
2. Click **My Apps** → **Create App**.
3. Choose **Business** and click **Next**.
4. App name: e.g. **Family Scheduler**. Contact email: your email. Click **Create App**.
5. On the app dashboard, find **WhatsApp** in the products list and click **Set up**.
6. Choose **WhatsApp Business Account** and complete the short flow (you can use the **test number** Meta gives you).

### 2.2 Get your credentials

1. In the left sidebar go to **WhatsApp** → **API Setup** (or **Getting started**).
2. You’ll see:
   - **Temporary access token** (long string). Copy it.
   - **Phone number ID** (numeric). Copy it.
3. Open your project’s **`.env.local`** and set:
   ```env
   META_WHATSAPP_ACCESS_TOKEN=paste-the-token-here
   META_WHATSAPP_PHONE_NUMBER_ID=paste-the-phone-number-id-here
   ```
4. Choose a **verify token** (any secret string you like, e.g. `my-family-scheduler-verify-123`). Add it to `.env.local`:
   ```env
   META_WHATSAPP_VERIFY_TOKEN=my-family-scheduler-verify-123
   ```
   You’ll use this same value when configuring the webhook below.

### 2.3 Expose your app to the internet (for the webhook)

Meta must be able to call your app. You have two options:

- **Option A — Local with ngrok (testing)**  
  1. Install ngrok: https://ngrok.com  
  2. Run: `ngrok http 3000`  
  3. Copy the HTTPS URL (e.g. `https://abc123.ngrok.io`). Use it below as `YOUR_PUBLIC_URL`.

- **Option B — Deploy to Vercel (recommended)**  
  1. Deploy the app to Vercel (see README “Deploy to Vercel”).  
  2. Use your Vercel URL as `YOUR_PUBLIC_URL` (e.g. `https://your-app.vercel.app`).

### 2.4 Set the WhatsApp webhook in Meta

1. In Meta: **WhatsApp** → **Configuration** (in the left menu).
2. Under **Webhook**, click **Edit**.
3. **Callback URL**:  
   `YOUR_PUBLIC_URL/api/webhooks/whatsapp`  
   Example: `https://your-app.vercel.app/api/webhooks/whatsapp`  
   (For ngrok: `https://abc123.ngrok.io/api/webhooks/whatsapp`.)
4. **Verify token**: paste the **exact same** value you put in `META_WHATSAPP_VERIFY_TOKEN` (e.g. `my-family-scheduler-verify-123`).
5. Click **Verify and save**. Meta will send a GET request to your app; if the token matches, verification succeeds.
6. Under **Webhook fields**, subscribe to **messages** (check the box). Save.

### 2.5 Link your phone in the app

1. Restart your app if you changed `.env.local` (`npm run dev` or redeploy).
2. In the Family Scheduler app go to **Settings**.
3. Scroll to **Messaging Channels** → **WhatsApp**.
4. Click **Get link code**. A 6-digit code appears (valid 15 minutes).
5. Open **WhatsApp** and send a message to the **Meta test number** (or your connected business number) with **only** that code, e.g. `482917`.
   - You can also send: `link 482917`.
6. The app should reply that you’re linked.
7. In the app, refresh Settings; it should show **Linked** next to WhatsApp.

### 2.6 Test adding an event

Send a WhatsApp message to the same number, for example:

- `Gym tomorrow 7pm`
- `Math test for Noam on Mar 10 8:00`
- `Dentist next Tuesday 10am`

You should get a reply like “Added: …” and the event should appear in the app and on the Family calendar.

### Troubleshooting WhatsApp

- **“Couldn’t understand”**  
  Use a clear pattern: *“[What] [when]”* or *“[What] for [name] on [date] [time]”*. Examples are in the reply message from the bot.

- **Webhook verify fails**  
  - Callback URL must be exactly `YOUR_PUBLIC_URL/api/webhooks/whatsapp` (no trailing slash).  
  - Verify token in Meta must match `META_WHATSAPP_VERIFY_TOKEN` in `.env.local` (and redeploy/restart after changing env).

- **No reply / event not created**  
  - Confirm the optional migrations were run (so `whatsapp_links` and `whatsapp_link_codes` exist).  
  - Make sure you linked your number (sent the 6-digit code) before sending event messages.  
  - Check the app logs (or Vercel logs) for errors when you send a message.

---

## 3. New dashboard (no setup)

The dashboard has been updated. You don’t need to configure anything; just use the app.

- **Important upcoming** — Next 7 days at a glance (tests first).
- **Conflicts** — Shown only when there are overlapping events for the same person.
- **By category** — Tests, Classes, Personal, Other with counts and next events.
- **Free time this week** — Gaps of at least 1 hour (6am–10pm) with no family events.
- **Week view** — Same 7-day grid with filters; conflicts highlighted in red.

---

## Quick reference: env vars for WhatsApp

In **`.env.local`** (and in Vercel if deployed):

```env
# WhatsApp (optional)
META_WHATSAPP_VERIFY_TOKEN=your-secret-verify-string
META_WHATSAPP_ACCESS_TOKEN=from-Meta-API-Setup
META_WHATSAPP_PHONE_NUMBER_ID=from-Meta-API-Setup
```

---

## If you deploy to Vercel later

1. Add the same env vars in Vercel (Settings → Environment Variables).
2. Set **Callback URL** in Meta to: `https://your-vercel-app.vercel.app/api/webhooks/whatsapp`.
3. Set `NEXTAUTH_URL` in Vercel to: `https://your-vercel-app.vercel.app`.

After that, WhatsApp will work in production; users can get a link code in the app and send it via WhatsApp to link their number.
