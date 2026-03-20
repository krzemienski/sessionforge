import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import type { Role } from "@/lib/permissions";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { workspace: slug } = await params;

  let role: Role;
  try {
    const result = await getAuthorizedWorkspace(session, slug);
    role = result.role;
  } catch {
    notFound();
  }

  return (
    <WorkspaceShell workspace={slug} userName={session.user.name} role={role}>
      {children}
    </WorkspaceShell>
  );
}
