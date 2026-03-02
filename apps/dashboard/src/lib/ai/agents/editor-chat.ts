import Anthropic from "@anthropic-ai/sdk";
import { getModelForAgent } from "../orchestration/model-selector";
import { getToolsForAgent } from "../orchestration/tool-registry";
import { handlePostManagerTool } from "../tools/post-manager";
import { handleMarkdownEditorTool } from "../tools/markdown-editor";
import { EDITOR_ASSISTANT_PROMPT } from "../prompts/editor-assistant";
import { createSSEStream, sseResponse } from "../orchestration/streaming";
import { injectStyleProfile } from "@/lib/style/profile-injector";

const client = new Anthropic();

interface EditorChatInput {
  workspaceId: string;
  postId: string;
  userMessage: string;
  conversationHistory?: Anthropic.MessageParam[];
}

export function streamEditorChat(input: EditorChatInput): Response {
  const { stream, send, close } = createSSEStream();

  const run = async () => {
    try {
      const model = getModelForAgent("editor-chat");
      const tools = getToolsForAgent("editor-chat");
      const systemPrompt = await injectStyleProfile(EDITOR_ASSISTANT_PROMPT, input.workspaceId);

      const messages: Anthropic.MessageParam[] = [
        ...(input.conversationHistory ?? []),
        {
          role: "user",
          content: `I'm editing post "${input.postId}". ${input.userMessage}`,
        },
      ];

      send("status", { phase: "starting", message: "Processing edit request..." });

      let response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        tools: tools as Anthropic.Tool[],
        messages,
      });

      while (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ContentBlock & { type: "tool_use" } =>
            b.type === "tool_use"
        );

        for (const toolUse of toolUseBlocks) {
          send("tool_use", { tool: toolUse.name, input: toolUse.input });
        }

        const toolResults: Anthropic.MessageParam = {
          role: "user",
          content: await Promise.all(
            toolUseBlocks.map(async (toolUse) => {
              try {
                const result = await dispatchTool(
                  input.workspaceId,
                  toolUse.name,
                  toolUse.input as Record<string, unknown>
                );
                send("tool_result", { tool: toolUse.name, success: true });
                return {
                  type: "tool_result" as const,
                  tool_use_id: toolUse.id,
                  content: JSON.stringify(result),
                };
              } catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                send("tool_result", { tool: toolUse.name, success: false, error: errMsg });
                return {
                  type: "tool_result" as const,
                  tool_use_id: toolUse.id,
                  content: `Error: ${errMsg}`,
                  is_error: true,
                };
              }
            })
          ),
        };

        messages.push({ role: "assistant", content: response.content });
        messages.push(toolResults);

        response = await client.messages.create({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          tools: tools as Anthropic.Tool[],
          messages,
        });
      }

      for (const block of response.content) {
        if (block.type === "text") {
          send("text", { content: block.text });
        }
      }

      send("complete", { usage: response.usage });
    } catch (error) {
      send("error", { message: error instanceof Error ? error.message : String(error) });
    } finally {
      close();
    }
  };

  run();
  return sseResponse(stream);
}

async function dispatchTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  if (toolName === "create_post" || toolName === "update_post" || toolName === "get_post" || toolName === "get_markdown") {
    return handlePostManagerTool(workspaceId, toolName, toolInput);
  }
  if (toolName === "edit_markdown") {
    return handleMarkdownEditorTool(workspaceId, toolName, toolInput);
  }
  throw new Error(`Unknown tool: ${toolName}`);
}
