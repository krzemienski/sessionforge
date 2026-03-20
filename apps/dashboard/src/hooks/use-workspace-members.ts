"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Role } from "@/lib/permissions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceMember {
  id: string;
  userId: string;
  role: Role;
  customPermissions: Record<string, boolean> | null;
  joinedAt: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: Role;
  token: string;
  expiresAt: string;
  invitedBy: string;
  acceptedAt: string | null;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useWorkspaceMembers(workspaceSlug: string | undefined) {
  return useQuery({
    queryKey: ["workspace-members", workspaceSlug],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/${workspaceSlug}/members`);
      if (!res.ok) throw new Error("Failed to fetch workspace members");
      return res.json() as Promise<{ members: WorkspaceMember[] }>;
    },
    enabled: !!workspaceSlug,
  });
}

export function useWorkspaceInvites(workspaceSlug: string | undefined) {
  return useQuery({
    queryKey: ["workspace-invites", workspaceSlug],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/${workspaceSlug}/invites`);
      if (!res.ok) throw new Error("Failed to fetch workspace invites");
      return res.json() as Promise<{ invites: WorkspaceInvite[] }>;
    },
    enabled: !!workspaceSlug,
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useUpdateMemberRole(workspaceSlug: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      memberId,
      role,
    }: {
      memberId: string;
      role: Role;
    }) => {
      const res = await fetch(
        `/api/workspace/${workspaceSlug}/members/${memberId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update member role");
      }
      return res.json() as Promise<{ member: WorkspaceMember }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-members", workspaceSlug] });
    },
  });
}

export function useRemoveMember(workspaceSlug: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(
        `/api/workspace/${workspaceSlug}/members/${memberId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to remove member");
      }
      return res.json() as Promise<{ removed: boolean }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-members", workspaceSlug] });
    },
  });
}

export function useSendInvite(workspaceSlug: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: Role }) => {
      const res = await fetch(`/api/workspace/${workspaceSlug}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to send invite");
      }
      return res.json() as Promise<{ invite: WorkspaceInvite }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-invites", workspaceSlug] });
    },
  });
}

export function useCancelInvite(workspaceSlug: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await fetch(`/api/workspace/${workspaceSlug}/invites`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inviteId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to cancel invite");
      }
      return res.json() as Promise<{ success: boolean }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-invites", workspaceSlug] });
    },
  });
}
