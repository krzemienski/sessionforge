/**
 * Unit tests for the structured data (JSON-LD) generator.
 */
import { describe, expect, it } from "bun:test";
import {
  detectSchemaType,
  generateStructuredData,
  wrapInScriptTag,
  type ArticleSchema,
  type FAQPageSchema,
  type HowToSchema,
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

  it("returns FAQPage before HowTo when both patterns present", () => {
    const mixed = FAQ_CONTENT + "\n\n1. Step one\n2. Step two\n3. Step three";
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
