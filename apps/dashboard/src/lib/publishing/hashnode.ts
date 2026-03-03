const HASHNODE_GQL_ENDPOINT = "https://gql.hashnode.com";

export interface HashnodePublication {
  id: string;
  title: string;
}

export interface HashnodeTag {
  slug: string;
  name: string;
}

export interface HashnodePublishInput {
  token: string;
  publicationId: string;
  title: string;
  subtitle?: string;
  contentMarkdown: string;
  tags?: HashnodeTag[];
  coverImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
}

export interface HashnodePublishResult {
  articleId: string;
  url: string;
  slug: string;
}

interface HashnodeErrorResponse {
  errors?: { message: string }[];
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function hashnodeRequest<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(HASHNODE_GQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Hashnode API request failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as { data?: T } & HashnodeErrorResponse;

  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  if (!json.data) {
    throw new Error("Hashnode API returned no data");
  }

  return json.data;
}

export async function getHashnodePublications(
  token: string
): Promise<HashnodePublication[]> {
  const query = `
    query GetMyPublications {
      me {
        publications(first: 20) {
          edges {
            node {
              id
              title
            }
          }
        }
      }
    }
  `;

  const data = await hashnodeRequest<{
    me: {
      publications: {
        edges: { node: HashnodePublication }[];
      };
    };
  }>(token, query);

  return data.me.publications.edges.map((edge) => edge.node);
}

export async function publishToHashnode(
  input: HashnodePublishInput
): Promise<HashnodePublishResult> {
  const mutation = `
    mutation PublishPost($input: PublishPostInput!) {
      publishPost(input: $input) {
        post {
          id
          url
          slug
        }
      }
    }
  `;

  const publishInput: Record<string, unknown> = {
    publicationId: input.publicationId,
    title: input.title,
    contentMarkdown: input.contentMarkdown,
    slug: slugify(input.title),
  };

  if (input.subtitle) {
    publishInput.subtitle = input.subtitle;
  }

  if (input.tags && input.tags.length > 0) {
    publishInput.tags = input.tags;
  }

  if (input.coverImageUrl) {
    publishInput.coverImageOptions = { coverImageURL: input.coverImageUrl };
  }

  if (input.seoTitle || input.seoDescription) {
    publishInput.metaTags = {
      ...(input.seoTitle ? { title: input.seoTitle } : {}),
      ...(input.seoDescription ? { description: input.seoDescription } : {}),
    };
  }

  if (input.canonicalUrl) {
    publishInput.originalArticleURL = input.canonicalUrl;
  }

  const data = await hashnodeRequest<{
    publishPost: {
      post: { id: string; url: string; slug: string };
    };
  }>(input.token, mutation, { input: publishInput });

  const post = data.publishPost.post;

  return {
    articleId: post.id,
    url: post.url,
    slug: post.slug,
  };
}
