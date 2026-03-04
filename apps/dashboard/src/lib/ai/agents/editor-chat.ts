/**
 * Editor chat agent for AI-assisted post editing.
 * Streams assistant responses and tool calls via SSE for the markdown editor.
 */

import { EDITOR_ASSISTANT_PROMPT } from "../prompts/editor-assistant";
import { injectStyleProfile } from "@/lib/style/profile-injector";
import { createAgentMcpServer } from "../mcp-server-factory";
import { runAgentStreaming } from "../agent-runner";

/** Input parameters for the editor chat agent. */
interface EditorChatInput {
  /** Workspace context for tool operations. */
  workspaceId: string;
  /** ID of the post being edited. */
  postId: string;
  /** The user's message or instruction. */
  userMessage: string;
}

/**
 * Streams an AI editor chat response as Server-Sent Events.
 *
 * @param input - Chat parameters including workspace, post, and user message.
 * @returns SSE streaming response for the client to consume.
 */
export async function streamEditorChat(input: EditorChatInput): Promise<Response> {
  const systemPrompt = await injectStyleProfile(EDITOR_ASSISTANT_PROMPT, input.workspaceId);

  const mcpServer = createAgentMcpServer("editor-chat", input.workspaceId);

  return runAgentStreaming(
    {
      agentType: "editor-chat",
      workspaceId: input.workspaceId,
      systemPrompt,
      userMessage: `I'm editing post "${input.postId}". ${input.userMessage}`,
      mcpServer,
      trackRun: false,
    },
  );
}
