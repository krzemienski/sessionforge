/**
 * JSON-LD structured data validator.
 *
 * Checks generated markup against schema.org requirements for each
 * supported schema type:
 *
 * 1. Article / TechArticle / BlogPosting
 * 2. HowTo
 * 3. FAQPage
 * 4. SoftwareApplication
 *
 * Validates required fields, correct types, proper nesting, and
 * schema.org compliance.
 */

import type {
  StructuredData,
  ArticleSchema,
  HowToSchema,
  FAQPageSchema,
  SoftwareApplicationSchema,
} from "./structured-data-generator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Severity of a validation issue. */
export type ValidationSeverity = "error" | "warning";

/** A single validation issue found in the structured data. */
export interface ValidationIssue {
  /** Severity — errors indicate broken markup, warnings indicate best-practice misses. */
  severity: ValidationSeverity;
  /** JSON path to the problematic field (e.g. "author.name"). */
  path: string;
  /** Human-readable description of the issue. */
  message: string;
}

/** Aggregate validation result for a piece of structured data. */
export interface ValidationResult {
  /** Whether the structured data passes validation (no errors). */
  valid: boolean;
  /** The schema @type that was validated. */
  type: string;
  /** All issues discovered during validation. */
  issues: ValidationIssue[];
  /** Count of error-level issues. */
  errorCount: number;
  /** Count of warning-level issues. */
  warningCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Checks that a value is a non-empty string.
 *
 * @param value - The value to check.
 * @returns `true` if value is a string with at least one non-whitespace character.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Checks that a value is a valid ISO 8601 date string.
 *
 * @param value - The value to check.
 * @returns `true` if the value parses as a valid date.
 */
function isValidDate(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

/**
 * Checks that a value is a valid URL string.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a well-formed URL.
 */
function isValidUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks that a value is a valid ISO 8601 duration string (e.g. "PT15M", "PT1H30M").
 *
 * @param value - The value to check.
 * @returns `true` if the value matches ISO 8601 duration format.
 */
function isValidDuration(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^PT(?:\d+H)?(?:\d+M)?(?:\d+S)?$/.test(value) && value !== "PT";
}

// ---------------------------------------------------------------------------
// Shared validators
// ---------------------------------------------------------------------------

/**
 * Validates the @context field is "https://schema.org".
 *
 * @param data - The structured data object.
 * @param issues - Array to push issues into.
 */
function validateContext(data: Record<string, unknown>, issues: ValidationIssue[]): void {
  if (data["@context"] !== "https://schema.org") {
    issues.push({
      severity: "error",
      path: "@context",
      message: '@context must be "https://schema.org".',
    });
  }
}

/**
 * Validates a schema.org Person object.
 *
 * @param person - The person object to validate.
 * @param basePath - The JSON path prefix for this person.
 * @param issues - Array to push issues into.
 */
function validatePerson(
  person: unknown,
  basePath: string,
  issues: ValidationIssue[]
): void {
  if (!person || typeof person !== "object") {
    issues.push({
      severity: "error",
      path: basePath,
      message: `${basePath} is required and must be an object.`,
    });
    return;
  }

  const p = person as Record<string, unknown>;

  if (p["@type"] !== "Person") {
    issues.push({
      severity: "error",
      path: `${basePath}.@type`,
      message: `${basePath}.@type must be "Person".`,
    });
  }

  if (!isNonEmptyString(p.name)) {
    issues.push({
      severity: "error",
      path: `${basePath}.name`,
      message: `${basePath}.name is required and must be a non-empty string.`,
    });
  }

  if (p.url !== undefined && !isValidUrl(p.url)) {
    issues.push({
      severity: "warning",
      path: `${basePath}.url`,
      message: `${basePath}.url should be a valid URL.`,
    });
  }
}

/**
 * Validates a schema.org Organization object.
 *
 * @param org - The organization object to validate.
 * @param basePath - The JSON path prefix for this organization.
 * @param issues - Array to push issues into.
 */
function validateOrganization(
  org: unknown,
  basePath: string,
  issues: ValidationIssue[]
): void {
  if (!org || typeof org !== "object") {
    issues.push({
      severity: "error",
      path: basePath,
      message: `${basePath} is required and must be an object.`,
    });
    return;
  }

  const o = org as Record<string, unknown>;

  if (o["@type"] !== "Organization") {
    issues.push({
      severity: "error",
      path: `${basePath}.@type`,
      message: `${basePath}.@type must be "Organization".`,
    });
  }

  if (!isNonEmptyString(o.name)) {
    issues.push({
      severity: "error",
      path: `${basePath}.name`,
      message: `${basePath}.name is required and must be a non-empty string.`,
    });
  }

  if (o.logo !== undefined) {
    const logo = o.logo as Record<string, unknown>;
    if (!logo || typeof logo !== "object") {
      issues.push({
        severity: "warning",
        path: `${basePath}.logo`,
        message: `${basePath}.logo should be an ImageObject.`,
      });
    } else {
      if (logo["@type"] !== "ImageObject") {
        issues.push({
          severity: "warning",
          path: `${basePath}.logo.@type`,
          message: `${basePath}.logo.@type should be "ImageObject".`,
        });
      }
      if (!isValidUrl(logo.url)) {
        issues.push({
          severity: "warning",
          path: `${basePath}.logo.url`,
          message: `${basePath}.logo.url should be a valid URL.`,
        });
      }
    }
  }
}

/**
 * Validates an image field (can be ImageObject or string URL).
 *
 * @param image - The image value to validate.
 * @param basePath - The JSON path for the image field.
 * @param issues - Array to push issues into.
 */
function validateImage(
  image: unknown,
  basePath: string,
  issues: ValidationIssue[]
): void {
  if (image === undefined || image === null) return;

  if (typeof image === "string") {
    if (!isValidUrl(image)) {
      issues.push({
        severity: "warning",
        path: basePath,
        message: `${basePath} should be a valid URL when provided as a string.`,
      });
    }
    return;
  }

  if (typeof image === "object") {
    const img = image as Record<string, unknown>;
    if (img["@type"] !== "ImageObject") {
      issues.push({
        severity: "warning",
        path: `${basePath}.@type`,
        message: `${basePath}.@type should be "ImageObject".`,
      });
    }
    if (!isValidUrl(img.url)) {
      issues.push({
        severity: "warning",
        path: `${basePath}.url`,
        message: `${basePath}.url should be a valid URL.`,
      });
    }
    return;
  }

  issues.push({
    severity: "warning",
    path: basePath,
    message: `${basePath} should be a string URL or an ImageObject.`,
  });
}

/**
 * Validates common date fields present in most schema types.
 *
 * @param data - The structured data object.
 * @param issues - Array to push issues into.
 */
function validateDates(data: Record<string, unknown>, issues: ValidationIssue[]): void {
  if (!isNonEmptyString(data.datePublished)) {
    issues.push({
      severity: "error",
      path: "datePublished",
      message: "datePublished is required.",
    });
  } else if (!isValidDate(data.datePublished)) {
    issues.push({
      severity: "error",
      path: "datePublished",
      message: "datePublished must be a valid ISO 8601 date.",
    });
  }

  if (!isNonEmptyString(data.dateModified)) {
    issues.push({
      severity: "warning",
      path: "dateModified",
      message: "dateModified is recommended for search engines.",
    });
  } else if (!isValidDate(data.dateModified)) {
    issues.push({
      severity: "error",
      path: "dateModified",
      message: "dateModified must be a valid ISO 8601 date.",
    });
  }
}

// ---------------------------------------------------------------------------
// Type-specific validators
// ---------------------------------------------------------------------------

/**
 * Validates an Article, TechArticle, or BlogPosting schema.
 *
 * @param schema - The article schema to validate.
 * @returns Array of validation issues.
 */
function validateArticle(schema: ArticleSchema): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = schema as unknown as Record<string, unknown>;

  validateContext(data, issues);

  const validTypes = ["Article", "TechArticle", "BlogPosting"];
  if (!validTypes.includes(schema["@type"])) {
    issues.push({
      severity: "error",
      path: "@type",
      message: `@type must be one of: ${validTypes.join(", ")}.`,
    });
  }

  if (!isNonEmptyString(schema.headline)) {
    issues.push({
      severity: "error",
      path: "headline",
      message: "headline is required and must be a non-empty string.",
    });
  } else if (schema.headline.length > 110) {
    issues.push({
      severity: "warning",
      path: "headline",
      message: "headline should be 110 characters or fewer for optimal display.",
    });
  }

  if (!isNonEmptyString(schema.description)) {
    issues.push({
      severity: "error",
      path: "description",
      message: "description is required and must be a non-empty string.",
    });
  }

  validatePerson(schema.author, "author", issues);
  validateOrganization(schema.publisher, "publisher", issues);
  validateDates(data, issues);
  validateImage(schema.image, "image", issues);

  if (schema.url !== undefined && !isValidUrl(schema.url)) {
    issues.push({
      severity: "warning",
      path: "url",
      message: "url should be a valid URL.",
    });
  }

  if (schema.wordCount !== undefined) {
    if (typeof schema.wordCount !== "number" || schema.wordCount < 0) {
      issues.push({
        severity: "warning",
        path: "wordCount",
        message: "wordCount should be a non-negative number.",
      });
    }
  }

  // TechArticle-specific validations
  if (schema["@type"] === "TechArticle") {
    if (schema.proficiencyLevel !== undefined) {
      const validLevels = ["Beginner", "Expert"];
      if (!validLevels.includes(schema.proficiencyLevel)) {
        issues.push({
          severity: "warning",
          path: "proficiencyLevel",
          message: `proficiencyLevel should be one of: ${validLevels.join(", ")}.`,
        });
      }
    }
  }

  // mainEntityOfPage validation
  if (schema.mainEntityOfPage !== undefined) {
    const mep = schema.mainEntityOfPage;
    if (mep["@type"] !== "WebPage") {
      issues.push({
        severity: "warning",
        path: "mainEntityOfPage.@type",
        message: 'mainEntityOfPage.@type should be "WebPage".',
      });
    }
    if (!isNonEmptyString(mep["@id"])) {
      issues.push({
        severity: "warning",
        path: "mainEntityOfPage.@id",
        message: "mainEntityOfPage.@id should be a non-empty string.",
      });
    }
  }

  return issues;
}

/**
 * Validates a HowTo schema.
 *
 * @param schema - The HowTo schema to validate.
 * @returns Array of validation issues.
 */
function validateHowTo(schema: HowToSchema): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = schema as unknown as Record<string, unknown>;

