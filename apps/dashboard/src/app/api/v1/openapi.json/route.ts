import { NextResponse } from "next/server";
import { withV1ApiHandler } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "SessionForge Public API",
    version: "1.0.0",
    description:
      "The SessionForge public REST API enables programmatic access to sessions, insights, content, and webhook management. Authenticate using your workspace API key as a Bearer token.",
  },
  servers: [
    {
      url: "https://app.sessionforge.com/api",
      description: "Production",
    },
  ],
  security: [{ ApiKey: [] }],
  components: {
    securitySchemes: {
      ApiKey: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "ApiKey",
        description:
          "Workspace API key. Format: `sf_live_<hex>`. Pass as `Authorization: Bearer <key>`.",
      },
    },
    schemas: {
      Meta: {
        type: "object",
        properties: {
          total: { type: "integer", description: "Total number of matching records" },
          limit: { type: "integer", description: "Number of records returned" },
          offset: { type: "integer", description: "Number of records skipped" },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          data: { type: "null" },
          meta: { type: "object" },
          error: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "Human-readable error message",
              },
              code: {
                type: "string",
                description:
                  "Stable machine-readable error code (UNAUTHORIZED, NOT_FOUND, VALIDATION_ERROR, BAD_REQUEST, INTERNAL_ERROR, FORBIDDEN)",
              },
              details: {
                type: "object",
                description:
                  "Optional structured validation details (e.g. Zod flatten output). Present for VALIDATION_ERROR responses.",
              },
            },
            required: ["message", "code"],
          },
        },
        required: ["error"],
      },
      Session: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          workspaceId: { type: "string", format: "uuid" },
          projectName: { type: "string" },
          messageCount: { type: "integer" },
          costUsd: { type: "number" },
          durationSeconds: { type: "number" },
          startedAt: { type: "string", format: "date-time" },
          endedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      SessionsResponse: {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Session" },
          },
          meta: { $ref: "#/components/schemas/Meta" },
          error: { type: "null" },
        },
      },
      ScanResult: {
        type: "object",
        properties: {
          scanned: { type: "integer", description: "Number of session files found" },
          indexed: { type: "integer", description: "Number of sessions newly indexed" },
          errors: { type: "integer", description: "Number of sessions that failed to parse" },
          durationMs: { type: "integer", description: "Total scan duration in milliseconds" },
        },
      },
      ScanResponse: {
        type: "object",
        properties: {
          data: { $ref: "#/components/schemas/ScanResult" },
          meta: { type: "object" },
          error: { type: "null" },
        },
      },
      Insight: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          workspaceId: { type: "string", format: "uuid" },
          sessionId: { type: "string", format: "uuid" },
          title: { type: "string" },
          summary: { type: "string" },
          category: {
            type: "string",
            enum: [
              "novel_problem_solving",
              "tool_pattern_discovery",
              "before_after_transformation",
              "failure_recovery",
              "architecture_decision",
              "performance_optimization",
            ],
          },
          compositeScore: { type: "number", minimum: 0, maximum: 1 },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      InsightsResponse: {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Insight" },
          },
          meta: { $ref: "#/components/schemas/Meta" },
          error: { type: "null" },
        },
      },
      Post: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          workspaceId: { type: "string", format: "uuid" },
          title: { type: "string" },
          markdown: { type: "string" },
          contentType: {
            type: "string",
            enum: ["blog_post", "twitter_thread", "linkedin_post", "devto_post", "changelog", "newsletter", "custom"],
          },
          status: {
            type: "string",
            enum: ["draft", "published", "archived"],
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ContentResponse: {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Post" },
          },
          meta: { $ref: "#/components/schemas/Meta" },
          error: { type: "null" },
        },
      },
      PostResponse: {
        type: "object",
        properties: {
          data: { $ref: "#/components/schemas/Post" },
          meta: { type: "object" },
          error: { type: "null" },
        },
      },
      GenerateContentRequest: {
        type: "object",
        required: ["insightId", "contentType"],
        properties: {
          insightId: { type: "string", format: "uuid", description: "ID of the insight to generate content from" },
          contentType: {
            type: "string",
            enum: ["blog_post", "twitter_thread", "linkedin_post", "devto_post", "changelog", "newsletter", "custom"],
            description: "Type of content to generate",
          },
          tone: {
            type: "string",
            enum: ["technical", "tutorial", "conversational"],
            description: "Writing tone for blog posts",
          },
        },
      },
      GenerateContentResult: {
        type: "object",
        properties: {
          postId: { type: "string", format: "uuid" },
          title: { type: "string" },
          contentType: { type: "string" },
        },
      },
      GenerateContentResponse: {
        type: "object",
        properties: {
          data: { $ref: "#/components/schemas/GenerateContentResult" },
          meta: { type: "object" },
          error: { type: "null" },
        },
      },
      UpdatePostRequest: {
        type: "object",
        properties: {
          title: { type: "string", description: "New post title" },
          markdown: { type: "string", description: "New post body in Markdown" },
          status: {
            type: "string",
            enum: ["draft", "published", "archived"],
            description: "New post status",
          },
        },
      },
      WebhookEndpoint: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          url: { type: "string", format: "uri", description: "HTTPS endpoint URL" },
          events: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "content.generated",
                "content.published",
                "insight.extracted",
                "scan.completed",
                "automation.completed",
              ],
            },
          },
          enabled: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      WebhooksResponse: {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/WebhookEndpoint" },
          },
          meta: { type: "object" },
          error: { type: "null" },
        },
      },
      CreateWebhookRequest: {
        type: "object",
        required: ["url", "events"],
        properties: {
          url: { type: "string", format: "uri", description: "HTTPS URL to receive webhook POST requests" },
          events: {
            type: "array",
            minItems: 1,
            items: {
              type: "string",
              enum: [
                "content.generated",
                "content.published",
                "insight.extracted",
                "scan.completed",
                "automation.completed",
              ],
            },
            description: "List of event types to subscribe to",
          },
        },
      },
      CreateWebhookResponse: {
        type: "object",
        properties: {
          data: {
            allOf: [
              { $ref: "#/components/schemas/WebhookEndpoint" },
              {
                type: "object",
                properties: {
                  secret: {
                    type: "string",
                    description: "Signing secret for HMAC-SHA256 verification. Only returned on creation.",
                  },
                },
              },
            ],
          },
          meta: { type: "object" },
          error: { type: "null" },
        },
      },
      UpdateWebhookRequest: {
        type: "object",
        properties: {
          url: { type: "string", format: "uri", description: "New endpoint URL" },
          events: {
            type: "array",
            minItems: 1,
            items: {
              type: "string",
              enum: [
                "content.generated",
                "content.published",
                "insight.extracted",
                "scan.completed",
                "automation.completed",
              ],
            },
          },
          enabled: { type: "boolean", description: "Enable or disable this endpoint" },
        },
      },
    },
  },
  paths: {
    "/v1/sessions": {
      get: {
        operationId: "listSessions",
        summary: "List sessions",
        description: "Returns a paginated list of Claude sessions for the authenticated workspace.",
        tags: ["Sessions"],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20, maximum: 100 },
            description: "Number of sessions to return (max 100)",
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer", default: 0 },
            description: "Number of sessions to skip",
          },
          {
            name: "sort",
            in: "query",
            schema: {
              type: "string",
              enum: ["startedAt", "messageCount", "costUsd", "durationSeconds"],
              default: "startedAt",
            },
          },
          {
            name: "order",
            in: "query",
            schema: { type: "string", enum: ["asc", "desc"], default: "desc" },
          },
          {
            name: "project",
            in: "query",
            schema: { type: "string" },
            description: "Filter by project name",
          },
          {
            name: "minMessages",
            in: "query",
            schema: { type: "integer" },
            description: "Filter sessions with at least this many messages",
          },
        ],
        responses: {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SessionsResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
        "x-code-samples": [
          {
            lang: "curl",
            label: "cURL",
            source:
              'curl -X GET "https://app.sessionforge.com/api/v1/sessions?limit=10&order=desc" \\\n  -H "Authorization: Bearer sf_live_your_api_key_here"',
          },
        ],
      },
    },
    "/v1/sessions/scan": {
      post: {
        operationId: "triggerScan",
        summary: "Trigger a session scan",
        description:
          "Scans the workspace session files and indexes any new or updated sessions. Fires a `scan.completed` webhook event on completion.",
        tags: ["Sessions"],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  lookbackDays: {
                    type: "integer",
                    default: 30,
                    description: "Number of days to look back when scanning for session files",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Scan completed successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ScanResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Workspace not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
        "x-code-samples": [
          {
            lang: "curl",
            label: "cURL",
            source:
              'curl -X POST "https://app.sessionforge.com/api/v1/sessions/scan" \\\n  -H "Authorization: Bearer sf_live_your_api_key_here" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"lookbackDays": 7}\'',
          },
        ],
      },
    },
    "/v1/insights": {
      get: {
        operationId: "listInsights",
        summary: "List insights",
        description:
          "Returns a paginated list of insights extracted from Claude sessions, ordered by composite score (highest first).",
        tags: ["Insights"],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20, maximum: 100 },
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer", default: 0 },
          },
          {
            name: "minScore",
            in: "query",
            schema: { type: "number", minimum: 0, maximum: 1 },
            description: "Only return insights with a composite score at or above this value",
          },
          {
            name: "category",
            in: "query",
            schema: {
              type: "string",
              enum: [
                "novel_problem_solving",
                "tool_pattern_discovery",
                "before_after_transformation",
                "failure_recovery",
                "architecture_decision",
                "performance_optimization",
              ],
            },
            description: "Filter by insight category",
          },
        ],
        responses: {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InsightsResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
        "x-code-samples": [
          {
            lang: "curl",
            label: "cURL",
            source:
              'curl -X GET "https://app.sessionforge.com/api/v1/insights?minScore=0.7&category=pattern" \\\n  -H "Authorization: Bearer sf_live_your_api_key_here"',
          },
        ],
      },
    },
    "/v1/content": {
      get: {
        operationId: "listContent",
        summary: "List content posts",
        description: "Returns a paginated list of generated content posts for the workspace.",
        tags: ["Content"],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20, maximum: 100 },
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer", default: 0 },
          },
          {
            name: "type",
            in: "query",
            schema: {
              type: "string",
              enum: ["blog_post", "twitter_thread", "linkedin_post", "devto_post", "changelog", "newsletter", "custom"],
            },
            description: "Filter by content type",
          },
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["draft", "published", "archived"],
            },
            description: "Filter by status",
          },
        ],
        responses: {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ContentResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
        "x-code-samples": [
          {
            lang: "curl",
            label: "cURL",
            source:
              'curl -X GET "https://app.sessionforge.com/api/v1/content?type=blog_post&status=draft" \\\n  -H "Authorization: Bearer sf_live_your_api_key_here"',
          },
        ],
      },
    },
    "/v1/content/generate": {
      post: {
        operationId: "generateContent",
        summary: "Generate content from an insight",
        description:
          "Triggers an AI agent to generate a content post from the specified insight. Fires a `content.generated` webhook event on success. This request may take 30–60 seconds.",
        tags: ["Content"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenerateContentRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Content generated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenerateContentResponse" },
              },
            },
          },
          "400": {
            description: "Invalid request body",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "500": {
            description: "Generation failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
        "x-code-samples": [
          {
            lang: "curl",
            label: "cURL",
            source:
              'curl -X POST "https://app.sessionforge.com/api/v1/content/generate" \\\n  -H "Authorization: Bearer sf_live_your_api_key_here" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"insightId": "uuid-here", "contentType": "blog_post", "tone": "technical"}\'',
          },
        ],
      },
    },
    "/v1/content/{id}": {
      patch: {
        operationId: "updateContent",
        summary: "Update a content post",
        description:
          "Updates a content post's title, body, or status. Setting status to `published` fires a `content.published` webhook event.",
        tags: ["Content"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Post ID",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdatePostRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Post updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PostResponse" },
              },
            },
          },
          "400": {
            description: "Invalid request body",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Post not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
        "x-code-samples": [
          {
            lang: "curl",
            label: "cURL",
            source:
              'curl -X PATCH "https://app.sessionforge.com/api/v1/content/uuid-here" \\\n  -H "Authorization: Bearer sf_live_your_api_key_here" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"status": "published"}\'',
          },
        ],
      },
    },
    "/v1/webhooks": {
      get: {
        operationId: "listWebhooks",
        summary: "List webhook endpoints",
        description: "Returns all registered webhook endpoints for the workspace.",
        tags: ["Webhooks"],
        responses: {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WebhooksResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
        "x-code-samples": [
          {
            lang: "curl",
            label: "cURL",
            source:
              'curl -X GET "https://app.sessionforge.com/api/v1/webhooks" \\\n  -H "Authorization: Bearer sf_live_your_api_key_here"',
          },
        ],
      },
      post: {
        operationId: "createWebhook",
        summary: "Register a webhook endpoint",
        description:
          "Registers a new webhook endpoint. Returns the endpoint including its signing secret (only shown once). Use the secret to verify the `X-SessionForge-Signature` header on incoming requests: `sha256=HMAC-SHA256(secret, body)`.",
        tags: ["Webhooks"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateWebhookRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Webhook endpoint created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateWebhookResponse" },
              },
            },
          },
          "400": {
            description: "Invalid request body",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
        "x-code-samples": [
          {
            lang: "curl",
            label: "cURL",
            source:
              'curl -X POST "https://app.sessionforge.com/api/v1/webhooks" \\\n  -H "Authorization: Bearer sf_live_your_api_key_here" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"url": "https://example.com/webhooks", "events": ["content.generated", "scan.completed"]}\'',
          },
        ],
      },
    },
    "/v1/webhooks/{id}": {
      patch: {
        operationId: "updateWebhook",
        summary: "Update a webhook endpoint",
        description: "Updates the URL, event subscriptions, or enabled state of a webhook endpoint.",
        tags: ["Webhooks"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Webhook endpoint ID",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateWebhookRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Webhook endpoint updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/WebhookEndpoint" },
                    meta: { type: "object" },
                    error: { type: "null" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid request body",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Webhook endpoint not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
        "x-code-samples": [
          {
            lang: "curl",
            label: "cURL",
            source:
              'curl -X PATCH "https://app.sessionforge.com/api/v1/webhooks/uuid-here" \\\n  -H "Authorization: Bearer sf_live_your_api_key_here" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"enabled": false}\'',
          },
        ],
      },
      delete: {
        operationId: "deleteWebhook",
        summary: "Delete a webhook endpoint",
        description: "Permanently deletes a webhook endpoint.",
        tags: ["Webhooks"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Webhook endpoint ID",
          },
        ],
        responses: {
          "200": {
            description: "Webhook endpoint deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        deleted: { type: "boolean", example: true },
                      },
                    },
                    meta: { type: "object" },
                    error: { type: "null" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Webhook endpoint not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
        "x-code-samples": [
          {
            lang: "curl",
            label: "cURL",
            source:
              'curl -X DELETE "https://app.sessionforge.com/api/v1/webhooks/uuid-here" \\\n  -H "Authorization: Bearer sf_live_your_api_key_here"',
          },
        ],
      },
    },
  },
};

export const GET = withV1ApiHandler(async () => {
  return NextResponse.json(openApiDocument);
});
