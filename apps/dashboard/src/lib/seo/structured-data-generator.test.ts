/**
 * Unit tests for the structured data (JSON-LD) generator.
 */
import { describe, expect, it } from "bun:test";
import {
  detectSchemaType,
  generateStructuredData,
  wrapInScriptTag,
  isTechContent,
  detectProficiencyLevel,
  extractDependencies,
  estimateHowToTime,
  type ArticleSchema,
  type FAQPageSchema,
  type HowToSchema,
  type HowToStep,
  type SoftwareApplicationSchema,
} from "./structured-data-generator";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<Parameters<typeof generateStructuredData>[0]> = {}) {
  return {
    title: "Test Post",
    content: "# Introduction\n\nThis is a test post with some content about programming.",
    datePublished: "2026-03-01T00:00:00Z",
    author: { name: "Jane Doe", url: "https://example.com/jane" },
    publisher: {
      name: "SessionForge",
      url: "https://sessionforge.io",
      logoUrl: "https://sessionforge.io/logo.png",
    },
    keywords: ["test", "programming"],
    url: "https://sessionforge.io/blog/test",
    imageUrl: "https://sessionforge.io/og.png",
    ...overrides,
  };
}

const FAQ_CONTENT = `# What is REST?
REST stands for Representational State Transfer. It is an architectural style for building APIs.

# What is JSON?
JSON is a lightweight data interchange format. It is easy for humans to read and write.

# How do I authenticate?
You can use JWT tokens for authentication. Pass the token in the Authorization header.
`;

const HOWTO_CONTENT = `# Deploying Your App

Follow these steps to deploy.

1. Clone the repository
   Run git clone to get the code on your machine.
2. Install dependencies
   Run npm install to install all required packages.
3. Build the project
   Run npm run build to compile the source code.
4. Start the server
   Run node server.js to launch the application.
`;

const SOFTWARE_CONTENT = `# SessionForge Desktop v3.1.0

SessionForge Desktop is a developer tool for managing AI coding sessions.

## System Requirements

- Windows 10 or macOS 12 or later
- Linux Ubuntu 20.04+
- 8GB RAM minimum

## Downloads

Download the application from our website. The software supports automatic updates.

## Release Notes

- Improved performance
- New plugin system
`;

const SOFTWARE_CONTENT_GAME = `# Epic Quest v1.0.0

Download this exciting game for Windows and Android.

## Minimum Requirements
- Windows 10 or later
- 16GB RAM

## About
Run the installer to set up the game on your system. This software is free to download.
`;

// ---------------------------------------------------------------------------
// detectSchemaType
// ---------------------------------------------------------------------------

describe("detectSchemaType", () => {
  it("returns Article for generic prose content", () => {
    expect(detectSchemaType("# Hello\n\nThis is a blog post about things.")).toBe("Article");
  });

  it("returns FAQPage for content with 3+ question headings", () => {
    expect(detectSchemaType(FAQ_CONTENT)).toBe("FAQPage");
  });

  it("returns HowTo for content with numbered steps", () => {
    expect(detectSchemaType(HOWTO_CONTENT)).toBe("HowTo");
  });

  it("returns HowTo for content with Step headings", () => {
    const stepContent = "# Step 1: Clone\nRun git clone.\n\n# Step 2: Install\nRun npm install.\n\n# Step 3: Build\nRun npm build.";
    expect(detectSchemaType(stepContent)).toBe("HowTo");
  });

  it("returns SoftwareApplication for software-related content", () => {
    const softwareContent = `# MyApp v2.3.0

Download MyApp for Windows and macOS. This software tool includes automatic updates.

## System Requirements

- Windows 10 or later
- macOS 12 or later
- 4GB RAM minimum

## About

This application is available as a free download from our website.`;
    expect(detectSchemaType(softwareContent)).toBe("SoftwareApplication");
  });

  it("returns FAQPage before SoftwareApplication when both patterns present", () => {
    const mixed = FAQ_CONTENT + "\n\nDownload the software v1.0.0 installer tool.";
    expect(detectSchemaType(mixed)).toBe("FAQPage");
  });
});