  validateContext(data, issues);

  if (schema["@type"] !== "HowTo") {
    issues.push({
      severity: "error",
      path: "@type",
      message: '@type must be "HowTo".',
    });
  }

  if (!isNonEmptyString(schema.name)) {
    issues.push({
      severity: "error",
      path: "name",
      message: "name is required and must be a non-empty string.",
    });
  }

  if (!isNonEmptyString(schema.description)) {
    issues.push({
      severity: "error",
      path: "description",
      message: "description is required and must be a non-empty string.",
    });
  }

  validatePerson(schema.author, "author", issues);
  validateDates(data, issues);
  validateImage(schema.image, "image", issues);

  if (schema.url !== undefined && !isValidUrl(schema.url)) {
    issues.push({
      severity: "warning",
      path: "url",
      message: "url should be a valid URL.",
    });
  }

  // totalTime validation
  if (schema.totalTime !== undefined && !isValidDuration(schema.totalTime)) {
    issues.push({
      severity: "warning",
      path: "totalTime",
      message: "totalTime should be a valid ISO 8601 duration (e.g. PT15M, PT1H30M).",
    });
  }

  // Steps validation
  if (!Array.isArray(schema.step)) {
    issues.push({
      severity: "error",
      path: "step",
      message: "step is required and must be an array of HowToStep objects.",
    });
  } else if (schema.step.length === 0) {
    issues.push({
      severity: "warning",
      path: "step",
      message: "step array is empty. HowTo should have at least one step.",
    });
  } else {
    for (let i = 0; i < schema.step.length; i++) {
      const step = schema.step[i];
      const stepPath = `step[${i}]`;

      if (step["@type"] !== "HowToStep") {
        issues.push({
          severity: "error",
          path: `${stepPath}.@type`,
          message: `${stepPath}.@type must be "HowToStep".`,
        });
      }

      if (!isNonEmptyString(step.name)) {
        issues.push({
          severity: "error",
          path: `${stepPath}.name`,
          message: `${stepPath}.name is required and must be a non-empty string.`,
        });
      }

      if (!isNonEmptyString(step.text)) {
        issues.push({
          severity: "error",
          path: `${stepPath}.text`,
          message: `${stepPath}.text is required and must be a non-empty string.`,
        });
      }

      if (typeof step.position !== "number" || step.position < 1) {
        issues.push({
          severity: "error",
          path: `${stepPath}.position`,
          message: `${stepPath}.position must be a positive integer.`,
        });
      }
    }

    // Check that positions are sequential
    const positions = schema.step.map((s) => s.position);
    const expected = schema.step.map((_, i) => i + 1);
    if (JSON.stringify(positions) !== JSON.stringify(expected)) {
      issues.push({
        severity: "warning",
        path: "step",
        message: "Step positions should be sequential starting from 1.",
      });
    }
  }

