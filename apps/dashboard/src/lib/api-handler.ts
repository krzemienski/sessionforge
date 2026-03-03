import { NextResponse } from "next/server";
import { AppError, ERROR_CODES, formatErrorResponse } from "@/lib/errors";

type RouteContext = { params: Promise<Record<string, string | string[]>> };
type RouteHandlerFn = (req: Request, ctx?: RouteContext) => Promise<Response>;

export function withApiHandler(handler: RouteHandlerFn): RouteHandlerFn {
  return async (req: Request, ctx?: RouteContext): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      const { method, url } = req;

      if (error instanceof AppError) {
        console.error(
          JSON.stringify({
            level: "error",
            timestamp: new Date().toISOString(),
            method,
            url,
            error: error.message,
            code: error.code,
          })
        );
        return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
      }

      // Non-AppError: log internally but never expose internal details to client
      console.error(
        JSON.stringify({
          level: "error",
          timestamp: new Date().toISOString(),
          method,
          url,
          error: error instanceof Error ? error.message : String(error),
          code: ERROR_CODES.INTERNAL_ERROR,
        })
      );
      return NextResponse.json(
        { error: "Internal server error", code: ERROR_CODES.INTERNAL_ERROR },
        { status: 500 }
      );
    }
  };
}
