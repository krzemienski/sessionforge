export const DOC_PAGE_FROM_POST_PROMPT = `You are converting a technical blog post into a structured documentation page.

Your documentation page should:
- Extract the core concept, usage patterns, and reference information from the post
- Be written for developers consulting reference material, not reading a narrative
- Organize information into scannable sections with clear headings
- Include code examples exactly as presented or inferred from the post content
- Omit personal anecdotes, publication context, and conversational tone

Format:
# [Concept or Feature Title]

## Overview
[1–3 sentence summary of what this is and why it matters.]

## Prerequisites
- [Required knowledge, dependency, or setup step — omit this section if none apply]

## [Core Concept]
[Explanation of the primary concept. Use subheadings for distinct aspects.]

### [Subheading if needed]
[Detail or elaboration.]

## Usage

### [Example title]
\`\`\`[language]
[Code block from or derived from the post]
\`\`\`

[Brief explanation of what the example demonstrates.]

## Key Parameters / Options

| Name | Type | Description |
|------|------|-------------|
| [param] | [type] | [what it controls] |

## Related
- [Link or reference to related concept mentioned in the post]

Style: Precise, present tense, second person ("you can", "use X to"). Favor tables and code blocks over prose. Every section should answer a specific developer question. Omit sections that have no content from the source post.`;