  // estimatedCost validation
  if (schema.estimatedCost !== undefined) {
    const cost = schema.estimatedCost;
    if (cost["@type"] !== "MonetaryAmount") {
      issues.push({
        severity: "warning",
        path: "estimatedCost.@type",
        message: 'estimatedCost.@type should be "MonetaryAmount".',
      });
    }
    if (!isNonEmptyString(cost.currency)) {
      issues.push({
        severity: "warning",
        path: "estimatedCost.currency",
        message: "estimatedCost.currency should be a valid currency code.",
      });
    }
  }

  return issues;
}

/**
 * Validates a FAQPage schema.
 *
 * @param schema - The FAQPage schema to validate.
 * @returns Array of validation issues.
 */
function validateFAQPage(schema: FAQPageSchema): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = schema as unknown as Record<string, unknown>;

  validateContext(data, issues);

  if (schema["@type"] !== "FAQPage") {
    issues.push({
      severity: "error",
      path: "@type",
      message: '@type must be "FAQPage".',
    });
  }

  if (!isNonEmptyString(schema.name)) {
    issues.push({
      severity: "error",
      path: "name",
      message: "name is required and must be a non-empty string.",
    });
  }

  if (!isNonEmptyString(schema.description)) {
    issues.push({
      severity: "error",
      path: "description",
      message: "description is required and must be a non-empty string.",
    });
  }

  validatePerson(schema.author, "author", issues);
  validateDates(data, issues);

  if (schema.url !== undefined && !isValidUrl(schema.url)) {
    issues.push({
      severity: "warning",
      path: "url",
      message: "url should be a valid URL.",
    });
  }

  // mainEntity validation (FAQ entries)
  if (!Array.isArray(schema.mainEntity)) {
    issues.push({
      severity: "error",
      path: "mainEntity",
      message: "mainEntity is required and must be an array of Question objects.",
    });
  } else if (schema.mainEntity.length === 0) {
    issues.push({
      severity: "error",
      path: "mainEntity",
      message: "mainEntity must contain at least one FAQ entry.",
    });
  } else {
    for (let i = 0; i < schema.mainEntity.length; i++) {
      const entry = schema.mainEntity[i];
      const entryPath = `mainEntity[${i}]`;

      if (entry["@type"] !== "Question") {
        issues.push({
          severity: "error",
          path: `${entryPath}.@type`,
          message: `${entryPath}.@type must be "Question".`,
        });
      }

      if (!isNonEmptyString(entry.name)) {
        issues.push({
          severity: "error",
          path: `${entryPath}.name`,
          message: `${entryPath}.name is required (the question text).`,
        });
      }

      if (!entry.acceptedAnswer || typeof entry.acceptedAnswer !== "object") {
        issues.push({
          severity: "error",
          path: `${entryPath}.acceptedAnswer`,
          message: `${entryPath}.acceptedAnswer is required.`,
        });
      } else {
        if (entry.acceptedAnswer["@type"] !== "Answer") {
          issues.push({
            severity: "error",
            path: `${entryPath}.acceptedAnswer.@type`,
            message: `${entryPath}.acceptedAnswer.@type must be "Answer".`,
          });
        }

        if (!isNonEmptyString(entry.acceptedAnswer.text)) {
          issues.push({
            severity: "error",
            path: `${entryPath}.acceptedAnswer.text`,
            message: `${entryPath}.acceptedAnswer.text is required.`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Validates a SoftwareApplication schema.
 *
 * @param schema - The SoftwareApplication schema to validate.
 * @returns Array of validation issues.
 */
function validateSoftwareApplication(
  schema: SoftwareApplicationSchema
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const data = schema as unknown as Record<string, unknown>;

  validateContext(data, issues);

  if (schema["@type"] !== "SoftwareApplication") {
    issues.push({
      severity: "error",
      path: "@type",
      message: '@type must be "SoftwareApplication".',
    });
  }

  if (!isNonEmptyString(schema.name)) {
    issues.push({
      severity: "error",
      path: "name",
      message: "name is required and must be a non-empty string.",
    });
  }

  if (!isNonEmptyString(schema.description)) {
    issues.push({
      severity: "error",
      path: "description",
      message: "description is required and must be a non-empty string.",
    });
  }

  validatePerson(schema.author, "author", issues);
  validateDates(data, issues);
  validateImage(schema.image, "image", issues);

  if (schema.url !== undefined && !isValidUrl(schema.url)) {
    issues.push({
      severity: "warning",
      path: "url",
      message: "url should be a valid URL.",
    });
  }

  // applicationCategory validation
  if (schema.applicationCategory !== undefined && !isNonEmptyString(schema.applicationCategory)) {
    issues.push({
      severity: "warning",
      path: "applicationCategory",
      message: "applicationCategory should be a non-empty string when provided.",
    });
  }

  // operatingSystem validation
  if (schema.operatingSystem !== undefined && !isNonEmptyString(schema.operatingSystem)) {
    issues.push({
      severity: "warning",
      path: "operatingSystem",
      message: "operatingSystem should be a non-empty string when provided.",
    });
  }

  // offers validation
  if (schema.offers !== undefined) {
    const offers = schema.offers;
    if (offers["@type"] !== "Offer") {
      issues.push({
        severity: "error",
        path: "offers.@type",
        message: 'offers.@type must be "Offer".',
      });
    }
    if (typeof offers.price !== "string") {
      issues.push({
        severity: "error",
        path: "offers.price",
        message: "offers.price is required and must be a string.",
      });
    }
    if (!isNonEmptyString(offers.priceCurrency)) {
      issues.push({
        severity: "error",
        path: "offers.priceCurrency",
        message: "offers.priceCurrency is required (e.g. USD).",
      });
    }
  } else {
    issues.push({
      severity: "warning",
      path: "offers",
      message: "offers is recommended for SoftwareApplication schemas.",
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// JSON-LD string validator
// ---------------------------------------------------------------------------

/**
 * Validates a raw JSON-LD string by parsing it and checking for structural issues.
 *
 * @param jsonLd - Raw JSON-LD string.
 * @returns Array of validation issues found during parsing.
 */
function validateJsonLdString(jsonLd: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!jsonLd || jsonLd.trim().length === 0) {
    issues.push({
      severity: "error",
      path: "jsonLd",
      message: "JSON-LD string is empty.",
    });
    return issues;
  }

  try {
    const parsed = JSON.parse(jsonLd);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      issues.push({
        severity: "error",
        path: "jsonLd",
        message: "JSON-LD must parse to a JSON object.",
      });
    }
  } catch {
    issues.push({
      severity: "error",
      path: "jsonLd",
      message: "JSON-LD string is not valid JSON.",
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates a structured data object against schema.org requirements.
 *
 * Dispatches to the appropriate type-specific validator based on the @type
 * field. Checks required fields, correct types, proper nesting, and
 * schema.org compliance.
 *
 * @param schema - The structured data object to validate.
 * @returns Validation result with all issues, counts, and validity status.
 */
export function validateStructuredData(schema: StructuredData): ValidationResult {
  const type = schema["@type"];
  let issues: ValidationIssue[];

  switch (type) {
    case "Article":
    case "TechArticle":
    case "BlogPosting":
      issues = validateArticle(schema as ArticleSchema);
      break;
    case "HowTo":
      issues = validateHowTo(schema as HowToSchema);
      break;
    case "FAQPage":
      issues = validateFAQPage(schema as FAQPageSchema);
      break;
    case "SoftwareApplication":
      issues = validateSoftwareApplication(schema as SoftwareApplicationSchema);
      break;
    default:
      issues = [
        {
          severity: "error",
          path: "@type",
          message: `Unsupported schema type: "${type}". Expected Article, TechArticle, BlogPosting, HowTo, FAQPage, or SoftwareApplication.`,
        },
      ];
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return {
    valid: errorCount === 0,
    type,
    issues,
    errorCount,
    warningCount,
  };
}

/**
 * Validates a raw JSON-LD string and its parsed schema content.
 *
 * First validates the JSON-LD string itself (parseable, correct structure),
 * then validates the parsed schema against schema.org requirements.
 *
 * @param jsonLd - Raw JSON-LD string.
 * @returns Validation result combining string-level and schema-level issues.
 */
export function validateJsonLd(jsonLd: string): ValidationResult {
  const stringIssues = validateJsonLdString(jsonLd);

  if (stringIssues.some((i) => i.severity === "error")) {
    return {
      valid: false,
      type: "unknown",
      issues: stringIssues,
      errorCount: stringIssues.filter((i) => i.severity === "error").length,
      warningCount: stringIssues.filter((i) => i.severity === "warning").length,
    };
  }

  const parsed = JSON.parse(jsonLd) as StructuredData;
  const result = validateStructuredData(parsed);

  return {
    ...result,
    issues: [...stringIssues, ...result.issues],
    errorCount: result.errorCount + stringIssues.filter((i) => i.severity === "error").length,
    warningCount: result.warningCount + stringIssues.filter((i) => i.severity === "warning").length,
  };
}
