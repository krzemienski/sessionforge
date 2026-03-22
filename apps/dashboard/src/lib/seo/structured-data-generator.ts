/**
 * Structured data (JSON-LD) generator for blog posts.
 * Produces schema.org-compliant Article, HowTo, and FAQPage markup
 * based on content structure analysis.
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** Base schema.org context shared by all generated types. */
interface SchemaBase {
  "@context": "https://schema.org";
  "@type": string;
}

/** A schema.org Person object for authorship. */
export interface SchemaPerson {
  "@type": "Person";
  name: string;
  url?: string;
}

/** A schema.org Organization object for publisher. */
export interface SchemaOrganization {
  "@type": "Organization";
  name: string;
  url?: string;
  logo?: {
    "@type": "ImageObject";
    url: string;
  };
}

/** An image object used in structured data. */
export interface SchemaImageObject {
  "@type": "ImageObject";
  url: string;
  width?: number;
  height?: number;
}

// ---------------------------------------------------------------------------
// Article schema
// ---------------------------------------------------------------------------

/** schema.org Article JSON-LD structure. */
export interface ArticleSchema extends SchemaBase {
  "@type": "Article" | "TechArticle" | "BlogPosting";
  headline: string;
  description: string;
  author: SchemaPerson;
  publisher: SchemaOrganization;
  datePublished: string;
  dateModified: string;
  image?: SchemaImageObject | string;
  url?: string;
  keywords?: string;
  wordCount?: number;
  articleBody?: string;
  mainEntityOfPage?: {
    "@type": "WebPage";
    "@id": string;
  };
  /** TechArticle: proficiency level of the target audience. */
  proficiencyLevel?: "Beginner" | "Expert";
  /** TechArticle: technologies or libraries the article depends on. */
  dependencies?: string;
}

// ---------------------------------------------------------------------------
// HowTo schema
// ---------------------------------------------------------------------------

/** A single step within a HowTo schema. */
export interface HowToStep {
  "@type": "HowToStep";
  name: string;
  text: string;
  position: number;
  image?: string;
}

/** schema.org HowTo JSON-LD structure. */
export interface HowToSchema extends SchemaBase {
  "@type": "HowTo";
  name: string;
  description: string;
  author: SchemaPerson;
  datePublished: string;
  dateModified: string;
  image?: SchemaImageObject | string;
  url?: string;
  totalTime?: string;
  estimatedCost?: {
    "@type": "MonetaryAmount";
    currency: string;
    value: string;
  };
  step: HowToStep[];
}

// ---------------------------------------------------------------------------
// FAQPage schema
// ---------------------------------------------------------------------------

/** A single question-answer pair within a FAQPage. */
export interface FAQEntry {
  "@type": "Question";
  name: string;
  acceptedAnswer: {
    "@type": "Answer";
    text: string;
  };
}

/** schema.org FAQPage JSON-LD structure. */
export interface FAQPageSchema extends SchemaBase {
  "@type": "FAQPage";
  name: string;
  description: string;
  author: SchemaPerson;
  datePublished: string;
  dateModified: string;
  url?: string;
  mainEntity: FAQEntry[];
}

// ---------------------------------------------------------------------------
// SoftwareApplication schema
// ---------------------------------------------------------------------------

/** schema.org Offer object for software pricing. */
export interface SchemaOffer {
  "@type": "Offer";
  price: string;
  priceCurrency: string;
}

/** schema.org SoftwareApplication JSON-LD structure. */
export interface SoftwareApplicationSchema extends SchemaBase {
  "@type": "SoftwareApplication";
  name: string;
  description: string;
  author: SchemaPerson;
  datePublished: string;
  dateModified: string;
  url?: string;
  image?: SchemaImageObject | string;
  applicationCategory?: string;
  operatingSystem?: string;
  offers?: SchemaOffer;
}

// ---------------------------------------------------------------------------
// Union result type
// ---------------------------------------------------------------------------

/** Discriminated union of all supported JSON-LD schema types. */
export type StructuredData =
  | ArticleSchema
  | HowToSchema
  | FAQPageSchema
  | SoftwareApplicationSchema;