// ---------------------------------------------------------------------------
// generateStructuredData — Article
// ---------------------------------------------------------------------------

describe("generateStructuredData — Article", () => {
  it("returns type Article for generic content", () => {
    const result = generateStructuredData(makeInput());
    expect(result.type).toBe("Article");
  });

  it("produces a valid Article schema with required fields", () => {
    const result = generateStructuredData(makeInput());
    const schema = result.schema as ArticleSchema;
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("Article");
    expect(schema.headline).toBe("Test Post");
    expect(schema.author["@type"]).toBe("Person");
    expect(schema.author.name).toBe("Jane Doe");
    expect(schema.publisher["@type"]).toBe("Organization");
    expect(schema.publisher.name).toBe("SessionForge");
    expect(schema.datePublished).toBe("2026-03-01T00:00:00Z");
  });

  it("includes image object when imageUrl provided", () => {
    const result = generateStructuredData(makeInput());
    const schema = result.schema as ArticleSchema;
    expect(schema.image).toBeDefined();
    if (schema.image && typeof schema.image === "object") {
      expect((schema.image as { url: string }).url).toBe("https://sessionforge.io/og.png");
    }
  });

  it("includes keywords as comma-separated string", () => {
    const result = generateStructuredData(makeInput());
    const schema = result.schema as ArticleSchema;
    expect(schema.keywords).toBe("test, programming");
  });

  it("includes mainEntityOfPage when url provided", () => {
    const result = generateStructuredData(makeInput());
    const schema = result.schema as ArticleSchema;
    expect(schema.mainEntityOfPage?.["@type"]).toBe("WebPage");
    expect(schema.mainEntityOfPage?.["@id"]).toBe("https://sessionforge.io/blog/test");
  });

  it("uses provided description instead of auto-excerpt", () => {
    const result = generateStructuredData(makeInput({ description: "Custom description" }));
    const schema = result.schema as ArticleSchema;
    expect(schema.description).toBe("Custom description");
  });

  it("defaults dateModified to datePublished when not provided", () => {
    const result = generateStructuredData(makeInput());
    const schema = result.schema as ArticleSchema;
    expect(schema.dateModified).toBe("2026-03-01T00:00:00Z");
  });

  it("uses provided dateModified when supplied", () => {
    const result = generateStructuredData(makeInput({ dateModified: "2026-03-05T00:00:00Z" }));
    const schema = result.schema as ArticleSchema;
    expect(schema.dateModified).toBe("2026-03-05T00:00:00Z");
  });

  it("omits optional fields when not provided", () => {
    const minimal = makeInput({ url: undefined, imageUrl: undefined, keywords: undefined });
    const result = generateStructuredData(minimal);
    const schema = result.schema as ArticleSchema;
    expect(schema.url).toBeUndefined();
    expect(schema.image).toBeUndefined();
    expect(schema.keywords).toBeUndefined();
    expect(schema.mainEntityOfPage).toBeUndefined();
  });

  it("produces valid JSON-LD string", () => {
    const result = generateStructuredData(makeInput());
    expect(() => JSON.parse(result.jsonLd)).not.toThrow();
  });

  it("forces Article type when forceType is Article", () => {
    const result = generateStructuredData(makeInput({ content: FAQ_CONTENT }), "Article");
    expect(result.type).toBe("Article");
  });
});

// ---------------------------------------------------------------------------
// generateStructuredData — HowTo
// ---------------------------------------------------------------------------

