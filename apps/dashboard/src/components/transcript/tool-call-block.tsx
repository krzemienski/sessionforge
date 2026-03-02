"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Terminal, FileText, Search, Globe, Code, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./code-block";

interface ToolCallBlockProps {
  toolName: string;
  input: Record<string, unknown>;
  result?: string | null;
  isError?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

const FILE_TOOLS = new Set(["Read", "Write", "Edit", "MultiEdit", "Glob", "Grep"]);
const WEB_TOOLS = new Set(["WebFetch", "WebSearch"]);
const TODO_TOOLS = new Set(["TodoWrite", "TodoRead"]);

function getToolBadgeClass(toolName: string): string {
  if (toolName === "Bash") return "text-sf-warning border-sf-warning/30 bg-sf-warning/10";
  if (FILE_TOOLS.has(toolName)) return "text-sf-info border-sf-info/30 bg-sf-info/10";
  if (WEB_TOOLS.has(toolName)) return "text-purple-400 border-purple-400/30 bg-purple-400/10";
  if (TODO_TOOLS.has(toolName)) return "text-sf-accent border-sf-accent/30 bg-sf-accent/10";
  return "text-sf-text-secondary border-sf-border bg-sf-bg-active";
}

function ToolIcon({ toolName, size = 14 }: { toolName: string; size?: number }) {
  const props = { size, strokeWidth: 1.5 };
  if (toolName === "Bash") return <Terminal {...props} />;
  if (FILE_TOOLS.has(toolName)) return <FileText {...props} />;
  if (WEB_TOOLS.has(toolName)) return <Globe {...props} />;
  if (WEB_TOOLS.has(toolName) || toolName.includes("Search")) return <Search {...props} />;
  return <Code {...props} />;
}

interface PrimaryParam {
  label: string;
  value: string;
}

function getPrimaryParam(toolName: string, input: Record<string, unknown>): PrimaryParam | null {
  if (toolName === "Bash") {
    const cmd = input.command;
    if (typeof cmd === "string") {
      const firstLine = cmd.split("\n")[0];
      return {
        label: "$",
        value: firstLine.length > 100 ? firstLine.slice(0, 100) + "…" : firstLine,
      };
    }
  }
  if (FILE_TOOLS.has(toolName)) {
    const path = input.file_path ?? input.pattern ?? input.path;
    if (typeof path === "string") {
      return { label: "file", value: path };
    }
  }
  if (WEB_TOOLS.has(toolName)) {
    const target = input.url ?? input.query;
    if (typeof target === "string") {
      return {
        label: toolName === "WebSearch" ? "query" : "url",
        value: target.length > 80 ? target.slice(0, 80) + "…" : target,
      };
    }
  }
  return null;
}

// Keys that are rendered specially and excluded from the params section
function getPrimaryKeys(toolName: string): Set<string> {
  if (toolName === "Bash") return new Set(["command"]);
  if (FILE_TOOLS.has(toolName)) return new Set(["file_path", "pattern", "path"]);
  if (WEB_TOOLS.has(toolName)) return new Set(["url", "query"]);
  return new Set();
}

function formatParamValue(value: unknown): string {
  if (typeof value === "string") {
    return value.length > 300 ? value.slice(0, 300) + "…" : value;
  }
  const json = JSON.stringify(value, null, 2);
  return json.length > 300 ? json.slice(0, 300) + "…" : json;
}

interface ParamRowProps {
  name: string;
  value: unknown;
}

function ParamRow({ name, value }: ParamRowProps) {
  return (
    <div className="flex gap-3 text-xs min-w-0">
      <span className="text-sf-text-muted font-code shrink-0 pt-0.5 select-none">{name}:</span>
      <span className="text-sf-text-secondary font-code break-all whitespace-pre-wrap">
        {formatParamValue(value)}
      </span>
    </div>
  );
}

export function ToolCallBlock({
  toolName,
  input,
  result,
  isError = false,
  defaultOpen = false,
  className,
}: ToolCallBlockProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const isBash = toolName === "Bash";
  const isFileTool = FILE_TOOLS.has(toolName);
  const isWebTool = WEB_TOOLS.has(toolName);

  const primaryParam = getPrimaryParam(toolName, input);
  const primaryKeys = getPrimaryKeys(toolName);
  const badgeClass = getToolBadgeClass(toolName);

  const bashCommand = isBash ? (input.command as string | undefined) : undefined;
  const filePath =
    isFileTool
      ? ((input.file_path ?? input.pattern ?? input.path) as string | undefined)
      : undefined;
  const webTarget =
    isWebTool ? ((input.url ?? input.query) as string | undefined) : undefined;

  // Remaining input params (excluding primary keys shown specially)
  const remainingEntries = Object.entries(input).filter(([k]) => !primaryKeys.has(k));

  const hasBody =
    (isBash && bashCommand) ||
    (isFileTool && filePath) ||
    (isWebTool && webTarget) ||
    remainingEntries.length > 0;

  return (
    <div className={cn("rounded-sf-lg border border-sf-border overflow-hidden", className)}>
      {/* Header / Toggle */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-sf-bg-secondary hover:bg-sf-bg-hover transition-colors text-left"
        aria-expanded={isOpen}
      >
        {/* Chevron */}
        <span className="text-sf-text-muted shrink-0">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>

        {/* Tool name badge */}
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs font-code font-medium px-2 py-0.5 rounded-sf border shrink-0",
            badgeClass
          )}
        >
          <ToolIcon toolName={toolName} size={12} />
          {toolName}
        </span>

        {/* Primary param summary */}
        {primaryParam && (
          <span className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
            <span className="text-xs text-sf-text-muted font-code shrink-0">
              {primaryParam.label}
            </span>
            <span className="text-xs text-sf-text-primary font-code truncate">
              {primaryParam.value}
            </span>
          </span>
        )}

        {/* Error badge */}
        {isError && (
          <span className="ml-auto flex items-center gap-1 text-xs text-sf-danger font-code shrink-0">
            <AlertCircle size={12} />
            error
          </span>
        )}
      </button>

      {/* Collapsible body */}
      {isOpen && hasBody && (
        <div className="border-t border-sf-border bg-sf-bg-tertiary">
          <div className="p-4 space-y-4">
            {/* Bash: full command in CodeBlock */}
            {isBash && bashCommand && (
              <div>
                <p className="text-xs text-sf-text-muted font-code mb-2 uppercase tracking-wider">
                  command
                </p>
                <CodeBlock code={bashCommand} language="bash" />
              </div>
            )}

            {/* File tools: file path displayed prominently */}
            {isFileTool && filePath && (
              <div>
                <p className="text-xs text-sf-text-muted font-code mb-1.5 uppercase tracking-wider">
                  {input.file_path ? "file_path" : input.pattern ? "pattern" : "path"}
                </p>
                <div className="flex items-center gap-2 bg-sf-bg-secondary px-3 py-2 rounded-sf border border-sf-border">
                  <FileText size={13} className="text-sf-info shrink-0" />
                  <span className="text-sm text-sf-info font-code break-all">{filePath}</span>
                </div>
              </div>
            )}

            {/* Web tools: url/query displayed */}
            {isWebTool && webTarget && (
              <div>
                <p className="text-xs text-sf-text-muted font-code mb-1.5 uppercase tracking-wider">
                  {input.url ? "url" : "query"}
                </p>
                <div className="flex items-center gap-2 bg-sf-bg-secondary px-3 py-2 rounded-sf border border-sf-border">
                  <Globe size={13} className="text-purple-400 shrink-0" />
                  <span className="text-sm text-purple-400 font-code break-all">{webTarget}</span>
                </div>
              </div>
            )}

            {/* Remaining params */}
            {remainingEntries.length > 0 && (
              <div>
                <p className="text-xs text-sf-text-muted font-code mb-2 uppercase tracking-wider">
                  params
                </p>
                <div className="bg-sf-bg-secondary rounded-sf border border-sf-border px-3 py-2.5 space-y-2">
                  {remainingEntries.map(([key, value]) => (
                    <ParamRow key={key} name={key} value={value} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Result panel */}
          {result != null && (
            <div
              className={cn(
                "border-t border-sf-border",
                isError ? "bg-sf-danger/5" : "bg-sf-bg-primary"
              )}
            >
              <div className="px-4 py-2 border-b border-sf-border">
                <span
                  className={cn(
                    "text-xs font-code uppercase tracking-wider",
                    isError ? "text-sf-danger" : "text-sf-text-muted"
                  )}
                >
                  {isError ? "error" : "result"}
                </span>
              </div>
              <div className="px-4 py-3 max-h-64 overflow-y-auto">
                <pre className="text-xs font-code text-sf-text-secondary whitespace-pre-wrap break-all">
                  {result.length > 2000 ? result.slice(0, 2000) + "\n… (truncated)" : result}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Result only (when body is empty but result exists) */}
      {isOpen && !hasBody && result != null && (
        <div
          className={cn(
            "border-t border-sf-border",
            isError ? "bg-sf-danger/5" : "bg-sf-bg-primary"
          )}
        >
          <div className="px-4 py-2 border-b border-sf-border">
            <span
              className={cn(
                "text-xs font-code uppercase tracking-wider",
                isError ? "text-sf-danger" : "text-sf-text-muted"
              )}
            >
              {isError ? "error" : "result"}
            </span>
          </div>
          <div className="px-4 py-3 max-h-64 overflow-y-auto">
            <pre className="text-xs font-code text-sf-text-secondary whitespace-pre-wrap break-all">
              {result.length > 2000 ? result.slice(0, 2000) + "\n… (truncated)" : result}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
