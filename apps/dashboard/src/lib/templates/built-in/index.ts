/**
 * Built-in content templates library
 *
 * This module exports all built-in templates that ship with SessionForge.
 * Individual templates are imported as they are created in subsequent subtasks.
 */

import type { BuiltInTemplate } from "@/types/templates";

/**
 * All built-in templates available in SessionForge
 *
 * Templates will be added here as they are created:
 * - How I Built X
 * - Debugging Story
 * - Tool Comparison
 * - Architecture Decision
 * - TIL (Today I Learned)
 * - Dev Log
 * - Release Notes
 * - Tutorial
 */
export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  // Templates will be imported and added here in subsequent subtasks
  // Example:
  // howIBuiltXTemplate,
  // debuggingStoryTemplate,
  // etc.
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
