/**
 * Editor chat agent for AI-assisted post editing.
 * Streams assistant responses and tool calls via SSE for the markdown editor.
 */

import { createAgentMcpServer } from "../mcp-server-factory";
import { runAgentStreaming } from "../agent-runner";
import { EDITOR_ASSISTANT_PROMPT } from "../prompts/editor-assistant";

/** Input parameters for the editor chat agent. */
interface EditorChatInput {
  /** Workspace context for tool operations. */
  workspaceId: string;
  /** ID of the post being edited. */
  postId: string;
  /** The user's message or instruction. */
  userMessage: string;
  /** Optional prior conversation turns for context (serialized into prompt). */
  conversationHistory?: Array<{ role: string; content: string }>;
}

/**
 * Streams an AI editor chat response as Server-Sent Events.
 *
 * @param input - Chat parameters including workspace, post, and user message.
 * @returns SSE streaming response for the client to consume.
 */
export function streamEditorChat(input: EditorChatInput): Response {
  const mcpServer = createAgentMcpServer("editor-chat", input.workspaceId);

  // Serialize conversation history into the prompt for context
  let userMessage = `I'm editing post "${input.postId}". ${input.userMessage}`;
  if (input.conversationHistory?.length) {
    const history = input.conversationHistory
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");
    userMessage = `Previous conversation:\n${history}\n\nCurrent request: ${userMessage}`;
  }

  return runAgentStreaming(
    {
      agentType: "editor-chat",
      workspaceId: input.workspaceId,
      systemPrompt: EDITOR_ASSISTANT_PROMPT,
      userMessage,
      mcpServer,
    },
    { postId: input.postId, workspaceId: input.workspaceId },
  );
}
