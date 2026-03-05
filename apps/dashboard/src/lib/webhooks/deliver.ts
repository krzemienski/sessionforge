import { createHmac } from "crypto";

interface WebhookEndpoint {
  url: string;
  secret: string;
}

export async function deliverWebhook(
  endpoint: WebhookEndpoint,
  eventType: string,
  payload: object
): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = `sha256=${createHmac("sha256", endpoint.secret).update(body).digest("hex")}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SessionForge-Signature": signature,
        "X-SessionForge-Event": eventType,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
  } catch {
    // Errors are handled gracefully - delivery failures should not throw
  }
}