/** Indicates which schema type was selected for the content. */
export type SchemaType = "Article" | "HowTo" | "FAQPage" | "SoftwareApplication";

/** Input metadata for structured data generation. */
export interface StructuredDataInput {
  /** Post title used as the schema headline. */
  title: string;
  /** Post markdown content for analysis and body extraction. */
  content: string;
  /** Short description or excerpt. Falls back to the first 160 chars if omitted. */
  description?: string;
  /** ISO 8601 date string when the post was first published. */
  datePublished: string;
  /** ISO 8601 date string when the post was last modified. Defaults to datePublished. */
  dateModified?: string;
  /** Canonical URL for the post. */
  url?: string;
  /** OG image URL for the post. */
  imageUrl?: string;
  /** Author information. */
  author: {
    name: string;
    url?: string;
  };
  /** Publisher / organisation information. */
  publisher: {
    name: string;
    url?: string;
    logoUrl?: string;
  };
  /** Optional list of keywords to embed in Article schema. */
  keywords?: string[];
}

/** Result returned by the generator, including the chosen type and serialised JSON-LD. */
export interface StructuredDataResult {
  /** The schema type selected based on content analysis. */
  type: SchemaType;
  /** The complete JSON-LD object. */
  schema: StructuredData;
  /** JSON-LD serialised as a string, ready for injection into a `<script>` tag. */
  jsonLd: string;
}

// ---------------------------------------------------------------------------
// Content analysis helpers
// ---------------------------------------------------------------------------

/**
 * Strips markdown syntax to produce plain text.
 * Used when embedding text in schema fields.
 *
 * @param markdown - Raw markdown string.
 * @returns Plain text.
 */
