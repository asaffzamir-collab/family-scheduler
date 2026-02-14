import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM || "Family Scheduler <onboarding@resend.dev>";

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send a single email via Resend.
 */
export async function sendEmail(payload: EmailPayload) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    if (error) {
      console.error("[Email] Send failed:", error);
      return { success: false, error };
    }
    console.log("[Email] Sent:", data?.id);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error("[Email] Exception:", err);
    return { success: false, error: err };
  }
}

/**
 * Build a reminder email body.
 */
export function buildReminderHtml(
  eventTitle: string,
  eventDate: string,
  person: string | null,
  category: string,
  appUrl: string
): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Reminder</h2>
      <p style="font-size: 18px; margin: 8px 0;"><strong>${eventTitle}</strong></p>
      <p style="color: #555;">${eventDate}</p>
      ${person ? `<p>For: <strong>${person}</strong></p>` : ""}
      <p>Category: <span style="text-transform: capitalize;">${category}</span></p>
      <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <a href="${appUrl}" style="color: #2563eb;">Open Family Scheduler</a>
    </div>
  `;
}

/**
 * Build a daily summary email body.
 */
export function buildSummaryHtml(
  userName: string,
  todayEvents: { title: string; time: string; person: string | null }[],
  tomorrowEvents: { title: string; time: string; person: string | null }[],
  upcomingTests: { title: string; date: string; person: string | null }[],
  appUrl: string
): string {
  const eventRow = (e: { title: string; time: string; person: string | null }) =>
    `<li><strong>${e.title}</strong> — ${e.time}${e.person ? ` (${e.person})` : ""}</li>`;

  return `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Good morning, ${userName}!</h2>
      
      <h3>Today</h3>
      ${todayEvents.length ? `<ul>${todayEvents.map(eventRow).join("")}</ul>` : "<p style='color:#888;'>Nothing scheduled</p>"}
      
      <h3>Tomorrow</h3>
      ${tomorrowEvents.length ? `<ul>${tomorrowEvents.map(eventRow).join("")}</ul>` : "<p style='color:#888;'>Nothing scheduled</p>"}
      
      ${
        upcomingTests.length
          ? `<h3>Tests in the next 7 days</h3>
             <ul>${upcomingTests.map((t) => `<li><strong>${t.title}</strong> — ${t.date}${t.person ? ` (${t.person})` : ""}</li>`).join("")}</ul>`
          : ""
      }
      
      <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <a href="${appUrl}" style="color: #2563eb;">Open Family Scheduler</a>
    </div>
  `;
}
