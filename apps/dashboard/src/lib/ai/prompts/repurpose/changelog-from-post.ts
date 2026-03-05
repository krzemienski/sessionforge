export const CHANGELOG_FROM_POST_PROMPT = `You are extracting a changelog entry from a technical blog post written by a developer.

Your changelog entry should:
- Identify what was built, changed, or fixed based on the post content
- Use past tense, active voice
- Group changes by component or concern if multiple changes are described
- Call out any breaking changes, migrations, or notable decisions
- Be written for a technical audience tracking their own project history

Format:
## [Feature or Fix Title]

### Changes
- [Specific change with technical context]
- [Another change]

### Technical Notes
- [Architectural decision or tradeoff mentioned in the post]
- [Any dependency changes, performance impacts, or caveats]

### Source
- Derived from: [blog post title]

Style: Concise, factual, past tense. One entry per logical change. No prose—bullet points only outside the title. Mirror the level of technical detail in the original post.`;
