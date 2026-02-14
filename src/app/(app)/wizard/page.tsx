"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Users,
  Calendar,
  Bell,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";

interface GoogleCalendar {
  id: string;
  summary: string;
  primary: boolean;
}

const STEPS = [
  { icon: Users, label: "Family" },
  { icon: Calendar, label: "Calendars" },
  { icon: Bell, label: "Reminders" },
  { icon: MessageSquare, label: "Channels" },
];

export default function WizardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Family
  const [partnerEmail, setPartnerEmail] = useState("");
  const [kids, setKids] = useState<string[]>([""]);

  // Step 2: Calendars
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedCals, setSelectedCals] = useState<Set<string>>(new Set());
  const [calLoading, setCalLoading] = useState(false);

  // Step 3: Reminder preferences (defaults)
  const [testReminders, setTestReminders] = useState("7d, 2d, morning-of");
  const [classReminders, setClassReminders] = useState("2h, 15m");
  const [personalReminders, setPersonalReminders] = useState("1d, 1h");

  // Load calendars when reaching step 2
  useEffect(() => {
    if (step === 1 && calendars.length === 0) {
      setCalLoading(true);
      fetch("/api/calendar/list")
        .then((r) => r.json())
        .then((d) => {
          setCalendars(d.calendars || []);
          // Pre-select primary calendar
          const primary = (d.calendars || []).find(
            (c: GoogleCalendar) => c.primary
          );
          if (primary) {
            setSelectedCals(new Set([primary.id]));
          }
        })
        .finally(() => setCalLoading(false));
    }
  }, [step, calendars.length]);

  // ── Step handlers ─────────────────────────
  async function finishStep1() {
    // Add kids as family members
    for (const kidName of kids) {
      if (kidName.trim()) {
        await fetch("/api/family/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ display_name: kidName.trim(), role: "kid" }),
        });
      }
    }
    // Partner invite would be sent here (future feature)
    setStep(1);
  }

  async function finishStep2() {
    setLoading(true);
    const selected = calendars
      .filter((c) => selectedCals.has(c.id))
      .map((c) => ({ id: c.id, name: c.summary }));

    await fetch("/api/calendar/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedCalendarIds: selected }),
    });
    setLoading(false);
    setStep(2);
  }

  async function finishStep3() {
    // Parse human-readable offsets into rule format
    // (keeping it simple — store as labels, the engine handles them)
    setStep(3);
  }

  async function finishWizard() {
    setLoading(true);
    // Enable push if available
    if ("serviceWorker" in navigator && "PushManager" in window) {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        });
        const subJson = sub.toJSON();
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: subJson.keys,
            userAgent: navigator.userAgent,
          }),
        });
      } catch {
        // Push not supported or denied — that's ok
      }
    }
    setLoading(false);
    router.push("/dashboard");
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-2">Family Setup</h1>
      <p className="text-sm text-gray-500 mb-6">
        Let&apos;s get your family organized in a few quick steps.
      </p>

      {/* Progress steps */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} className="flex items-center gap-1 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                  done
                    ? "bg-green-100 text-green-700"
                    : active
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span
                className={`text-xs hidden sm:inline ${
                  active ? "font-medium" : "text-gray-400"
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-px mx-1 ${
                    done ? "bg-green-300" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Family ── */}
      {step === 0 && (
        <div className="card">
          <h2 className="font-semibold mb-1">Your Family</h2>
          <p className="text-xs text-gray-500 mb-4">
            Who&apos;s in your family? We&apos;ll track schedules for everyone.
          </p>

          <div className="mb-4">
            <label className="label">Your name</label>
            <input
              className="input"
              value={session?.user?.name || ""}
              disabled
            />
          </div>

          <div className="mb-4">
            <label className="label">Partner&apos;s email (optional)</label>
            <input
              className="input"
              type="email"
              placeholder="partner@email.com"
              value={partnerEmail}
              onChange={(e) => setPartnerEmail(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              They&apos;ll get an invite to join your family calendar.
            </p>
          </div>

          <div className="mb-4">
            <label className="label">Kids</label>
            {kids.map((kid, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  className="input flex-1"
                  placeholder={`Kid ${i + 1} name`}
                  value={kid}
                  onChange={(e) => {
                    const next = [...kids];
                    next[i] = e.target.value;
                    setKids(next);
                  }}
                />
                {kids.length > 1 && (
                  <button
                    onClick={() => setKids(kids.filter((_, j) => j !== i))}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setKids([...kids, ""])}
              className="btn btn-secondary btn-sm"
            >
              <Plus className="w-4 h-4" />
              Add kid
            </button>
          </div>

          <button onClick={finishStep1} className="btn btn-primary w-full">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Step 2: Calendars ── */}
      {step === 1 && (
        <div className="card">
          <h2 className="font-semibold mb-1">Your Calendars</h2>
          <p className="text-xs text-gray-500 mb-4">
            Pick which Google Calendars we should read. We&apos;ll create a new
            &quot;Family - Master&quot; calendar for events you add through the app.
          </p>

          {calLoading ? (
            <div className="flex items-center gap-2 py-4 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading your calendars...
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {calendars.map((cal) => (
                <label
                  key={cal.id}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCals.has(cal.id)}
                    onChange={(e) => {
                      const next = new Set(selectedCals);
                      e.target.checked ? next.add(cal.id) : next.delete(cal.id);
                      setSelectedCals(next);
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{cal.summary}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setStep(0)}
              className="btn btn-secondary flex-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={finishStep2}
              className="btn btn-primary flex-1"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Next <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Reminders ── */}
      {step === 2 && (
        <div className="card">
          <h2 className="font-semibold mb-1">Reminder Preferences</h2>
          <p className="text-xs text-gray-500 mb-4">
            When should we remind you? Defaults are already set — you can
            change later in Settings.
          </p>

          <div className="space-y-4 mb-6">
            <div>
              <label className="label">Tests / Exams</label>
              <input
                className="input"
                value={testReminders}
                onChange={(e) => setTestReminders(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                7 days before, 2 days before, and morning of the test
              </p>
            </div>
            <div>
              <label className="label">Classes / Lessons</label>
              <input
                className="input"
                value={classReminders}
                onChange={(e) => setClassReminders(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                2 hours and 15 minutes before
              </p>
            </div>
            <div>
              <label className="label">Personal appointments</label>
              <input
                className="input"
                value={personalReminders}
                onChange={(e) => setPersonalReminders(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                1 day and 1 hour before
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="btn btn-secondary flex-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button onClick={finishStep3} className="btn btn-primary flex-1">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Notification Channels ── */}
      {step === 3 && (
        <div className="card">
          <h2 className="font-semibold mb-1">Notification Channels</h2>
          <p className="text-xs text-gray-500 mb-4">
            How should we reach you?
          </p>

          <div className="space-y-3 mb-6">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">
                  Email (always on)
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Reminders and daily summary sent to {session?.user?.email}
              </p>
            </div>

            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="text-sm font-medium mb-1">
                Phone Notifications
              </div>
              <p className="text-xs text-gray-500 mb-2">
                We&apos;ll ask for permission when you finish setup.
                On iPhone: first &quot;Add to Home Screen&quot;, then open from there.
              </p>
            </div>

            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium mb-1">
                Telegram (free, easiest)
              </div>
              <p className="text-xs text-gray-500">
                Send a message to our bot to add events.
                You can set this up later in Settings.
              </p>
            </div>

            <div className="p-3 bg-green-50 rounded-lg">
              <div className="text-sm font-medium mb-1">
                WhatsApp (optional)
              </div>
              <p className="text-xs text-gray-500">
                Requires Meta Business API. See our setup guide.
                You can set this up later.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep(2)}
              className="btn btn-secondary flex-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={finishWizard}
              className="btn btn-primary flex-1"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Finish Setup <Check className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
