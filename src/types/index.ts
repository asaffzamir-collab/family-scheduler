// ─── Data types matching our Supabase schema ───

export interface Family {
  id: string;
  name: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  family_id: string | null;
  google_access_token: string | null;
  google_refresh_token: string | null;
  timezone: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string | null;       // null for kids
  role: "adult" | "kid";
  display_name: string;
  created_at: string;
}

export type EventCategory = "test" | "class" | "personal" | "other";
export type EventSource = "manual" | "telegram" | "whatsapp" | "email";

export interface CalendarEvent {
  id: string;
  family_id: string;
  google_event_id: string | null;
  calendar_id: string | null;
  title: string;
  start_time: string;           // ISO datetime
  end_time: string;             // ISO datetime
  all_day: boolean;
  rrule: string | null;
  person_id: string | null;     // family_member id
  category: EventCategory;
  priority: "low" | "medium" | "high";
  notes: string | null;
  created_from: EventSource;
  source_message_id: string | null;
  conflict_flag: boolean;
  created_at: string;
}

export interface ReminderRule {
  id: string;
  family_id: string;
  category: EventCategory;
  offsets: ReminderOffset[];    // stored as JSONB
}

export interface ReminderOffset {
  value: number;
  unit: "minutes" | "hours" | "days";
  label?: string;               // e.g. "morning-of"
}

export interface NotificationLog {
  id: string;
  event_id: string;
  offset_key: string;           // e.g. "7d" — dedup key
  channel: "email" | "push" | "telegram";
  user_id: string;
  sent_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}

export interface InboxMessage {
  id: string;
  channel: "telegram" | "whatsapp" | "email";
  external_id: string;
  chat_id: string | null;
  raw_text: string;
  parsed_json: Record<string, unknown> | null;
  event_id: string | null;
  created_at: string;
}

export interface UserCalendar {
  id: string;
  user_id: string;
  google_calendar_id: string;
  name: string;
  role: "read" | "write";
  selected_for_sync: boolean;
  created_at: string;
}

// ─── Parser output ───

export interface ParsedEvent {
  title: string;
  person?: string;
  category: EventCategory;
  start: Date;
  end: Date;
  all_day: boolean;
  rrule?: string;
}
