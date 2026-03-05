const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";

export interface LinkedInUser {
  id: string;
  firstName: string;
  lastName: string;
  vanityName?: string;
}

export interface LinkedInPostAnalytics {
  postId: string;
  text: string;
  impressions: number;
  likes: number;
  comments: number;
  reposts: number;
  clicks: number;
  createdAt: string;
}

export interface LinkedInPostsResult {
  posts: LinkedInPostAnalytics[];
  nextToken?: string;
}

export class LinkedInApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code:
      | "unauthorized"
      | "forbidden"
      | "not_found"
      | "rate_limited"
      | "unknown"
  ) {
    super(message);
    this.name = "LinkedInApiError";
  }
}

function classifyError(status: number): LinkedInApiError["code"] {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  return "unknown";
}

async function linkedInFetch<T>(
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${LINKEDIN_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const code = classifyError(response.status);
    let message: string;

    switch (code) {
      case "unauthorized":
        message =
          "LinkedIn access token is invalid or expired. Please reconnect your LinkedIn account.";
        break;
      case "forbidden":
        message =
          "Insufficient LinkedIn API permissions. Ensure your app has the required scopes.";
        break;
      case "not_found":
        message = "LinkedIn resource not found.";
        break;
      case "rate_limited":
        message =
          "LinkedIn API rate limit exceeded. Please wait a moment and try again.";
        break;
      default:
        message = `LinkedIn API error (${response.status})`;
    }

    throw new LinkedInApiError(message, response.status, code);
  }

  return response.json() as Promise<T>;
}

export async function verifyLinkedInAuth(
  accessToken: string
): Promise<LinkedInUser> {
  const result = await linkedInFetch<{
    sub: string;
    given_name: string;
    family_name: string;
    vanityName?: string;
  }>(accessToken, "/userinfo");

  return {
    id: result.sub,
    firstName: result.given_name,
    lastName: result.family_name,
    vanityName: result.vanityName,
  };
}

export async function getLinkedInUser(
  accessToken: string
): Promise<LinkedInUser> {
  return verifyLinkedInAuth(accessToken);
}

export async function getLinkedInPostAnalytics(
  accessToken: string,
  authorId: string,
  options: { count?: number; start?: number } = {}
): Promise<LinkedInPostsResult> {
  const count = options.count ?? 20;
  const start = options.start ?? 0;

  const postsParams = new URLSearchParams({
    q: "authors",
    authors: `List(urn:li:person:${authorId})`,
    count: String(count),
    start: String(start),
  });

  const postsResult = await linkedInFetch<{
    elements?: Array<{
      id: string;
      commentary?: string;
      createdAt?: number;
    }>;
    paging?: { total: number; count: number; start: number };
  }>(accessToken, `/posts?${postsParams.toString()}`);

  const elements = postsResult.elements ?? [];

  if (elements.length === 0) {
    return { posts: [] };
  }

  const postIds = elements.map((p) => p.id);
  const statsParams = new URLSearchParams({
    ugcPosts: postIds.map((id) => `urn:li:ugcPost:${id}`).join(","),
  });

  let statsMap: Record<
    string,
    {
      totalShareStatistics?: {
        impressionCount?: number;
        likeCount?: number;
        commentCount?: number;
        shareCount?: number;
        clickCount?: number;
      };
    }
  > = {};

  try {
    const statsResult = await linkedInFetch<{
      elements?: Array<{
        ugcPost: string;
        totalShareStatistics?: {
          impressionCount?: number;
          likeCount?: number;
          commentCount?: number;
          shareCount?: number;
          clickCount?: number;
        };
      }>;
    }>(
      accessToken,
      `/organizationalEntityShareStatistics?q=ugcPosts&${statsParams.toString()}`
    );

    for (const stat of statsResult.elements ?? []) {
      statsMap[stat.ugcPost] = { totalShareStatistics: stat.totalShareStatistics };
    }
  } catch {
    // Analytics endpoint may not be accessible — return posts with zero metrics
  }

  const posts: LinkedInPostAnalytics[] = elements.map((post) => {
    const urn = `urn:li:ugcPost:${post.id}`;
    const stats = statsMap[urn]?.totalShareStatistics ?? {};

    return {
      postId: post.id,
      text: post.commentary ?? "",
      impressions: stats.impressionCount ?? 0,
      likes: stats.likeCount ?? 0,
      comments: stats.commentCount ?? 0,
      reposts: stats.shareCount ?? 0,
      clicks: stats.clickCount ?? 0,
      createdAt: post.createdAt
        ? new Date(post.createdAt).toISOString()
        : new Date(0).toISOString(),
    };
  });

  const hasMore =
    (postsResult.paging?.start ?? 0) + elements.length <
    (postsResult.paging?.total ?? 0);

  return {
    posts,
    nextToken: hasMore ? String(start + count) : undefined,
  };
}

export async function getLinkedInPostById(
  accessToken: string,
  postId: string
): Promise<LinkedInPostAnalytics> {
  const post = await linkedInFetch<{
    id: string;
    commentary?: string;
    createdAt?: number;
  }>(accessToken, `/posts/${postId}`);

  let stats: {
    impressionCount?: number;
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
    clickCount?: number;
  } = {};

  try {
    const statsResult = await linkedInFetch<{
      elements?: Array<{
        totalShareStatistics?: {
          impressionCount?: number;
          likeCount?: number;
          commentCount?: number;
          shareCount?: number;
          clickCount?: number;
        };
      }>;
    }>(
      accessToken,
      `/organizationalEntityShareStatistics?q=ugcPosts&ugcPosts=urn:li:ugcPost:${postId}`
    );

    stats = statsResult.elements?.[0]?.totalShareStatistics ?? {};
  } catch {
    // Analytics endpoint may not be accessible — return post with zero metrics
  }

  return {
    postId: post.id,
    text: post.commentary ?? "",
    impressions: stats.impressionCount ?? 0,
    likes: stats.likeCount ?? 0,
    comments: stats.commentCount ?? 0,
    reposts: stats.shareCount ?? 0,
    clicks: stats.clickCount ?? 0,
    createdAt: post.createdAt
      ? new Date(post.createdAt).toISOString()
      : new Date(0).toISOString(),
  };
}
