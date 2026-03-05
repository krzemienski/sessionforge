"use client";

import { useParams } from "next/navigation";
import { CalendarView } from "@/components/scheduling/calendar-view";

export default function CalendarPage() {
  const { workspace } = useParams<{ workspace: string }>();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display">Content Calendar</h1>
        <p className="text-sm text-sf-text-secondary mt-1">
          View your scheduled and published posts on a calendar
        </p>
      </div>

      <CalendarView workspace={workspace} />
    </div>
  );
}