describe("generateStructuredData — HowTo", () => {
  it("returns type HowTo for numbered-step content", () => {
    const result = generateStructuredData(makeInput({ content: HOWTO_CONTENT }));
    expect(result.type).toBe("HowTo");
  });

  it("produces a valid HowTo schema with required fields", () => {
    const result = generateStructuredData(makeInput({ content: HOWTO_CONTENT }));
    const schema = result.schema as HowToSchema;
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("HowTo");
    expect(schema.name).toBe("Test Post");
    expect(schema.author.name).toBe("Jane Doe");
  });

  it("parses numbered list items into steps", () => {
    const result = generateStructuredData(makeInput({ content: HOWTO_CONTENT }));
    const schema = result.schema as HowToSchema;
    expect(schema.step.length).toBeGreaterThanOrEqual(4);
    expect(schema.step[0]["@type"]).toBe("HowToStep");
    expect(schema.step[0].position).toBe(1);
  });

  it("assigns sequential positions to steps", () => {
    const result = generateStructuredData(makeInput({ content: HOWTO_CONTENT }));
    const schema = result.schema as HowToSchema;
    schema.step.forEach((step, idx) => {
      expect(step.position).toBe(idx + 1);
    });
  });

  it("forces HowTo type when forceType is HowTo", () => {
    const result = generateStructuredData(makeInput(), "HowTo");
    expect(result.type).toBe("HowTo");
  });

  it("includes totalTime in ISO 8601 duration format", () => {
    const result = generateStructuredData(makeInput({ content: HOWTO_CONTENT }));
    const schema = result.schema as HowToSchema;
    expect(schema.totalTime).toBeDefined();
    expect(schema.totalTime).toMatch(/^PT(\d+H)?(\d+M)?$/);
  });

  it("calculates totalTime based on step count (base 2 min per step)", () => {
    const result = generateStructuredData(makeInput({ content: HOWTO_CONTENT }));
    const schema = result.schema as HowToSchema;
    // 4 steps × 2 min = 8 min base
    expect(schema.totalTime).toBe("PT8M");
  });

  it("adds extra time for steps with high word counts", () => {
    const verboseStep = "word ".repeat(60).trim();
    const verboseContent = `# How to do things\n\n1. ${verboseStep}\n2. Short step\n3. Another short step`;
    const result = generateStructuredData(makeInput({ content: verboseContent }));
    const schema = result.schema as HowToSchema;
    // 3 steps × 2 min = 6 min base + 3 min for 1 complex step = 9 min
    expect(schema.totalTime).toBe("PT9M");
  });

  it("adds extra time when content contains code blocks", () => {
    const codeContent = `# How to set up\n\n1. Install deps\n2. Configure settings\n3. Start server\n\n\`\`\`bash\nnpm install\n\`\`\``;
    const result = generateStructuredData(makeInput({ content: codeContent }));
    const schema = result.schema as HowToSchema;
    // 3 steps × 2 min = 6 min + 5 min code = 11 min
    expect(schema.totalTime).toBe("PT11M");
  });
});

// ---------------------------------------------------------------------------
// estimateHowToTime
// ---------------------------------------------------------------------------

describe("estimateHowToTime", () => {
  function makeStep(position: number, text = "Short step text"): HowToStep {
    return { "@type": "HowToStep", name: `Step ${position}`, text, position };
  }

  it("returns ISO 8601 duration format", () => {
    const result = estimateHowToTime([makeStep(1)], "");
    expect(result).toMatch(/^PT(\d+H)?(\d+M)?$/);
  });

  it("calculates 2 minutes per step as base", () => {
    const steps = [makeStep(1), makeStep(2), makeStep(3)];
    expect(estimateHowToTime(steps, "")).toBe("PT6M");
  });

  it("adds 3 extra minutes for steps exceeding 50 words", () => {
    const longText = "word ".repeat(60).trim();
    const steps = [makeStep(1, longText), makeStep(2)];
    // 2 steps × 2 min = 4 + 3 extra = 7
    expect(estimateHowToTime(steps, "")).toBe("PT7M");
  });

  it("adds 5 extra minutes when content has code blocks", () => {
    const steps = [makeStep(1)];
    const content = "```js\nconsole.log('hi');\n```";
    // 1 step × 2 min + 5 code = 7
    expect(estimateHowToTime(steps, content)).toBe("PT7M");
  });

  it("formats hours and minutes for large estimates", () => {
    // 30 steps × 2 min = 60 min + 5 code = 65 min = 1H5M
    const steps = Array.from({ length: 30 }, (_, i) => makeStep(i + 1));
    const content = "```py\nprint('hello')\n```";
    expect(estimateHowToTime(steps, content)).toBe("PT1H5M");
  });

  it("formats exact hours without minutes", () => {
    // 30 steps × 2 min = 60 min = 1H
    const steps = Array.from({ length: 30 }, (_, i) => makeStep(i + 1));
    expect(estimateHowToTime(steps, "")).toBe("PT1H");
  });

  it("returns at least PT1M for empty steps array", () => {
    expect(estimateHowToTime([], "")).toBe("PT1M");
  });
});

