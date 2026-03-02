import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Layout already guards against unauthenticated access, but
  // we still need the session for the workspace query.
  if (!session) {
    return null;
  }

  const userWorkspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.ownerId, session.user.id),
  });

  return <OnboardingWizard initialWorkspaceName={userWorkspace?.name} />;
}
