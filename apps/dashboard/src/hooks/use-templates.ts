"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ContentTemplate, CreateTemplateInput, UpdateTemplateInput } from "@/types/templates";

export function useTemplates(workspace: string, params?: { contentType?: string; templateType?: string }) {
  return useQuery({
    queryKey: ["templates", workspace, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspaceSlug: workspace });
      if (params?.contentType) sp.set("contentType", params.contentType);
      if (params?.templateType) sp.set("templateType", params.templateType);
      const res = await fetch(`/api/templates?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch templates");
      const data = await res.json() as { templates: ContentTemplate[] };
      return data.templates;
    },
    enabled: !!workspace,
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: ["template", id],
    queryFn: async () => {
      const res = await fetch(`/api/templates/${id}`);
      if (!res.ok) throw new Error("Failed to fetch template");
      return res.json() as Promise<ContentTemplate>;
    },
    enabled: !!id,
  });
}

export function useCreateTemplate(workspace: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<CreateTemplateInput, "workspaceId">) => {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, workspaceSlug: workspace }),
      });
      if (!res.ok) throw new Error("Failed to create template");
      return res.json() as Promise<ContentTemplate>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTemplateInput }) => {
      const res = await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update template");
      return res.json() as Promise<ContentTemplate>;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      qc.invalidateQueries({ queryKey: ["template", variables.id] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete template");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}
