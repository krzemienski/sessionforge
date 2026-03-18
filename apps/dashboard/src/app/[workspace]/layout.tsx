import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;

  // Check if user is authenticated
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Look up the workspace
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  // If authenticated and this is their workspace, redirect to dashboard
  if (session && workspace && workspace.ownerId === session.user.id) {
    redirect(`/${workspaceSlug}/content`);
  }

  // Otherwise, show public portfolio (children = page.tsx)
  return <>{children}</>;
}
