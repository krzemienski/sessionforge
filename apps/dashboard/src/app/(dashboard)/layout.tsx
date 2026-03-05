import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, workspaces } from "@sessionforge/db";
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

  // Fetch user record and workspaces in parallel
  const [user, userWorkspaces] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    }),
    db.query.workspaces.findMany({
      where: eq(workspaces.ownerId, session.user.id),
    }),
  ]);

  const hasWorkspace = userWorkspaces.length > 0;
  const onboardingCompleted = user?.onboardingCompleted ?? false;

  if (hasWorkspace) {
    // Existing users who have workspaces but onboardingCompleted=false:
    // auto-complete onboarding for backward compatibility
    if (!onboardingCompleted) {
      await db
        .update(users)
        .set({ onboardingCompleted: true })
        .where(eq(users.id, session.user.id));
    }
    return <>{children}</>;
  }

  // No workspace — check onboarding status
  if (!onboardingCompleted) {
    // New user: send them through the onboarding wizard
    redirect("/onboarding");
  }

  // onboardingCompleted=true but no workspace (fallback — shouldn't normally occur)
  const slug =
    session.user.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "default";

  await db
    .insert(workspaces)
    .values({
      name: `${session.user.name}'s Workspace`,
      slug,
      ownerId: session.user.id,
    })
    .onConflictDoNothing();

  redirect(`/${slug}`);
}
