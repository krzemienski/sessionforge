"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolActions?: string[];
}

interface UseEditorChatOptions {
  postId: string;
  workspace: string;
  onEditsApplied: (newMarkdown: string) => void;
}

export interface EditorChatState {
  messages: ChatMessage[];
  input: string;
  isStreaming: boolean;
  statusText: string;
  conversationLoaded: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  setInput: (value: string) => void;
  handleSend: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
}

export function useEditorChat({ postId, workspace, onEditsApplied }: UseEditorChatOptions): EditorChatState {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [conversationLoaded, setConversationLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load conversation history on mount / when postId changes
  useEffect(() => {
    setMessages([]);
    setConversationLoaded(false);

    let cancelled = false;
    fetch(`/api/content/${postId}/conversation`)
      .then((res) => res.ok ? res.json() : { messages: [] })
      .then((data) => {
        if (!cancelled) {
          setMessages(Array.isArray(data.messages) ? data.messages : []);
          setConversationLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setConversationLoaded(true);
      });

    return () => { cancelled = true; };
  }, [postId]);

  const saveConversation = useCallback(async (updatedMessages: ChatMessage[]) => {
    try {
      await fetch(`/api/content/${postId}/conversation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });
    } catch {
      // Silent fail — persistence is best-effort
    }
  }, [postId]);

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

  const executeMessage = useCallback(async (text: string, currentMessages: ChatMessage[]) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const messagesWithUser = [...currentMessages, userMsg];
    setMessages(messagesWithUser);
    setIsStreaming(true);
    setStatusText("Connecting...");

    const conversationHistory = currentMessages.map((m) => ({
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
          message: text.trim(),
          conversationHistory,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        const errorMsg: ChatMessage = { role: "assistant", content: `Error: ${err.error || res.statusText}` };
        const finalMessages = [...messagesWithUser, errorMsg];
        setMessages(finalMessages);
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

      // Ensure final message is set and persist conversation
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        let finalMessages: ChatMessage[];
        if (assistantText) {
          if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
            updated[lastIdx] = { ...updated[lastIdx], content: assistantText, toolActions };
            finalMessages = updated;
          } else {
            finalMessages = [...updated, { role: "assistant", content: assistantText, toolActions }];
          }
        } else {
          finalMessages = updated;
        }
        saveConversation(finalMessages);
        return finalMessages;
      });
    } catch (error) {
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: `Connection error: ${error instanceof Error ? error.message : "Unknown"}`,
      };
      setMessages((prev) => {
        const finalMessages = [...prev, errorMsg];
        saveConversation(finalMessages);
        return finalMessages;
      });
    } finally {
      setIsStreaming(false);
      setStatusText("");
    }
  }, [isStreaming, postId, workspace, fetchUpdatedMarkdown, saveConversation]);

  const handleSend = useCallback(async () => {
    await executeMessage(input, messages);
    setInput("");
  }, [input, messages, executeMessage]);

  const sendMessage = useCallback(async (text: string) => {
    await executeMessage(text, messages);
  }, [messages, executeMessage]);

  return {
    messages,
    input,
    isStreaming,
    statusText,
    conversationLoaded,
    bottomRef,
    setInput,
    handleSend,
    sendMessage,
  };
}
