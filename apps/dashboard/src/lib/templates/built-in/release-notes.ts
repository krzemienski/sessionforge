import type { BuiltInTemplate } from "@/types/templates";

/**
 * Release Notes Template
 *
 * A structured template for documenting software releases, version updates,
 * and product launches. Focuses on communicating changes, improvements, and
 * important information to users and stakeholders.
 */
export const releaseNotesTemplate: BuiltInTemplate = {
  name: "Release Notes",
  slug: "release-notes",
  contentType: "changelog",
  description:
    "A clear template for documenting software releases and updates. Perfect for communicating new features, bug fixes, breaking changes, and upgrade instructions to your users.",
  structure: {
    sections: [
      {
        heading: "Overview",
        description:
          "Summarize the release in 2-3 sentences. What's the headline? What's the most important thing users need to know?",
        required: true,
      },
      {
        heading: "What's New",
        description:
          "Highlight the major new features or capabilities. Focus on user-facing improvements and what value they bring.",
        required: true,
      },
      {
        heading: "Improvements",
        description:
          "List enhancements to existing features, performance improvements, and quality of life updates. Show how things got better.",
        required: false,
      },
      {
        heading: "Bug Fixes",
        description:
          "Document resolved issues and bugs. Be specific about what was broken and what's now fixed.",
        required: false,
      },
      {
        heading: "Breaking Changes",
        description:
          "Call out any changes that break backward compatibility. Explain the impact and what users need to do to migrate.",
        required: false,
      },
      {
        heading: "Upgrade Guide",
        description:
          "Provide step-by-step instructions for upgrading. Include migration steps, deprecation warnings, and any required actions.",
        required: false,
      },
      {
        heading: "Known Issues",
        description:
          "List any known bugs or limitations in this release. Provide workarounds if available.",
        required: false,
      },
    ],
  },
  toneGuidance: `Write in clear, user-focused language. Lead with benefits, not implementation details. Be honest about breaking changes and issues.

Style: Structured and scannable. Use bullet points, code examples, and clear headings.
Voice: Professional but approachable. Balance enthusiasm for improvements with clarity about changes.
Length: Varies by release size. Major releases: 1500-2500 words. Minor/patch: 500-1000 words.

Avoid: Jargon without explanation, burying breaking changes, overhyping minor improvements, being vague about impact.`,
  exampleContent: `# Release Notes: SessionForge v2.0

## Overview

SessionForge v2.0 introduces AI-powered content generation, a redesigned template system, and improved session management. This release includes breaking changes to the API - please review the upgrade guide before updating.

**Release Date:** March 4, 2026
**Version:** 2.0.0

## What's New

### AI Content Generation

Transform your session data into polished blog posts, documentation, and tutorials with one click. Our new AI integration analyzes your sessions and generates content using customizable templates.

\`\`\`typescript
const content = await generateContent({
  sessionIds: ['session-123', 'session-456'],
  template: 'how-i-built-x',
  outputFormat: 'markdown'
});
\`\`\`

Features:
- 8 built-in content templates
- Custom template support
- Multi-session synthesis
- Markdown and HTML output

### Redesigned Template System

The new template library makes it easy to create reusable content structures. Templates now support sections, tone guidance, and example content.

- Built-in templates for common use cases
- TypeScript types for template structure
- Template preview in the editor
- Export templates as JSON

## Improvements

- **Session Search**: 3x faster search with fuzzy matching and filters
- **Export Performance**: Batch exports now complete 50% faster
- **Mobile UI**: Improved responsive design for tablet and mobile devices
- **Accessibility**: Added ARIA labels and keyboard navigation throughout

## Bug Fixes

- Fixed session titles not updating when edited inline
- Resolved memory leak in long-running session views
- Corrected timezone handling in session timestamps
- Fixed broken syntax highlighting in code blocks
- Resolved CORS issues with custom API endpoints

## Breaking Changes

### API Endpoint Changes

The \`/api/sessions\` endpoint now returns paginated results by default:

\`\`\`typescript
// Before (v1.x)
const sessions = await fetch('/api/sessions').then(r => r.json());

// After (v2.0)
const response = await fetch('/api/sessions?page=1&limit=50');
const { sessions, total, hasMore } = await response.json();
\`\`\`

### Template Schema Updates

Custom templates must now include a \`contentType\` field:

\`\`\`typescript
// Before
const template = {
  name: "My Template",
  slug: "my-template"
};

// After
const template = {
  name: "My Template",
  slug: "my-template",
  contentType: "blog_post" // required
};
\`\`\`

## Upgrade Guide

### Step 1: Update Dependencies

\`\`\`bash
npm install sessionforge@2.0.0
# or
pnpm update sessionforge@2.0.0
\`\`\`

### Step 2: Update API Calls

Review your code for any direct API calls to \`/api/sessions\`. Add pagination parameters as shown in the Breaking Changes section.

### Step 3: Migrate Custom Templates

Add the \`contentType\` field to any custom templates. Valid values are: \`blog_post\`, \`documentation\`, \`tutorial\`.

### Step 4: Test Your Integration

Run your test suite to catch any compatibility issues:

\`\`\`bash
npm test
\`\`\`

## Known Issues

- **Safari 15.x**: Template preview may not render correctly on Safari 15.x. Upgrade to Safari 16+ or use Chrome/Firefox.
- **Large Sessions**: Sessions with 1000+ messages may experience slow load times. We're working on virtual scrolling for the next release.

## Contributors

Thanks to everyone who contributed to this release! 🎉

View the full changelog on [GitHub](https://github.com/sessionforge/sessionforge/releases/tag/v2.0.0).`,
};

export default releaseNotesTemplate;
