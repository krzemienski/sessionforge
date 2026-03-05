import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { claudeSessions, workspaces } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import fs from "fs/promises";
import { createReadStream } from "fs";
import readline from "readline";

export const dynamic = "force-dynamic";

async function readRawMessages(filePath: string): Promise<unknown[]> {
  const messages: unknown[] = [];
  return new Promise((resolve) => {
    const stream = createReadStream(filePath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        messages.push(JSON.parse(trimmed));
      } catch {
        // skip malformed
      }
    });

    rl.on("close", () => resolve(messages));
    rl.on("error", () => resolve(messages));
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const workspace = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerId, session.user.id))
    .limit(1);

  if (!workspace.length) {
    return NextResponse.json({ error: "No workspace found" }, { status: 404 });
  }

  const rows = await db
    .select({ filePath: claudeSessions.filePath })
    .from(claudeSessions)
    .where(
      and(
        eq(claudeSessions.workspaceId, workspace[0].id),
        eq(claudeSessions.id, id)
      )
    )
    .limit(1);

  if (!rows.length) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const filePath = rows[0].filePath;

  try {
    await fs.access(filePath);
  } catch {
    return NextResponse.json({ error: "Session file not accessible" }, { status: 404 });
  }

  const messages = await readRawMessages(filePath);
  return NextResponse.json({ data: messages, count: messages.length });
}
