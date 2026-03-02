/**
 * SSE streaming helpers for agent responses.
 * Wraps Anthropic SDK streaming into Server-Sent Events format.
 */

export function createSSEStream(): {
  stream: ReadableStream;
  writer: WritableStreamDefaultWriter<string>;
  encoder: TextEncoder;
  send: (event: string, data: unknown) => void;
  close: () => void;
} {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
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

export function sseResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
