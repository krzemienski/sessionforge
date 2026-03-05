/**
 * Database operations for content templates.
 * Provides functions for querying and updating template usage statistics.
 */

import { db } from "@/lib/db";
import { contentTemplates } from "@sessionforge/db";
import { eq, sql } from "drizzle-orm";
import type { ContentTemplate } from "@/types/templates";

/**
 * Fetch a template from the database by ID.
 *
 * @param templateId - The template ID to fetch
 * @returns The template if found, null otherwise
 */
export async function getTemplateById(
  templateId: string
): Promise<ContentTemplate | null> {
  const template = await db.query.contentTemplates.findFirst({
    where: eq(contentTemplates.id, templateId),
  });

  return template ?? null;
}

/**
 * Increment the usage count for a template.
 * This should be called after successfully using a template to generate content.
 *
 * @param templateId - The ID of the template to increment usage for
 * @returns The updated usage count, or null if template not found
 */
export async function incrementTemplateUsage(
  templateId: string
): Promise<number | null> {
  try {
    const [updated] = await db
      .update(contentTemplates)
      .set({
        usageCount: sql`${contentTemplates.usageCount} + 1`,
      })
      .where(eq(contentTemplates.id, templateId))
      .returning({ usageCount: contentTemplates.usageCount });

    return updated?.usageCount ?? null;
  } catch (error) {
    // Silently fail - usage tracking is non-critical
    return null;
  }
}
