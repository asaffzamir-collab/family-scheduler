import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";
import { parseMessage } from "@/lib/parser";
import { ensureFamilyCalendar, createGoogleEvent } from "@/lib/google-calendar";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Telegram webhook handler.
 * Receives incoming messages, parses them, creates events.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body?.message;
    if (!message?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const messageId = String(message.message_id);
    const text = message.text as string;

    // ── /start command — link Telegram to user ──
    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      const linkCode = parts[1]; // e.g. /start <userId>

      if (linkCode) {
        // Link this chat to the user
        await supabaseAdmin.from("telegram_links").upsert(
          {
            user_id: linkCode,
            chat_id: chatId,
            username: message.from?.username || null,
          },
          { onConflict: "chat_id" }
        );
        await sendTelegramMessage(
          chatId,
          "Linked! You can now send messages like:\n\n" +
            '"Math test for Noam on Mar 10 8:00"\n' +
            '"Soccer practice every Tue 16:00"\n' +
            '"Gym tomorrow 19:00"\n\n' +
            "I'll add them to your Family Calendar."
        );
      } else {
        await sendTelegramMessage(
          chatId,
          "Welcome! To link your account, go to Settings in the Family Scheduler app and click 'Link Telegram'."
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ── Deduplicate ─────────────────────────────
    const { data: existing } = await supabaseAdmin
      .from("inbox_messages")
      .select("id")
      .eq("channel", "telegram")
      .eq("external_id", messageId)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ ok: true, dedup: true });
    }

    // ── Find the user linked to this chat ───────
    const { data: link } = await supabaseAdmin
      .from("telegram_links")
      .select("user_id")
      .eq("chat_id", chatId)
      .limit(1)
      .single();

    if (!link) {
      await sendTelegramMessage(
        chatId,
        "I don't know who you are yet. Please link your account first in the Family Scheduler app settings."
      );
      return NextResponse.json({ ok: true });
    }

    // Get user + family
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, family_id, google_access_token, google_refresh_token")
      .eq("id", link.user_id)
      .single();

    if (!user || !user.family_id) {
      await sendTelegramMessage(chatId, "Your account isn't set up yet. Please complete the setup wizard in the app.");
      return NextResponse.json({ ok: true });
    }

    // Get family member names for parser
    const { data: members } = await supabaseAdmin
      .from("family_members")
      .select("id, display_name")
      .eq("family_id", user.family_id);

    const personNames = (members || []).map((m) => m.display_name);

    // ── Parse message ───────────────────────────
    const parsed = parseMessage(text, personNames);
    if (!parsed) {
      await sendTelegramMessage(chatId, "Sorry, I couldn't understand that. Try something like:\n\"Math test for Noam on Mar 10 8:00\"");
      return NextResponse.json({ ok: true });
    }

    // Find person_id
    let personId: string | null = null;
    if (parsed.person && members) {
      const match = members.find(
        (m) => m.display_name.toLowerCase() === parsed.person!.toLowerCase()
      );
      if (match) personId = match.id;
    }

    // ── Create Google Calendar event ────────────
    let googleEventId: string | null = null;
    if (user.google_access_token && user.google_refresh_token) {
      try {
        const calId = await ensureFamilyCalendar(
          user.google_access_token,
          user.google_refresh_token
        );
        const gEvent = await createGoogleEvent(
          user.google_access_token,
          user.google_refresh_token,
          calId,
          {
            title: parsed.title,
            start: parsed.start,
            end: parsed.end,
            allDay: parsed.all_day,
            recurrence: parsed.rrule ? [parsed.rrule] : undefined,
          }
        );
        googleEventId = gEvent.id || null;
      } catch (e) {
        console.error("[Telegram] Google Calendar error:", e);
      }
    }

    // ── Store event in DB ───────────────────────
    const { data: event } = await supabaseAdmin
      .from("events")
      .insert({
        family_id: user.family_id,
        google_event_id: googleEventId,
        title: parsed.title,
        start_time: parsed.start.toISOString(),
        end_time: parsed.end.toISOString(),
        all_day: parsed.all_day,
        rrule: parsed.rrule || null,
        person_id: personId,
        category: parsed.category,
        priority: "medium",
        created_from: "telegram",
        source_message_id: messageId,
      })
      .select("id")
      .single();

    // ── Log inbox message ───────────────────────
    await supabaseAdmin.from("inbox_messages").insert({
      channel: "telegram",
      external_id: messageId,
      chat_id: chatId,
      raw_text: text,
      parsed_json: parsed as unknown as Record<string, unknown>,
      event_id: event?.id || null,
    });

    // ── Reply ───────────────────────────────────
    const { format } = await import("date-fns");
    const dateStr = parsed.all_day
      ? format(parsed.start, "EEE, MMM d")
      : format(parsed.start, "EEE, MMM d 'at' h:mm a");

    let reply = `Added: *${parsed.title}*\n${dateStr}`;
    if (parsed.person) reply += `\nFor: ${parsed.person}`;
    if (parsed.rrule) reply += `\n(Recurring)`;

    await sendTelegramMessage(chatId, reply);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Telegram Webhook] Error:", error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}

async function sendTelegramMessage(chatId: string, text: string) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
  } catch (e) {
    console.error("[Telegram] Send message failed:", e);
  }
}
