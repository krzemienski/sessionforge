import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writingSkills, workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { listAvailableSkills, getSkillByName } from "@/lib/ai/tools/skill-loader";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { workspaceSlug } = body;

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspaceSlug is required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const availableSkills = await listAvailableSkills();

  const imported: typeof writingSkills.$inferSelect[] = [];

  for (const skillInfo of availableSkills) {
    const content = await getSkillByName(skillInfo.name);
    if (!content) continue;

    const [upserted] = await db
      .insert(writingSkills)
      .values({
        workspaceId: workspace.id,
        name: skillInfo.name,
        description: skillInfo.description,
        instructions: content,
        source: "imported",
        filePath: skillInfo.path,
        appliesTo: ["all"],
      })
      .onConflictDoUpdate({
        target: [writingSkills.workspaceId, writingSkills.filePath],
        set: {
          name: skillInfo.name,
          description: skillInfo.description,
          instructions: content,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (upserted) {
      imported.push(upserted);
    }
  }

  return NextResponse.json({ imported: imported.length, skills: imported }, { status: 200 });
}
