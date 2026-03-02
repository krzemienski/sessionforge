import { Client, Receiver } from "@upstash/qstash";

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

export async function deleteTriggerSchedule(scheduleId: string): Promise<void> {
  await client.schedules.delete(scheduleId);
}

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
