const TWITTER_API_BASE = "https://api.twitter.com/2";

export interface TwitterUser {
  id: string;
  username: string;
  name: string;
}

export interface TweetPublicMetrics {
  impression_count: number;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  url_link_clicks: number;
  quote_count: number;
}

export interface TweetAnalytics {
  tweetId: string;
  text: string;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  clicks: number;
  quotes: number;
  createdAt: string;
}

export interface TwitterUserTweetsResult {
  tweets: TweetAnalytics[];
  nextToken?: string;
}

export class TwitterApiError extends Error {
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
    this.name = "TwitterApiError";
  }
}

function classifyError(status: number): TwitterApiError["code"] {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  return "unknown";
}

async function twitterFetch<T>(
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${TWITTER_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const code = classifyError(response.status);
    let message: string;

    switch (code) {
      case "unauthorized":
        message =
          "Twitter access token is invalid or expired. Please reconnect your Twitter account.";
        break;
      case "forbidden":
        message =
          "Insufficient Twitter API permissions. Ensure your app has the required scopes.";
        break;
      case "not_found":
        message = "Twitter resource not found.";
        break;
      case "rate_limited":
        message =
          "Twitter API rate limit exceeded. Please wait a moment and try again.";
        break;
      default:
        message = `Twitter API error (${response.status})`;
    }

    throw new TwitterApiError(message, response.status, code);
  }

  return response.json() as Promise<T>;
}

export async function verifyTwitterAuth(
  accessToken: string
): Promise<TwitterUser> {
  const result = await twitterFetch<{
    data: { id: string; username: string; name: string };
  }>(accessToken, "/users/me?user.fields=username,name");

  return {
    id: result.data.id,
    username: result.data.username,
    name: result.data.name,
  };
}

export async function getTwitterUser(
  accessToken: string
): Promise<TwitterUser> {
  return verifyTwitterAuth(accessToken);
}

export async function getTweetAnalytics(
  accessToken: string,
  userId: string,
  options: { maxResults?: number; nextToken?: string } = {}
): Promise<TwitterUserTweetsResult> {
  const params = new URLSearchParams({
    "tweet.fields": "public_metrics,created_at,text",
    max_results: String(options.maxResults ?? 100),
  });

  if (options.nextToken) {
    params.set("pagination_token", options.nextToken);
  }

  const result = await twitterFetch<{
    data?: Array<{
      id: string;
      text: string;
      created_at: string;
      public_metrics: TweetPublicMetrics;
    }>;
    meta?: { next_token?: string };
  }>(accessToken, `/users/${userId}/tweets?${params.toString()}`);

  const tweets: TweetAnalytics[] = (result.data ?? []).map((tweet) => ({
    tweetId: tweet.id,
    text: tweet.text,
    impressions: tweet.public_metrics.impression_count,
    likes: tweet.public_metrics.like_count,
    retweets: tweet.public_metrics.retweet_count,
    replies: tweet.public_metrics.reply_count,
    clicks: tweet.public_metrics.url_link_clicks,
    quotes: tweet.public_metrics.quote_count,
    createdAt: tweet.created_at,
  }));

  return {
    tweets,
    nextToken: result.meta?.next_token,
  };
}

export async function getTweetById(
  accessToken: string,
  tweetId: string
): Promise<TweetAnalytics> {
  const result = await twitterFetch<{
    data: {
      id: string;
      text: string;
      created_at: string;
      public_metrics: TweetPublicMetrics;
    };
  }>(
    accessToken,
    `/tweets/${tweetId}?tweet.fields=public_metrics,created_at,text`
  );

  return {
    tweetId: result.data.id,
    text: result.data.text,
    impressions: result.data.public_metrics.impression_count,
    likes: result.data.public_metrics.like_count,
    retweets: result.data.public_metrics.retweet_count,
    replies: result.data.public_metrics.reply_count,
    clicks: result.data.public_metrics.url_link_clicks,
    quotes: result.data.public_metrics.quote_count,
    createdAt: result.data.created_at,
  };
}
