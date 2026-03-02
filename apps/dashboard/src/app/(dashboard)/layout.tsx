import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Check if user has any workspaces, if not create a default one
  const userWorkspaces = await db.query.workspaces.findMany({
    where: eq(workspaces.ownerId, session.user.id),
  });

  if (userWorkspaces.length === 0) {
    const slug = session.user.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "default";
    await db.insert(workspaces).values({
      name: `${session.user.name}'s Workspace`,
      slug,
      ownerId: session.user.id,
    }).onConflictDoNothing();

    redirect(`/${slug}`);
  }

  return <>{children}</>;
}
