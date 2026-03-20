import { z } from "zod";
import { AppError, ERROR_CODES } from "@/lib/errors";

// ---------------------------------------------------------------------------
// parseBody helper
// ---------------------------------------------------------------------------

export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    throw new AppError(
      "Validation failed",
      ERROR_CODES.VALIDATION_ERROR,
      400,
      { fields }
    );
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Workspace schemas
// ---------------------------------------------------------------------------

export const workspaceCreateSchema = z.object({
  name: z.string().min(1, "name is required").trim(),
  sessionBasePath: z.string().optional(),
});

export const workspaceStyleSchema = z.object({
  defaultTone: z.string().optional(),
  targetAudience: z.string().optional(),
  customInstructions: z.string().optional(),
  includeCodeSnippets: z.boolean().optional(),
  includeTerminalOutput: z.boolean().optional(),
  maxBlogWordCount: z.number().int().positive().optional(),
});

// ---------------------------------------------------------------------------
// Content schemas
// ---------------------------------------------------------------------------

export const contentCreateSchema = z.object({
  workspaceSlug: z.string().min(1, "workspaceSlug is required"),
  title: z.string().min(1, "title is required"),
  markdown: z.string().min(1, "markdown is required"),
  contentType: z.string().min(1, "contentType is required"),
  toneUsed: z.string().optional(),
  insightId: z.string().optional(),
});

