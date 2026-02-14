"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  Bell,
  Calendar,
  MessageSquare,
  Users,
  Plus,
  Trash2,
  Send,
  Smartphone,
  Check,
  ExternalLink,
} from "lucide-react";

interface FamilyMember {
  id: string;
  display_name: string;
  role: string;
}

interface GoogleCalendar {
  id: string;
  summary: string;
  primary: boolean;
  account?: string;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  // Key = "account|calendarId" so work and main "primary" are distinct
  const [selectedCals, setSelectedCals] = useState<Set<string>>(new Set());
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"kid" | "adult">("kid");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushStatus, setPushStatus] = useState("");
  const [testEventStatus, setTestEventStatus] = useState("");
  const [testPushStatus, setTestPushStatus] = useState("");
  const [calSyncStatus, setCalSyncStatus] = useState("");
  const [pullStatus, setPullStatus] = useState("");
  const [pulling, setPulling] = useState(false);
  const [whatsappLinked, setWhatsappLinked] = useState<boolean | null>(null);
  const [whatsappCode, setWhatsappCode] = useState<string | null>(null);
  const [whatsappCodeLoading, setWhatsappCodeLoading] = useState(false);

  // Fetch data and pre-load saved calendar selection (re-run when session is available so keys match)
  useEffect(() => {
    fetch("/api/family/members")
      .then((r) => r.json())
      .then((d) => setMembers(d.members || []));

    Promise.all([
      fetch("/api/calendar/list").then((r) => r.json()),
      fetch("/api/calendar/selection").then((r) => r.json()),
    ]).then(([listRes, selRes]) => {
      const calList = listRes.calendars || [];
      const selection = selRes.selection || [];
      setCalendars(calList);
      // Pre-check calendars that are already saved (main = null in API, use session email for key)
      const mainEmail = session?.user?.email ?? "main";
      const savedKeys = new Set<string>(
        selection.map(
          (s: { google_calendar_id: string; account_email: string | null }) =>
            `${s.account_email ?? mainEmail}-${s.google_calendar_id}`
        )
      );
      setSelectedCals(savedKeys);
    });

    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setPushEnabled(!!sub);
        });
      });
    }

    fetch("/api/auth/whatsapp/status")
      .then((r) => r.json())
      .then((d) => setWhatsappLinked(d.linked === true));
  }, [session?.user?.email]);

  // ── Family Members ────────────────────────
  async function addMember() {
    if (!newMemberName.trim()) return;
    const res = await fetch("/api/family/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: newMemberName,
        role: newMemberRole,
      }),
    });
    const data = await res.json();
    if (data.member) {
      setMembers([...members, data.member]);
      setNewMemberName("");
    }
  }

  async function removeMember(id: string) {
    await fetch(`/api/family/members?id=${id}`, { method: "DELETE" });
    setMembers(members.filter((m) => m.id !== id));
  }

  function calKey(cal: GoogleCalendar) {
    return `${cal.account ?? session?.user?.email ?? "main"}-${cal.id}`;
  }

  // ── Calendar Sync ─────────────────────────
  async function syncCalendars() {
    setCalSyncStatus("Syncing...");
    const selected = calendars
      .filter((c) => selectedCals.has(calKey(c)))
      .map((c) => ({ id: c.id, name: c.summary, account: c.account ?? null }));

    const res = await fetch("/api/calendar/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedCalendarIds: selected }),
    });
    const data = await res.json();
    setCalSyncStatus(data.success ? "Calendars saved! Click \"Sync from Google\" below to load events." : "Save failed");
  }

  async function generateWhatsAppCode() {
    setWhatsappCodeLoading(true);
    setWhatsappCode(null);
    try {
      const res = await fetch("/api/auth/whatsapp/code", { method: "POST" });
      const data = await res.json();
      if (data.code) setWhatsappCode(data.code);
    } finally {
      setWhatsappCodeLoading(false);
    }
  }

  async function pullFromGoogle() {
    setPullStatus("Syncing events...");
    setPulling(true);
    try {
      const res = await fetch("/api/calendar/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 30 }),
      });
      const data = await res.json();
      if (data.error) {
        setPullStatus(data.error);
      } else if (data.synced > 0) {
        setPullStatus(`Synced ${data.synced} events. Check your Dashboard.`);
      } else {
        setPullStatus(data.message || "No new events. You're up to date.");
      }
    } catch {
      setPullStatus("Sync failed. Try again.");
    }
    setPulling(false);
  }

  // ── Test Event ────────────────────────────
  async function createTestEvent() {
    setTestEventStatus("Creating...");
    const res = await fetch("/api/calendar/test-event", { method: "POST" });
    const data = await res.json();
    if (data.eventLink) {
      setTestEventStatus("Test event created! Check your Google Calendar.");
    } else {
      setTestEventStatus("Failed: " + (data.error || "Unknown error"));
    }
  }

  // ── Push Notifications ────────────────────
  async function enablePush() {
    setPushStatus("Setting up...");
    try {
      // Register service worker
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Subscribe
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      const subJson = sub.toJSON();

      // Send to server
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          userAgent: navigator.userAgent,
        }),
      });

      setPushEnabled(true);
      setPushStatus("Phone notifications enabled!");
    } catch (err) {
      console.error("Push subscription error:", err);
      setPushStatus(
        "Failed. Make sure you allowed notifications. On iPhone, you must first 'Add to Home Screen'."
      );
    }
  }

  async function testPush() {
    setTestPushStatus("Sending...");
    const res = await fetch("/api/push/test", { method: "POST" });
    const data = await res.json();
    setTestPushStatus(
      data.success ? "Test notification sent!" : data.error || "Failed"
    );
  }

  // ── Telegram Link ─────────────────────────
  const telegramBotLink = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
    ? `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}?start=${session?.user?.id}`
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-500">
          Manage your family, calendars, and notifications
        </p>
      </div>

      {/* ── Family Members ── */}
      <section className="card">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" />
          Family Members
        </h2>
        <div className="space-y-2 mb-4">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
            >
              <div>
                <span className="text-sm font-medium">{m.display_name}</span>
                <span className="text-xs text-gray-400 ml-2">({m.role})</span>
              </div>
              <button
                onClick={() => removeMember(m.id)}
                className="text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Name (e.g. Noam)"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
          />
          <select
            className="input w-24"
            value={newMemberRole}
            onChange={(e) => setNewMemberRole(e.target.value as "kid" | "adult")}
          >
            <option value="kid">Kid</option>
            <option value="adult">Adult</option>
          </select>
          <button onClick={addMember} className="btn btn-primary btn-sm">
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </section>

      {/* ── Calendars ── */}
      <section className="card">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-green-600" />
          Google Calendars
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Select which calendars to read (including from your linked work account).
          Then click <strong>Save Calendar Selection</strong>. After that, go to the Dashboard and click <strong>Sync from Google</strong> to load events into the app.
        </p>

        {/* Link another Google account */}
        <div className="p-3 bg-amber-50 rounded-lg mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Have a work calendar on a different Google account?</div>
              <div className="text-xs text-gray-500">Link it to see those calendars here too.</div>
            </div>
            <a
              href="/api/auth/link"
              className="btn btn-secondary btn-sm"
            >
              <Plus className="w-4 h-4" />
              Link Work Account
            </a>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {calendars.map((cal) => (
            <label
              key={calKey(cal)}
              className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedCals.has(calKey(cal))}
                onChange={(e) => {
                  const next = new Set(selectedCals);
                  const key = calKey(cal);
                  e.target.checked ? next.add(key) : next.delete(key);
                  setSelectedCals(next);
                }}
                className="rounded"
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm">
                  {cal.summary}
                  {cal.primary && (
                    <span className="text-xs text-gray-400 ml-1">(primary)</span>
                  )}
                </span>
                {cal.account && (
                  <span className="text-xs text-gray-400 ml-2">{cal.account}</span>
                )}
              </div>
            </label>
          ))}
          {calendars.length === 0 && (
            <p className="text-sm text-gray-400">Loading calendars...</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={syncCalendars} className="btn btn-primary btn-sm">
            Save Calendar Selection
          </button>
          <button
            onClick={pullFromGoogle}
            disabled={pulling}
            className="btn btn-secondary btn-sm"
          >
            {pulling ? "Syncing…" : "Sync from Google"}
          </button>
          <button onClick={createTestEvent} className="btn btn-secondary btn-sm">
            Create Test Event
          </button>
        </div>
        {calSyncStatus && (
          <p className="text-xs text-green-600 mt-2">{calSyncStatus}</p>
        )}
        {pullStatus && (
          <p className="text-xs text-blue-600 mt-2">{pullStatus}</p>
        )}
        {testEventStatus && (
          <p className="text-xs text-blue-600 mt-2">{testEventStatus}</p>
        )}
      </section>

      {/* ── Phone Notifications ── */}
      <section className="card">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-purple-600" />
          Phone Notifications
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Get reminders on your phone. On iPhone: first tap &quot;Share &gt; Add to
          Home Screen&quot;, then open the app from there and enable notifications.
        </p>
        {pushEnabled ? (
          <div className="flex items-center gap-2 mb-3">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700">
              Notifications are enabled
            </span>
          </div>
        ) : (
          <button onClick={enablePush} className="btn btn-primary btn-sm mb-3">
            <Bell className="w-4 h-4" />
            Enable Phone Notifications
          </button>
        )}
        <button onClick={testPush} className="btn btn-secondary btn-sm">
          <Send className="w-4 h-4" />
          Send Test Notification
        </button>
        {pushStatus && (
          <p className="text-xs text-blue-600 mt-2">{pushStatus}</p>
        )}
        {testPushStatus && (
          <p className="text-xs text-green-600 mt-2">{testPushStatus}</p>
        )}
      </section>

      {/* ── Messaging Channels ── */}
      <section className="card">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-green-600" />
          Messaging Channels
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Send a message to add events to your calendar instantly.
        </p>

        {/* Telegram */}
        <div className="p-3 bg-blue-50 rounded-lg mb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">
                Telegram (free, easiest)
              </div>
              <div className="text-xs text-gray-500">
                Send a message to our bot to add events
              </div>
            </div>
            {telegramBotLink ? (
              <a
                href={telegramBotLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
              >
                Link Telegram
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-xs text-gray-400">
                Bot not configured yet
              </span>
            )}
          </div>
          {!telegramBotLink && (
            <p className="text-xs text-gray-500 mt-2">
              To set up: open Settings, get the Telegram link, and send /start to the bot.
              The link will include your user ID to connect your account.
            </p>
          )}
        </div>

        {/* WhatsApp */}
        <div className="p-3 bg-green-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">
                WhatsApp — add events by texting
              </div>
              <div className="text-xs text-gray-500">
                Send simple messages to add events to the shared calendar
              </div>
            </div>
            {whatsappLinked ? (
              <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                <Check className="w-4 h-4" /> Linked
              </span>
            ) : (
              <span className="badge badge-other">Link required</span>
            )}
          </div>
          {!whatsappLinked && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-gray-600">
                1. Click &quot;Get link code&quot; below.<br />
                2. Send that 6-digit code in a WhatsApp message to our business number.<br />
                3. You&apos;ll be linked. Then send things like &quot;Gym tomorrow 7pm&quot; or &quot;Math test for Noam on Mar 10 8:00&quot;.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={generateWhatsAppCode}
                  disabled={whatsappCodeLoading}
                  className="btn btn-primary btn-sm"
                >
                  {whatsappCodeLoading ? "Generating…" : "Get link code"}
                </button>
                {whatsappCode && (
                  <span className="font-mono text-lg font-bold tracking-widest text-gray-800 bg-white px-3 py-1.5 rounded border border-green-200">
                    {whatsappCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Code expires in 15 minutes. Send it to our WhatsApp number (see README for setup).
              </p>
            </div>
          )}
          {whatsappLinked && (
            <p className="text-xs text-gray-600 mt-2">
              Send a message like: &quot;Dentist next Tuesday 10am&quot; or &quot;Soccer every Wed 4pm&quot; to add events.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
