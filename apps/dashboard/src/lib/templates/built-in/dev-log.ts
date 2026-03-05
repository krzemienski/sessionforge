import type { BuiltInTemplate } from "@/types/templates";

/**
 * Dev Log Template
 *
 * A template for weekly or periodic development logs. Perfect for tracking
 * progress on projects, documenting decision-making in real-time, and building
 * in public with transparency about both wins and struggles.
 */
export const devLogTemplate: BuiltInTemplate = {
  name: "Dev Log",
  slug: "dev-log",
  contentType: "blog_post",
  description:
    "A template for weekly development logs documenting your build journey. Perfect for building in public, tracking project progress, and sharing the real-time ups and downs of development.",
  structure: {
    sections: [
      {
        heading: "Week Summary",
        description:
          "Start with a quick overview. What was the focus this week? What's the one-sentence version of progress?",
        required: true,
      },
      {
        heading: "What I Shipped",
        description:
          "List concrete wins and completed features. Include screenshots, demo links, or code snippets. Celebrate the tangible progress.",
        required: true,
      },
      {
        heading: "What I Learned",
        description:
          "Technical insights, new tools, or approaches you discovered this week. What would you tell yourself a week ago?",
        required: false,
      },
      {
        heading: "What I'm Stuck On",
        description:
          "Current blockers, open questions, or challenges. Be honest about what's not working. Sometimes writing it out helps solve it.",
        required: false,
      },
      {
        heading: "Technical Deep Dive",
        description:
          "Pick one interesting technical problem from the week and dive deeper. Show code, explain the approach, share the context.",
        required: false,
      },
      {
        heading: "Metrics & Progress",
        description:
          "Numbers that matter for your project. Could be performance metrics, user stats, lines of code, tests written - whatever tells the story.",
        required: false,
      },
      {
        heading: "Next Week's Goals",
        description:
          "What's on deck? Set 2-3 concrete, achievable goals. Helps with accountability and gives readers something to look forward to.",
        required: true,
      },
    ],
  },
  toneGuidance: `Write in first person as an ongoing narrative. Be honest and transparent about both progress and struggles. Think of this as a public journal entry that's useful to others.

Style: Casual but structured. Bullet points are your friend. Include visuals when possible.
Voice: Authentic and conversational. Don't oversell or hide the hard parts.
Length: 800-1500 words. Quick enough to write weekly without burnout.

Avoid: Being too polished or formal. This isn't a press release - it's a real-time snapshot of your work. Don't skip the messy parts.`,
  exampleContent: `# Dev Log: Week 47 - Real-time Collaboration Nearly Works

## Week Summary

Focused on implementing the real-time sync layer for the collaborative editor. Made major progress on operational transforms, but discovered a nasty race condition that's blocking the MVP. Still, shipped cursor tracking and it feels magical.

## What I Shipped

✅ **Live cursor tracking** - You can now see where other users are typing in real-time. Used WebSocket broadcasting with cursor position data. Took 3 hours, feels like the future.

\`\`\`typescript
// Simple but effective cursor broadcast
socket.broadcast.emit('cursor:move', {
  userId: user.id,
  position: { line: 42, column: 15 },
  color: user.color
});
\`\`\`

✅ **Basic presence indicators** - Active user list updates live. Used Redis sorted sets for tracking who's in each document.

✅ **Connection recovery** - Clients now reconnect gracefully after network drops. Implemented exponential backoff (100ms → 1s → 5s).

[Screenshot of multiple cursors in action]

## What I Learned

**Operational Transforms are hard.** I thought I understood them from reading papers. I did not. The actual implementation has so many edge cases:
- Concurrent operations at same position
- Operations on deleted text
- Undo/redo with transforms

Switched to using ShareDB's OT implementation instead of rolling my own. Sometimes the wheel doesn't need reinventing.

**WebSocket reconnection needs careful thought.** You can't just replay all missed operations - you need to:
1. Get current document state
2. Transform queued local operations against latest state
3. Only then resume normal sync

## What I'm Stuck On

**Race condition in concurrent edits** - When two users type at the exact same position simultaneously, sometimes one edit gets lost. My transform logic is wrong somewhere but I can't reproduce it consistently.

Current theory: I'm not properly handling the case where operations are in-flight when new remote ops arrive. Need to queue them? Transform them? Still figuring this out.

If anyone's built collaborative editing before, I'd love to chat.

## Technical Deep Dive: Cursor Position Broadcasting

The cursor tracking was surprisingly fun to build. Key insight: you don't need perfect accuracy, you need low latency.

My approach:
- Throttle cursor updates to every 50ms (60 updates/sec max)
- Only broadcast when cursor actually moves
- Include user color/name with each update
- Let clients interpolate between positions for smoothness

\`\`\`typescript
const debouncedCursorUpdate = throttle((position) => {
  socket.emit('cursor:move', {
    position,
    timestamp: Date.now()
  });
}, 50);

editor.onDidChangeCursorPosition((e) => {
  debouncedCursorUpdate(e.position);
});
\`\`\`

Works great even with 10+ concurrent users.

## Metrics & Progress

- **Lines of code:** 2,847 (up from 2,103)
- **Test coverage:** 67% (down from 71% - need to catch up)
- **WebSocket connections:** Handling 50+ concurrent without issues
- **Latency:** Cursor updates in ~30ms average

## Next Week's Goals

1. **Fix the race condition** - This is blocking everything else. Planning to pair with Sarah who's built similar systems.
2. **Add operation queuing** - Proper handling of in-flight operations during sync.
3. **Write the damn tests** - Coverage dropped this week. Need to test the OT edge cases thoroughly.

Stretch goal: Deploy to staging and get feedback from the team.`,
};

export default devLogTemplate;
