/**
 * Unit tests for the structured data (JSON-LD) validator.
 */
import { describe, expect, it } from "bun:test";
import {
  validateStructuredData,
  validateJsonLd,
  type ValidationResult,
} from "./structured-data-validator";
import {
  generateStructuredData,
  type ArticleSchema,
  type HowToSchema,
  type FAQPageSchema,
  type SoftwareApplicationSchema,
  type StructuredData,
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

function makeArticleSchema(overrides: Partial<ArticleSchema> = {}): ArticleSchema {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Test Article",
    description: "A test article for validation.",
    author: { "@type": "Person", name: "Jane Doe" },
    publisher: { "@type": "Organization", name: "SessionForge" },
    datePublished: "2026-03-01T00:00:00Z",
    dateModified: "2026-03-10T00:00:00Z",
    ...overrides,
  };
}

function makeHowToSchema(overrides: Partial<HowToSchema> = {}): HowToSchema {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Test",
    description: "A guide on testing.",
    author: { "@type": "Person", name: "Jane Doe" },
    datePublished: "2026-03-01T00:00:00Z",
    dateModified: "2026-03-10T00:00:00Z",
    step: [
      { "@type": "HowToStep", name: "Step 1", text: "Do the first thing.", position: 1 },
      { "@type": "HowToStep", name: "Step 2", text: "Do the second thing.", position: 2 },
    ],
    ...overrides,
  };
}

function makeFAQPageSchema(overrides: Partial<FAQPageSchema> = {}): FAQPageSchema {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    name: "FAQ",
    description: "Frequently asked questions.",
    author: { "@type": "Person", name: "Jane Doe" },
    datePublished: "2026-03-01T00:00:00Z",
    dateModified: "2026-03-10T00:00:00Z",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is this?",
        acceptedAnswer: { "@type": "Answer", text: "This is a test." },
      },
    ],
    ...overrides,
  };
}

