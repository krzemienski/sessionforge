"use client";

import { useParams } from "next/navigation";
import { PublishQueue } from "@/components/scheduling/publish-queue";

export default function SchedulePage() {
  const { workspace } = useParams<{ workspace: string }>();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display">Publish Queue</h1>
        <p className="text-sm text-sf-text-secondary mt-1">
          Manage your scheduled posts
        </p>
      </div>

      <PublishQueue workspace={workspace} />
    </div>
  );
}
