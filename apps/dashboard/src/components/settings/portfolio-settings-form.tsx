"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Globe, Palette, Link as LinkIcon, Twitter, Linkedin, Github, ExternalLink } from "lucide-react";

const THEME_OPTIONS = [
  {
    value: "minimal",
    label: "Minimal",
    description: "Clean, minimalist design with simple typography",
  },
  {
    value: "developer-dark",
    label: "Developer Dark",
    description: "Dark mode design with terminal-style accents",
  },
  {
    value: "colorful",
    label: "Colorful",
    description: "Vibrant design with gradients and bright colors",
  },
] as const;

interface SocialLinks {
  twitter?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

interface PortfolioSettingsFormProps {
  workspace: string;
}

export function PortfolioSettingsForm({ workspace }: PortfolioSettingsFormProps) {
  const qc = useQueryClient();

  const portfolioSettings = useQuery({
    queryKey: ["portfolio-settings", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/settings?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed to load portfolio settings");
      return res.json();
    },
  });

  const [isEnabled, setIsEnabled] = useState(false);
  const [bio, setBio] = useState("");
  const [theme, setTheme] = useState<"minimal" | "developer-dark" | "colorful">("minimal");
  const [customDomain, setCustomDomain] = useState("");
  const [showRss, setShowRss] = useState(true);
  const [showPoweredBy, setShowPoweredBy] = useState(true);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});

  useEffect(() => {
    if (portfolioSettings.data) {
      setIsEnabled(portfolioSettings.data.isEnabled ?? false);
      setBio(portfolioSettings.data.bio || "");
      setTheme(portfolioSettings.data.theme || "minimal");
      setCustomDomain(portfolioSettings.data.customDomain || "");
      setShowRss(portfolioSettings.data.showRss ?? true);
      setShowPoweredBy(portfolioSettings.data.showPoweredBy ?? true);
      setSocialLinks(portfolioSettings.data.socialLinks || {});
    }
  }, [portfolioSettings.data]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/portfolio/settings?workspace=${workspace}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isEnabled,
          bio: bio || null,
          theme,
          customDomain: customDomain || null,
          showRss,
          showPoweredBy,
          socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio-settings", workspace] });
    },
  });

  const updateSocialLink = (platform: keyof SocialLinks, value: string) => {
    setSocialLinks((prev) => ({
      ...prev,
      [platform]: value || undefined,
    }));
  };

  if (portfolioSettings.isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-sf-bg-tertiary rounded w-1/3" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Globe size={18} className="text-sf-accent" />
          <h2 className="text-base font-semibold font-display">Portfolio Settings</h2>
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="rounded border-sf-border bg-sf-bg-tertiary text-sf-accent focus:ring-sf-accent"
            />
            <span className="text-sm text-sf-text-primary font-medium">
              Enable public portfolio
            </span>
          </label>
          <p className="text-xs text-sf-text-muted mt-1 ml-7">
            Your portfolio will be accessible at{" "}
            <code className="font-code text-sf-accent">
              sessionforge.dev/{workspace}
            </code>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-sf-text-secondary mb-1">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="Tell visitors about yourself and your content..."
            className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary resize-none focus:outline-none focus:border-sf-border-focus"
          />
          <p className="text-xs text-sf-text-muted mt-1">
            A short bio that appears at the top of your portfolio
          </p>
        </div>
      </div>

      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Palette size={18} className="text-sf-accent" />
          <h2 className="text-base font-semibold font-display">Theme</h2>
        </div>

        <div className="space-y-3">
          {THEME_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-start gap-3 p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf cursor-pointer hover:border-sf-border-focus transition-colors"
            >
              <input
                type="radio"
                name="theme"
                value={option.value}
                checked={theme === option.value}
                onChange={(e) => setTheme(e.target.value as typeof theme)}
                className="mt-0.5 text-sf-accent focus:ring-sf-accent"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-sf-text-primary">
                  {option.label}
                </div>
                <div className="text-xs text-sf-text-muted mt-0.5">
                  {option.description}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <LinkIcon size={18} className="text-sf-accent" />
          <h2 className="text-base font-semibold font-display">Social Links</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-sf-text-secondary mb-1">
              <Twitter size={14} />
              Twitter
            </label>
            <input
              type="text"
              value={socialLinks.twitter || ""}
              onChange={(e) => updateSocialLink("twitter", e.target.value)}
              placeholder="https://twitter.com/username"
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-sf-text-secondary mb-1">
              <Linkedin size={14} />
              LinkedIn
            </label>
            <input
              type="text"
              value={socialLinks.linkedin || ""}
              onChange={(e) => updateSocialLink("linkedin", e.target.value)}
              placeholder="https://linkedin.com/in/username"
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-sf-text-secondary mb-1">
              <Github size={14} />
              GitHub
            </label>
            <input
              type="text"
              value={socialLinks.github || ""}
              onChange={(e) => updateSocialLink("github", e.target.value)}
              placeholder="https://github.com/username"
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-sf-text-secondary mb-1">
              <ExternalLink size={14} />
              Website
            </label>
            <input
              type="text"
              value={socialLinks.website || ""}
              onChange={(e) => updateSocialLink("website", e.target.value)}
              placeholder="https://yourwebsite.com"
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
            />
          </div>
        </div>
      </div>

      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-5">
        <h2 className="text-base font-semibold font-display">Additional Options</h2>

        <div>
          <label className="block text-sm font-medium text-sf-text-secondary mb-1">
            Custom Domain
          </label>
          <input
            type="text"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="portfolio.yourdomain.com"
            className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
          />
          <p className="text-xs text-sf-text-muted mt-1">
            Optional: Point your custom domain to your portfolio via CNAME
          </p>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showRss}
              onChange={(e) => setShowRss(e.target.checked)}
              className="rounded border-sf-border bg-sf-bg-tertiary text-sf-accent focus:ring-sf-accent"
            />
            <span className="text-sm text-sf-text-primary">
              Show RSS feed link on portfolio
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showPoweredBy}
              onChange={(e) => setShowPoweredBy(e.target.checked)}
              className="rounded border-sf-border bg-sf-bg-tertiary text-sf-accent focus:ring-sf-accent"
            />
            <span className="text-sm text-sf-text-primary">
              Show &quot;Powered by SessionForge&quot; in footer
            </span>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {save.isPending ? "Saving..." : "Save Changes"}
        </button>
        {save.isSuccess && (
          <p className="text-sm text-sf-success">Portfolio settings saved.</p>
        )}
        {save.isError && (
          <p className="text-sm text-sf-error">Failed to save portfolio settings.</p>
        )}
      </div>
    </div>
  );
}
