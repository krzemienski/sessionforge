"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { GeneralTab } from "@/components/settings/general-tab";
import { StyleTab } from "@/components/settings/style-tab";
import { ApiKeysTab } from "@/components/settings/api-keys-tab";
import { IntegrationsTab } from "@/components/settings/integrations-tab";
import { WebhooksTab } from "@/components/settings/webhooks-tab";
import { SourcesTab } from "@/components/settings/sources-tab";

const TABS = [
  { id: "general", label: "General" },
  { id: "style", label: "Style" },
  { id: "api-keys", label: "API Keys" },
  { id: "integrations", label: "Integrations" },
  { id: "webhooks", label: "Webhooks" },
  { id: "sources", label: "Sources" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SettingsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawTab = searchParams.get("tab") || "general";
  const activeTab: TabId = TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : "general";

  const setTab = (tab: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "general") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    router.replace(`/${workspace}/settings${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Settings size={22} className="text-sf-accent" />
        <h1 className="text-2xl font-bold font-display">Settings</h1>
      </div>

      <div
        className="flex items-center gap-1 border-b border-sf-border mb-6 overflow-x-auto"
        role="tablist"
        aria-label="Settings"
        onKeyDown={(e) => {
          const currentIndex = TABS.findIndex((t) => t.id === activeTab);
          if (currentIndex === -1) return;
          let nextIndex = -1;
          if (e.key === "ArrowRight") {
            nextIndex = (currentIndex + 1) % TABS.length;
          } else if (e.key === "ArrowLeft") {
            nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
          } else if (e.key === "Home") {
            nextIndex = 0;
          } else if (e.key === "End") {
            nextIndex = TABS.length - 1;
          }
          if (nextIndex !== -1) {
            e.preventDefault();
            setTab(TABS[nextIndex].id);
            const tablist = e.currentTarget;
            const buttons = tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]');
            buttons[nextIndex]?.focus();
          }
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-settings-${tab.id}`}
            id={`tab-settings-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sf-accent ${
              activeTab === tab.id
                ? "border-sf-accent text-sf-accent"
                : "border-transparent text-sf-text-secondary hover:text-sf-text-primary hover:border-sf-border"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "general" && <div role="tabpanel" id="tabpanel-settings-general" aria-labelledby="tab-settings-general"><GeneralTab workspace={workspace} /></div>}
      {activeTab === "style" && <div role="tabpanel" id="tabpanel-settings-style" aria-labelledby="tab-settings-style"><StyleTab workspace={workspace} /></div>}
      {activeTab === "api-keys" && <div role="tabpanel" id="tabpanel-settings-api-keys" aria-labelledby="tab-settings-api-keys"><ApiKeysTab workspace={workspace} /></div>}
      {activeTab === "integrations" && <div role="tabpanel" id="tabpanel-settings-integrations" aria-labelledby="tab-settings-integrations"><IntegrationsTab workspace={workspace} /></div>}
      {activeTab === "webhooks" && <div role="tabpanel" id="tabpanel-settings-webhooks" aria-labelledby="tab-settings-webhooks"><WebhooksTab workspace={workspace} /></div>}
      {activeTab === "sources" && <div role="tabpanel" id="tabpanel-settings-sources" aria-labelledby="tab-settings-sources"><SourcesTab workspace={workspace} /></div>}
    </div>
  );
}