function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*{1,3}|_{1,3}/g, "")
    .replace(/^>\s*/gm, "")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/^[\s]*[-*+]\s+/gm, " ")
    .replace(/^\d+\.\s+/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts the first `maxChars` characters of plain text from markdown,
 * breaking at a word boundary.
 *
 * @param markdown - Raw markdown content.
 * @param maxChars - Maximum character count. Defaults to 160.
 * @returns Truncated plain text excerpt.
 */
function extractExcerpt(markdown: string, maxChars = 160): string {
  const plain = stripMarkdown(markdown);
  if (plain.length <= maxChars) return plain;
  const truncated = plain.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 0 ? truncated.slice(0, lastSpace) + "…" : truncated + "…";
}

// ---------------------------------------------------------------------------
// FAQ detection
// ---------------------------------------------------------------------------

/** Regex patterns that identify FAQ-style headings. */
const FAQ_HEADING_PATTERN =
  /^#{1,4}\s+(?:(?:what|how|why|when|where|who|can|does|is|are|will|should|do)\b.+\?|faq|frequently\s+asked)/im;

/** Inline question pattern — heading text ending in a question mark. */
const QUESTION_HEADING_PATTERN = /^#{1,4}\s+.+\?\s*$/gm;

/**
 * Parses the markdown for FAQ-style Q&A content.
 * Detects headings ending in "?" and treats the following paragraphs as answers.
 *
 * @param markdown - Raw markdown string.
 * @returns Array of FAQ entries, or empty array if none found.
 */
function parseFAQEntries(markdown: string): FAQEntry[] {
  const entries: FAQEntry[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const headingMatch = line.match(/^#{1,4}\s+(.+\?)\s*$/);
    if (headingMatch) {
      const question = headingMatch[1].trim();
      const answerLines: string[] = [];
      i++;

      // Collect answer lines until the next heading or end of content
      while (i < lines.length && !lines[i].match(/^#{1,4}\s+/)) {
        answerLines.push(lines[i]);
        i++;
      }

      const answerText = stripMarkdown(answerLines.join("\n")).trim();
      if (answerText.length > 0) {
        entries.push({
          "@type": "Question",
          name: question,
          acceptedAnswer: {
            "@type": "Answer",
            text: answerText,
          },
        });
      }
    } else {
      i++;
    }
  }

  return entries;
}

/**
 * Determines whether the content is best represented as a FAQPage.
 * Requires at least 2 question-style headings.
 *
 * @param markdown - Raw markdown to inspect.
 * @returns `true` if the content appears to be FAQ-style.
 */
function isFAQContent(markdown: string): boolean {
  const questionHeadings = (markdown.match(QUESTION_HEADING_PATTERN) || []).length;
  if (FAQ_HEADING_PATTERN.test(markdown) && questionHeadings >= 2) return true;
  return questionHeadings >= 3;
}

// ---------------------------------------------------------------------------
// HowTo detection
// ---------------------------------------------------------------------------

/** Heading patterns that indicate a step-by-step / tutorial format. */
const HOWTO_HEADING_PATTERN =
  /^#{1,4}\s+(?:step\s+\d+|how\s+to|getting\s+started|prerequisites?|installation|setup|configure)/im;

/** Numbered list items — presence in significant quantity suggests HowTo. */
const NUMBERED_LIST_PATTERN = /^\d+\.\s+\S/m;

/**
 * Parses HowTo steps from numbered list items in the markdown.
 * Steps are derived from top-level numbered list entries.
 *
 * @param markdown - Raw markdown string.
 * @returns Array of HowToStep objects.
 */
function parseHowToSteps(markdown: string): HowToStep[] {
  const steps: HowToStep[] = [];
  const lines = markdown.split("\n");
  let position = 1;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect "Step N" headings
    const stepHeadingMatch = line.match(/^#{1,4}\s+(?:step\s+\d+[:\s-]+(.+)|(.+))/i);
    if (stepHeadingMatch && /step\s+\d+/i.test(line)) {
      const stepName = (stepHeadingMatch[1] || stepHeadingMatch[2] || line.replace(/^#+\s+/, "")).trim();
      const descLines: string[] = [];
      i++;

      while (i < lines.length && !lines[i].match(/^#{1,4}\s+/)) {
        descLines.push(lines[i]);
        i++;
      }

      const text = stripMarkdown(descLines.join("\n")).trim();
      steps.push({
        "@type": "HowToStep",
        name: stripMarkdown(stepName),
        text: text || stripMarkdown(stepName),
        position: position++,
      });
      continue;
    }

    // Detect top-level numbered list items
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      const itemName = numberedMatch[2].trim();
      const descLines: string[] = [];
      i++;

      // Include indented continuation lines as part of this step's description
      while (i < lines.length && (lines[i].match(/^\s+\S/) || lines[i].trim() === "")) {
        if (lines[i].trim() !== "") {
          descLines.push(lines[i]);
        }
        i++;
      }

      const text = descLines.length > 0
        ? stripMarkdown(descLines.join("\n")).trim()
        : stripMarkdown(itemName);

      steps.push({
        "@type": "HowToStep",
        name: stripMarkdown(itemName),
        text: text || stripMarkdown(itemName),
        position: position++,
      });
      continue;
    }

    i++;
  }

  return steps;
}

/**
 * Determines whether the content is best represented as a HowTo schema.
 * Requires step-style headings or multiple numbered list items.
 *
 * @param markdown - Raw markdown to inspect.
 * @returns `true` if the content appears to be tutorial/how-to content.
 */
function isHowToContent(markdown: string): boolean {
  if (HOWTO_HEADING_PATTERN.test(markdown)) return true;

  // Count numbered list items at the top level
  const numberedItems = (markdown.match(/^\d+\.\s+\S/gm) || []).length;
  return numberedItems >= 3;
}

// ---------------------------------------------------------------------------
// TechArticle detection
// ---------------------------------------------------------------------------

/** Fenced code block pattern — triple backticks with optional language tag. */
const FENCED_CODE_BLOCK_PATTERN = /^```[\s\S]*?^```/gm;

/**
 * Extracts fenced code blocks from markdown content.
 *
 * @param markdown - Raw markdown string.
 * @returns Array of code block strings (including fences).
 */
function extractCodeBlocks(markdown: string): string[] {
  return markdown.match(FENCED_CODE_BLOCK_PATTERN) || [];
}

/**
 * Determines whether the content qualifies as a TechArticle.
 * Content is considered technical when it contains at least one fenced code block.
 *
 * @param markdown - Raw markdown to inspect.
 * @returns `true` if the content contains fenced code blocks.
 */
export function isTechContent(markdown: string): boolean {
  return FENCED_CODE_BLOCK_PATTERN.test(markdown);
}

/**
 * Advanced technical indicators that suggest expert-level content.
 * Used for proficiency level detection.
 */
const ADVANCED_PATTERNS = [
  /\b(?:async|await|concurrency|mutex|semaphore|deadlock)\b/i,
  /\b(?:architecture|microservice|distributed|scalab)/i,
  /\b(?:kubernetes|k8s|docker|containeriz)/i,
  /\b(?:webpack|bundl|tree[\s-]?shak|code[\s-]?split)/i,
  /\b(?:generic|polymorphi|abstract|interface|inheritance)\b/i,
  /\b(?:regex|regexp|regular\s+expression)/i,
  /\b(?:optimiz|performance|benchmark|profil)/i,
  /\b(?:security|vulnerabilit|authentication|authorization|oauth|jwt)\b/i,
  /\b(?:ci[\s/]cd|pipeline|deploy|infrastructure)/i,
];

/**
 * Determines the proficiency level of technical content.
 *
 * Expert-level content is identified by:
 * - 3+ code blocks, OR
 * - Multiple advanced technical indicator patterns.
 *
 * @param markdown - Raw markdown content.
 * @returns "Beginner" or "Expert" proficiency level.
 */
export function detectProficiencyLevel(
  markdown: string
): "Beginner" | "Expert" {
  const codeBlocks = extractCodeBlocks(markdown);
  if (codeBlocks.length >= 3) return "Expert";

  const advancedHits = ADVANCED_PATTERNS.filter((p) => p.test(markdown)).length;
  if (advancedHits >= 3) return "Expert";

  return "Beginner";
}

/**
 * Extracts technology dependencies from code block language tags.
 * Parses the language identifier after the opening triple backticks.
 *
 * @param markdown - Raw markdown content.
 * @returns Comma-separated string of unique language/technology names, or undefined if none found.
 */
export function extractDependencies(markdown: string): string | undefined {
  const langPattern = /^```(\w[\w+#-]*)\s*$/gm;
  const langs = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = langPattern.exec(markdown)) !== null) {
    langs.add(match[1].toLowerCase());
  }

  return langs.size > 0 ? Array.from(langs).join(", ") : undefined;
}

// ---------------------------------------------------------------------------
// SoftwareApplication detection
// ---------------------------------------------------------------------------

/** Patterns that indicate software/application-related content. */
const SOFTWARE_PATTERNS = [
  /\b(?:install(?:ation|ing|ed)?|uninstall)\b/i,
  /\bv?\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?\b/,
  /\b(?:system\s+requirements?|minimum\s+requirements?|recommended\s+requirements?)\b/i,
  /\b(?:download(?:ing|ed|s)?)\b/i,
  /\b(?:software|application|app|tool|utility|program|executable)\b/i,
  /\b(?:operating\s+system|(?:windows|macos|linux|android|ios)\s+(?:support|compatible|version))\b/i,
  /\b(?:release\s+notes?|changelog|what'?s\s+new)\b/i,
  /\b(?:license|licensing|free(?:ware)?|open[\s-]?source|proprietary)\b/i,
];

/** Minimum number of software pattern matches required for detection. */
const SOFTWARE_PATTERN_THRESHOLD = 3;

/**
 * Determines whether the content is best represented as a SoftwareApplication.
 * Requires multiple software-related indicators to be present.
 *
 * @param markdown - Raw markdown to inspect.
 * @returns `true` if the content appears to describe a software application.
 */
function isSoftwareContent(markdown: string): boolean {
  const hits = SOFTWARE_PATTERNS.filter((p) => p.test(markdown)).length;
  return hits >= SOFTWARE_PATTERN_THRESHOLD;
}

/**
 * Detects the application category from content by checking for common categories.
 *
 * @param markdown - Raw markdown content.
 * @returns Detected application category, or "SoftwareApplication" as default.
 */
function detectApplicationCategory(markdown: string): string {
  const categoryPatterns: [RegExp, string][] = [
    [/\b(?:game|gaming|gameplay)\b/i, "GameApplication"],
    [/\b(?:business|enterprise|crm|erp)\b/i, "BusinessApplication"],
    [/\b(?:developer|development|ide|sdk|api|programming)\b/i, "DeveloperApplication"],
    [/\b(?:design|graphic|photo|image\s+edit)\b/i, "DesignApplication"],
    [/\b(?:education|learning|tutorial|course)\b/i, "EducationalApplication"],
    [/\b(?:security|antivirus|firewall|encryption)\b/i, "SecurityApplication"],
    [/\b(?:browser|web\s+browser)\b/i, "WebApplication"],
    [/\b(?:multimedia|video|audio|music|media\s+player)\b/i, "MultimediaApplication"],
    [/\b(?:utility|utilities|tool|tools)\b/i, "UtilitiesApplication"],
  ];

  for (const [pattern, category] of categoryPatterns) {
    if (pattern.test(markdown)) return category;
  }

  return "SoftwareApplication";
}

/**
 * Detects mentioned operating systems from content.
 *
 * @param markdown - Raw markdown content.
 * @returns Comma-separated string of detected OS names, or undefined if none found.
 */
function detectOperatingSystem(markdown: string): string | undefined {
  const osPatterns: [RegExp, string][] = [
    [/\b(?:windows)\b/i, "Windows"],
    [/\b(?:macos|mac\s+os|os\s*x)\b/i, "macOS"],
    [/\b(?:linux|ubuntu|debian|fedora|centos)\b/i, "Linux"],
    [/\b(?:android)\b/i, "Android"],
    [/\b(?:ios|iphone|ipad)\b/i, "iOS"],
  ];

  const detected = new Set<string>();
  for (const [pattern, name] of osPatterns) {
    if (pattern.test(markdown)) detected.add(name);
  }

  return detected.size > 0 ? Array.from(detected).join(", ") : undefined;
}

// ---------------------------------------------------------------------------
// HowTo time estimation
// ---------------------------------------------------------------------------

/** Base minutes per step for simple text-only steps. */
const BASE_MINUTES_PER_STEP = 2;

/** Additional minutes per step when the step text exceeds this word count. */
const COMPLEX_STEP_WORD_THRESHOLD = 50;

/** Additional minutes added for steps with high word counts. */
const COMPLEX_STEP_EXTRA_MINUTES = 3;

/** Additional minutes added when content contains code blocks. */
const CODE_BLOCK_EXTRA_MINUTES = 5;

/**
 * Estimates the total time required to complete a HowTo guide.
 *
 * Calculation:
 * - Each step contributes a base of 2 minutes.
 * - Steps whose text exceeds 50 words add an extra 3 minutes each.
 * - If the overall content contains fenced code blocks, 5 minutes is added.
 *
 * @param steps - Parsed HowTo steps.
 * @param content - Original markdown content (used for code block detection).
 * @returns ISO 8601 duration string (e.g. "PT15M" or "PT1H30M").
 */
export function estimateHowToTime(steps: HowToStep[], content: string): string {
  let totalMinutes = 0;

  for (const step of steps) {
    totalMinutes += BASE_MINUTES_PER_STEP;

    const wordCount = step.text.split(/\s+/).filter(Boolean).length;
    if (wordCount > COMPLEX_STEP_WORD_THRESHOLD) {
      totalMinutes += COMPLEX_STEP_EXTRA_MINUTES;
    }
  }

  if (FENCED_CODE_BLOCK_PATTERN.test(content)) {
    // Reset lastIndex since the pattern uses the global flag
    FENCED_CODE_BLOCK_PATTERN.lastIndex = 0;
    totalMinutes += CODE_BLOCK_EXTRA_MINUTES;
  }
  // Reset lastIndex to avoid side-effects on subsequent calls
  FENCED_CODE_BLOCK_PATTERN.lastIndex = 0;

  // Ensure a minimum of 1 minute
  totalMinutes = Math.max(totalMinutes, 1);

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `PT${hours}H${minutes}M`;
  if (hours > 0) return `PT${hours}H`;
  return `PT${minutes}M`;
}

// ---------------------------------------------------------------------------
// Schema builders
// ---------------------------------------------------------------------------

/**
 * Builds a SchemaPerson object from author input.
 *
 * @param author - Author name and optional URL.
 * @returns schema.org Person.
 */
function buildPerson(author: { name: string; url?: string }): SchemaPerson {
  const person: SchemaPerson = {
    "@type": "Person",
    name: author.name,
  };
  if (author.url) person.url = author.url;
  return person;
}

/**
 * Builds a SchemaOrganization from publisher input.
 *
 * @param publisher - Publisher name, URL, and optional logo.
 * @returns schema.org Organization.
 */
function buildOrganization(publisher: {
  name: string;
  url?: string;
  logoUrl?: string;
}): SchemaOrganization {
  const org: SchemaOrganization = {
    "@type": "Organization",
    name: publisher.name,
  };
  if (publisher.url) org.url = publisher.url;
  if (publisher.logoUrl) {
    org.logo = {
      "@type": "ImageObject",
      url: publisher.logoUrl,
    };
  }
  return org;
}

/**
 * Builds a SchemaImageObject or plain URL string depending on available metadata.
 *
 * @param imageUrl - Raw image URL.
 * @returns SchemaImageObject suitable for embedding in structured data.
 */
function buildImage(imageUrl: string): SchemaImageObject {
  return {
    "@type": "ImageObject",
    url: imageUrl,
  };
}

/**
 * Generates an Article (or TechArticle / BlogPosting) JSON-LD schema.
 *
 * @param input - Post metadata and content.
 * @returns Complete ArticleSchema.
 */
function generateArticleSchema(input: StructuredDataInput): ArticleSchema {
  const dateModified = input.dateModified ?? input.datePublished;
  const description = input.description ?? extractExcerpt(input.content);
  const plainBody = stripMarkdown(input.content);
  const isTech = isTechContent(input.content);

  const schema: ArticleSchema = {
    "@context": "https://schema.org",
    "@type": isTech ? "TechArticle" : "Article",
    headline: input.title,
    description,
    author: buildPerson(input.author),
    publisher: buildOrganization(input.publisher),
    datePublished: input.datePublished,
    dateModified,
    wordCount: plainBody.split(/\s+/).filter(Boolean).length,
  };

  if (isTech) {
    schema.proficiencyLevel = detectProficiencyLevel(input.content);
    const deps = extractDependencies(input.content);
    if (deps) schema.dependencies = deps;
  }

  if (input.url) {
    schema.url = input.url;
    schema.mainEntityOfPage = {
      "@type": "WebPage",
      "@id": input.url,
    };
  }

  if (input.imageUrl) {
    schema.image = buildImage(input.imageUrl);
  }

  if (input.keywords && input.keywords.length > 0) {
    schema.keywords = input.keywords.join(", ");
  }

  return schema;
}

/**
 * Generates a HowTo JSON-LD schema from tutorial-style content.
 *
 * @param input - Post metadata and content.
 * @returns Complete HowToSchema.
 */
function generateHowToSchema(input: StructuredDataInput): HowToSchema {
  const dateModified = input.dateModified ?? input.datePublished;
  const description = input.description ?? extractExcerpt(input.content);
  const steps = parseHowToSteps(input.content);

  const totalTime = steps.length > 0
    ? estimateHowToTime(steps, input.content)
    : undefined;

  const schema: HowToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.title,
    description,
    author: buildPerson(input.author),
    datePublished: input.datePublished,
    dateModified,
    step: steps,
  };

  if (totalTime) schema.totalTime = totalTime;
  if (input.url) schema.url = input.url;
  if (input.imageUrl) schema.image = buildImage(input.imageUrl);

  return schema;
}

/**
 * Generates a FAQPage JSON-LD schema from Q&A-style content.
 *
 * @param input - Post metadata and content.
 * @returns Complete FAQPageSchema.
 */
function generateFAQPageSchema(input: StructuredDataInput): FAQPageSchema {
  const dateModified = input.dateModified ?? input.datePublished;
  const description = input.description ?? extractExcerpt(input.content);
  const entries = parseFAQEntries(input.content);

  const schema: FAQPageSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    name: input.title,
    description,
    author: buildPerson(input.author),
    datePublished: input.datePublished,
    dateModified,
    mainEntity: entries,
  };

  if (input.url) schema.url = input.url;

  return schema;
}

/**
 * Generates a SoftwareApplication JSON-LD schema from software-related content.
 *
 * @param input - Post metadata and content.
 * @returns Complete SoftwareApplicationSchema.
 */
function generateSoftwareApplicationSchema(
  input: StructuredDataInput
): SoftwareApplicationSchema {
  const dateModified = input.dateModified ?? input.datePublished;
  const description = input.description ?? extractExcerpt(input.content);

  const schema: SoftwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: input.title,
    description,
    author: buildPerson(input.author),
    datePublished: input.datePublished,
    dateModified,
  };

  const category = detectApplicationCategory(input.content);
  schema.applicationCategory = category;

  const os = detectOperatingSystem(input.content);
  if (os) schema.operatingSystem = os;

  // Default to free offer; content mentioning pricing could be extended later
  schema.offers = {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  };

  if (input.url) schema.url = input.url;
  if (input.imageUrl) schema.image = buildImage(input.imageUrl);

  return schema;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detects the most appropriate schema.org type for the given content.
 *
 * Detection priority:
 * 1. FAQPage — if the content has 3+ question-style headings.
 * 2. HowTo — if the content has step-style headings or 3+ numbered list items.
 * 3. SoftwareApplication — if the content has 3+ software-related indicators.
 * 4. Article — default for all other content.
 *
 * @param content - Raw markdown content to analyse.
 * @returns The detected schema type.
 */
export function detectSchemaType(content: string): SchemaType {
  if (isFAQContent(content)) return "FAQPage";
  if (isHowToContent(content)) return "HowTo";
  if (isSoftwareContent(content)) return "SoftwareApplication";
  return "Article";
}

/**
 * Generates structured data (JSON-LD) for a blog post.
 *
 * Automatically detects the best schema type from the content, then builds
 * a complete schema.org-compliant object and serialises it to JSON-LD.
 *
 * @param input - Post metadata and content.
 * @param forceType - Optional override for the detected schema type.
 * @returns The schema type chosen, the schema object, and the serialised JSON-LD string.
 */
export function generateStructuredData(
  input: StructuredDataInput,
  forceType?: SchemaType
): StructuredDataResult {
  const type = forceType ?? detectSchemaType(input.content);

  let schema: StructuredData;

  switch (type) {
    case "FAQPage":
      schema = generateFAQPageSchema(input);
      break;
    case "HowTo":
      schema = generateHowToSchema(input);
      break;
    case "SoftwareApplication":
      schema = generateSoftwareApplicationSchema(input);
      break;
    default:
      schema = generateArticleSchema(input);
  }

  return {
    type,
    schema,
    jsonLd: JSON.stringify(schema, null, 2),
  };
}

/**
 * Wraps a JSON-LD string in a `<script>` tag suitable for HTML injection.
 * The tag uses `type="application/ld+json"` as required by Google.
 *
 * @param jsonLd - Serialised JSON-LD string.
 * @returns HTML `<script>` tag string.
 */
export function wrapInScriptTag(jsonLd: string): string {
  return `<script type="application/ld+json">\n${jsonLd}\n</script>`;
}
