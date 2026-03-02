import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { claudeSessions, workspaces } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import fs from "fs/promises";
import { createReadStream } from "fs";
import readline from "readline";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";

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
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const workspace = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.ownerId, session.user.id))
      .limit(1);

    if (!workspace.length) {
      throw new AppError("No workspace found", ERROR_CODES.NOT_FOUND);
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
      throw new AppError("Session not found", ERROR_CODES.NOT_FOUND);
    }

    const filePath = rows[0].filePath;

    try {
      await fs.access(filePath);
    } catch {
      throw new AppError("Session file not accessible", ERROR_CODES.NOT_FOUND);
    }

    const messages = await readRawMessages(filePath);
    return NextResponse.json({ data: messages, count: messages.length });
  })(req);
}
