const DEVTO_API_BASE = "https://dev.to/api";

export interface DevtoUser {
  username: string;
  name: string;
}

export interface DevtoArticleInput {
  title: string;
  body_markdown: string;
  published: boolean;
  tags: string[];
  canonical_url?: string;
  series?: string;
}

export interface DevtoArticleResult {
  id: number;
  url: string;
  published: boolean;
}

export class DevtoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: "invalid_api_key" | "validation_error" | "rate_limited" | "unknown"
  ) {
    super(message);
    this.name = "DevtoApiError";
  }
}

function classifyError(status: number): DevtoApiError["code"] {
  if (status === 401) return "invalid_api_key";
  if (status === 422) return "validation_error";
  if (status === 429) return "rate_limited";
  return "unknown";
}

async function devtoFetch<T>(
  apiKey: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${DEVTO_API_BASE}${path}`, {
    ...options,
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const code = classifyError(response.status);
    let message: string;

    switch (code) {
      case "invalid_api_key":
        message = "Invalid Dev.to API key. Please check your API key and try again.";
        break;
      case "validation_error":
        message = "Dev.to validation error. Check your article content and tags.";
        break;
      case "rate_limited":
        message = "Dev.to rate limit exceeded. Please wait a moment and try again.";
        break;
      default:
        message = `Dev.to API error (${response.status})`;
    }

    throw new DevtoApiError(message, response.status, code);
  }

  return response.json() as Promise<T>;
}

export async function verifyDevtoApiKey(apiKey: string): Promise<DevtoUser> {
  const user = await devtoFetch<{ username: string; name: string }>(
    apiKey,
    "/users/me"
  );
  return { username: user.username, name: user.name };
}

export async function publishToDevto(
  apiKey: string,
  article: DevtoArticleInput
): Promise<DevtoArticleResult> {
  const result = await devtoFetch<{ id: number; url: string; published: boolean }>(
    apiKey,
    "/articles",
    {
      method: "POST",
      body: JSON.stringify({ article }),
    }
  );

  return { id: result.id, url: result.url, published: result.published };
}

export async function updateDevtoArticle(
  apiKey: string,
  articleId: number,
  article: Partial<DevtoArticleInput>
): Promise<DevtoArticleResult> {
  const result = await devtoFetch<{ id: number; url: string; published: boolean }>(
    apiKey,
    `/articles/${articleId}`,
    {
      method: "PUT",
      body: JSON.stringify({ article }),
    }
  );

  return { id: result.id, url: result.url, published: result.published };
}
