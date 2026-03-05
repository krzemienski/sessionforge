const MEDIUM_API_BASE = "https://api.medium.com/v1";

export interface MediumUser {
  id: string;
  username: string;
  name: string;
  imageUrl: string;
}

export interface MediumPublication {
  id: string;
  name: string;
  description: string;
  url: string;
  imageUrl: string;
}

export interface MediumArticleInput {
  title: string;
  contentFormat: "markdown" | "html";
  content: string;
  publishStatus: "draft" | "public" | "unlisted";
  tags?: string[];
  canonicalUrl?: string;
  notifyFollowers?: boolean;
}

export interface MediumArticleResult {
  id: string;
  url: string;
  publishStatus: string;
  publishedAt?: number;
}

export class MediumApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: "invalid_token" | "validation_error" | "rate_limited" | "forbidden" | "unknown"
  ) {
    super(message);
    this.name = "MediumApiError";
  }
}

function classifyError(status: number): MediumApiError["code"] {
  if (status === 401) return "invalid_token";
  if (status === 403) return "forbidden";
  if (status === 400 || status === 422) return "validation_error";
  if (status === 429) return "rate_limited";
  return "unknown";
}

async function mediumFetch<T>(
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${MEDIUM_API_BASE}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const code = classifyError(response.status);
    let message: string;

    switch (code) {
      case "invalid_token":
        message = "Invalid Medium access token. Please reconnect your Medium account.";
        break;
      case "forbidden":
        message = "Access forbidden. Please check your Medium account permissions.";
        break;
      case "validation_error":
        message = "Medium validation error. Check your article content and settings.";
        break;
      case "rate_limited":
        message = "Medium rate limit exceeded. Please wait a moment and try again.";
        break;
      default:
        message = `Medium API error (${response.status})`;
    }

    throw new MediumApiError(message, response.status, code);
  }

  return response.json() as Promise<T>;
}

export async function verifyMediumToken(accessToken: string): Promise<MediumUser> {
  const response = await mediumFetch<{ data: MediumUser }>(
    accessToken,
    "/me"
  );
  return response.data;
}

export async function getMediumPublications(
  accessToken: string,
  userId: string
): Promise<MediumPublication[]> {
  const response = await mediumFetch<{ data: MediumPublication[] }>(
    accessToken,
    `/users/${userId}/publications`
  );
  return response.data;
}

export async function publishToMedium(
  accessToken: string,
  userId: string,
  article: MediumArticleInput
): Promise<MediumArticleResult> {
  const response = await mediumFetch<{ data: MediumArticleResult }>(
    accessToken,
    `/users/${userId}/posts`,
    {
      method: "POST",
      body: JSON.stringify(article),
    }
  );

  return response.data;
}

export async function publishToMediumPublication(
  accessToken: string,
  publicationId: string,
  article: MediumArticleInput
): Promise<MediumArticleResult> {
  const response = await mediumFetch<{ data: MediumArticleResult }>(
    accessToken,
    `/publications/${publicationId}/posts`,
    {
      method: "POST",
      body: JSON.stringify(article),
    }
  );

  return response.data;
}
