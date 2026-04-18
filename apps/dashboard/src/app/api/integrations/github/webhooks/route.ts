import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  githubRepositories,
  githubCommits,
  githubPullRequests,
  githubIssues,
} from "@sessionforge/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";

export const dynamic = "force-dynamic";

const repoSchema = z.object({
  id: z.number(),
});

const pushPayloadSchema = z.object({
  repository: repoSchema,
  commits: z
    .array(
      z.object({
        id: z.string(),
        message: z.string(),
        author: z.object({
          name: z.string(),
          email: z.string(),
        }),
        timestamp: z.string(),
        url: z.string(),
      }),
    )
    .default([]),
});

const pullRequestPayloadSchema = z.object({
  repository: repoSchema,
  action: z.string().optional(),
  pull_request: z.object({
    number: z.number(),
    title: z.string(),
    body: z.string().nullable().optional(),
    state: z.string(),
    user: z.object({ login: z.string() }),
    html_url: z.string(),
    merged_at: z.string().nullable().optional(),
    created_at: z.string(),
  }),
});

const issuesPayloadSchema = z.object({
  repository: repoSchema,
  action: z.string().optional(),
  issue: z.object({
    number: z.number(),
    title: z.string(),
    body: z.string().nullable().optional(),
    state: z.string(),
    user: z.object({ login: z.string() }),
    html_url: z.string(),
    created_at: z.string(),
    closed_at: z.string().nullable().optional(),
    pull_request: z.unknown().optional(),
  }),
});

const repoOnlyPayloadSchema = z.object({
  repository: repoSchema,
});

/**
 * Verify GitHub webhook signature
 * GitHub signs webhooks with HMAC-SHA256 using the webhook secret
 */
function verifyGitHubSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  // GitHub signature format: "sha256=<hash>"
  const [algorithm, hash] = signature.split("=");
  if (algorithm !== "sha256" || !hash) return false;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const expectedHash = hmac.digest("hex");

  // Use timingSafeEqual to prevent timing attacks
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const actualBuffer = Buffer.from(hash, "hex");

  if (expectedBuffer.length !== actualBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

/**
 * GitHub Webhook Receiver
 * Handles push, pull_request, and issues events from GitHub
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("GITHUB_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  // Get the raw body for signature verification
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  // Verify webhook signature
  if (!verifyGitHubSignature(rawBody, signature, webhookSecret)) {
    console.error("Invalid GitHub webhook signature");
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const event = request.headers.get("x-github-event");

  if (!event) {
    return NextResponse.json(
      { error: "Missing x-github-event header" },
      { status: 400 }
    );
  }

  const repoOnly = repoOnlyPayloadSchema.safeParse(rawPayload);
  if (!repoOnly.success) {
    return NextResponse.json(
      { error: "Missing or invalid repository in payload" },
      { status: 400 }
    );
  }

  const repo = await db.query.githubRepositories.findFirst({
    where: eq(githubRepositories.githubRepoId, repoOnly.data.repository.id),
  });

  if (!repo) {
    return NextResponse.json(
      { message: "Repository not connected, ignoring event" },
      { status: 200 }
    );
  }

  try {
    switch (event) {
      case "push": {
        const parsed = pushPayloadSchema.safeParse(rawPayload);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Invalid push payload", details: parsed.error.flatten() },
            { status: 400 }
          );
        }
        const { commits } = parsed.data;
        let processed = 0;
        for (const commit of commits) {
          await db
            .insert(githubCommits)
            .values({
              repositoryId: repo.id,
              commitSha: commit.id,
              message: commit.message,
              authorName: commit.author.name,
              authorEmail: commit.author.email,
              authorDate: new Date(commit.timestamp),
              commitUrl: commit.url,
            })
            .onConflictDoNothing();
          processed++;
        }
        return NextResponse.json({
          event: "push",
          processed,
          message: `Processed ${processed} commits`,
        });
      }

      case "pull_request": {
        const parsed = pullRequestPayloadSchema.safeParse(rawPayload);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Invalid pull_request payload", details: parsed.error.flatten() },
            { status: 400 }
          );
        }
        const { pull_request: pr, action } = parsed.data;
        await db
          .insert(githubPullRequests)
          .values({
            repositoryId: repo.id,
            prNumber: pr.number,
            title: pr.title,
            body: pr.body ?? null,
            state: pr.state,
            authorName: pr.user.login,
            prUrl: pr.html_url,
            mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
            createdAtGithub: new Date(pr.created_at),
          })
          .onConflictDoUpdate({
            target: [githubPullRequests.repositoryId, githubPullRequests.prNumber],
            set: {
              title: pr.title,
              body: pr.body ?? null,
              state: pr.state,
              mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
              updatedAt: new Date(),
            },
          });

        return NextResponse.json({
          event: "pull_request",
          action,
          prNumber: pr.number,
          message: `Processed pull request #${pr.number}`,
        });
      }

      case "issues": {
        const parsed = issuesPayloadSchema.safeParse(rawPayload);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Invalid issues payload", details: parsed.error.flatten() },
            { status: 400 }
          );
        }
        const { issue, action } = parsed.data;

        if (issue.pull_request) {
          return NextResponse.json({
            event: "issues",
            message: "Skipping pull request in issues event",
          });
        }

        await db
          .insert(githubIssues)
          .values({
            repositoryId: repo.id,
            issueNumber: issue.number,
            title: issue.title,
            body: issue.body ?? null,
            state: issue.state,
            authorName: issue.user.login,
            issueUrl: issue.html_url,
            createdAtGithub: new Date(issue.created_at),
            closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
          })
          .onConflictDoUpdate({
            target: [githubIssues.repositoryId, githubIssues.issueNumber],
            set: {
              title: issue.title,
              body: issue.body ?? null,
              state: issue.state,
              closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
              updatedAt: new Date(),
            },
          });

        return NextResponse.json({
          event: "issues",
          action,
          issueNumber: issue.number,
          message: `Processed issue #${issue.number}`,
        });
      }

      default: {
        return NextResponse.json({
          event,
          message: `Event type '${event}' not supported, ignoring`,
        });
      }
    }
  } catch (error) {
    console.error("Error processing GitHub webhook:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process webhook",
      },
      { status: 500 }
    );
  }
}
