"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface SeoData {
  id: string;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  keywords: string[] | null;
  structuredData: Record<string, unknown> | null;
  readabilityScore: number | null;
  geoScore: number | null;
  geoChecklist: Record<string, unknown> | null;
  seoAnalysis: Record<string, unknown> | null;
}

export interface MetaSuggestions {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  ogImagePrompt: string;
}

export interface UpdateSeoInput {
  id: string;
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  keywords?: string[];
  structuredData?: Record<string, unknown>;
  readabilityScore?: number;
  geoScore?: number;
  geoChecklist?: Record<string, unknown>;
  seoAnalysis?: Record<string, unknown>;
}

export function useSeoData(postId: string) {
  return useQuery<SeoData>({
    queryKey: ["seo", postId],
    queryFn: async () => {
      const res = await fetch(`/api/content/${postId}/seo`);
      if (!res.ok) throw new Error("Failed to fetch SEO data");
      return res.json();
    },
    enabled: !!postId,
  });
}

export function useAnalyzeSeo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, regenerate = false }: { id: string; regenerate?: boolean }) => {
      const res = await fetch(`/api/content/${id}/seo/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate }),
      });
      if (!res.ok) throw new Error("SEO analysis failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["seo", vars.id] });
    },
  });
}

export function useGenerateMeta() {
  return useMutation<
    MetaSuggestions,
    Error,
    { id: string; targetAudience?: string; contentDomain?: string }
  >({
    mutationFn: async ({ id, targetAudience, contentDomain }) => {
      const res = await fetch(`/api/content/${id}/seo/generate-meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAudience, contentDomain }),
      });
      if (!res.ok) throw new Error("Meta generation failed");
      return res.json();
    },
  });
}

export interface ValidationIssue {
  severity: "error" | "warning";
  path: string;
  message: string;
}

export interface ValidationResult {
  id: string;
  valid: boolean;
  type: string;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
}

export function useValidateStructuredData() {
  const qc = useQueryClient();
  return useMutation<
    ValidationResult,
    Error,
    { id: string; structuredData?: Record<string, unknown> }
  >({
    mutationFn: async ({ id, structuredData }) => {
      const res = await fetch(`/api/content/${id}/seo/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structuredData }),
      });
      if (!res.ok) throw new Error("Structured data validation failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["seo", vars.id] });
    },
  });
}

export function useUpdateSeo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateSeoInput) => {
      const res = await fetch(`/api/content/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("SEO update failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["seo", vars.id] });
    },
  });
}
