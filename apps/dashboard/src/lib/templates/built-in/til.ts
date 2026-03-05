import type { BuiltInTemplate } from "@/types/templates";

/**
 * TIL (Today I Learned) Template
 *
 * A concise template for capturing quick technical learnings, gotchas, and
 * discoveries. Perfect for sharing bite-sized knowledge that saved you time
 * or taught you something valuable.
 */
export const tilTemplate: BuiltInTemplate = {
  name: "TIL (Today I Learned)",
  slug: "til",
  contentType: "blog_post",
  description:
    "A concise template for quick technical learnings and discoveries. Perfect for sharing gotchas, tips, tricks, and 'aha!' moments that others might find useful.",
  structure: {
    sections: [
      {
        heading: "The Discovery",
        description:
          "What did you learn? State it clearly and concisely upfront. Lead with the insight.",
        required: true,
      },
      {
        heading: "The Context",
        description:
          "What were you working on when you learned this? What problem were you trying to solve? Set up why this matters.",
        required: true,
      },
      {
        heading: "The Details",
        description:
          "Explain the learning with code examples, commands, or screenshots. Show the before/after or the gotcha that surprised you.",
        required: true,
      },
      {
        heading: "Why It Matters",
        description:
          "What makes this useful? When would someone else encounter this? What errors or time does it save?",
        required: false,
      },
      {
        heading: "Further Reading",
        description:
          "Link to docs, related resources, or deeper dives. Keep it minimal - 2-3 links max.",
        required: false,
      },
    ],
  },
  toneGuidance: `Write in first person, conversational and direct. Lead with the insight - don't bury the lede. Be specific and practical.

Style: Brief and actionable. Get to the point quickly.
Voice: Helpful and enthusiastic. Share your surprise or delight at the discovery.
Length: 300-800 words. Short enough to read in 2-3 minutes.

Avoid: Long intros, excessive backstory, being vague. TIL posts should be scannable and immediately useful.`,
  exampleContent: `# TIL: TypeScript's satisfies Operator Catches Type Errors Without Widening

## The Discovery

TypeScript's \`satisfies\` operator (introduced in TS 4.9) lets you validate that a value matches a type without actually widening the value's type. It's like type assertion's more careful sibling.

## The Context

I was building a config object with string literal types and kept running into this pattern:

\`\`\`typescript
const config = {
  theme: "dark",
  language: "en",
} as const;

// Problem: Can't validate against a type without losing literals
type Config = {
  theme: "light" | "dark";
  language: string;
};
\`\`\`

Using \`as Config\` widened my types. Using \`as const\` meant no type checking. I needed both.

## The Details

Enter \`satisfies\`:

\`\`\`typescript
type Config = {
  theme: "light" | "dark";
  language: string;
};

const config = {
  theme: "dark",    // Type is "dark", not "light" | "dark"
  language: "en",   // Type is "en", not string
} satisfies Config;

// ✅ Validates against Config type
// ✅ Preserves literal types
// ✅ Autocomplete works perfectly

config.theme;  // type is "dark"
\`\`\`

If I typo the theme, TypeScript catches it:

\`\`\`typescript
const bad = {
  theme: "drak",  // ❌ Error: Type '"drak"' is not assignable to type '"light" | "dark"'
} satisfies Config;
\`\`\`

## Why It Matters

Before \`satisfies\`, you had to choose between type safety and precise types. This is especially useful for config objects, theme definitions, and anywhere you want both validation and autocomplete.

## Further Reading

- [TypeScript 4.9 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator)
- [Matt Pocock's satisfies video](https://www.youtube.com/watch?v=49gHWuepxxE)`,
};

export default tilTemplate;
