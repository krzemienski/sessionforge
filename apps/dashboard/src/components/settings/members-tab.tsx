"use client";

import { useState } from "react";
import {
  useWorkspaceMembers,
  useWorkspaceInvites,
  useUpdateMemberRole,
  useRemoveMember,
  useSendInvite,
  useCancelInvite,
} from "@/hooks/use-workspace-members";
import type { WorkspaceMember, WorkspaceInvite } from "@/hooks/use-workspace-members";
import type { Role } from "@/lib/permissions";
import { Users, UserPlus, Trash2, Mail, Shield, ChevronDown, Clock, AlertCircle } from "lucide-react";

interface MembersTabProps {
  workspace: string;
}

const ASSIGNABLE_ROLES: { value: Role; label: string; description: string }[] = [
  { value: "editor", label: "Editor", description: "Can create, edit, and manage content" },
  { value: "publisher", label: "Publisher", description: "Can approve and publish content" },
  { value: "reviewer", label: "Reviewer", description: "Can review and approve content" },
  { value: "analyst", label: "Analyst", description: "Read-only access to analytics" },
  { value: "viewer", label: "Viewer", description: "Read-only access to all resources" },
];

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-sf-accent/15 text-sf-accent",
  editor: "bg-blue-500/15 text-blue-400",
  publisher: "bg-purple-500/15 text-purple-400",
  reviewer: "bg-amber-500/15 text-amber-400",
  analyst: "bg-emerald-500/15 text-emerald-400",
  viewer: "bg-sf-text-muted/15 text-sf-text-muted",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ROLE_COLORS[role] ?? ROLE_COLORS.viewer}`}>
      <Shield size={10} />
      {role}
    </span>
  );
}

export function MembersTab({ workspace }: MembersTabProps) {
  const members = useWorkspaceMembers(workspace);
  const invites = useWorkspaceInvites(workspace);
  const updateRole = useUpdateMemberRole(workspace);
  const removeMember = useRemoveMember(workspace);
  const sendInvite = useSendInvite(workspace);
  const cancelInvite = useCancelInvite(workspace);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("editor");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSendInvite = () => {
    if (!inviteEmail.trim()) return;
    setError(null);
    sendInvite.mutate(
      { email: inviteEmail.trim(), role: inviteRole },
      {
        onSuccess: () => {
          setInviteEmail("");
          setInviteRole("editor");
          setShowInvite(false);
        },
        onError: (err) => setError(err.message),
      }
    );
  };

  const handleRoleChange = (memberId: string, role: Role) => {
    setError(null);
    updateRole.mutate(
      { memberId, role },
      {
        onSuccess: () => setEditingRoleId(null),
        onError: (err) => setError(err.message),
      }
    );
  };

  const handleRemoveMember = (memberId: string) => {
    setError(null);
    removeMember.mutate(memberId, {
      onSuccess: () => setConfirmRemoveId(null),
      onError: (err) => setError(err.message),
    });
  };

  if (members.isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-sf-bg-tertiary rounded w-1/3" />
        <div className="h-16 bg-sf-bg-tertiary rounded" />
        <div className="h-16 bg-sf-bg-tertiary rounded" />
      </div>
    );
  }

  const memberList = members.data?.members ?? [];
  const inviteList = (invites.data?.invites ?? []).filter((i: WorkspaceInvite) => !i.acceptedAt);

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 bg-sf-error/10 border border-sf-error/30 rounded-sf-lg p-3 text-sm text-sf-error">
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-xs opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* Members section */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-sf-accent" />
            <h2 className="text-base font-semibold font-display">Members</h2>
            <span className="text-xs text-sf-text-muted">({memberList.length})</span>
          </div>
          {!showInvite && (
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 bg-sf-accent text-sf-bg-primary px-3 py-1.5 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
            >
              <UserPlus size={14} /> Invite
            </button>
          )}
        </div>

        {/* Invite form */}
        {showInvite && (
          <div className="flex items-end gap-3 mb-4 p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
            <div className="flex-1">
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">Email Address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
                className="w-full bg-sf-bg-primary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
                onKeyDown={(e) => e.key === "Enter" && handleSendInvite()}
              />
            </div>
            <div className="w-36">
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="w-full bg-sf-bg-primary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus capitalize"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleSendInvite}
              disabled={!inviteEmail.trim() || sendInvite.isPending}
              className="flex items-center gap-1.5 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
            >
              {sendInvite.isPending ? "Sending..." : "Send Invite"}
            </button>
            <button
              onClick={() => { setShowInvite(false); setInviteEmail(""); }}
              className="px-3 py-2 text-sm text-sf-text-secondary hover:text-sf-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Members list */}
        {memberList.length > 0 ? (
          <div className="space-y-2">
            {memberList.map((member: WorkspaceMember) => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {member.user.image ? (
                    <img src={member.user.image} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-sf-accent/20 flex items-center justify-center text-xs font-medium text-sf-accent">
                      {(member.user.name || member.user.email)?.[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-sf-text-primary truncate">{member.user.name || "Unnamed"}</span>
                      <RoleBadge role={member.role} />
                    </div>
                    <div className="text-xs text-sf-text-muted truncate">{member.user.email}</div>
                  </div>
                </div>

                {member.role !== "owner" && (
                  <div className="flex items-center gap-1">
                    {/* Role selector */}
                    {editingRoleId === member.id ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as Role)}
                        onBlur={() => setEditingRoleId(null)}
                        autoFocus
                        className="bg-sf-bg-primary border border-sf-border rounded-sf px-2 py-1 text-xs text-sf-text-primary focus:outline-none focus:border-sf-border-focus capitalize"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingRoleId(member.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-hover rounded-sf transition-colors"
                        title="Change role"
                      >
                        <ChevronDown size={12} />
                        Role
                      </button>
                    )}

                    {/* Remove button */}
                    {confirmRemoveId === member.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={removeMember.isPending}
                          className="px-2 py-1 text-xs bg-sf-error/20 text-sf-error rounded-sf hover:bg-sf-error/30 transition-colors"
                        >
                          {removeMember.isPending ? "..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => setConfirmRemoveId(null)}
                          className="px-2 py-1 text-xs text-sf-text-muted hover:text-sf-text-secondary transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemoveId(member.id)}
                        className="p-2 text-sf-text-muted hover:text-sf-error transition-colors"
                        title="Remove member"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users size={32} className="mx-auto text-sf-text-muted mb-2" />
            <p className="text-sm text-sf-text-muted">No members yet</p>
            <p className="text-xs text-sf-text-muted mt-1">Invite team members to collaborate on this workspace.</p>
          </div>
        )}
      </div>

      {/* Pending invites section */}
      {inviteList.length > 0 && (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Mail size={18} className="text-sf-accent" />
            <h2 className="text-base font-semibold font-display">Pending Invites</h2>
            <span className="text-xs text-sf-text-muted">({inviteList.length})</span>
          </div>

          <div className="space-y-2">
            {inviteList.map((invite: WorkspaceInvite) => (
              <div key={invite.id} className="flex items-center justify-between p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-sf-text-primary truncate">{invite.email}</span>
                    <RoleBadge role={invite.role} />
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-sf-text-muted">
                    <Clock size={10} />
                    <span>Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => cancelInvite.mutate(invite.id)}
                  disabled={cancelInvite.isPending}
                  className="p-2 text-sf-text-muted hover:text-sf-error transition-colors"
                  title="Revoke invite"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role descriptions */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-sf-accent" />
          <h2 className="text-base font-semibold font-display">Role Permissions</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { role: "owner", label: "Owner", desc: "Full access — manage workspace, billing, members, and all resources" },
            ...ASSIGNABLE_ROLES.map((r) => ({ role: r.value, label: r.label, desc: r.description })),
          ].map((item) => (
            <div key={item.role} className="p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
              <RoleBadge role={item.role} />
              <p className="text-xs text-sf-text-muted mt-1.5">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