export const contentUpdateSchema = z.object({
  title: z.string().optional(),
  markdown: z.string().optional(),
  status: z.string().optional(),
  toneUsed: z.string().optional(),
  badgeEnabled: z.boolean().optional(),
  platformFooterEnabled: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// API key schemas
// ---------------------------------------------------------------------------

export const apiKeyCreateSchema = z.object({
  workspaceSlug: z.string().min(1, "workspaceSlug is required"),
  name: z.string().min(1, "name is required"),
});

// ---------------------------------------------------------------------------
// Insight schemas
// ---------------------------------------------------------------------------

export const insightExtractSchema = z.object({
  sessionIds: z.array(z.string().min(1)).min(1, "at least one sessionId is required"),
  workspaceSlug: z.string().min(1, "workspaceSlug is required"),
});

// ---------------------------------------------------------------------------
// Session schemas
// ---------------------------------------------------------------------------

export const sessionScanSchema = z.object({
  workspaceSlug: z.string().min(1).optional(),
  lookbackDays: z.number().int().positive().optional().default(30),
  fullRescan: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// Agent schemas
// ---------------------------------------------------------------------------

export const agentBlogSchema = z.object({
  workspaceSlug: z.string().min(1, "workspaceSlug is required"),
  insightId: z.string().min(1, "insightId is required"),
  tone: z.string().optional(),
  customInstructions: z.string().optional(),
});

export const agentSocialSchema = z.object({
  workspaceSlug: z.string().min(1, "workspaceSlug is required"),
  insightId: z.string().min(1, "insightId is required"),
  platform: z.enum(["twitter", "linkedin"], {
    errorMap: () => ({ message: "platform must be 'twitter' or 'linkedin'" }),
  }),
  customInstructions: z.string().optional(),
});

export const agentChangelogSchema = z.object({
  workspaceSlug: z.string().min(1, "workspaceSlug is required"),
  lookbackDays: z
    .number({ required_error: "lookbackDays is required" })
    .int()
    .positive(),
  projectFilter: z.string().optional(),
  customInstructions: z.string().optional(),
});

export const agentChatSchema = z.object({
  workspaceSlug: z.string().min(1, "workspaceSlug is required"),
  postId: z.string().min(1, "postId is required"),
  message: z.string().min(1, "message is required"),
  conversationHistory: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const agentNewsletterSchema = z.object({
  workspaceSlug: z.string().min(1, "workspaceSlug is required"),
  lookbackDays: z.number().int().positive().optional().default(7),
  customInstructions: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Dev.to integration schemas
// ---------------------------------------------------------------------------

export const devtoConnectSchema = z.object({
  workspaceSlug: z.string().min(1, "workspaceSlug is required"),
  apiKey: z.string().min(1, "apiKey is required"),
});

export const devtoPublishSchema = z.object({
  postId: z.string().min(1, "postId is required"),
  workspaceSlug: z.string().min(1, "workspaceSlug is required"),
  published: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  canonicalUrl: z.string().optional(),
  series: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Automation / trigger schemas
// ---------------------------------------------------------------------------

export const triggerCreateSchema = z.object({
  workspaceSlug: z.string().min(1, "workspaceSlug is required"),
  name: z.string().optional(),
  triggerType: z.string().min(1, "triggerType is required"),
  contentType: z.string().min(1, "contentType is required"),
  lookbackWindow: z.string().optional(),
  cronExpression: z.string().optional(),
  debounceMinutes: z.number().int().optional(),
});

export const triggerUpdateSchema = z.object({
  name: z.string().optional(),
  triggerType: z.string().optional(),
  contentType: z.string().optional(),
  lookbackWindow: z.string().optional(),
  cronExpression: z.string().optional(),
  enabled: z.boolean().optional(),
  debounceMinutes: z.number().int().optional(),
});

export const triggerExecuteSchema = z.object({
  triggerId: z.string().min(1, "triggerId is required"),
});

// ---------------------------------------------------------------------------
// Experiment schemas (A/B Headline & Hook Testing)
// ---------------------------------------------------------------------------

export const variantCreateSchema = z.object({
  label: z.string().min(1, "label is required"),
  headlineText: z.string().min(1, "headlineText is required"),
  hookText: z.string().min(1, "hookText is required"),
  trafficAllocation: z
    .number({ required_error: "trafficAllocation is required" })
    .min(0, "trafficAllocation must be >= 0")
    .max(1, "trafficAllocation must be <= 1"),
  isControl: z.boolean().optional().default(false),
});

export const experimentCreateSchema = z.object({
  workspaceSlug: z.string().min(1, "workspaceSlug is required"),
  postId: z.string().min(1, "postId is required"),
  name: z.string().min(1, "name is required"),
  kpi: z.enum(["views", "likes", "comments", "shares", "engagement_rate"], {
    errorMap: () => ({
      message:
        "kpi must be one of: views, likes, comments, shares, engagement_rate",
    }),
  }),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  variants: z
    .array(variantCreateSchema)
    .min(2, "at least two variants are required"),
});

export const experimentUpdateSchema = z.object({
  name: z.string().min(1, "name cannot be empty").optional(),
  kpi: z
    .enum(["views", "likes", "comments", "shares", "engagement_rate"], {
      errorMap: () => ({
        message:
          "kpi must be one of: views, likes, comments, shares, engagement_rate",
      }),
    })
    .optional(),
  status: z
    .enum(["draft", "running", "paused", "completed", "cancelled"], {
      errorMap: () => ({
        message:
          "status must be one of: draft, running, paused, completed, cancelled",
      }),
    })
    .optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

export const resultRecordSchema = z.object({
  variantId: z.string().min(1, "variantId is required"),
  impressions: z.number().int().nonnegative().optional(),
  clicks: z.number().int().nonnegative().optional(),
  views: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  shares: z.number().int().nonnegative().optional(),
  engagementRate: z.number().nonnegative().optional(),
  recordedAt: z.string().datetime().optional(),
});

// ---------------------------------------------------------------------------
// Inferred types (handy for route handlers)
// ---------------------------------------------------------------------------

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;
export type WorkspaceStyleInput = z.infer<typeof workspaceStyleSchema>;
export type ContentCreateInput = z.infer<typeof contentCreateSchema>;
export type ContentUpdateInput = z.infer<typeof contentUpdateSchema>;
export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateSchema>;
export type InsightExtractInput = z.infer<typeof insightExtractSchema>;
export type SessionScanInput = z.infer<typeof sessionScanSchema>;
export type AgentBlogInput = z.infer<typeof agentBlogSchema>;
export type AgentSocialInput = z.infer<typeof agentSocialSchema>;
export type AgentChangelogInput = z.infer<typeof agentChangelogSchema>;
export type AgentChatInput = z.infer<typeof agentChatSchema>;
export type AgentNewsletterInput = z.infer<typeof agentNewsletterSchema>;
export type DevtoConnectInput = z.infer<typeof devtoConnectSchema>;
export type DevtoPublishInput = z.infer<typeof devtoPublishSchema>;
export type TriggerCreateInput = z.infer<typeof triggerCreateSchema>;
export type TriggerUpdateInput = z.infer<typeof triggerUpdateSchema>;
export type TriggerExecuteInput = z.infer<typeof triggerExecuteSchema>;
export type VariantCreateInput = z.infer<typeof variantCreateSchema>;
export type ExperimentCreateInput = z.infer<typeof experimentCreateSchema>;
export type ExperimentUpdateInput = z.infer<typeof experimentUpdateSchema>;
export type ResultRecordInput = z.infer<typeof resultRecordSchema>;
