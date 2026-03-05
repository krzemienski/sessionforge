"use client";

import { useParams } from "next/navigation";
import { PublishQueue } from "@/components/scheduling/publish-queue";
import { RecentActivity } from "@/components/scheduling/recent-activity";
import { useScheduledPosts } from "@/hooks/use-schedule";

export default function SchedulePage() {
  const { workspace } = useParams<{ workspace: string }>();
  const { data } = useScheduledPosts(workspace);
  const recentActivity = data?.recentActivity ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display">Publish Queue</h1>
        <p className="text-sm text-sf-text-secondary mt-1">
          Manage your scheduled posts
        </p>
      </div>

      <PublishQueue workspace={workspace} />

      <RecentActivity items={recentActivity} />
    </div>
  );
}
