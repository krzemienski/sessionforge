/**
 * SSE streaming helpers for agent responses.
 * Wraps Anthropic SDK streaming into Server-Sent Events format.
 * Provides a low-level `createSSEStream` factory and a convenience
 * `sseResponse` wrapper to build a standards-compliant streaming `Response`.
 */

/**
 * Creates a Server-Sent Events (SSE) stream with helpers for sending
 * typed events to the client.
 *
 * The returned `stream` is a `ReadableStream` suitable for passing directly
 * to a `Response`. Use `send` to push named events with arbitrary payloads,
 * and `close` to emit a terminal `done` event and flush the stream.
 *
 * @returns An object containing:
 *   - `stream` — the underlying `ReadableStream<Uint8Array>` to pass to the HTTP layer.
 *   - `writer` — legacy slot; always `null` cast to the writer type.
 *   - `encoder` — the `TextEncoder` used to encode event frames.
 *   - `send(event, data)` — enqueues an SSE frame for the given event name and payload.
 *   - `close()` — emits a final `done` event and closes the stream.
 */
/** Interval in milliseconds between SSE keep-alive (comment) frames. */
const SSE_HEARTBEAT_MS = 15_000;

export function createSSEStream(): {
  stream: ReadableStream;
  writer: WritableStreamDefaultWriter<string>;
  encoder: TextEncoder;
  send: (event: string, data: unknown) => void;
  close: () => void;
} {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const enqueueRaw = (chunk: string) => {
    try {
      controller.enqueue(encoder.encode(chunk));
    } catch {
      // Stream may already be closed
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      // Emit an SSE comment every 15s so CDNs / proxies don't idle-close
      // long-running agent streams. Comment frames are ignored by EventSource
      // clients and do not trigger message handlers (M7).
      heartbeat = setInterval(() => enqueueRaw(": ping\n\n"), SSE_HEARTBEAT_MS);
    },
    cancel() {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    },
  });

  const send = (event: string, data: unknown) => {
    try {
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
    } catch {
      // Stream may already be closed
    }
  };

  const close = () => {
    try {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      send("done", "[DONE]");
      controller.close();
    } catch {
      // Already closed
    }
  };

  return {
    stream,
    writer: null as unknown as WritableStreamDefaultWriter<string>,
    encoder,
    send,
    close,
  };
}

/**
 * Wraps a `ReadableStream` in an HTTP `Response` with the correct
 * Server-Sent Events headers.
 *
 * Sets `Content-Type: text/event-stream`, `Cache-Control: no-cache`,
 * and `Connection: keep-alive` so that browsers and fetch clients keep
 * the connection open and process events as they arrive.
 *
 * @param stream - The `ReadableStream` produced by `createSSEStream`.
 * @returns A `Response` ready to be returned from an API route handler.
 */
export function sseResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
