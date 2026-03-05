/**
 * Built-in content templates library
 *
 * This module exports all built-in templates that ship with SessionForge.
 * Individual templates are imported as they are created in subsequent subtasks.
 */

import type { BuiltInTemplate } from "@/types/templates";
import { howIBuiltXTemplate } from "./how-i-built-x";
import { debuggingStoryTemplate } from "./debugging-story";
import { toolComparisonTemplate } from "./tool-comparison";
import { architectureDecisionTemplate } from "./architecture-decision";

/**
 * All built-in templates available in SessionForge
 *
 * Templates will be added here as they are created:
 * - How I Built X ✓
 * - Debugging Story ✓
 * - Tool Comparison ✓
 * - Architecture Decision ✓
 * - TIL (Today I Learned)
 * - Dev Log
 * - Release Notes
 * - Tutorial
 */
export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  howIBuiltXTemplate,
  debuggingStoryTemplate,
  toolComparisonTemplate,
  architectureDecisionTemplate,
  // Additional templates will be added here in subsequent subtasks
];

/**
 * Get all built-in templates
 */
export function getBuiltInTemplates(): BuiltInTemplate[] {
  return BUILT_IN_TEMPLATES;
}

/**
 * Get a built-in template by its slug
 *
 * @param slug - The template slug to search for
 * @returns The template if found, undefined otherwise
 */
export function getBuiltInTemplateBySlug(slug: string): BuiltInTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((template) => template.slug === slug);
}
