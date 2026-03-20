import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { streamContentStrategist } from "@/lib/ai/agents/content-strategist";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const body = await request.json();
    const { workspaceSlug, customInstructions } = body;

    if (!workspaceSlug) {
      throw new AppError("workspaceSlug is required", ERROR_CODES.VALIDATION_ERROR);
    }

    const { workspace } = await getAuthorizedWorkspace(
      session,
      workspaceSlug,
      PERMISSIONS.CONTENT_CREATE
    );

    return streamContentStrategist({
      workspaceId: workspace.id,
      customInstructions,
    });
  })(request);
}
