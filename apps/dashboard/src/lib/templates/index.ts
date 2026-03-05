/**
 * Content Templates Library
 *
 * Central module for accessing and managing content templates.
 * Re-exports built-in templates and provides utility functions.
 */

import type { BuiltInTemplate } from "@/types/templates";
import {
  BUILT_IN_TEMPLATES,
  getBuiltInTemplates as getBuiltIn,
  getBuiltInTemplateBySlug as getBuiltInBySlug
} from "./built-in";

/**
 * Re-export built-in templates
 */
export { BUILT_IN_TEMPLATES } from "./built-in";

/**
 * Get all built-in templates
 *
 * @returns Array of all built-in templates
 */
export function getBuiltInTemplates(): BuiltInTemplate[] {
  return getBuiltIn();
}

/**
 * Get a template by its slug from the built-in library
 *
 * @param slug - The template slug to search for
 * @returns The template if found, undefined otherwise
 */
export function getTemplateBySlug(slug: string): BuiltInTemplate | undefined {
  return getBuiltInBySlug(slug);
}

/**
 * Check if a template slug exists in the built-in library
 *
 * @param slug - The template slug to check
 * @returns true if the template exists, false otherwise
 */
export function templateExists(slug: string): boolean {
  return getTemplateBySlug(slug) !== undefined;
}

/**
 * Get all templates for a specific content type
 *
 * @param contentType - The content type to filter by
 * @returns Array of templates matching the content type
 */
export function getTemplatesByContentType(contentType: string): BuiltInTemplate[] {
  return BUILT_IN_TEMPLATES.filter((template) => template.contentType === contentType);
}
