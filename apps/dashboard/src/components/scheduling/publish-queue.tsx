"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useScheduledPosts, useCancelSchedule } from "@/hooks/use-schedule";
import { Calendar, Clock, X, Edit2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScheduleModal } from "./schedule-modal";

interface PublishQueueProps {
  workspace: string;
}

export function PublishQueue({ workspace }: PublishQueueProps) {
  const router = useRouter();
  const { data, isLoading } = useScheduledPosts(workspace);
  const cancelPost = useCancelSchedule();
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<{
    scheduledFor: string;
    timezone: string;
  } | null>(null);
  const [cancelingPostId, setCancelingPostId] = useState<string | null>(null);

  const scheduledPosts = data?.posts ?? [];

  const handleEdit = (post: any) => {
    setEditingPostId(post.id);
    setEditingSchedule({
      scheduledFor: post.scheduledFor,
      timezone: post.timezone,
    });
  };

  const handleCancel = async (postId: string) => {
    if (!confirm("Are you sure you want to cancel this scheduled post?")) {
      return;
    }

    setCancelingPostId(postId);
    try {
      await cancelPost.mutateAsync(postId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel scheduled post");
    } finally {
      setCancelingPostId(null);
    }
  };

  const formatScheduledTime = (scheduledFor: string, timezone: string) => {
    const date = new Date(scheduledFor);

    // Format date and time
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    // Get timezone abbreviation or offset
    const tzDisplay = timezone === "UTC" ? "UTC" : timezone.split("/").pop()?.replace("_", " ") || timezone;

    return { dateStr, timeStr, tzDisplay };
  };

  const getTimeUntilPublish = (scheduledFor: string) => {
    const now = new Date();
    const scheduled = new Date(scheduledFor);
    const diff = scheduled.getTime() - now.getTime();

    if (diff < 0) return "Overdue";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `in ${days}d ${hours}h`;
    if (hours > 0) return `in ${hours}h ${minutes}m`;
    if (minutes > 0) return `in ${minutes}m`;
    return "in < 1m";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-sf-text-muted" />
      </div>
    );
  }

  if (scheduledPosts.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar size={40} className="mx-auto text-sf-text-muted mb-3" />
        <h3 className="font-semibold text-sf-text-primary mb-1">No scheduled posts</h3>
        <p className="text-sm text-sf-text-secondary">
          Posts you schedule for publishing will appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {scheduledPosts.map((post: any) => {
          const { dateStr, timeStr, tzDisplay } = formatScheduledTime(post.scheduledFor, post.timezone);
          const timeUntil = getTimeUntilPublish(post.scheduledFor);
          const isCanceling = cancelingPostId === post.id;

          return (
            <div
              key={post.id}
              className="bg-sf-bg-secondary border border-sf-border hover:border-sf-border-focus rounded-sf-lg p-4 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Timeline indicator */}
                <div className="flex flex-col items-center gap-1 pt-1">
                  <div className="w-3 h-3 rounded-full bg-sf-accent"></div>
                  <div className="w-0.5 h-full bg-sf-border"></div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Scheduled time badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sf-full text-xs font-medium bg-sf-accent-bg text-sf-accent">
                      <Clock size={12} />
                      {timeUntil}
                    </span>
                    <span className="text-xs text-sf-text-muted">
                      {dateStr} at {timeStr} ({tzDisplay})
                    </span>
                  </div>

                  {/* Post title and preview */}
                  <h3
                    className="font-semibold text-sf-text-primary mb-1 cursor-pointer hover:text-sf-accent transition-colors"
                    onClick={() => router.push(`/${workspace}/content/${post.id}`)}
                  >
                    {post.title || "Untitled Post"}
                  </h3>
                  <p className="text-sm text-sf-text-secondary line-clamp-2 mb-3">
                    {post.markdown?.slice(0, 150) || "No content"}
                    {post.markdown && post.markdown.length > 150 ? "..." : ""}
                  </p>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(post);
                      }}
                      disabled={isCanceling}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-hover border border-sf-border rounded-sf transition-colors disabled:opacity-50"
                    >
                      <Edit2 size={12} />
                      Edit Schedule
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancel(post.id);
                      }}
                      disabled={isCanceling}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sf-error hover:bg-sf-error/10 border border-sf-border hover:border-sf-error rounded-sf transition-colors disabled:opacity-50"
                    >
                      {isCanceling ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Canceling...
                        </>
                      ) : (
                        <>
                          <X size={12} />
                          Cancel
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Schedule Modal for editing */}
      {editingPostId && editingSchedule && (
        <ScheduleModal
          postId={editingPostId}
          workspace={workspace}
          isOpen={true}
          onClose={() => {
            setEditingPostId(null);
            setEditingSchedule(null);
          }}
          existingSchedule={editingSchedule}
        />
      )}
    </>
  );
}
