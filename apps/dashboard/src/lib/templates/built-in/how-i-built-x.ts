import type { BuiltInTemplate } from "@/types/templates";

/**
 * How I Built X Template
 *
 * A narrative template for documenting project builds, implementations, and
 * technical journeys. Focuses on the story behind the code - decisions made,
 * challenges faced, and lessons learned.
 */
export const howIBuiltXTemplate: BuiltInTemplate = {
  name: "How I Built X",
  slug: "how-i-built-x",
  contentType: "blog_post",
  description:
    "A narrative template for documenting how you built a project, feature, or system. Perfect for sharing your technical journey, architectural decisions, and lessons learned.",
  structure: {
    sections: [
      {
        heading: "The Spark",
        description:
          "What motivated you to build this? What problem were you solving? Set the context for why this project exists.",
        required: true,
      },
      {
        heading: "The Plan",
        description:
          "What was your initial approach? What technologies did you choose and why? Outline your starting architecture and key decisions.",
        required: true,
      },
      {
        heading: "The Build",
        description:
          "Walk through the implementation journey. Include code snippets, architectural diagrams, and key milestones. What worked? What didn't?",
        required: true,
      },
      {
        heading: "The Challenges",
        description:
          "What obstacles did you hit? Technical debt, scaling issues, integration problems? How did you overcome them?",
        required: false,
      },
      {
        heading: "The Outcome",
        description:
          "What did you ship? Show the final result with screenshots, metrics, or demo links. What impact did it have?",
        required: true,
      },
      {
        heading: "What I'd Do Differently",
        description:
          "Reflect on the journey. What would you change? What surprised you? What advice would you give someone building something similar?",
        required: false,
      },
    ],
  },
  toneGuidance: `Write in first person as a journey narrative. Be honest about both successes and failures. Focus on the "why" behind decisions, not just the "what." Show your thought process and evolution.

Style: Conversational but technical. Like explaining your project to a senior engineer over coffee.
Voice: Authentic and reflective. Don't oversell - share the real story, including the messy parts.
Length: 2000-3000 words with code examples and visuals.

Avoid: Marketing speak, excessive jargon, hiding failures, making it sound easier than it was.`,
  exampleContent: `# How I Built a Real-Time Collaborative Code Editor

## The Spark

I was pair programming with a colleague in different time zones, and our existing tools felt clunky. Screen sharing lagged, cursors jumped, and we spent more time fighting the tools than writing code. I thought: "How hard could it be to build something better?"

(Spoiler: harder than I thought, but worth it.)

## The Plan

I started with a simple architecture:
- WebSockets for real-time communication
- Operational Transform (OT) for conflict resolution
- Monaco Editor for the UI
- Node.js backend with Redis for session state

The tech choices were deliberate. I'd read about OT vs CRDT and went with OT because I found better docs. In retrospect, CRDT might have been easier, but we'll get to that.

\`\`\`typescript
// Initial server setup - looked simple enough
const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    // Apply OT here... how hard could it be?
  });
});
\`\`\`

## The Build

The first version took three weekends. Monaco integrated smoothly - their docs are excellent. WebSocket communication worked on the first try (rare!). The problem was everything in between...

[Continue with detailed implementation story, code examples, and lessons learned]`,
};

export default howIBuiltXTemplate;