// ---------------------------------------------------------------------------
// generateStructuredData — FAQPage
// ---------------------------------------------------------------------------

describe("generateStructuredData — FAQPage", () => {
  it("returns type FAQPage for question-heading content", () => {
    const result = generateStructuredData(makeInput({ content: FAQ_CONTENT }));
    expect(result.type).toBe("FAQPage");
  });

  it("produces a valid FAQPage schema with required fields", () => {
    const result = generateStructuredData(makeInput({ content: FAQ_CONTENT }));
    const schema = result.schema as FAQPageSchema;
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("FAQPage");
    expect(schema.name).toBe("Test Post");
  });

  it("parses question headings into FAQ entries", () => {
    const result = generateStructuredData(makeInput({ content: FAQ_CONTENT }));
    const schema = result.schema as FAQPageSchema;
    expect(schema.mainEntity.length).toBe(3);
    expect(schema.mainEntity[0]["@type"]).toBe("Question");
    expect(schema.mainEntity[0].name).toContain("What is REST");
    expect(schema.mainEntity[0].acceptedAnswer["@type"]).toBe("Answer");
  });

  it("includes answer text in each FAQ entry", () => {
    const result = generateStructuredData(makeInput({ content: FAQ_CONTENT }));
    const schema = result.schema as FAQPageSchema;
    expect(schema.mainEntity[0].acceptedAnswer.text.length).toBeGreaterThan(0);
  });

  it("forces FAQPage type when forceType is FAQPage", () => {
    const result = generateStructuredData(makeInput(), "FAQPage");
    expect(result.type).toBe("FAQPage");
  });
});

// ---------------------------------------------------------------------------
// generateStructuredData — TechArticle
// ---------------------------------------------------------------------------

const TECH_CONTENT_SIMPLE = `# Understanding TypeScript Types

TypeScript adds type safety to JavaScript.

\`\`\`typescript
const greet = (name: string): string => {
  return \`Hello, \${name}!\`;
};
\`\`\`

This makes your code more maintainable.
`;

const TECH_CONTENT_ADVANCED = `# Advanced Async Patterns in Kubernetes

This article covers concurrency, performance optimization, and deployment pipelines.

\`\`\`typescript
async function fetchData(): Promise<Data> {
  const result = await api.get("/data");
  return result;
}
\`\`\`

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
\`\`\`

\`\`\`bash
kubectl apply -f deployment.yaml
\`\`\`

Use benchmarks to verify your optimization.
`;

describe("TechArticle detection", () => {
  it("isTechContent returns true for content with fenced code blocks", () => {
    expect(isTechContent(TECH_CONTENT_SIMPLE)).toBe(true);
  });

  it("isTechContent returns false for content without code blocks", () => {
    expect(isTechContent("# Hello\n\nThis is a blog post.")).toBe(false);
  });

  it("detectProficiencyLevel returns Beginner for simple technical content", () => {
    expect(detectProficiencyLevel(TECH_CONTENT_SIMPLE)).toBe("Beginner");
  });

  it("detectProficiencyLevel returns Expert for content with 3+ code blocks", () => {
    expect(detectProficiencyLevel(TECH_CONTENT_ADVANCED)).toBe("Expert");
  });

  it("extractDependencies returns language tags from code blocks", () => {
    const deps = extractDependencies(TECH_CONTENT_SIMPLE);
    expect(deps).toBe("typescript");
  });

  it("extractDependencies returns multiple unique languages", () => {
    const deps = extractDependencies(TECH_CONTENT_ADVANCED);
    expect(deps).toContain("typescript");
    expect(deps).toContain("yaml");
    expect(deps).toContain("bash");
  });

  it("extractDependencies returns undefined when no language tags present", () => {
    const content = "# Test\n\n```\nsome code\n```\n";
    expect(extractDependencies(content)).toBeUndefined();
  });
});

