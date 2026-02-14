import { google, calendar_v3 } from "googleapis";

/**
 * Create an authenticated Google Calendar client from stored tokens.
 */
export function getCalendarClient(accessToken: string, refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  // Auto-refresh: listen for new tokens
  oauth2Client.on("tokens", (tokens) => {
    if (tokens.access_token) {
      // In a real scenario we'd update the DB here.
      // The caller should handle token refresh persistence.
      console.log("[GoogleCal] Token refreshed");
    }
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

/**
 * List all calendars for a user.
 */
export async function listCalendars(
  accessToken: string,
  refreshToken: string
): Promise<calendar_v3.Schema$CalendarListEntry[]> {
  const cal = getCalendarClient(accessToken, refreshToken);
  const res = await cal.calendarList.list();
  return res.data.items || [];
}

/**
 * List events in a date range.
 */
export async function listEvents(
  accessToken: string,
  refreshToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<calendar_v3.Schema$Event[]> {
  const cal = getCalendarClient(accessToken, refreshToken);
  const res = await cal.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });
  return res.data.items || [];
}

/**
 * Create a Google Calendar event.
 * Returns the created event (with id, htmlLink, etc.)
 */
export async function createGoogleEvent(
  accessToken: string,
  refreshToken: string,
  calendarId: string,
  event: {
    title: string;
    start: Date;
    end: Date;
    allDay: boolean;
    description?: string;
    recurrence?: string[];
  }
): Promise<calendar_v3.Schema$Event> {
  const cal = getCalendarClient(accessToken, refreshToken);

  const body: calendar_v3.Schema$Event = {
    summary: event.title,
    description: event.description,
    recurrence: event.recurrence,
  };

  if (event.allDay) {
    const dateStr = event.start.toISOString().split("T")[0];
    const endStr = event.end.toISOString().split("T")[0];
    body.start = { date: dateStr };
    body.end = { date: endStr };
  } else {
    body.start = { dateTime: event.start.toISOString() };
    body.end = { dateTime: event.end.toISOString() };
  }

  const res = await cal.events.insert({
    calendarId,
    requestBody: body,
  });

  return res.data;
}

/**
 * Find or create the "Family - Master" calendar.
 * Returns the calendar ID.
 */
export async function ensureFamilyCalendar(
  accessToken: string,
  refreshToken: string
): Promise<string> {
  const cal = getCalendarClient(accessToken, refreshToken);
  const list = await cal.calendarList.list();
  const existing = (list.data.items || []).find(
    (c) => c.summary === "Family - Master"
  );
  if (existing?.id) return existing.id;

  // Create it
  const res = await cal.calendars.insert({
    requestBody: {
      summary: "Family - Master",
      description: "Shared family calendar managed by Family Scheduler",
      timeZone: "Asia/Jerusalem",
    },
  });
  return res.data.id!;
}
