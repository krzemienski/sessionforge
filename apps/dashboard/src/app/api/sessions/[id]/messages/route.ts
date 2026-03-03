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

interface PagedMessages {
  messages: unknown[];
  hasMore: boolean;
}

async function readPagedMessages(
  filePath: string,
  offset: number,
  limit: number
): Promise<PagedMessages> {
  const messages: unknown[] = [];
  let validLinesSeen = 0;

  return new Promise((resolve) => {
    const stream = createReadStream(filePath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        // skip malformed
        return;
      }

      if (validLinesSeen < offset) {
        validLinesSeen++;
        return;
      }

      if (messages.length < limit) {
        messages.push(parsed);
      } else {
        // We have one extra — signals hasMore; stop processing
        rl.close();
        stream.destroy();
      }

      validLinesSeen++;
    });

    rl.on("close", () => resolve({ messages, hasMore: validLinesSeen > offset + limit }));
    rl.on("error", () => resolve({ messages, hasMore: false }));
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

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0);

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

    const { messages, hasMore } = await readPagedMessages(filePath, offset, limit);
    return NextResponse.json({ messages, offset, limit, hasMore });
  })(req);
}
