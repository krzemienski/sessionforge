import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { checkQuota, recordUsage } from "@/lib/billing/usage";
import { getStyleProfileContext } from "@/lib/style/profile-injector";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { ensureCliAuth } from "@/lib/ai/ensure-cli-auth";

ensureCliAuth();

export const dynamic = "force-dynamic";

const agentAbCompareSchema = z.object({
  workspaceSlug: z.string().min(1, "workspaceSlug is required"),
  insightId: z.string().optional(),
  contentType: z.string().optional(),
});

const AB_COMPARE_BASE_PROMPT = `You are a professional content writer. Generate a 300–400 word excerpt about the provided topic. Write naturally, directly, and concisely. Do not include a title or headings — just the prose excerpt.`;

async function generateExcerpt(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  let result: string | null = null;

  for await (const message of query({
    prompt: userMessage,
    options: {
      systemPrompt,
      model: "claude-sonnet-4-6",
      maxTurns: 1,
    },
  })) {
    if ("result" in message && typeof message.result === "string") {
      result = message.result;
    }
  }

  return result ?? "";
}

export async function POST(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await req.json().catch(() => ({}));
    const { workspaceSlug, insightId, contentType } = parseBody(agentAbCompareSchema, rawBody);

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, workspaceSlug),
    });

    if (!workspace || workspace.ownerId !== session.user.id) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    const quota = await checkQuota(session.user.id, "content_generation");
    if (!quota.allowed) {
      return new Response(
        JSON.stringify({
          error: "Monthly content generation quota exceeded",
          quota: {
            limit: quota.limit,
            remaining: quota.remaining,
            percentUsed: quota.percentUsed,
          },
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }

    const topicHint = contentType ?? insightId ?? "software development";
    const userMessage = `Write a 300–400 word content excerpt about: ${topicHint}`;

    const voiceContext = await getStyleProfileContext(workspace.id);
    const voicedPrompt = voiceContext
      ? `${AB_COMPARE_BASE_PROMPT}\n\nVOICE GUIDE:\n${voiceContext}`
      : AB_COMPARE_BASE_PROMPT;

    const [withoutVoice, withVoice] = await Promise.all([
      generateExcerpt(AB_COMPARE_BASE_PROMPT, userMessage),
      generateExcerpt(voicedPrompt, userMessage),
    ]);

    void recordUsage(session.user.id, workspace.id, "content_generation", 0.02);

    return new Response(
      JSON.stringify({ withVoice, withoutVoice }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  })(req);
}
