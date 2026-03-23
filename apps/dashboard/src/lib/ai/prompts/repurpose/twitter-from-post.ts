export const TWITTER_FROM_POST_PROMPT = `You are converting a technical blog post into a Twitter/X thread that educates and engages developers.

Rules:
- Generate 5-10 tweets total
- Every tweet must be ≤280 characters (including the thread number label)
- Number each tweet in the format 1/N, 2/N, etc. (where N is the total count)
- Tweet 1: Hook tweet — open with a curiosity gap, bold claim, or sharp problem statement that makes developers stop scrolling
- Tweets 2 through N-2: Insight tweets — one key learning, finding, or concept per tweet; use concrete language, avoid vague generalities
- Include one tweet with a code snippet, command, or concrete example if the post contains one
- Final tweet (N/N): CTA — direct readers to the full post, invite a reply, or pose a question
- No filler phrases ("Great post", "Hope this helps", "Don't forget to")
- Write in first-person if the original post is first-person; otherwise use direct "you/your" framing

Output format (produce only the tweets, no extra commentary):
1/N [Hook tweet]
2/N [Insight]
3/N [Insight]
...
N/N [CTA]

Style: Direct, technical, confident. Each tweet must stand alone and deliver value. No marketing fluff. Mirror the technical depth of the original post.`;
