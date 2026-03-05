import type { BuiltInTemplate } from "@/types/templates";

/**
 * Debugging Story Template
 *
 * A template for documenting debugging war stories - those epic battles with
 * mysterious bugs that taught you something valuable. Perfect for sharing
 * hard-won debugging lessons with the community.
 */
export const debuggingStoryTemplate: BuiltInTemplate = {
  name: "Debugging Story",
  slug: "debugging-story",
  contentType: "blog_post",
  description:
    "Document your debugging war stories and share hard-won lessons. Perfect for mysterious bugs, production incidents, and those 'aha!' moments that took days to reach.",
  structure: {
    sections: [
      {
        heading: "The Incident",
        description:
          "Set the scene. What broke? How did you discover it? What were the symptoms? Paint a vivid picture of the problem.",
        required: true,
      },
      {
        heading: "The Investigation",
        description:
          "Walk through your debugging journey. What did you try first? What clues did you find? Include dead ends - they're part of the story.",
        required: true,
      },
      {
        heading: "The Breakthrough",
        description:
          "What led to the 'aha!' moment? Show the actual bug with code snippets. Explain why it was hard to find.",
        required: true,
      },
      {
        heading: "The Fix",
        description:
          "Show the solution with before/after code. Why does this fix work? What tests did you add to prevent regression?",
        required: true,
      },
      {
        heading: "The Lessons",
        description:
          "What did you learn? What would you do differently next time? What tools or techniques helped most?",
        required: true,
      },
      {
        heading: "The Prevention",
        description:
          "How are you preventing this class of bugs going forward? Monitoring, linting, testing strategies?",
        required: false,
      },
    ],
  },
  toneGuidance: `Write as a detective story - build suspense and curiosity. Be honest about false starts and wrong theories. Show your emotional journey (frustration, confusion, elation).

Style: Narrative and engaging. Make readers feel like they're debugging alongside you.
Voice: Humble and self-aware. Share what you didn't know or got wrong.
Length: 1500-2500 words with code snippets, logs, and stack traces.

Avoid: Making yourself look like a hero. The bug is the villain, not your colleagues. Don't skip the parts where you were wrong - those are the most interesting.`,
  exampleContent: `# The Case of the Disappearing Database Connections

## The Incident

It was 2 AM when PagerDuty woke me up. Production was down. Hard down. The kind of down where the health check endpoint itself was timing out.

The logs showed a pattern I'd never seen:
\`\`\`
Error: Connection pool exhausted (0/100 available)
Error: Connection pool exhausted (0/100 available)
Error: Connection pool exhausted (0/100 available)
...
\`\`\`

All 100 database connections were gone. But our traffic was normal - maybe 20 requests per second. Something was leaking connections, badly.

## The Investigation

First guess: we forgot to close connections somewhere. I grepped for database queries without proper cleanup:

\`\`\`bash
grep -r "db.query" --include="*.ts" | grep -v ".finally"
\`\`\`

Nothing suspicious. Every query had proper cleanup in try/finally blocks. This wasn't going to be easy.

Next, I added aggressive logging around connection lifecycle...

[Continue with detailed debugging journey, false starts, and eventual solution]`,
};

export default debuggingStoryTemplate;
