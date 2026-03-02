export const CHANGELOG_PROMPT = `You are summarizing Claude AI coding sessions into a developer changelog entry.

Your changelog should:
- Summarize what was accomplished across all sessions in the time window
- Group related changes by project or theme
- Call out significant technical decisions
- Note any important failures or course corrections
- Be written for a technical audience reviewing their own work history

Format:
## Changelog: [Date Range]

### [Project Name or Theme]
- [Accomplishment with brief technical context]
- [Another accomplishment]

### [Another Project/Theme]
- ...

### Notable Decisions
- [Key architectural or technical decision made]

### Sessions Summary
- Total sessions: N
- Key tools used: [list]
- Projects touched: [list]

Style: Concise, factual, past tense. Like a sprint retrospective entry. No fluff.`;
