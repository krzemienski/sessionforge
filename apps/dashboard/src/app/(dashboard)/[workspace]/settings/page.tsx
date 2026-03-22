"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { GeneralTab } from "@/components/settings/general-tab";
import { StyleTab } from "@/components/settings/style-tab";
import { ApiKeysTab } from "@/components/settings/api-keys-tab";
import { IntegrationsTab } from "@/components/settings/integrations-tab";
import { WebhooksTab } from "@/components/settings/webhooks-tab";
import { SourcesTab } from "@/components/settings/sources-tab";
import { BillingTab } from "@/components/settings/billing-tab";

const TABS = [
  { id: "general", label: "General" },
  { id: "style", label: "Style" },
  { id: "api-keys", label: "API Keys" },
  { id: "integrations", label: "Integrations" },
  { id: "webhooks", label: "Webhooks" },
  { id: "sources", label: "Sources" },
  { id: "billing", label: "Billing" },
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

      <div className="flex items-center gap-1 border-b border-sf-border mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-sf-accent text-sf-accent"
                : "border-transparent text-sf-text-secondary hover:text-sf-text-primary hover:border-sf-border"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "general" && <GeneralTab workspace={workspace} />}
      {activeTab === "style" && <StyleTab workspace={workspace} />}
      {activeTab === "api-keys" && <ApiKeysTab workspace={workspace} />}
      {activeTab === "integrations" && <IntegrationsTab workspace={workspace} />}
      {activeTab === "webhooks" && <WebhooksTab workspace={workspace} />}
      {activeTab === "sources" && <SourcesTab workspace={workspace} />}
      {activeTab === "billing" && <BillingTab workspace={workspace} />}
    </div>
  );
}
