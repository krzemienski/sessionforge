"use client";

import { useEffect } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { TRANSFORMERS } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import { $getRoot, EditorState } from "lexical";

function MarkdownImportPlugin({ markdown }: { markdown: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!markdown) return;
    editor.update(() => {
      $convertFromMarkdownString(markdown, TRANSFORMERS);
    });
  }, []); // Only import once on mount

  return null;
}

function MarkdownExportPlugin({
  onMarkdownChange,
}: {
  onMarkdownChange: (md: string) => void;
}) {
  function handleChange(editorState: EditorState) {
    editorState.read(() => {
      const md = $convertToMarkdownString(TRANSFORMERS);
      onMarkdownChange(md);
    });
  }

  return <OnChangePlugin onChange={handleChange} ignoreSelectionChange />;
}

/** Allows external code to update the editor content */
export function ExternalUpdatePlugin({
  externalMarkdown,
}: {
  externalMarkdown: string | null;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (externalMarkdown === null) return;
    editor.update(() => {
      $convertFromMarkdownString(externalMarkdown, TRANSFORMERS);
    });
  }, [externalMarkdown, editor]);

  return null;
}

const EDITOR_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
  AutoLinkNode,
];

interface MarkdownEditorProps {
  initialMarkdown: string;
  onMarkdownChange: (md: string) => void;
  externalMarkdown?: string | null;
}

export function MarkdownEditor({
  initialMarkdown,
  onMarkdownChange,
  externalMarkdown = null,
}: MarkdownEditorProps) {
  const initialConfig = {
    namespace: "SessionForgeEditor",
    theme: {
      root: "sf-editor-root",
      paragraph: "sf-editor-paragraph",
      heading: {
        h1: "sf-editor-h1",
        h2: "sf-editor-h2",
        h3: "sf-editor-h3",
      },
      list: {
        ul: "sf-editor-ul",
        ol: "sf-editor-ol",
        listitem: "sf-editor-li",
      },
      code: "sf-editor-code",
      codeHighlight: {},
      link: "sf-editor-link",
      quote: "sf-editor-quote",
      text: {
        bold: "sf-editor-bold",
        italic: "sf-editor-italic",
        code: "sf-editor-inline-code",
        strikethrough: "sf-editor-strikethrough",
      },
    },
    nodes: EDITOR_NODES,
    onError: (error: Error) => {
      console.error("Lexical error:", error);
    },
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="flex-1 flex flex-col bg-sf-bg-secondary border border-sf-border rounded-sf-lg overflow-hidden">
        <RichTextPlugin
          contentEditable={
            <ContentEditable className="flex-1 p-4 text-sm text-sf-text-primary outline-none overflow-y-auto min-h-0" />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <MarkdownImportPlugin markdown={initialMarkdown} />
        <MarkdownExportPlugin onMarkdownChange={onMarkdownChange} />
        <ExternalUpdatePlugin externalMarkdown={externalMarkdown} />
      </div>
    </LexicalComposer>
  );
}