describe("generateStructuredData — TechArticle", () => {
  it("sets @type to TechArticle when content has code blocks", () => {
    const result = generateStructuredData(makeInput({ content: TECH_CONTENT_SIMPLE }));
    const schema = result.schema as ArticleSchema;
    expect(schema["@type"]).toBe("TechArticle");
  });

  it("sets @type to Article when content has no code blocks", () => {
    const result = generateStructuredData(makeInput());
    const schema = result.schema as ArticleSchema;
    expect(schema["@type"]).toBe("Article");
  });

  it("includes proficiencyLevel for TechArticle", () => {
    const result = generateStructuredData(makeInput({ content: TECH_CONTENT_SIMPLE }));
    const schema = result.schema as ArticleSchema;
    expect(schema.proficiencyLevel).toBe("Beginner");
  });

  it("sets Expert proficiencyLevel for advanced content", () => {
    const result = generateStructuredData(makeInput({ content: TECH_CONTENT_ADVANCED }));
    const schema = result.schema as ArticleSchema;
    expect(schema.proficiencyLevel).toBe("Expert");
  });

  it("includes dependencies from code block language tags", () => {
    const result = generateStructuredData(makeInput({ content: TECH_CONTENT_SIMPLE }));
    const schema = result.schema as ArticleSchema;
    expect(schema.dependencies).toBe("typescript");
  });

  it("does not include proficiencyLevel for plain Article", () => {
    const result = generateStructuredData(makeInput());
    const schema = result.schema as ArticleSchema;
    expect(schema.proficiencyLevel).toBeUndefined();
  });

  it("does not include dependencies for plain Article", () => {
    const result = generateStructuredData(makeInput());
    const schema = result.schema as ArticleSchema;
    expect(schema.dependencies).toBeUndefined();
  });

  it("still detects schema type as Article for TechArticle content", () => {
    const result = generateStructuredData(makeInput({ content: TECH_CONTENT_SIMPLE }));
    expect(result.type).toBe("Article");
  });
});

// ---------------------------------------------------------------------------
// generateStructuredData — SoftwareApplication
// ---------------------------------------------------------------------------

describe("generateStructuredData — SoftwareApplication", () => {
  it("returns type SoftwareApplication for software content", () => {
    const result = generateStructuredData(makeInput({ content: SOFTWARE_CONTENT }));
    expect(result.type).toBe("SoftwareApplication");
  });

  it("produces a valid SoftwareApplication schema with required fields", () => {
    const result = generateStructuredData(makeInput({ content: SOFTWARE_CONTENT }));
    const schema = result.schema as SoftwareApplicationSchema;
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("SoftwareApplication");
    expect(schema.name).toBe("Test Post");
    expect(schema.author["@type"]).toBe("Person");
    expect(schema.author.name).toBe("Jane Doe");
  });

  it("includes applicationCategory field", () => {
    const result = generateStructuredData(makeInput({ content: SOFTWARE_CONTENT }));
    const schema = result.schema as SoftwareApplicationSchema;
    expect(schema.applicationCategory).toBeDefined();
    expect(schema.applicationCategory).toBe("DeveloperApplication");
  });

  it("detects GameApplication category", () => {
    const result = generateStructuredData(makeInput({ content: SOFTWARE_CONTENT_GAME }));
    const schema = result.schema as SoftwareApplicationSchema;
    expect(schema.applicationCategory).toBe("GameApplication");
  });

  it("detects operating systems from content", () => {
    const result = generateStructuredData(makeInput({ content: SOFTWARE_CONTENT }));
    const schema = result.schema as SoftwareApplicationSchema;
    expect(schema.operatingSystem).toBeDefined();
    expect(schema.operatingSystem).toContain("Windows");
    expect(schema.operatingSystem).toContain("macOS");
    expect(schema.operatingSystem).toContain("Linux");
  });

  it("includes offers field with default free pricing", () => {
    const result = generateStructuredData(makeInput({ content: SOFTWARE_CONTENT }));
    const schema = result.schema as SoftwareApplicationSchema;
    expect(schema.offers).toBeDefined();
    expect(schema.offers?.["@type"]).toBe("Offer");
    expect(schema.offers?.price).toBe("0");
    expect(schema.offers?.priceCurrency).toBe("USD");
  });

  it("includes url when provided", () => {
    const result = generateStructuredData(makeInput({ content: SOFTWARE_CONTENT }));
    const schema = result.schema as SoftwareApplicationSchema;
    expect(schema.url).toBe("https://sessionforge.io/blog/test");
  });

  it("includes image when imageUrl provided", () => {
    const result = generateStructuredData(makeInput({ content: SOFTWARE_CONTENT }));
    const schema = result.schema as SoftwareApplicationSchema;
    expect(schema.image).toBeDefined();
  });

  it("forces SoftwareApplication type when forceType is SoftwareApplication", () => {
    const result = generateStructuredData(makeInput(), "SoftwareApplication");
    expect(result.type).toBe("SoftwareApplication");
  });

  it("produces valid JSON-LD string", () => {
    const result = generateStructuredData(makeInput({ content: SOFTWARE_CONTENT }));
    expect(() => JSON.parse(result.jsonLd)).not.toThrow();
  });

  it("defaults dateModified to datePublished when not provided", () => {
    const result = generateStructuredData(makeInput({ content: SOFTWARE_CONTENT }));
    const schema = result.schema as SoftwareApplicationSchema;
    expect(schema.dateModified).toBe("2026-03-01T00:00:00Z");
  });
});

