import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";

export default async function DashboardRoot() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const ws = await db.query.workspaces.findFirst({
    where: eq(workspaces.ownerId, session.user.id),
  });

  if (ws) redirect(`/${ws.slug}`);
  redirect("/onboarding");
}
