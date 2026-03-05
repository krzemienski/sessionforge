import fs from "fs/promises";
import path from "path";

export type ThemeId = "minimal-portfolio" | "technical-blog" | "changelog";

export interface ThemeMetadata {
  id: ThemeId;
  name: string;
  description: string;
  bestFor: string[];
}

export interface ThemeFiles {
  html: string;
  css: string;
  js: string;
}

export interface ThemeVariables {
  /** Site-level variables */
  SITE_TITLE: string;
  SITE_DESCRIPTION: string;
  SITE_TAGLINE: string;
  AUTHOR_NAME: string;
  BASE_URL: string;
  CURRENT_YEAR: string;
  CANONICAL_URL: string;
  /** Page-level variables */
  PAGE_TITLE: string;
  OG_TYPE: "website" | "article";
  /** Navigation */
  NAV_HOME_ACTIVE: string;
  /** Index page variables */
  COLLECTION_NAME: string;
  COLLECTION_DESCRIPTION: string;
  POSTS_LIST: string;
  /** Post page variables */
  POST_TITLE: string;
  POST_DATE_ISO: string;
  POST_DATE_FORMATTED: string;
  POST_TAGS: string;
  POST_CONTENT: string;
  /** Feature flags */
  SHOW_RSS: boolean;
  SHOW_ATTRIBUTION: boolean;
  IS_INDEX: boolean;
  IS_POST: boolean;
}

export interface ThemeConfig {
  /** Site title displayed in the header and page titles */
  siteTitle: string;
  /** Short tagline shown below the site title */
  siteTagline: string;
  /** Description used in meta tags */
  siteDescription: string;
  /** Author name for copyright and meta tags */
  authorName: string;
  /** Base URL for links and asset paths (e.g. "https://example.com" or "") */
  baseUrl: string;
  /** Include RSS feed link in navigation */
  showRss: boolean;
  /** Show "Powered by SessionForge" attribution in footer */
  showAttribution: boolean;
}

const THEME_REGISTRY: Record<ThemeId, ThemeMetadata> = {
  "minimal-portfolio": {
    id: "minimal-portfolio",
    name: "Minimal Portfolio",
    description:
      "A clean, minimal developer portfolio theme focused on readability and simplicity.",
    bestFor: ["personal blog", "developer portfolio", "writing portfolio"],
  },
  "technical-blog": {
    id: "technical-blog",
    name: "Technical Blog",
    description:
      "A feature-rich blog theme with reading progress, table of contents, and copy-to-clipboard on code blocks.",
    bestFor: [
      "technical articles",
      "tutorials",
      "engineering blog",
      "dev.to style",
    ],
  },
  changelog: {
    id: "changelog",
    name: "Changelog",
    description:
      "A timeline-based changelog theme with version badges and semantic change-type categorisation.",
    bestFor: ["release notes", "project changelog", "version history"],
  },
};

const THEMES_DIR = path.join(
  process.cwd(),
  "src",
  "lib",
  "export",
  "themes"
);

export function getAvailableThemes(): ThemeMetadata[] {
  return Object.values(THEME_REGISTRY);
}

export function getThemeMetadata(themeId: ThemeId): ThemeMetadata {
  return THEME_REGISTRY[themeId];
}

export async function loadThemeFiles(themeId: ThemeId): Promise<ThemeFiles> {
  const themeDir = path.join(THEMES_DIR, themeId);

  const [html, css, js] = await Promise.all([
    fs.readFile(path.join(themeDir, "index.html"), "utf-8"),
    fs.readFile(path.join(themeDir, "styles.css"), "utf-8"),
    fs.readFile(path.join(themeDir, "script.js"), "utf-8"),
  ]);

  return { html, css, js };
}

/**
 * Applies template variables to a template string.
 * Supports:
 *  - `{{VARIABLE_NAME}}` substitutions
 *  - `{{#if FLAG}}...{{/if FLAG}}` conditional blocks (boolean flags)
 */
export function applyTemplateVariables(
  template: string,
  variables: ThemeVariables
): string {
  let result = template;

  // Process conditional blocks: {{#if FLAG}}...{{/if FLAG}}
  result = result.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if \1\}\}/g,
    (_match, flag: string, content: string) => {
      const value = variables[flag as keyof ThemeVariables];
      return value ? content : "";
    }
  );

  // Process scalar substitutions: {{VARIABLE_NAME}}
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = variables[key as keyof ThemeVariables];
    if (value === undefined || value === null) return "";
    if (typeof value === "boolean") return value ? "true" : "";
    return String(value);
  });

  return result;
}

export function buildThemeVariables(
  config: ThemeConfig,
  overrides: Partial<ThemeVariables> = {}
): ThemeVariables {
  const currentYear = String(new Date().getFullYear());

  const defaults: ThemeVariables = {
    SITE_TITLE: config.siteTitle,
    SITE_DESCRIPTION: config.siteDescription,
    SITE_TAGLINE: config.siteTagline,
    AUTHOR_NAME: config.authorName,
    BASE_URL: config.baseUrl.replace(/\/$/, ""),
    CURRENT_YEAR: currentYear,
    CANONICAL_URL: config.baseUrl.replace(/\/$/, ""),
    PAGE_TITLE: config.siteTitle,
    OG_TYPE: "website",
    NAV_HOME_ACTIVE: "",
    COLLECTION_NAME: config.siteTitle,
    COLLECTION_DESCRIPTION: config.siteDescription,
    POSTS_LIST: "",
    POST_TITLE: "",
    POST_DATE_ISO: "",
    POST_DATE_FORMATTED: "",
    POST_TAGS: "",
    POST_CONTENT: "",
    SHOW_RSS: config.showRss,
    SHOW_ATTRIBUTION: config.showAttribution,
    IS_INDEX: false,
    IS_POST: false,
  };

  return { ...defaults, ...overrides };
}

export async function renderThemeTemplate(
  themeId: ThemeId,
  variables: ThemeVariables
): Promise<string> {
  const { html } = await loadThemeFiles(themeId);
  return applyTemplateVariables(html, variables);
}

export function defaultThemeConfig(overrides: Partial<ThemeConfig> = {}): ThemeConfig {
  return {
    siteTitle: "My Site",
    siteTagline: "",
    siteDescription: "",
    authorName: "",
    baseUrl: "",
    showRss: true,
    showAttribution: true,
    ...overrides,
  };
}
