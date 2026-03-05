import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  githubRepositories,
  githubCommits,
  githubPullRequests,
  githubIssues,
} from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

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

  // Parse the payload after verification
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
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

  try {
    // Find the repository in our database
    const repository = payload.repository;
    if (!repository) {
      return NextResponse.json(
        { error: "Missing repository in payload" },
        { status: 400 }
      );
    }

    const repo = await db.query.githubRepositories.findFirst({
      where: eq(githubRepositories.githubRepoId, repository.id),
    });

    if (!repo) {
      // Repository not connected to any workspace, ignore
      return NextResponse.json(
        { message: "Repository not connected, ignoring event" },
        { status: 200 }
      );
    }

    // Handle different event types
    switch (event) {
      case "push": {
        // Process commits from push event
        const commits = payload.commits || [];
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
        // Process pull request event
        const pr = payload.pull_request;
        if (!pr) {
          return NextResponse.json(
            { error: "Missing pull_request in payload" },
            { status: 400 }
          );
        }

        await db
          .insert(githubPullRequests)
          .values({
            repositoryId: repo.id,
            prNumber: pr.number,
            title: pr.title,
            body: pr.body,
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
              body: pr.body,
              state: pr.state,
              mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
              updatedAt: new Date(),
            },
          });

        return NextResponse.json({
          event: "pull_request",
          action: payload.action,
          prNumber: pr.number,
          message: `Processed pull request #${pr.number}`,
        });
      }

      case "issues": {
        // Process issues event
        const issue = payload.issue;
        if (!issue) {
          return NextResponse.json(
            { error: "Missing issue in payload" },
            { status: 400 }
          );
        }

        // GitHub API returns PRs as issues, but webhooks have a pull_request field
        // Skip if this is actually a pull request
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
            body: issue.body,
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
              body: issue.body,
              state: issue.state,
              closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
              updatedAt: new Date(),
            },
          });

        return NextResponse.json({
          event: "issues",
          action: payload.action,
          issueNumber: issue.number,
          message: `Processed issue #${issue.number}`,
        });
      }

      default: {
        // Unsupported event type, but return 200 to acknowledge receipt
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
