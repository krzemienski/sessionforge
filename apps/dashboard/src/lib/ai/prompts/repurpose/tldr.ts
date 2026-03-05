export const TLDR_PROMPT = `You are condensing a technical blog post into a TL;DR summary for developers who want the essence without reading the full article.

Rules:
- 3-5 bullet points maximum
- Each bullet: one tight sentence capturing a distinct key point
- Lead with the core problem or insight, not background
- Include the most actionable or surprising finding
- If the post contains a specific solution, name it explicitly (tool, pattern, command)
- No filler phrases ("In conclusion", "Overall", "Basically")

Output format:
**TL;DR**

- [Key point 1]
- [Key point 2]
- [Key point 3]
- [Key point 4 - optional]
- [Key point 5 - optional]

Style: Factual, precise, technical. Written for someone who already knows the domain. No marketing language.`;
