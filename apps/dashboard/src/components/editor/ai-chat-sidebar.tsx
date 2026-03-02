"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { SHORTCUTS } from "@/lib/keyboard-shortcuts";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolActions?: string[];
}

interface AIChatSidebarProps {
  postId: string;
  workspace: string;
  onEditsApplied: (newMarkdown: string) => void;
}

export function AIChatSidebar({ postId, workspace, onEditsApplied }: AIChatSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const fetchUpdatedMarkdown = useCallback(async () => {
    try {
      const res = await fetch(`/api/content/${postId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.markdown) {
          onEditsApplied(data.markdown);
        }
      }
    } catch {
      // Silent fail — user can manually refresh
    }
  }, [postId, onEditsApplied]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
    setStatusText("Connecting...");

    const conversationHistory = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug: workspace,
          postId,
          message: trimmed,
          conversationHistory,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${err.error || res.statusText}` },
        ]);
        setIsStreaming(false);
        setStatusText("");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let assistantText = "";
      const toolActions: string[] = [];
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            const event = line.slice(7).trim();
            const nextLine = lines[lines.indexOf(line) + 1];
            if (!nextLine?.startsWith("data: ")) continue;

            const dataStr = nextLine.slice(6);
            if (dataStr === "[DONE]") continue;

            try {
              const data = JSON.parse(dataStr);

              switch (event) {
                case "status":
                  setStatusText(data.message || "Processing...");
                  break;
                case "text":
                  assistantText += data.content || "";
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
                      updated[lastIdx] = { ...updated[lastIdx], content: assistantText, toolActions };
                    } else {
                      updated.push({ role: "assistant", content: assistantText, toolActions });
                    }
                    return updated;
                  });
                  break;
                case "tool_use":
                  toolActions.push(`Using ${data.tool}...`);
                  setStatusText(`Using ${data.tool}...`);
                  break;
                case "tool_result":
                  if (data.tool === "edit_markdown" && data.success) {
                    // Fetch updated markdown from the post
                    fetchUpdatedMarkdown();
                  }
                  break;
                case "error":
                  assistantText += `\n\nError: ${data.message}`;
                  break;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      // Ensure final message is set
      if (assistantText) {
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
            updated[lastIdx] = { ...updated[lastIdx], content: assistantText, toolActions };
          } else {
            updated.push({ role: "assistant", content: assistantText, toolActions });
          }
          return updated;
        });
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Connection error: ${error instanceof Error ? error.message : "Unknown"}` },
      ]);
    } finally {
      setIsStreaming(false);
      setStatusText("");
    }
  }, [input, isStreaming, messages, postId, workspace, fetchUpdatedMarkdown]);

  useKeyboardShortcut(SHORTCUTS.Actions[1], handleSend, { captureInInputs: true });

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-sf-border">
        <h3 className="font-display font-semibold text-sf-text-primary text-sm">AI Assistant</h3>
        {statusText && (
          <p className="text-xs text-sf-accent mt-1 flex items-center gap-1">
            <Loader2 size={12} className="animate-spin" />
            {statusText}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot size={32} className="mx-auto text-sf-text-muted mb-2" />
            <p className="text-sm text-sf-text-muted">Ask the AI to edit your content.</p>
            <p className="text-xs text-sf-text-muted mt-1">Try: "Make the intro more engaging"</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-sf-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={14} className="text-sf-accent" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[85%] rounded-sf-lg px-3 py-2 text-sm",
                msg.role === "user"
                  ? "bg-sf-accent text-sf-bg-primary"
                  : "bg-sf-bg-tertiary text-sf-text-primary"
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.toolActions && msg.toolActions.length > 0 && (
                <div className="mt-2 border-t border-sf-border/30 pt-1">
                  {msg.toolActions.map((action, j) => (
                    <p key={j} className="text-xs text-sf-text-muted">{action}</p>
                  ))}
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-6 h-6 rounded-full bg-sf-bg-tertiary flex items-center justify-center flex-shrink-0 mt-0.5">
                <User size={14} className="text-sf-text-secondary" />
              </div>
            )}
          </div>
        ))}

        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-sf-accent/20 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-sf-accent" />
            </div>
            <div className="bg-sf-bg-tertiary rounded-sf-lg px-3 py-2">
              <Loader2 size={16} className="text-sf-accent animate-spin" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-sf-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && !e.metaKey && handleSend()}
            placeholder="Ask AI to edit..."
            disabled={isStreaming}
            className="flex-1 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-border-focus disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="bg-sf-accent text-sf-bg-primary p-2 rounded-sf hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
