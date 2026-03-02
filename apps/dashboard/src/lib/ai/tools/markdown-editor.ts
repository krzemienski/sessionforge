import { getMarkdown, updatePost } from "./post-manager";

export type EditOperation =
  | { op: "replaceLine"; lineNumber: number; newContent: string }
  | { op: "replaceRange"; startLine: number; endLine: number; newContent: string }
  | { op: "insert"; afterLine: number; content: string }
  | { op: "delete"; startLine: number; endLine: number };

export async function editMarkdown(
  workspaceId: string,
  postId: string,
  operation: EditOperation
): Promise<{ markdown: string; linesChanged: number }> {
  const current = await getMarkdown(workspaceId, postId);
  const lines = current.split("\n");
  let result: string[];
  let linesChanged = 0;

  switch (operation.op) {
    case "replaceLine": {
      const idx = operation.lineNumber - 1;
      if (idx < 0 || idx >= lines.length) {
        throw new Error(`Line ${operation.lineNumber} out of range (1-${lines.length})`);
      }
      result = [...lines];
      result[idx] = operation.newContent;
      linesChanged = 1;
      break;
    }
    case "replaceRange": {
      const start = operation.startLine - 1;
      const end = operation.endLine - 1;
      if (start < 0 || end >= lines.length || start > end) {
        throw new Error(`Invalid range ${operation.startLine}-${operation.endLine}`);
      }
      const newLines = operation.newContent.split("\n");
      result = [
        ...lines.slice(0, start),
        ...newLines,
        ...lines.slice(end + 1),
      ];
      linesChanged = end - start + 1;
      break;
    }
    case "insert": {
      const idx = operation.afterLine; // insert after this line (0 = before first)
      if (idx < 0 || idx > lines.length) {
        throw new Error(`Cannot insert after line ${operation.afterLine}`);
      }
      const newLines = operation.content.split("\n");
      result = [
        ...lines.slice(0, idx),
        ...newLines,
        ...lines.slice(idx),
      ];
      linesChanged = newLines.length;
      break;
    }
    case "delete": {
      const start = operation.startLine - 1;
      const end = operation.endLine - 1;
      if (start < 0 || end >= lines.length || start > end) {
        throw new Error(`Invalid delete range ${operation.startLine}-${operation.endLine}`);
      }
      result = [...lines.slice(0, start), ...lines.slice(end + 1)];
      linesChanged = end - start + 1;
      break;
    }
    default:
      throw new Error(`Unknown operation`);
  }

  const newMarkdown = result.join("\n");
  await updatePost(workspaceId, postId, { markdown: newMarkdown });

  return { markdown: newMarkdown, linesChanged };
}

// MCP tool definitions
export const markdownEditorTools = [
  {
    name: "edit_markdown",
    description:
      "Edit the markdown content of a post with precise line-level operations. Operations: replaceLine, replaceRange, insert, delete.",
    input_schema: {
      type: "object" as const,
      properties: {
        postId: { type: "string", description: "Post ID to edit" },
        operation: {
          type: "string",
          enum: ["replaceLine", "replaceRange", "insert", "delete"],
          description: "Type of edit operation",
        },
        lineNumber: {
          type: "number",
          description: "Line number (1-indexed) for replaceLine",
        },
        startLine: {
          type: "number",
          description: "Start line (1-indexed) for replaceRange or delete",
        },
        endLine: {
          type: "number",
          description: "End line (1-indexed) for replaceRange or delete",
        },
        afterLine: {
          type: "number",
          description: "Insert content after this line number (0 = before line 1)",
        },
        newContent: {
          type: "string",
          description: "Replacement content for replaceLine or replaceRange",
        },
        content: {
          type: "string",
          description: "Content to insert for insert operation",
        },
      },
      required: ["postId", "operation"],
    },
  },
];

export async function handleMarkdownEditorTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  if (toolName !== "edit_markdown") {
    throw new Error(`Unknown markdown editor tool: ${toolName}`);
  }

  const op = toolInput.operation as string;
  let operation: EditOperation;

  switch (op) {
    case "replaceLine":
      operation = {
        op: "replaceLine",
        lineNumber: toolInput.lineNumber as number,
        newContent: toolInput.newContent as string,
      };
      break;
    case "replaceRange":
      operation = {
        op: "replaceRange",
        startLine: toolInput.startLine as number,
        endLine: toolInput.endLine as number,
        newContent: toolInput.newContent as string,
      };
      break;
    case "insert":
      operation = {
        op: "insert",
        afterLine: toolInput.afterLine as number,
        content: toolInput.content as string,
      };
      break;
    case "delete":
      operation = {
        op: "delete",
        startLine: toolInput.startLine as number,
        endLine: toolInput.endLine as number,
      };
      break;
    default:
      throw new Error(`Unknown operation: ${op}`);
  }

  return editMarkdown(workspaceId, toolInput.postId as string, operation);
}
