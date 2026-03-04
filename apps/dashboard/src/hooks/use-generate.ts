"use client";

import { useState, useCallback } from "react";

export type FormatKey = "blog" | "twitter" | "linkedin" | "newsletter" | "changelog";
export type FormatStatus = "idle" | "generating" | "complete" | "error";

export type FormatStatuses = Record<FormatKey, FormatStatus>;
export type GeneratedPostIds = Partial<Record<FormatKey, string>>;

const INITIAL_STATUSES: FormatStatuses = {
  blog: "idle",
  twitter: "idle",
  linkedin: "idle",
  newsletter: "idle",
  changelog: "idle",
};

function buildRequest(
  workspaceSlug: string,
  insightId: string,
  format: FormatKey
): [string, RequestInit] {
  if (format === "blog") {
    return [
      "/api/agents/blog",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, insightId, tone: "technical" }),
      },
    ];
  }
  if (format === "newsletter") {
    return [
      "/api/agents/newsletter",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, lookbackDays: 7 }),
      },
    ];
  }
  if (format === "changelog") {
    return [
      "/api/agents/changelog",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, lookbackDays: 7 }),
      },
    ];
  }
  const platform = format === "twitter" ? "twitter" : "linkedin";
  return [
    "/api/agents/social",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, insightId, platform }),
    },
  ];
}

async function consumeSSEStream(
  response: Response,
  onFirstEvent: () => void,
  onComplete: (postId?: string) => void,
  onError: () => void
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    onError();
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let firstEvent = true;
  let pendingCreatePost = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE messages are separated by double newline
      const messages = buffer.split("\n\n");
      buffer = messages.pop() ?? "";

      for (const message of messages) {
        if (!message.trim()) continue;

        if (firstEvent) {
          firstEvent = false;
          onFirstEvent();
        }

        let eventType = "";
        let eventData = "";

        for (const line of message.split("\n")) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            eventData = line.slice(6).trim();
          }
        }

        if (!eventType) continue;

        try {
          if (eventType === "tool_use") {
            const parsed = JSON.parse(eventData);
            if (parsed?.tool === "create_post") {
              pendingCreatePost = true;
            }
          } else if (eventType === "tool_result" && pendingCreatePost) {
            pendingCreatePost = false;
            const parsed = JSON.parse(eventData);
            if (parsed?.success && parsed?.result?.id) {
              onComplete(parsed.result.id);
              return;
            }
          } else if (eventType === "complete") {
            onComplete();
            return;
          } else if (eventType === "done") {
            onComplete();
            return;
          } else if (eventType === "error") {
            onError();
            return;
          }
        } catch {
          // ignore parse errors for individual events
        }
      }
    }

    onComplete();
  } catch {
    onError();
  } finally {
    reader.releaseLock();
  }
}

export function useGenerateFormats(workspaceSlug: string, insightId: string) {
  const [statuses, setStatuses] = useState<FormatStatuses>({ ...INITIAL_STATUSES });
  const [postIds, setPostIds] = useState<GeneratedPostIds>({});

  const generateFormats = useCallback(
    async (selectedFormats: FormatKey[]) => {
      if (!workspaceSlug || !insightId || selectedFormats.length === 0) return;

      // Reset selected formats to idle and clear prior post IDs
      setStatuses((prev) => {
        const next = { ...prev };
        for (const fmt of selectedFormats) {
          next[fmt] = "idle";
        }
        return next;
      });
      setPostIds((prev) => {
        const next = { ...prev };
        for (const fmt of selectedFormats) {
          delete next[fmt];
        }
        return next;
      });

      await Promise.all(
        selectedFormats.map(async (format) => {
          const [url, init] = buildRequest(workspaceSlug, insightId, format);

          let res: Response;
          try {
            res = await fetch(url, init);
          } catch {
            setStatuses((prev) => ({ ...prev, [format]: "error" }));
            return;
          }

          if (!res.ok) {
            setStatuses((prev) => ({ ...prev, [format]: "error" }));
            return;
          }

          await consumeSSEStream(
            res,
            () => setStatuses((prev) => ({ ...prev, [format]: "generating" })),
            (postId?: string) => {
              setStatuses((prev) => ({ ...prev, [format]: "complete" }));
              if (postId) {
                setPostIds((prev) => ({ ...prev, [format]: postId }));
              }
            },
            () => setStatuses((prev) => ({ ...prev, [format]: "error" }))
          );
        })
      );
    },
    [workspaceSlug, insightId]
  );

  return { statuses, postIds, generateFormats };
}