function makeSoftwareSchema(
  overrides: Partial<SoftwareApplicationSchema> = {}
): SoftwareApplicationSchema {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TestApp",
    description: "A test application.",
    author: { "@type": "Person", name: "Jane Doe" },
    datePublished: "2026-03-01T00:00:00Z",
    dateModified: "2026-03-10T00:00:00Z",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: validateStructuredData — Article
// ---------------------------------------------------------------------------

describe("validateStructuredData — Article", () => {
  it("passes for a valid Article schema", () => {
    const schema = makeArticleSchema();
    const result = validateStructuredData(schema);
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
    expect(result.type).toBe("Article");
  });

  it("passes for a valid TechArticle schema", () => {
    const schema = makeArticleSchema({
      "@type": "TechArticle",
      proficiencyLevel: "Expert",
      dependencies: "typescript, react",
    });
    const result = validateStructuredData(schema);
    expect(result.valid).toBe(true);
    expect(result.type).toBe("TechArticle");
  });

  it("passes for a valid BlogPosting schema", () => {
    const schema = makeArticleSchema({ "@type": "BlogPosting" });
    const result = validateStructuredData(schema);
    expect(result.valid).toBe(true);
    expect(result.type).toBe("BlogPosting");
  });

  it("errors on missing headline", () => {
    const schema = makeArticleSchema({ headline: "" });
    const result = validateStructuredData(schema);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "headline" && i.severity === "error")).toBe(true);
  });

  it("errors on missing description", () => {
    const schema = makeArticleSchema({ description: "" });
    const result = validateStructuredData(schema);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "description" && i.severity === "error")).toBe(
      true
    );
  });

  it("errors on missing author", () => {
    const schema = makeArticleSchema({ author: null as unknown as ArticleSchema["author"] });
    const result = validateStructuredData(schema);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "author" && i.severity === "error")).toBe(true);
  });

  it("errors on missing publisher", () => {
    const schema = makeArticleSchema({
      publisher: null as unknown as ArticleSchema["publisher"],
    });
    const result = validateStructuredData(schema);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "publisher" && i.severity === "error")).toBe(true);
  });

  it("errors on invalid datePublished", () => {
    const schema = makeArticleSchema({ datePublished: "not-a-date" });
    const result = validateStructuredData(schema);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some((i) => i.path === "datePublished" && i.severity === "error")
    ).toBe(true);
  });

  it("warns on long headline", () => {
    const schema = makeArticleSchema({ headline: "A".repeat(120) });
    const result = validateStructuredData(schema);
    expect(result.warningCount).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.path === "headline" && i.severity === "warning")).toBe(
      true
    );
  });

  it("errors on invalid @context", () => {
    const schema = makeArticleSchema();
    (schema as Record<string, unknown>)["@context"] = "http://schema.org";
    const result = validateStructuredData(schema as unknown as StructuredData);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "@context")).toBe(true);
  });

  it("validates mainEntityOfPage when present", () => {
    const schema = makeArticleSchema({
      url: "https://example.com/post",
      mainEntityOfPage: { "@type": "WebPage", "@id": "https://example.com/post" },
    });
    const result = validateStructuredData(schema);
    expect(result.valid).toBe(true);
  });

  it("validates image as ImageObject", () => {
    const schema = makeArticleSchema({
      image: { "@type": "ImageObject", url: "https://example.com/img.jpg" },
    });
    const result = validateStructuredData(schema);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: validateStructuredData — HowTo
// ---------------------------------------------------------------------------

describe("validateStructuredData — HowTo", () => {
  it("passes for a valid HowTo schema", () => {
    const result = validateStructuredData(makeHowToSchema());
    expect(result.valid).toBe(true);
    expect(result.type).toBe("HowTo");
  });

  it("errors on missing name", () => {
    const result = validateStructuredData(makeHowToSchema({ name: "" }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "name" && i.severity === "error")).toBe(true);
  });

  it("errors on missing step array", () => {
    const schema = makeHowToSchema();
    (schema as Record<string, unknown>).step = "not-an-array";
    const result = validateStructuredData(schema as unknown as StructuredData);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "step" && i.severity === "error")).toBe(true);
  });

  it("warns on empty step array", () => {
    const result = validateStructuredData(makeHowToSchema({ step: [] }));
    expect(result.warningCount).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.path === "step" && i.severity === "warning")).toBe(true);
  });

  it("errors on step with missing name", () => {
    const schema = makeHowToSchema({
      step: [{ "@type": "HowToStep", name: "", text: "Do something.", position: 1 }],
    });
    const result = validateStructuredData(schema);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "step[0].name")).toBe(true);
  });

  it("errors on step with missing text", () => {
    const schema = makeHowToSchema({
      step: [{ "@type": "HowToStep", name: "Step 1", text: "", position: 1 }],
    });
    const result = validateStructuredData(schema);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "step[0].text")).toBe(true);
  });

  it("errors on step with wrong @type", () => {
    const schema = makeHowToSchema({
      step: [
        { "@type": "Wrong" as "HowToStep", name: "Step 1", text: "Do it.", position: 1 },
      ],
    });
    const result = validateStructuredData(schema);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "step[0].@type")).toBe(true);
  });

  it("warns on non-sequential step positions", () => {
    const schema = makeHowToSchema({
      step: [
        { "@type": "HowToStep", name: "Step 1", text: "First.", position: 1 },
        { "@type": "HowToStep", name: "Step 2", text: "Second.", position: 3 },
      ],
    });
    const result = validateStructuredData(schema);
    expect(result.issues.some((i) => i.path === "step" && i.severity === "warning")).toBe(true);
  });

  it("validates totalTime duration format", () => {
    const valid = validateStructuredData(makeHowToSchema({ totalTime: "PT15M" }));
    expect(valid.issues.some((i) => i.path === "totalTime")).toBe(false);

    const invalid = validateStructuredData(makeHowToSchema({ totalTime: "15 minutes" }));
    expect(invalid.issues.some((i) => i.path === "totalTime" && i.severity === "warning")).toBe(
      true
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: validateStructuredData — FAQPage
// ---------------------------------------------------------------------------

describe("validateStructuredData — FAQPage", () => {
  it("passes for a valid FAQPage schema", () => {
    const result = validateStructuredData(makeFAQPageSchema());
    expect(result.valid).toBe(true);
    expect(result.type).toBe("FAQPage");
  });

  it("errors on empty mainEntity", () => {
    const result = validateStructuredData(makeFAQPageSchema({ mainEntity: [] }));
    expect(result.valid).toBe(false);
    expect(
      result.issues.some((i) => i.path === "mainEntity" && i.severity === "error")
    ).toBe(true);
  });

  it("errors on FAQ entry with missing question name", () => {
    const schema = makeFAQPageSchema({
      mainEntity: [
        {
          "@type": "Question",
          name: "",
          acceptedAnswer: { "@type": "Answer", text: "An answer." },
        },
      ],
    });
    const result = validateStructuredData(schema);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "mainEntity[0].name")).toBe(true);
  });

  it("errors on FAQ entry with missing acceptedAnswer", () => {
    const schema = makeFAQPageSchema({
      mainEntity: [
        {
          "@type": "Question",
          name: "What is this?",
          acceptedAnswer: null as unknown as FAQPageSchema["mainEntity"][0]["acceptedAnswer"],
        },
      ],
    });
    const result = validateStructuredData(schema);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "mainEntity[0].acceptedAnswer")).toBe(true);
  });

  it("errors on FAQ entry with wrong @type on acceptedAnswer", () => {
    const schema = makeFAQPageSchema({
      mainEntity: [
        {
          "@type": "Question",
          name: "What is this?",
          acceptedAnswer: {
            "@type": "Wrong" as "Answer",
            text: "An answer.",
          },
        },
      ],
    });
    const result = validateStructuredData(schema);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some((i) => i.path === "mainEntity[0].acceptedAnswer.@type")
    ).toBe(true);
  });

  it("errors on FAQ entry with empty answer text", () => {
    const schema = makeFAQPageSchema({
      mainEntity: [
        {
          "@type": "Question",
          name: "What is this?",
          acceptedAnswer: { "@type": "Answer", text: "" },
        },
      ],
    });
    const result = validateStructuredData(schema);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some((i) => i.path === "mainEntity[0].acceptedAnswer.text")
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: validateStructuredData — SoftwareApplication
// ---------------------------------------------------------------------------

describe("validateStructuredData — SoftwareApplication", () => {
  it("passes for a valid SoftwareApplication schema", () => {
    const result = validateStructuredData(makeSoftwareSchema());
    expect(result.valid).toBe(true);
    expect(result.type).toBe("SoftwareApplication");
  });

  it("errors on missing name", () => {
    const result = validateStructuredData(makeSoftwareSchema({ name: "" }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "name" && i.severity === "error")).toBe(true);
  });

  it("errors on missing description", () => {
    const result = validateStructuredData(makeSoftwareSchema({ description: "" }));
    expect(result.valid).toBe(false);
  });

  it("validates offers with correct types", () => {
    const result = validateStructuredData(
      makeSoftwareSchema({
        offers: { "@type": "Offer", price: "9.99", priceCurrency: "USD" },
      })
    );
    expect(result.valid).toBe(true);
  });

  it("errors on offers with wrong @type", () => {
    const schema = makeSoftwareSchema();
    (schema.offers as Record<string, unknown>)["@type"] = "Wrong";
    const result = validateStructuredData(schema as unknown as StructuredData);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "offers.@type")).toBe(true);
  });

  it("warns when offers is missing", () => {
    const schema = makeSoftwareSchema();
    delete (schema as Record<string, unknown>).offers;
    const result = validateStructuredData(schema as unknown as StructuredData);
    expect(result.warningCount).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.path === "offers" && i.severity === "warning")).toBe(true);
  });

  it("accepts optional applicationCategory and operatingSystem", () => {
    const result = validateStructuredData(
      makeSoftwareSchema({
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Windows, macOS",
      })
    );
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: validateJsonLd
// ---------------------------------------------------------------------------

describe("validateJsonLd", () => {
  it("validates a valid JSON-LD string", () => {
    const schema = makeArticleSchema();
    const jsonLd = JSON.stringify(schema, null, 2);
    const result = validateJsonLd(jsonLd);
    expect(result.valid).toBe(true);
    expect(result.type).toBe("Article");
  });

  it("errors on empty string", () => {
    const result = validateJsonLd("");
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "jsonLd")).toBe(true);
  });

  it("errors on invalid JSON", () => {
    const result = validateJsonLd("{invalid json}");
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes("not valid JSON"))).toBe(true);
  });

  it("errors on non-object JSON (array)", () => {
    const result = validateJsonLd("[1, 2, 3]");
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes("JSON object"))).toBe(true);
  });

  it("validates generated structured data end-to-end", () => {
    const input = makeInput();
    const generated = generateStructuredData(input);
    const result = validateJsonLd(generated.jsonLd);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: Integration with generator
// ---------------------------------------------------------------------------

describe("validator + generator integration", () => {
  it("validates generator output for Article content", () => {
    const input = makeInput({ content: "# My Article\n\nSome content about a topic." });
    const generated = generateStructuredData(input, "Article");
    const result = validateStructuredData(generated.schema);
    expect(result.valid).toBe(true);
    expect(result.type).toBe("Article");
  });

  it("validates generator output for TechArticle content", () => {
    const techContent = `# Building APIs

\`\`\`typescript
const app = express();
\`\`\`

Some technical explanation of the code above.
`;
    const input = makeInput({ content: techContent });
    const generated = generateStructuredData(input);
    const result = validateStructuredData(generated.schema);
    expect(result.valid).toBe(true);
  });

  it("validates generator output for HowTo content", () => {
    const howtoContent = `# How to Deploy

1. Clone the repository
   Run git clone to get the code.
2. Install dependencies
   Run npm install.
3. Build the project
   Run npm run build.
4. Start the server
   Run node server.js.
`;
    const input = makeInput({ content: howtoContent });
    const generated = generateStructuredData(input, "HowTo");
    const result = validateStructuredData(generated.schema);
    expect(result.valid).toBe(true);
    expect(result.type).toBe("HowTo");
  });

  it("validates generator output for FAQPage content", () => {
    const faqContent = `# What is REST?
REST stands for Representational State Transfer.

# What is JSON?
JSON is a lightweight data interchange format.

# How do I authenticate?
You can use JWT tokens for authentication.
`;
    const input = makeInput({ content: faqContent });
    const generated = generateStructuredData(input, "FAQPage");
    const result = validateStructuredData(generated.schema);
    expect(result.valid).toBe(true);
    expect(result.type).toBe("FAQPage");
  });

  it("validates generator output for SoftwareApplication content", () => {
    const softwareContent = `# SessionForge Desktop v3.1.0

SessionForge Desktop is a developer tool for managing sessions.

## System Requirements

- Windows 10 or macOS 12
- Linux Ubuntu 20.04+

## Downloads

Download the application from our website. The software supports updates.

## Release Notes

New features and bug fixes in this version.
`;
    const input = makeInput({ content: softwareContent });
    const generated = generateStructuredData(input, "SoftwareApplication");
    const result = validateStructuredData(generated.schema);
    expect(result.valid).toBe(true);
    expect(result.type).toBe("SoftwareApplication");
  });
});

// ---------------------------------------------------------------------------
// Tests: Unsupported type
// ---------------------------------------------------------------------------

describe("unsupported schema type", () => {
  it("errors on unknown @type", () => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "UnknownType",
    } as unknown as StructuredData;
    const result = validateStructuredData(schema);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes("Unsupported schema type"))).toBe(true);
  });
});
