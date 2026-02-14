"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useMemo } from "react";
import {
  format,
  startOfWeek,
  addDays,
  addHours,
  isToday,
  setHours,
  setMinutes,
} from "date-fns";
import {
  Calendar,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  BookOpen,
  Filter,
  RefreshCw,
  Users,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

const CATEGORY_COLORS: Record<string, string> = {
  test: "badge-test",
  class: "badge-class",
  personal: "badge-personal",
  other: "badge-other",
};

const CATEGORY_LABELS: Record<string, string> = {
  test: "Tests",
  class: "Classes",
  personal: "Personal",
  other: "Other",
};

interface EventData {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  category: string;
  priority: string;
  conflict_flag: boolean;
  person_id: string | null;
  family_members: { id: string; display_name: string } | null;
}

interface FamilyMember {
  id: string;
  display_name: string;
  role: string;
}

interface FreeSlot {
  start: Date;
  end: Date;
  label: string;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<EventData[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [weekStart, setWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [filterPerson, setFilterPerson] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  async function syncFromGoogle() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/calendar/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 30 }),
      });
      const data = await res.json();
      setSyncMsg(
        data.synced > 0
          ? `Synced ${data.synced} new events from Google Calendar`
          : data.message || "Already up to date"
      );
      const params = new URLSearchParams({
        start: weekStart.toISOString(),
        end: weekEnd.toISOString(),
      });
      const evRes = await fetch(`/api/calendar/events?${params}`);
      const evData = await evRes.json();
      setEvents(evData.events || []);
    } catch {
      setSyncMsg("Sync failed. Try again.");
    }
    setSyncing(false);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const params = new URLSearchParams({
        start: weekStart.toISOString(),
        end: weekEnd.toISOString(),
      });
      if (filterCategory) params.set("category", filterCategory);
      if (filterPerson) params.set("person", filterPerson);

      const [evRes, memRes] = await Promise.all([
        fetch(`/api/calendar/events?${params}`),
        fetch("/api/family/members"),
      ]);
      if (cancelled) return;
      const evData = await evRes.json();
      const memData = await memRes.json();
      setEvents(evData.events || []);
      setMembers(memData.members || []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [weekStart, weekEnd, filterCategory, filterPerson]);

  const now = new Date();
  const next7d = addDays(now, 7);
  const next48h = addHours(now, 48);

  // Important upcoming: next 7 days, tests first then by date
  const importantUpcoming = useMemo(() => {
    const upcoming = events.filter((e) => {
      const s = new Date(e.start_time);
      return s >= now && s <= next7d;
    });
    return upcoming.sort((a, b) => {
      const aTest = a.category === "test" ? 1 : 0;
      const bTest = b.category === "test" ? 1 : 0;
      if (bTest !== aTest) return bTest - aTest;
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    });
  }, [events, now, next7d]);

  const upcoming48h = events.filter((e) => {
    const s = new Date(e.start_time);
    return s >= now && s <= next48h;
  }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const upcomingTests = events.filter(
    (e) => e.category === "test" && new Date(e.start_time) >= now
  ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const conflictEvents = events.filter((e) => e.conflict_flag);

  // Events by category (for this week's range)
  const byCategory = useMemo(() => {
    const map: Record<string, EventData[]> = { test: [], class: [], personal: [], other: [] };
    for (const e of events) {
      const cat = map[e.category] ?? map.other;
      cat.push(e);
    }
    for (const cat of Object.keys(map)) {
      map[cat].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }
    return map;
  }, [events]);

  // Free time: gaps in the week (family-wide), 6am–10pm, min 1 hour
  const freeSlots = useMemo((): FreeSlot[] => {
    const slots: FreeSlot[] = [];
    const oneHour = 60 * 60 * 1000;
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const rangeStart = setMinutes(setHours(day, 6), 0);
      const rangeEnd = setMinutes(setHours(day, 22), 0);
      const dayEvents = events
        .filter((e) => {
          const es = new Date(e.start_time);
          const ee = new Date(e.end_time);
          return es < rangeEnd && ee > rangeStart;
        })
        .map((e) => ({
          start: new Date(Math.max(new Date(e.start_time).getTime(), rangeStart.getTime())),
          end: new Date(Math.min(new Date(e.end_time).getTime(), rangeEnd.getTime())),
        }))
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      let cursor = rangeStart.getTime();
      for (const ev of dayEvents) {
        const gapStart = ev.start.getTime();
        if (gapStart - cursor >= oneHour) {
          slots.push({
            start: new Date(cursor),
            end: new Date(gapStart),
            label: format(new Date(cursor), "EEE MMM d · h:mm a") + " – " + format(new Date(gapStart), "h:mm a"),
          });
        }
        if (ev.end.getTime() > cursor) cursor = ev.end.getTime();
      }
      if (rangeEnd.getTime() - cursor >= oneHour) {
        slots.push({
          start: new Date(cursor),
          end: rangeEnd,
          label: format(new Date(cursor), "EEE MMM d · h:mm a") + " – " + format(rangeEnd, "h:mm a"),
        });
      }
    }
    return slots.slice(0, 8);
  }, [events, weekStart]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const eventsByDay: Record<string, EventData[]> = {};
  for (const day of days) {
    const key = format(day, "yyyy-MM-dd");
    eventsByDay[key] = events.filter((e) => format(new Date(e.start_time), "yyyy-MM-dd") === key);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Family Dashboard</h1>
          <p className="text-sm text-gray-500">
            Welcome back, {session?.user?.name?.split(" ")[0] || "there"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncFromGoogle}
            disabled={syncing}
            className="btn btn-secondary btn-sm"
            title="Pull events from your Google Calendars"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync"}
          </button>
          <Link href="/capture" className="btn btn-primary">
            + Add Event
          </Link>
        </div>
      </div>

      {syncMsg && (
        <div className="p-3 rounded-lg bg-blue-50 text-blue-700 text-sm">
          {syncMsg}
        </div>
      )}

      {/* Important upcoming — prominent strip */}
      <section className="card border-l-4 border-l-blue-500">
        <h2 className="font-semibold mb-3 flex items-center gap-2 text-gray-900">
          <Sparkles className="w-4 h-4 text-blue-600" />
          Important upcoming
        </h2>
        {importantUpcoming.length === 0 ? (
          <p className="text-sm text-gray-500">No events in the next 7 days</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {importantUpcoming.slice(0, 6).map((ev) => (
              <Link
                key={ev.id}
                href="#week"
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  ev.conflict_flag ? "bg-red-50 border border-red-200" : "bg-gray-50"
                } ${ev.category === "test" ? "ring-1 ring-amber-200" : ""}`}
              >
                <span className={`badge ${CATEGORY_COLORS[ev.category] || "badge-other"}`}>
                  {CATEGORY_LABELS[ev.category]?.slice(0, 1) || "?"}
                </span>
                <span className="font-medium truncate max-w-[140px]">{ev.title}</span>
                <span className="text-gray-500 text-xs whitespace-nowrap">
                  {format(new Date(ev.start_time), "EEE MMM d")}
                  {!ev.all_day && ` · ${format(new Date(ev.start_time), "h:mm a")}`}
                </span>
                {ev.family_members && (
                  <span className="text-xs text-gray-400">{ev.family_members.display_name}</span>
                )}
                {ev.conflict_flag && <AlertTriangle className="w-4 h-4 text-red-500" />}
              </Link>
            ))}
            {importantUpcoming.length > 6 && (
              <span className="text-xs text-gray-400 self-center">+{importantUpcoming.length - 6} more</span>
            )}
          </div>
        )}
      </section>

      {/* Conflicts — only when there are any */}
      {conflictEvents.length > 0 && (
        <section className="card border border-red-200 bg-red-50/50">
          <h2 className="font-semibold mb-3 flex items-center gap-2 text-red-800">
            <AlertTriangle className="w-4 h-4" />
            Schedule conflicts
          </h2>
          <p className="text-xs text-red-700 mb-3">
            These events overlap for the same person. Consider rescheduling.
          </p>
          <div className="space-y-2">
            {conflictEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-white border border-red-200"
              >
                <span className={`badge ${CATEGORY_COLORS[ev.category] || "badge-other"}`}>
                  {ev.category}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{ev.title}</div>
                  <div className="text-xs text-gray-500">
                    {format(new Date(ev.start_time), "EEE MMM d, h:mm a")}
                    {ev.family_members ? ` · ${ev.family_members.display_name}` : ""}
                  </div>
                </div>
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* By category */}
      <section>
        <h2 className="font-semibold mb-3 flex items-center gap-2 text-gray-900">
          <Users className="w-4 h-4 text-gray-600" />
          By category
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(["test", "class", "personal", "other"] as const).map((cat) => (
            <div key={cat} className="card">
              <div className="flex items-center justify-between mb-2">
                <span className={`badge ${CATEGORY_COLORS[cat]}`}>
                  {CATEGORY_LABELS[cat]}
                </span>
                <span className="text-sm font-semibold text-gray-600">
                  {byCategory[cat]?.length ?? 0}
                </span>
              </div>
              <div className="space-y-1.5 min-h-[60px]">
                {(byCategory[cat] ?? []).slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    className="text-xs p-2 rounded bg-gray-50 truncate"
                    title={ev.title}
                  >
                    <span className="font-medium">{ev.title}</span>
                    <span className="text-gray-400 ml-1">
                      {format(new Date(ev.start_time), "EEE h:mm a")}
                    </span>
                  </div>
                ))}
                {(byCategory[cat]?.length ?? 0) === 0 && (
                  <p className="text-xs text-gray-400">None this week</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Free time */}
      {freeSlots.length > 0 && (
        <section className="card bg-green-50/50 border border-green-200">
          <h2 className="font-semibold mb-3 flex items-center gap-2 text-green-800">
            <Clock className="w-4 h-4 text-green-600" />
            Free time this week
          </h2>
          <p className="text-xs text-green-700 mb-3">
            Gaps of at least 1 hour (6am–10pm) with no family events.
          </p>
          <div className="flex flex-wrap gap-2">
            {freeSlots.map((slot, i) => (
              <span
                key={i}
                className="inline-block px-3 py-1.5 rounded-lg bg-white border border-green-200 text-sm text-gray-700"
              >
                {slot.label}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Week navigation + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="btn btn-secondary btn-sm"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium px-2">
            {format(weekStart, "MMM d")} — {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </span>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="btn btn-secondary btn-sm"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
            className="btn btn-secondary btn-sm ml-1"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            className="input text-xs py-1 w-auto"
            value={filterPerson}
            onChange={(e) => setFilterPerson(e.target.value)}
          >
            <option value="">All people</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
          <select
            className="input text-xs py-1 w-auto"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">All categories</option>
            <option value="test">Tests</option>
            <option value="class">Classes</option>
            <option value="personal">Personal</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Week grid */}
      <div id="week" className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDay[key] || [];
          const today = isToday(day);
          return (
            <div
              key={key}
              className={`bg-white min-h-[160px] p-2 ${today ? "ring-2 ring-blue-500 ring-inset" : ""}`}
            >
              <div
                className={`text-xs font-medium mb-2 ${
                  today ? "text-blue-600" : "text-gray-500"
                }`}
              >
                {format(day, "EEE")}
                <span className={`ml-1 ${today ? "bg-blue-600 text-white rounded-full px-1.5 py-0.5" : ""}`}>
                  {format(day, "d")}
                </span>
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 5).map((ev) => (
                  <div
                    key={ev.id}
                    className={`text-xs p-1.5 rounded truncate ${
                      ev.conflict_flag ? "bg-red-50 border border-red-200" : "bg-gray-50"
                    }`}
                    title={`${ev.title}${ev.family_members ? ` — ${ev.family_members.display_name}` : ""}`}
                  >
                    <span className={`badge ${CATEGORY_COLORS[ev.category] || "badge-other"} mr-1`}>
                      {ev.category.charAt(0).toUpperCase()}
                    </span>
                    <span className="font-medium">{ev.title}</span>
                    {!ev.all_day && (
                      <span className="text-gray-400 ml-1">
                        {format(new Date(ev.start_time), "h:mm a")}
                      </span>
                    )}
                    {ev.conflict_flag && (
                      <AlertTriangle className="w-3 h-3 text-red-500 inline ml-1" />
                    )}
                  </div>
                ))}
                {dayEvents.length > 5 && (
                  <div className="text-xs text-gray-400">+{dayEvents.length - 5} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Next 48h + Upcoming tests */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Next 48 hours
          </h3>
          {upcoming48h.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing coming up</p>
          ) : (
            <div className="space-y-2">
              {upcoming48h.map((ev) => (
                <EventRow key={ev.id} event={ev} />
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-600" />
            Upcoming tests
          </h3>
          {upcomingTests.length === 0 ? (
            <p className="text-sm text-gray-400">No tests scheduled</p>
          ) : (
            <div className="space-y-2">
              {upcomingTests.slice(0, 5).map((ev) => (
                <EventRow key={ev.id} event={ev} showDate />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventRow({
  event,
  showDate,
}: {
  event: EventData;
  showDate?: boolean;
}) {
  const start = new Date(event.start_time);
  const timeStr = event.all_day ? "All day" : format(start, "h:mm a");
  const dateStr = showDate ? format(start, "EEE, MMM d") : "";

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-lg ${
        event.conflict_flag ? "bg-red-50" : "bg-gray-50"
      }`}
    >
      <span className={`badge ${CATEGORY_COLORS[event.category] || "badge-other"}`}>
        {event.category}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{event.title}</div>
        <div className="text-xs text-gray-500">
          {showDate && dateStr ? `${dateStr} · ` : ""}
          {timeStr}
          {event.family_members ? ` · ${event.family_members.display_name}` : ""}
        </div>
      </div>
      {event.conflict_flag && (
        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
      )}
    </div>
  );
}
