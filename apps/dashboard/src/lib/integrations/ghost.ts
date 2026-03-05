export interface GhostUser {
  name: string;
  email: string;
  url: string;
}

export interface GhostPostInput {
  title: string;
  html?: string;
  lexical?: string;
  status: "draft" | "published" | "scheduled";
  tags?: { name: string }[];
  authors?: { email: string }[];
  feature_image?: string;
  canonical_url?: string;
  visibility?: "public" | "members" | "paid";
  custom_excerpt?: string;
}

export interface GhostPostResult {
  id: string;
  url: string;
  status: string;
  published_at: string | null;
}

export class GhostApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: "invalid_api_key" | "validation_error" | "rate_limited" | "not_found" | "unknown"
  ) {
    super(message);
    this.name = "GhostApiError";
  }
}

function classifyError(status: number): GhostApiError["code"] {
  if (status === 401 || status === 403) return "invalid_api_key";
  if (status === 422) return "validation_error";
  if (status === 429) return "rate_limited";
  if (status === 404) return "not_found";
  return "unknown";
}

/**
 * Ghost Admin API keys are in the format `{id}:{secret}` where secret is a hex string.
 * We generate a JWT token for authentication.
 */
async function generateGhostJwt(adminApiKey: string): Promise<string> {
  const [id, secret] = adminApiKey.split(":");
  if (!id || !secret) {
    throw new GhostApiError(
      "Invalid Ghost Admin API key format. Expected format: {id}:{secret}",
      401,
      "invalid_api_key"
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT", kid: id };
  const payload = { iat: now, exp: now + 5 * 60, aud: "/admin/" };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const secretBytes = new Uint8Array(
    secret.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${signingInput}.${signatureB64}`;
}

function normalizeGhostUrl(ghostUrl: string): string {
  return ghostUrl.replace(/\/+$/, "");
}

async function ghostFetch<T>(
  adminApiKey: string,
  ghostUrl: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await generateGhostJwt(adminApiKey);
  const baseUrl = normalizeGhostUrl(ghostUrl);

  const response = await fetch(`${baseUrl}/ghost/api/admin${path}`, {
    ...options,
    headers: {
      Authorization: `Ghost ${token}`,
      "Content-Type": "application/json",
      "Accept-Version": "v5.0",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const code = classifyError(response.status);
    let message: string;

    switch (code) {
      case "invalid_api_key":
        message =
          "Invalid Ghost Admin API key. Please check your key and Ghost URL, then try again.";
        break;
      case "validation_error":
        message =
          "Ghost validation error. Check your post content and field values.";
        break;
      case "rate_limited":
        message = "Ghost rate limit exceeded. Please wait a moment and try again.";
        break;
      case "not_found":
        message = "Ghost resource not found. Check the Ghost URL and post ID.";
        break;
      default:
        message = `Ghost API error (${response.status})`;
    }

    throw new GhostApiError(message, response.status, code);
  }

  return response.json() as Promise<T>;
}

export async function verifyGhostApiKey(
  adminApiKey: string,
  ghostUrl: string
): Promise<GhostUser> {
  const data = await ghostFetch<{
    users: Array<{ name: string; email: string; url: string }>;
  }>(adminApiKey, ghostUrl, "/users/me/?include=roles");

  const user = data.users[0];
  return { name: user.name, email: user.email, url: user.url };
}

export async function publishToGhost(
  adminApiKey: string,
  ghostUrl: string,
  post: GhostPostInput
): Promise<GhostPostResult> {
  const data = await ghostFetch<{
    posts: Array<{ id: string; url: string; status: string; published_at: string | null }>;
  }>(adminApiKey, ghostUrl, "/posts/", {
    method: "POST",
    body: JSON.stringify({ posts: [post] }),
  });

  const result = data.posts[0];
  return {
    id: result.id,
    url: result.url,
    status: result.status,
    published_at: result.published_at,
  };
}

export async function updateGhostPost(
  adminApiKey: string,
  ghostUrl: string,
  postId: string,
  post: Partial<GhostPostInput> & { updated_at: string }
): Promise<GhostPostResult> {
  const data = await ghostFetch<{
    posts: Array<{ id: string; url: string; status: string; published_at: string | null }>;
  }>(adminApiKey, ghostUrl, `/posts/${postId}/`, {
    method: "PUT",
    body: JSON.stringify({ posts: [post] }),
  });

  const result = data.posts[0];
  return {
    id: result.id,
    url: result.url,
    status: result.status,
    published_at: result.published_at,
  };
}
