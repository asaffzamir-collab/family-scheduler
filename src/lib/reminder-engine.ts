import { supabaseAdmin } from "./db";
import { sendEmail, buildReminderHtml, buildSummaryHtml } from "./email";
import { sendPush, PushPayload } from "./web-push-util";
import {
  addDays,
  addHours,
  addMinutes,
  subDays,
  subHours,
  subMinutes,
  startOfDay,
  endOfDay,
  format,
  isBefore,
  isAfter,
} from "date-fns";
import type { ReminderOffset } from "@/types";

const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

/**
 * Compute the reminder fire time from an event start and an offset.
 */
function computeReminderTime(
  eventStart: Date,
  offset: ReminderOffset
): Date {
  if (offset.label === "morning-of") {
    // 7:00 AM on the event day
    return setTimeOnDate(startOfDay(eventStart), 7, 0);
  }
  switch (offset.unit) {
    case "days":
      return subDays(eventStart, offset.value);
    case "hours":
      return subHours(eventStart, offset.value);
    case "minutes":
      return subMinutes(eventStart, offset.value);
    default:
      return subDays(eventStart, offset.value);
  }
}

function setTimeOnDate(date: Date, hour: number, minute: number): Date {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/**
 * Build an offset key string for dedup, e.g. "7d" or "morning-of"
 */
function offsetKey(offset: ReminderOffset): string {
  if (offset.label === "morning-of") return "morning-of";
  return `${offset.value}${offset.unit.charAt(0)}`;
}

/**
 * Main reminder processing — called by /api/cron/reminders
 *
 * 1. Load events within the next 30 days.
 * 2. For each event, check each reminder rule offset.
 * 3. If the reminder is due and not yet sent, send email + push.
 */
export async function processReminders() {
  const now = new Date();
  const windowEnd = addDays(now, 30);

  // Get all events in window
  const { data: events, error: eventsErr } = await supabaseAdmin
    .from("events")
    .select(
      "*, family_members:person_id(display_name), families:family_id(name)"
    )
    .gte("start_time", now.toISOString())
    .lte("start_time", windowEnd.toISOString())
    .order("start_time");

  if (eventsErr || !events) {
    console.error("[Reminders] Failed to load events:", eventsErr);
    return { sent: 0, errors: 1 };
  }

  // Get all reminder rules keyed by family_id + category
  const { data: rules } = await supabaseAdmin
    .from("reminder_rules")
    .select("*");
  const rulesMap = new Map<string, ReminderOffset[]>();
  for (const rule of rules || []) {
    rulesMap.set(`${rule.family_id}:${rule.category}`, rule.offsets);
  }

  let sent = 0;

  for (const event of events) {
    const offsets = rulesMap.get(`${event.family_id}:${event.category}`);
    if (!offsets || offsets.length === 0) continue;

    const eventStart = new Date(event.start_time);

    // Get family users for notifications
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, email, name")
      .eq("family_id", event.family_id);

    if (!users || users.length === 0) continue;

    for (const offset of offsets) {
      const reminderTime = computeReminderTime(eventStart, offset);
      const key = offsetKey(offset);

      // Is it due? (reminder time <= now) AND event hasn't started yet
      if (!isBefore(reminderTime, now) || !isAfter(eventStart, now)) continue;

      for (const user of users) {
        // Check if already sent
        const { data: existing } = await supabaseAdmin
          .from("notification_log")
          .select("id")
          .eq("event_id", event.id)
          .eq("offset_key", key)
          .eq("user_id", user.id)
          .limit(1);

        if (existing && existing.length > 0) continue;

        // Send email
        const personName = event.family_members?.display_name || null;
        const dateStr = format(eventStart, "EEEE, MMM d 'at' h:mm a");

        await sendEmail({
          to: user.email,
          subject: `Reminder: ${event.title} — ${dateStr}`,
          html: buildReminderHtml(
            event.title,
            dateStr,
            personName,
            event.category,
            APP_URL
          ),
        });

        // Send push to all user's subscriptions
        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", user.id);

        const pushPayload: PushPayload = {
          title: `Reminder: ${event.title}`,
          body: `${dateStr}${personName ? ` — ${personName}` : ""}`,
          url: `${APP_URL}/dashboard`,
          tag: `reminder-${event.id}-${key}`,
        };

        for (const sub of subs || []) {
          await sendPush(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            pushPayload
          );
        }

        // Send Telegram if linked
        const { data: telegramLink } = await supabaseAdmin
          .from("telegram_links")
          .select("chat_id")
          .eq("user_id", user.id)
          .limit(1);

        if (telegramLink && telegramLink.length > 0 && process.env.TELEGRAM_BOT_TOKEN) {
          const chatId = telegramLink[0].chat_id;
          const msg = `🔔 Reminder: *${event.title}*\n${dateStr}${personName ? `\nFor: ${personName}` : ""}`;
          try {
            await fetch(
              `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: msg,
                  parse_mode: "Markdown",
                }),
              }
            );
          } catch (e) {
            console.error("[Telegram] Push failed:", e);
          }
        }

        // Log all channels as single entry (email is always sent)
        await supabaseAdmin.from("notification_log").insert({
          event_id: event.id,
          offset_key: key,
          channel: "email",
          user_id: user.id,
        });

        sent++;
      }
    }
  }

  return { sent, errors: 0 };
}

/**
 * Send daily morning summary to all users.
 */
export async function sendDailySummary() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const tomorrowEnd = endOfDay(tomorrowStart);
  const weekEnd = addDays(todayStart, 7);

  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, email, name, family_id")
    .not("family_id", "is", null);

  if (!users) return;

  for (const user of users) {
    // Today's events
    const { data: todayEvents } = await supabaseAdmin
      .from("events")
      .select("title, start_time, category, family_members:person_id(display_name)")
      .eq("family_id", user.family_id)
      .gte("start_time", todayStart.toISOString())
      .lte("start_time", todayEnd.toISOString())
      .order("start_time");

    // Tomorrow's events
    const { data: tomorrowEvents } = await supabaseAdmin
      .from("events")
      .select("title, start_time, category, family_members:person_id(display_name)")
      .eq("family_id", user.family_id)
      .gte("start_time", tomorrowStart.toISOString())
      .lte("start_time", tomorrowEnd.toISOString())
      .order("start_time");

    // Tests in next 7 days
    const { data: upcomingTests } = await supabaseAdmin
      .from("events")
      .select("title, start_time, family_members:person_id(display_name)")
      .eq("family_id", user.family_id)
      .eq("category", "test")
      .gte("start_time", todayStart.toISOString())
      .lte("start_time", weekEnd.toISOString())
      .order("start_time");

    const mapEvent = (e: Record<string, unknown>) => ({
      title: e.title as string,
      time: format(new Date(e.start_time as string), "h:mm a"),
      date: format(new Date(e.start_time as string), "EEE, MMM d"),
      person: (e.family_members as Record<string, unknown>)?.display_name as string | null,
    });

    const html = buildSummaryHtml(
      user.name || "there",
      (todayEvents || []).map(mapEvent),
      (tomorrowEvents || []).map(mapEvent),
      (upcomingTests || []).map(mapEvent),
      APP_URL
    );

    await sendEmail({
      to: user.email,
      subject: `Daily Schedule — ${format(now, "EEE, MMM d")}`,
      html,
    });
  }
}
