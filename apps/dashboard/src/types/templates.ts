// Template type definitions for SessionForge content templates library

/**
 * Template type enum values
 */
export type TemplateType = "built_in" | "custom" | "workspace_default";

/**
 * Content type enum values
 */
export type ContentType =
  | "blog_post"
  | "twitter_thread"
  | "linkedin_post"
  | "devto_post"
  | "changelog"
  | "newsletter"
  | "custom";

/**
 * Template structure defining the outline and sections
 */
export interface TemplateStructure {
  sections: TemplateSection[];
}

/**
 * Individual section within a template
 */
export interface TemplateSection {
  heading: string;
  description: string;
  required: boolean;
}

/**
 * Complete content template matching database schema
 */
export interface ContentTemplate {
  id: string;
  workspaceId: string | null;
  name: string;
  slug: string;
  templateType: TemplateType;
  contentType: ContentType;
  description: string | null;
  structure: TemplateStructure | null;
  toneGuidance: string | null;
  exampleContent: string | null;
  isActive: boolean;
  createdBy: string | null;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Built-in template definition (used in template library)
 */
export interface BuiltInTemplate {
  name: string;
  slug: string;
  contentType: ContentType;
  description: string;
  structure: TemplateStructure;
  toneGuidance: string;
  exampleContent: string;
}

/**
 * Input for creating a new custom template
 */
export interface CreateTemplateInput {
  workspaceId: string;
  name: string;
  slug: string;
  contentType: ContentType;
  description?: string;
  structure?: TemplateStructure;
  toneGuidance?: string;
  exampleContent?: string;
  createdBy?: string;
}

/**
 * Input for updating an existing template
 */
export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  structure?: TemplateStructure;
  toneGuidance?: string;
  exampleContent?: string;
  isActive?: boolean;
}

/**
 * Template with creator and workspace details
 */
export interface TemplateWithRelations extends ContentTemplate {
  creator?: {
    id: string;
    name: string;
    email: string;
  } | null;
  workspace?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}
