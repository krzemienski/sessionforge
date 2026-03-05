/**
 * WordPress REST API client for publishing posts to self-hosted and WordPress.com sites.
 * Uses Application Passwords for authentication (Basic auth over HTTPS).
 */

export interface WordPressSiteInfo {
  id: number;
  name: string;
  url: string;
  description: string;
}

export interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
}

export interface WordPressTag {
  id: number;
  name: string;
  slug: string;
  count: number;
}

export interface WordPressPostParams {
  title: string;
  htmlContent: string;
  excerpt?: string;
  categories?: number[];
  tags?: number[];
  featuredMediaId?: number;
  status: "draft" | "publish" | "pending" | "private";
}

export interface WordPressPost {
  id: number;
  link: string;
  status: string;
  title: { rendered: string };
  date: string;
}

export class WordPressClient {
  private readonly siteUrl: string;
  private readonly username: string;
  private readonly appPassword: string;

  constructor(siteUrl: string, username: string, appPassword: string) {
    this.siteUrl = siteUrl.trim();
    this.username = username.trim();
    this.appPassword = appPassword.trim();
  }

  /**
   * Normalizes the site URL to ensure it ends with /wp-json/wp/v2.
   * Handles both WordPress.com and self-hosted WordPress.org sites.
   */
  getApiBase(): string {
    let url = this.siteUrl.replace(/\/+$/, "");

    // Already has /wp-json/wp/v2 suffix
    if (url.endsWith("/wp-json/wp/v2")) {
      return url;
    }

    // Has /wp-json but not /wp/v2
    if (url.endsWith("/wp-json")) {
      return `${url}/wp/v2`;
    }

    // Contains /wp-json somewhere in the path
    const wpJsonIndex = url.indexOf("/wp-json");
    if (wpJsonIndex !== -1) {
      return `${url.slice(0, wpJsonIndex)}/wp-json/wp/v2`;
    }

    // WordPress.com hosted sites: siteurl.wordpress.com → siteurl.wordpress.com/wp-json/wp/v2
    // Self-hosted: append /wp-json/wp/v2
    return `${url}/wp-json/wp/v2`;
  }

  /**
   * Builds the Authorization header value for HTTP Basic auth using Application Password.
   */
  private getAuthHeader(): string {
    const credentials = Buffer.from(
      `${this.username}:${this.appPassword}`
    ).toString("base64");
    return `Basic ${credentials}`;
  }

  /**
   * Makes an authenticated request to the WordPress REST API.
   * Throws a descriptive error if the response is not OK.
   */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.getApiBase()}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.getAuthHeader(),
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorBody = (await response.json()) as {
          message?: string;
          code?: string;
        };
        errorMessage =
          errorBody.message ??
          `WordPress API error: ${response.status} ${response.statusText}`;
      } catch {
        errorMessage = `WordPress API error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Tests the connection by fetching the current authenticated user.
   * Returns basic site info on success. Throws if credentials are invalid.
   */
  async testConnection(): Promise<WordPressSiteInfo> {
    interface WpUser {
      id: number;
      name: string;
      url: string;
      description: string;
    }

    const user = await this.request<WpUser>("/users/me");

    return {
      id: user.id,
      name: user.name,
      url: user.url,
      description: user.description,
    };
  }

  /**
   * Retrieves all categories from the WordPress site.
   * Fetches up to 100 categories per page (WordPress default max).
   */
  async getCategories(): Promise<WordPressCategory[]> {
    interface WpCategory {
      id: number;
      name: string;
      slug: string;
      count: number;
    }

    const categories = await this.request<WpCategory[]>(
      "/categories?per_page=100&orderby=name&order=asc"
    );

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      count: cat.count,
    }));
  }

  /**
   * Retrieves all tags from the WordPress site.
   * Fetches up to 100 tags per page (WordPress default max).
   */
  async getTags(): Promise<WordPressTag[]> {
    interface WpTag {
      id: number;
      name: string;
      slug: string;
      count: number;
    }

    const tags = await this.request<WpTag[]>(
      "/tags?per_page=100&orderby=name&order=asc"
    );

    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      count: tag.count,
    }));
  }

  /**
   * Creates a new post on the WordPress site.
   * Returns the created post including its ID and published URL.
   */
  async createPost(params: WordPressPostParams): Promise<WordPressPost> {
    const body: Record<string, unknown> = {
      title: params.title,
      content: params.htmlContent,
      status: params.status,
    };

    if (params.excerpt) {
      body.excerpt = params.excerpt;
    }

    if (params.categories && params.categories.length > 0) {
      body.categories = params.categories;
    }

    if (params.tags && params.tags.length > 0) {
      body.tags = params.tags;
    }

    if (params.featuredMediaId) {
      body.featured_media = params.featuredMediaId;
    }

    interface WpPost {
      id: number;
      link: string;
      status: string;
      title: { rendered: string };
      date: string;
    }

    const post = await this.request<WpPost>("/posts", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      id: post.id,
      link: post.link,
      status: post.status,
      title: post.title,
      date: post.date,
    };
  }
}
