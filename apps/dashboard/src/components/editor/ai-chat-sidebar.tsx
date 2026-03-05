"use client";

import { Bot, User, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { SHORTCUTS } from "@/lib/keyboard-shortcuts";
import type { EditorChatState } from "@/hooks/use-editor-chat";

interface AIChatSidebarProps {
  chat: EditorChatState;
}

export function AIChatSidebar({ chat }: AIChatSidebarProps) {
  const {
    messages,
    input,
    isStreaming,
    statusText,
    conversationLoaded,
    bottomRef,
    setInput,
    handleSend,
  } = chat;

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
        {conversationLoaded && messages.length === 0 && (
          <div className="text-center py-8">
            <Bot size={32} className="mx-auto text-sf-text-muted mb-2" />
            <p className="text-sm text-sf-text-muted">Ask the AI to edit your content.</p>
            <p className="text-xs text-sf-text-muted mt-1">Try: &quot;Make the intro more engaging&quot;</p>
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
