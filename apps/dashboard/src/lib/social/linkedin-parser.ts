export interface LinkedInPostResult {
  charCount: number;
  charLimit: number;
  hashtags: string[];
  suggestedHashtags: string[];
}

const LINKEDIN_CHAR_LIMIT = 3000;

/**
 * Maps lowercase tech keywords found in content to their corresponding hashtags.
 * Each entry is [keyword, hashtag].
 */
const TECH_KEYWORD_HASHTAGS: [string, string][] = [
  ["javascript", "JavaScript"],
  ["typescript", "TypeScript"],
  ["react", "ReactJS"],
  ["nextjs", "NextJS"],
  ["next.js", "NextJS"],
  ["nodejs", "NodeJS"],
  ["node.js", "NodeJS"],
  ["python", "Python"],
  ["rust", "RustLang"],
  ["golang", "Golang"],
  ["go ", "Golang"],
  ["aws", "AWS"],
  ["azure", "Azure"],
  ["gcp", "GoogleCloud"],
  ["cloud", "CloudComputing"],
  ["devops", "DevOps"],
  ["docker", "Docker"],
  ["kubernetes", "Kubernetes"],
  ["k8s", "Kubernetes"],
  ["api", "API"],
  ["graphql", "GraphQL"],
  ["database", "Database"],
  ["postgres", "PostgreSQL"],
  ["mysql", "MySQL"],
  ["mongodb", "MongoDB"],
  ["redis", "Redis"],
  ["ai", "ArtificialIntelligence"],
  ["machine learning", "MachineLearning"],
  ["llm", "LLM"],
  ["openai", "OpenAI"],
  ["startup", "Startup"],
  ["saas", "SaaS"],
  ["open source", "OpenSource"],
  ["frontend", "Frontend"],
  ["backend", "Backend"],
  ["fullstack", "FullStack"],
  ["full stack", "FullStack"],
  ["web development", "WebDevelopment"],
  ["webdev", "WebDev"],
  ["mobile", "MobileDev"],
  ["ios", "iOS"],
  ["android", "Android"],
  ["agile", "Agile"],
  ["productivity", "Productivity"],
  ["career", "CareerDevelopment"],
  ["coding", "Coding"],
  ["programming", "Programming"],
  ["software", "SoftwareEngineering"],
  ["engineer", "SoftwareEngineering"],
  ["developer", "Developer"],
  ["tailwind", "TailwindCSS"],
  ["css", "CSS"],
  ["html", "HTML"],
  ["git", "Git"],
  ["github", "GitHub"],
];

/**
 * Extracts existing hashtags from the post content using the #word pattern.
 */
function extractHashtags(content: string): string[] {
  const matches = content.match(/#[a-zA-Z]\w*/g);
  if (!matches) return [];

  return [...new Set(matches)];
}

/**
 * Generates hashtag suggestions based on tech keywords detected in the content.
 * Excludes hashtags that are already present in the post.
 */
function generateSuggestedHashtags(
  content: string,
  existingHashtags: string[]
): string[] {
  const lower = content.toLowerCase();
  const existingLower = new Set(
    existingHashtags.map((h) => h.toLowerCase())
  );

  const suggestions: string[] = [];
  const seen = new Set<string>();

  for (const [keyword, hashtag] of TECH_KEYWORD_HASHTAGS) {
    const tag = `#${hashtag}`;
    if (
      lower.includes(keyword) &&
      !existingLower.has(tag.toLowerCase()) &&
      !seen.has(hashtag.toLowerCase())
    ) {
      suggestions.push(tag);
      seen.add(hashtag.toLowerCase());
    }
  }

  return suggestions;
}

/**
 * Parses a LinkedIn post in markdown format into structured metadata.
 *
 * Returns:
 *   - charCount: total character count of the post
 *   - charLimit: LinkedIn's 3000-character limit
 *   - hashtags: hashtags already present in the content
 *   - suggestedHashtags: additional hashtags recommended based on content keywords
 */
export function parseLinkedInPost(markdown: string): LinkedInPostResult {
  if (!markdown || !markdown.trim()) {
    return {
      charCount: 0,
      charLimit: LINKEDIN_CHAR_LIMIT,
      hashtags: [],
      suggestedHashtags: [],
    };
  }

  const charCount = markdown.length;
  const hashtags = extractHashtags(markdown);
  const suggestedHashtags = generateSuggestedHashtags(markdown, hashtags);

  return {
    charCount,
    charLimit: LINKEDIN_CHAR_LIMIT,
    hashtags,
    suggestedHashtags,
  };
}
