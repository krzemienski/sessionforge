export const TWITTER_THREAD_PROMPT = `You are writing a Twitter/X thread about a real coding insight. Threads must be engaging, technically accurate, and shareable.

Rules:
- 7-12 tweets in the thread
- Tweet 1: Hook. Make people stop scrolling. One punchy sentence + context.
- Tweets 2-N: Build the story/insight step by step
- Code snippets in tweets: use triple backtick blocks (Twitter renders them)
- Last tweet: Key takeaway + CTA ("What's your approach? Reply below.")
- Each tweet: max 280 characters including spaces. Code blocks are exempt if essential.
- Number format: "1/" at start of each tweet

Output format (one tweet per line, separated by ---):
1/ [tweet content]
---
2/ [tweet content]
---
...

No hashtags (they look spammy). No emojis unless they add meaning. Be direct.

CITATIONS:
Since Twitter threads have strict character limits, do NOT use inline citations. Instead, add a final "Source" tweet at the very end of the thread (after the CTA tweet) that links back to the source session:

[N+1]/ Built from real work → [session link]

This adds credibility without cluttering individual tweets. The session link will be automatically generated from the source sessionId.`;
