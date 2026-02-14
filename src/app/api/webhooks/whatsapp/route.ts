import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";
import { parseMessage } from "@/lib/parser";
import { ensureFamilyCalendar, createGoogleEvent } from "@/lib/google-calendar";

const VERIFY_TOKEN = process.env.META_WHATSAPP_VERIFY_TOKEN;

/**
 * WhatsApp webhook verification (GET).
 * Meta sends hub.mode, hub.verify_token, hub.challenge.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[WhatsApp] Webhook verified");
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * WhatsApp webhook handler (POST).
 * Receives incoming messages from WhatsApp Business Cloud API.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Parse WhatsApp webhook payload
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ ok: true });
    }

    for (const msg of messages) {
      if (msg.type !== "text") continue;

      const waMessageId = msg.id;
      const senderPhone = msg.from;
      const text = (msg.text?.body ?? "").trim();

      if (!text) continue;

      // Deduplicate
      const { data: existing } = await supabaseAdmin
        .from("inbox_messages")
        .select("id")
        .eq("channel", "whatsapp")
        .eq("external_id", waMessageId)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // ── Link code: user sends 6-digit code (or "link 123456") to link their number ──
      const codeMatch = text.match(/^(?:link\s+)?(\d{6})$/i);
      if (codeMatch) {
        const code = codeMatch[1];
        const { data: codeRow } = await supabaseAdmin
          .from("whatsapp_link_codes")
          .select("user_id")
          .eq("code", code)
          .gt("expires_at", new Date().toISOString())
          .limit(1)
          .single();

        if (codeRow) {
          await supabaseAdmin.from("whatsapp_links").upsert(
            { user_id: codeRow.user_id, phone_number: senderPhone },
            { onConflict: "phone_number" }
          );
          await supabaseAdmin.from("whatsapp_link_codes").delete().eq("code", code);
          await sendWhatsAppReply(
            senderPhone,
            "Linked! You can now add events by sending messages like:\n\n" +
              '"Math test for Noam on Mar 10 8:00"\n' +
              '"Gym tomorrow 19:00"\n' +
              '"Soccer practice every Tue 16:00"\n\n' +
              "I'll add them to your Family Calendar."
          );
        } else {
          await sendWhatsAppReply(
            senderPhone,
            "That code is invalid or expired. In the app go to Settings → WhatsApp and generate a new code, then send it here within 15 minutes."
          );
        }
        continue;
      }

      // ── Find user by linked phone ──
      const { data: link } = await supabaseAdmin
        .from("whatsapp_links")
        .select("user_id")
        .eq("phone_number", senderPhone)
        .limit(1)
        .single();

      if (!link) {
        await sendWhatsAppReply(
          senderPhone,
          "To add events, link your account first.\n\nIn the Family Scheduler app: go to Settings → Messaging Channels → WhatsApp. Copy the 6-digit code and send it here."
        );
        continue;
      }

      const { data: user } = await supabaseAdmin
        .from("users")
        .select("id, family_id, google_access_token, google_refresh_token")
        .eq("id", link.user_id)
        .single();

      if (!user || !user.family_id) continue;

      // Get family members for parser
      const { data: members } = await supabaseAdmin
        .from("family_members")
        .select("id, display_name")
        .eq("family_id", user.family_id);

      const personNames = (members || []).map((m) => m.display_name);

      // Parse message
      const parsed = parseMessage(text, personNames);
      if (!parsed) {
        await sendWhatsAppReply(
          senderPhone,
          "Sorry, I couldn't understand that. Try:\n\"Math test for Noam on Mar 10 8:00\""
        );
        continue;
      }

      // Find person_id
      let personId: string | null = null;
      if (parsed.person && members) {
        const match = members.find(
          (m) => m.display_name.toLowerCase() === parsed.person!.toLowerCase()
        );
        if (match) personId = match.id;
      }

      // Create Google Calendar event
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
          console.error("[WhatsApp] Google Calendar error:", e);
        }
      }

      // Store event
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
          created_from: "whatsapp",
          source_message_id: waMessageId,
        })
        .select("id")
        .single();

      // Log
      await supabaseAdmin.from("inbox_messages").insert({
        channel: "whatsapp",
        external_id: waMessageId,
        chat_id: senderPhone,
        raw_text: text,
        parsed_json: parsed as unknown as Record<string, unknown>,
        event_id: event?.id || null,
      });

      // Reply
      const { format } = await import("date-fns");
      const dateStr = parsed.all_day
        ? format(parsed.start, "EEE, MMM d")
        : format(parsed.start, "EEE, MMM d 'at' h:mm a");

      let reply = `Added: ${parsed.title}\n${dateStr}`;
      if (parsed.person) reply += `\nFor: ${parsed.person}`;

      await sendWhatsAppReply(senderPhone, reply);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[WhatsApp Webhook] Error:", error);
    return NextResponse.json({ ok: true });
  }
}

async function sendWhatsAppReply(to: string, text: string) {
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return;

  try {
    await fetch(
      `https://graph.facebook.com/v18.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
      }
    );
  } catch (e) {
    console.error("[WhatsApp] Reply failed:", e);
  }
}
