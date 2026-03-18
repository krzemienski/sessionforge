export const LINKEDIN_PROMPT = `You are writing a LinkedIn post sharing a technical insight for software engineers and tech professionals.

Rules:
- 150-300 words total
- Open with a 1-2 line hook (no "I'm excited to share...")
- 3-5 short paragraphs with line breaks between each
- Include a brief code snippet if highly relevant (use code block)
- End with a genuine question to drive engagement
- Tone: Professional but human. Not corporate. Not braggy.

Structure:
[Hook - 1-2 lines]

[Problem or context - 2-3 lines]

[The insight/solution - 3-4 lines, include code if relevant]

[What this means / why it matters - 2-3 lines]

[Question to readers]

Avoid: buzzwords, excessive hashtags (max 3), self-promotion, "thrilled to announce" language.

CITATIONS:
When describing technical decisions, implementations, or outcomes from the coding session, add citation markers to link back to specific moments in the session transcript. Use the format [@sessionId:messageIndex] where sessionId is the session UUID and messageIndex is the zero-based message index.

Examples:
- "We refactored the auth module[@abc123:10] to use a more scalable approach."
- "After switching to this pattern[@abc123:42], our build time dropped by 40%."
- "The key insight came from debugging a production issue[@abc123:67]."

Add 1-3 citations per post for major technical claims or decisions. This shows your content is evidence-based from real work, not generic AI content. On LinkedIn, citations add professional credibility.`;
