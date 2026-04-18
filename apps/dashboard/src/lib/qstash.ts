import { Client, Receiver } from "@upstash/qstash";

// Required env vars for scheduled triggers:
//   UPSTASH_QSTASH_TOKEN
//   UPSTASH_QSTASH_CURRENT_SIGNING_KEY
//   UPSTASH_QSTASH_NEXT_SIGNING_KEY
//   NEXT_PUBLIC_APP_URL (webhook callback URL)

const isPlaceholderToken =
  !process.env.UPSTASH_QSTASH_TOKEN ||
  process.env.UPSTASH_QSTASH_TOKEN === "placeholder";

if (isPlaceholderToken) {
  console.warn(
    "[qstash] QStash credentials not configured — scheduled triggers use /api/cron/automation fallback."
  );
}

/**
 * Checks if QStash is properly configured with real credentials.
 * @returns true if UPSTASH_QSTASH_TOKEN is set and not a placeholder.
 */
export function isQStashAvailable(): boolean {
  return !isPlaceholderToken;
}

const qstashToken =
  process.env.UPSTASH_QSTASH_TOKEN ?? "placeholder-qstash-token";

const currentSigningKey =
  process.env.UPSTASH_QSTASH_CURRENT_SIGNING_KEY ??
  "placeholder-current-signing-key";

const nextSigningKey =
  process.env.UPSTASH_QSTASH_NEXT_SIGNING_KEY ??
  "placeholder-next-signing-key";

const client = new Client({ token: qstashToken });

const receiver = new Receiver({
  currentSigningKey,
  nextSigningKey,
});

/**
 * Creates a recurring cron schedule in QStash for automation triggers.
 * @param triggerId - Trigger ID to pass in the webhook body.
 * @param cronExpression - Cron expression (e.g., "0 9 * * *").
 * @param callbackUrl - Optional webhook URL (defaults to /api/automation/execute).
 * @returns Schedule ID from QStash.
 */
export async function createTriggerSchedule(
  triggerId: string,
  cronExpression: string,
  callbackUrl?: string
): Promise<string> {
  const destination =
    callbackUrl ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/automation/execute`;

  const { scheduleId } = await client.schedules.create({
    destination,
    cron: cronExpression,
    body: JSON.stringify({ triggerId }),
    headers: { "Content-Type": "application/json" },
  });

  return scheduleId;
}

/**
 * Creates a file-watch schedule that polls every 5 minutes.
 * Used for monitoring file system changes with a trigger.
 * @param triggerId - Trigger ID to pass in the webhook body.
 * @returns Schedule ID from QStash.
 */
export async function createFileWatchSchedule(
  triggerId: string
): Promise<string> {
  const destination = `${process.env.NEXT_PUBLIC_APP_URL}/api/automation/file-watch`;

  const { scheduleId } = await client.schedules.create({
    destination,
    cron: "*/5 * * * *",
    body: JSON.stringify({ triggerId }),
    headers: { "Content-Type": "application/json" },
  });

  return scheduleId;
}

/**
 * Creates a one-time delayed message to publish content at a future time.
 * @param postId - Post ID to publish.
 * @param scheduledFor - Future date/time for publication.
 * @returns Message ID from QStash.
 * @throws {Error} If scheduledFor is in the past.
 */
export async function createPublishSchedule(
  postId: string,
  scheduledFor: Date
): Promise<string> {
  const destination = `${process.env.NEXT_PUBLIC_APP_URL}/api/schedule/publish`;

  // Calculate delay in seconds from now
  const delaySeconds = Math.floor((scheduledFor.getTime() - Date.now()) / 1000);

  if (delaySeconds <= 0) {
    throw new Error("Scheduled time must be in the future");
  }

  // Use publishJSON for one-time delayed jobs (not schedules)
  const { messageId } = await client.publishJSON({
    url: destination,
    body: { postId },
    delay: delaySeconds,
  });

  return messageId;
}

/**
 * Deletes a recurring schedule from QStash.
 * @param scheduleId - Schedule ID to delete.
 */
export async function deleteTriggerSchedule(scheduleId: string): Promise<void> {
  await client.schedules.delete(scheduleId);
}

/**
 * Cancels a pending one-time message (e.g., scheduled publish).
 * Swallows errors if message doesn't exist or has already been delivered.
 * @param messageId - Message ID to cancel.
 */
export async function cancelPublishMessage(messageId: string): Promise<void> {
  try {
    await client.messages.delete(messageId);
  } catch (error) {
    // Message might have already been delivered or doesn't exist
    // This is not a critical error - the webhook handler will check the database
  }
}

/**
 * Verifies the authenticity of a QStash webhook using the signature header.
 * Must be called with the raw request body (before JSON parsing).
 * @param req - The HTTP request.
 * @param rawBody - The raw request body as a string.
 * @returns true if signature is valid, false otherwise.
 */
export async function verifyQStashRequest(
  req: Request,
  rawBody: string
): Promise<boolean> {
  const signature = req.headers.get("upstash-signature") ?? "";

  return receiver.verify({
    signature,
    body: rawBody,
    url: req.url,
  });
}