// ---------------------------------------------------------------------------
// wrapInScriptTag
// ---------------------------------------------------------------------------

describe("wrapInScriptTag", () => {
  it("wraps JSON-LD in a script tag with the correct type attribute", () => {
    const jsonLd = '{"@context":"https://schema.org","@type":"Article"}';
    const result = wrapInScriptTag(jsonLd);
    expect(result).toContain('<script type="application/ld+json">');
    expect(result).toContain("</script>");
    expect(result).toContain(jsonLd);
  });

  it("starts with the script opening tag", () => {
    const result = wrapInScriptTag("{}");
    expect(result.trimStart()).toMatch(/^<script type="application\/ld\+json">/);
  });

  it("ends with the closing script tag", () => {
    const result = wrapInScriptTag("{}");
    expect(result.trimEnd()).toMatch(/<\/script>$/);
  });
});

// ---------------------------------------------------------------------------
// Schema.org compliance spot-checks
// ---------------------------------------------------------------------------

describe("Schema.org compliance", () => {
  it("Article schema context is exactly https://schema.org", () => {
    const result = generateStructuredData(makeInput());
    expect(result.schema["@context"]).toBe("https://schema.org");
  });

  it("HowTo schema context is exactly https://schema.org", () => {
    const result = generateStructuredData(makeInput({ content: HOWTO_CONTENT }));
    expect(result.schema["@context"]).toBe("https://schema.org");
  });

  it("FAQPage schema context is exactly https://schema.org", () => {
    const result = generateStructuredData(makeInput({ content: FAQ_CONTENT }));
    expect(result.schema["@context"]).toBe("https://schema.org");
  });

  it("SoftwareApplication schema context is exactly https://schema.org", () => {
    const result = generateStructuredData(makeInput({ content: SOFTWARE_CONTENT }));
    expect(result.schema["@context"]).toBe("https://schema.org");
  });

  it("publisher logo uses ImageObject type", () => {
    const result = generateStructuredData(makeInput());
    const schema = result.schema as ArticleSchema;
    expect(schema.publisher.logo?.["@type"]).toBe("ImageObject");
  });

  it("image uses ImageObject type", () => {
    const result = generateStructuredData(makeInput());
    const schema = result.schema as ArticleSchema;
    if (schema.image && typeof schema.image === "object") {
      expect((schema.image as { "@type": string })["@type"]).toBe("ImageObject");
    }
  });
});
