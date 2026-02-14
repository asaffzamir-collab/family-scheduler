"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format, addHours, startOfHour } from "date-fns";
import { Zap, Calendar, AlertTriangle } from "lucide-react";

interface FamilyMember {
  id: string;
  display_name: string;
  role: string;
}

export default function CapturePage() {
  const router = useRouter();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [quickText, setQuickText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [conflicts, setConflicts] = useState<{ id: string; title: string }[]>(
    []
  );
  const [success, setSuccess] = useState("");

  // Form fields
  const defaultStart = startOfHour(addHours(new Date(), 1));
  const [title, setTitle] = useState("");
  const [personId, setPersonId] = useState("");
  const [category, setCategory] = useState("other");
  const [startDate, setStartDate] = useState(
    format(defaultStart, "yyyy-MM-dd")
  );
  const [startTime, setStartTime] = useState(format(defaultStart, "HH:mm"));
  const [endTime, setEndTime] = useState(
    format(addHours(defaultStart, 1), "HH:mm")
  );
  const [allDay, setAllDay] = useState(false);
  const [recurrence, setRecurrence] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("medium");

  useEffect(() => {
    fetch("/api/family/members")
      .then((r) => r.json())
      .then((d) => setMembers(d.members || []));
  }, []);

  // ── Quick-add via natural language ────────
  async function handleQuickAdd() {
    if (!quickText.trim()) return;
    setSubmitting(true);
    setConflicts([]);
    setSuccess("");

    // Parse on the server (or we could call the parser client-side)
    // For simplicity, we POST the raw text and let the API parse it
    try {
      const res = await fetch("/api/calendar/quick-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: quickText }),
      });
      const data = await res.json();
      if (data.event) {
        setSuccess(`Added: ${data.event.title}`);
        setQuickText("");
        if (data.conflicts?.length) setConflicts(data.conflicts);
      } else {
        setSuccess("Could not parse. Try the form below.");
      }
    } catch {
      setSuccess("Error adding event.");
    }
    setSubmitting(false);
  }

  // ── Form submit ───────────────────────────
  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setConflicts([]);
    setSuccess("");

    const startISO = allDay
      ? new Date(`${startDate}T00:00:00`).toISOString()
      : new Date(`${startDate}T${startTime}`).toISOString();
    const endISO = allDay
      ? new Date(`${startDate}T23:59:59`).toISOString()
      : new Date(`${startDate}T${endTime}`).toISOString();

    try {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          start_time: startISO,
          end_time: endISO,
          all_day: allDay,
          person_id: personId || null,
          category,
          priority,
          notes: notes || null,
          rrule: recurrence || null,
        }),
      });
      const data = await res.json();
      if (data.event) {
        setSuccess(`Added: ${data.event.title}`);
        setTitle("");
        setNotes("");
        if (data.conflicts?.length) setConflicts(data.conflicts);
      }
    } catch {
      setSuccess("Error creating event.");
    }
    setSubmitting(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Add Event</h1>

      {/* Quick-add */}
      <div className="card mb-6">
        <h2 className="font-semibold mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          Quick Add (type naturally)
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Examples: &quot;Math test for Noam on Mar 10 8:00&quot; &middot;
          &quot;Soccer every Tue 16:00&quot; &middot; &quot;Gym tomorrow
          19:00&quot;
        </p>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Type event details..."
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
          />
          <button
            className="btn btn-primary"
            onClick={handleQuickAdd}
            disabled={submitting}
          >
            Add
          </button>
        </div>
      </div>

      {/* Success / Conflict messages */}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">
          {success}
        </div>
      )}
      {conflicts.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <div>
            <strong>Schedule conflict detected!</strong>
            <ul className="mt-1">
              {conflicts.map((c) => (
                <li key={c.id}>Overlaps with: {c.title}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Full form */}
      <div className="card">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          Event Details
        </h2>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input
              className="input"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Math test"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Person</label>
              <select
                className="input"
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
              >
                <option value="">None</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name} ({m.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="test">Test / Exam</option>
                <option value="class">Class / Lesson</option>
                <option value="personal">Personal</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="rounded"
              />
              All day
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Date *</label>
              <input
                type="date"
                className="input"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            {!allDay && (
              <>
                <div>
                  <label className="label">Start time</label>
                  <input
                    type="time"
                    className="input"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">End time</label>
                  <input
                    type="time"
                    className="input"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Repeat</label>
              <select
                className="input"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
              >
                <option value="">No repeat</option>
                <option value="RRULE:FREQ=DAILY">Every day</option>
                <option value="RRULE:FREQ=WEEKLY">Every week</option>
                <option value="RRULE:FREQ=MONTHLY">Every month</option>
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select
                className="input"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any extra details..."
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={submitting}
          >
            {submitting ? "Adding..." : "Add Event"}
          </button>
        </form>
      </div>
    </div>
  );
}
