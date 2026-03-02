"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useContent(workspace: string, params?: { limit?: number; offset?: number; status?: string; type?: string }) {
  return useQuery({
    queryKey: ["content", workspace, params],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace });
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.offset) sp.set("offset", String(params.offset));
      if (params?.status) sp.set("status", params.status);
      if (params?.type) sp.set("type", params.type);
      const res = await fetch(`/api/content?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch content");
      return res.json();
    },
    enabled: !!workspace,
  });
}

export function usePost(id: string) {
  return useQuery({
    queryKey: ["post", id],
    queryFn: async () => {
      const res = await fetch(`/api/content/${id}`);
      if (!res.ok) throw new Error("Failed to fetch post");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      title?: string;
      markdown?: string;
      status?: string;
      versionType?: string;
      editType?: string;
    }) => {
      const res = await fetch(`/api/content/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["post", vars.id] });
      qc.invalidateQueries({ queryKey: ["content"] });
      qc.invalidateQueries({ queryKey: ["revisions", vars.id] });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/content/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }),
  });
}

export function useExportContent() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportCount, setExportCount] = useState<number | null>(null);

  const exportContent = useCallback(
    async (workspace: string, filters?: { type?: string; status?: string; dateFrom?: string; dateTo?: string }) => {
      setIsExporting(true);
      setExportCount(null);
      try {
        const sp = new URLSearchParams({ workspace });
        if (filters?.type) sp.set("type", filters.type);
        if (filters?.status) sp.set("status", filters.status);
        if (filters?.dateFrom) sp.set("dateFrom", filters.dateFrom);
        if (filters?.dateTo) sp.set("dateTo", filters.dateTo);

        const res = await fetch(`/api/content/export?${sp}`);
        if (!res.ok) throw new Error("Export failed");

        const count = res.headers.get("X-Export-Count");
        if (count) setExportCount(Number(count));

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `content-export-${workspace}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  return { exportContent, isExporting, exportCount };
}
