"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface SearchResults {
  sessions: any[];
  insights: any[];
  content: any[];
}

export function useGlobalSearch(query: string, workspace: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const result = useQuery<SearchResults>({
    queryKey: ["search", debouncedQuery, workspace],
    queryFn: async () => {
      const sp = new URLSearchParams({ q: debouncedQuery, workspace });
      const res = await fetch(`/api/search?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch search results");
      return res.json();
    },
    enabled: debouncedQuery.length >= 2 && !!workspace,
  });

  return {
    sessions: result.data?.sessions ?? [],
    insights: result.data?.insights ?? [],
    content: result.data?.content ?? [],
    isLoading: result.isLoading,
    isError: result.isError,
  };
}
