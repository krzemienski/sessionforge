const GITHUB_API_BASE = "https://api.github.com";

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  owner: {
    login: string;
    avatar_url: string;
  };
  updated_at: string;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  html_url: string;
  author: {
    login: string;
    avatar_url: string;
  } | null;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: "open" | "closed";
  merged: boolean;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  user: {
    login: string;
    avatar_url: string;
  };
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: "open" | "closed";
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  user: {
    login: string;
    avatar_url: string;
  };
  labels: Array<{
    name: string;
    color: string;
  }>;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: "invalid_token" | "not_found" | "forbidden" | "rate_limited" | "validation_error" | "unknown"
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

function classifyError(status: number): GitHubApiError["code"] {
  if (status === 401) return "invalid_token";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 422) return "validation_error";
  if (status === 429) return "rate_limited";
  return "unknown";
}

async function githubFetch<T>(
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const code = classifyError(response.status);
    let message: string;

    switch (code) {
      case "invalid_token":
        message = "Invalid GitHub access token. Please reconnect your GitHub account.";
        break;
      case "forbidden":
        message = "GitHub API access forbidden. Check your permissions or rate limits.";
        break;
      case "not_found":
        message = "GitHub resource not found. The repository or resource may not exist.";
        break;
      case "validation_error":
        message = "GitHub validation error. Check your request parameters.";
        break;
      case "rate_limited":
        message = "GitHub rate limit exceeded. Please wait a moment and try again.";
        break;
      default:
        message = `GitHub API error (${response.status})`;
    }

    throw new GitHubApiError(message, response.status, code);
  }

  return response.json() as Promise<T>;
}

export async function verifyGitHubToken(accessToken: string): Promise<GitHubUser> {
  const user = await githubFetch<{
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string;
  }>(accessToken, "/user");

  return {
    login: user.login,
    name: user.name,
    email: user.email,
    avatar_url: user.avatar_url,
  };
}

export async function fetchGitHubRepositories(
  accessToken: string,
  options?: { affiliation?: string; sort?: string; per_page?: number }
): Promise<GitHubRepository[]> {
  const params = new URLSearchParams({
    affiliation: options?.affiliation || "owner,collaborator,organization_member",
    sort: options?.sort || "updated",
    per_page: String(options?.per_page || 100),
  });

  return githubFetch<GitHubRepository[]>(
    accessToken,
    `/user/repos?${params.toString()}`
  );
}

export async function fetchGitHubCommits(
  accessToken: string,
  owner: string,
  repo: string,
  options?: { since?: string; per_page?: number; page?: number }
): Promise<GitHubCommit[]> {
  const params = new URLSearchParams();
  if (options?.since) params.set("since", options.since);
  if (options?.per_page) params.set("per_page", String(options.per_page));
  if (options?.page) params.set("page", String(options.page));

  const queryString = params.toString() ? `?${params.toString()}` : "";
  return githubFetch<GitHubCommit[]>(
    accessToken,
    `/repos/${owner}/${repo}/commits${queryString}`
  );
}

export async function fetchGitHubPullRequests(
  accessToken: string,
  owner: string,
  repo: string,
  options?: { state?: "open" | "closed" | "all"; per_page?: number; page?: number }
): Promise<GitHubPullRequest[]> {
  const params = new URLSearchParams({
    state: options?.state || "all",
  });
  if (options?.per_page) params.set("per_page", String(options.per_page));
  if (options?.page) params.set("page", String(options.page));

  return githubFetch<GitHubPullRequest[]>(
    accessToken,
    `/repos/${owner}/${repo}/pulls?${params.toString()}`
  );
}

export async function fetchGitHubPullRequest(
  accessToken: string,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<GitHubPullRequest> {
  return githubFetch<GitHubPullRequest>(
    accessToken,
    `/repos/${owner}/${repo}/pulls/${pullNumber}`
  );
}

export async function fetchGitHubIssues(
  accessToken: string,
  owner: string,
  repo: string,
  options?: { state?: "open" | "closed" | "all"; per_page?: number; page?: number }
): Promise<GitHubIssue[]> {
  const params = new URLSearchParams({
    state: options?.state || "all",
  });
  if (options?.per_page) params.set("per_page", String(options.per_page));
  if (options?.page) params.set("page", String(options.page));

  return githubFetch<GitHubIssue[]>(
    accessToken,
    `/repos/${owner}/${repo}/issues?${params.toString()}`
  );
}

export async function fetchGitHubRepository(
  accessToken: string,
  owner: string,
  repo: string
): Promise<GitHubRepository> {
  return githubFetch<GitHubRepository>(
    accessToken,
    `/repos/${owner}/${repo}`
  );
}
