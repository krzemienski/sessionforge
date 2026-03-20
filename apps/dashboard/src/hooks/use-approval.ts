"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useApprovalSettings(workspace: string) {
  return useQuery({
    queryKey: ["approval-settings", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/${workspace}/approval-settings`);
      if (!res.ok) throw new Error("Failed to fetch approval settings");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function useUpdateApprovalSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workspace,
      ...data
    }: {
      workspace: string;
      enabled?: boolean;
      requiredApprovers?: number;
    }) => {
      const res = await fetch(`/api/workspace/${workspace}/approval-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update approval settings");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["approval-settings", vars.workspace] });
    },
  });
}

export function useReviewStatus(postId: string) {
  return useQuery({
    queryKey: ["review-status", postId],
    queryFn: async () => {
      const res = await fetch(`/api/content/${postId}/review`);
      if (!res.ok) throw new Error("Failed to fetch review status");
      return res.json();
    },
    enabled: !!postId,
  });
}

export function useSubmitForReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId }: { postId: string }) => {
      const res = await fetch(`/api/content/${postId}/review`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to submit for review");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["review-status", vars.postId] });
      qc.invalidateQueries({ queryKey: ["post", vars.postId] });
      qc.invalidateQueries({ queryKey: ["content"] });
      qc.invalidateQueries({ queryKey: ["approval-timeline", vars.postId] });
    },
  });
}

export function useAssignReviewers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postId,
      reviewerIds,
    }: {
      postId: string;
      reviewerIds: string[];
    }) => {
      const res = await fetch(`/api/content/${postId}/review/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerIds }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to assign reviewers");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["review-status", vars.postId] });
      qc.invalidateQueries({ queryKey: ["approval-timeline", vars.postId] });
    },
  });
}

export function useRemoveReviewer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postId,
      reviewerId,
    }: {
      postId: string;
      reviewerId: string;
    }) => {
      const res = await fetch(`/api/content/${postId}/review/assign`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to remove reviewer");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["review-status", vars.postId] });
      qc.invalidateQueries({ queryKey: ["approval-timeline", vars.postId] });
    },
  });
}

export function useSubmitDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postId,
      decision,
      comment,
    }: {
      postId: string;
      decision: "approved" | "rejected" | "changes_requested";
      comment?: string;
    }) => {
      const res = await fetch(`/api/content/${postId}/review/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to submit decision");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["review-status", vars.postId] });
      qc.invalidateQueries({ queryKey: ["post", vars.postId] });
      qc.invalidateQueries({ queryKey: ["content"] });
      qc.invalidateQueries({ queryKey: ["approval-timeline", vars.postId] });
    },
  });
}

export function useWorkspaceMembers(workspace: string) {
  return useQuery({
    queryKey: ["workspace-members", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/${workspace}/members`);
      if (!res.ok) throw new Error("Failed to fetch workspace members");
      return res.json() as Promise<{
        ownerId: string;
        members: { id: string; name: string | null; email: string | null; image: string | null }[];
      }>;
    },
    enabled: !!workspace,
  });
}

export function useApprovalTimeline(postId: string) {
  return useQuery({
    queryKey: ["approval-timeline", postId],
    queryFn: async () => {
      const res = await fetch(`/api/content/${postId}/review/timeline`);
      if (!res.ok) throw new Error("Failed to fetch approval timeline");
      return res.json();
    },
    enabled: !!postId,
  });
}
