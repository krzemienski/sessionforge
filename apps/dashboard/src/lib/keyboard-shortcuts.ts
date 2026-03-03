export type ShortcutDefinition = {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  description: string;
  category: string;
};

export const SHORTCUTS: Record<string, ShortcutDefinition[]> = {
  Navigation: [
    {
      key: "1",
      metaKey: true,
      description: "Go to Dashboard",
      category: "Navigation",
    },
    {
      key: "2",
      metaKey: true,
      description: "Go to Sessions",
      category: "Navigation",
    },
    {
      key: "3",
      metaKey: true,
      description: "Go to Insights",
      category: "Navigation",
    },
    {
      key: "4",
      metaKey: true,
      description: "Go to Content",
      category: "Navigation",
    },
    {
      key: "5",
      metaKey: true,
      description: "Go to Automation",
      category: "Navigation",
    },
  ],
  Actions: [
    {
      key: "k",
      metaKey: true,
      description: "Open Search",
      category: "Actions",
    },
    {
      key: "Enter",
      metaKey: true,
      description: "Generate with AI",
      category: "Actions",
    },
    {
      key: "s",
      metaKey: true,
      description: "Save",
      category: "Actions",
    },
    {
      key: "p",
      metaKey: true,
      shiftKey: true,
      description: "Publish",
      category: "Actions",
    },
  ],
  Help: [
    {
      key: "/",
      metaKey: true,
      description: "Show Keyboard Shortcuts",
      category: "Help",
    },
  ],
};

export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: ShortcutDefinition
): boolean {
  const keyMatches = event.key === shortcut.key;
  const metaMatches = (shortcut.metaKey ?? false) === event.metaKey;
  const ctrlMatches = (shortcut.ctrlKey ?? false) === event.ctrlKey;
  const shiftMatches = (shortcut.shiftKey ?? false) === event.shiftKey;
  const altMatches = (shortcut.altKey ?? false) === event.altKey;

  return keyMatches && metaMatches && ctrlMatches && shiftMatches && altMatches;
}
