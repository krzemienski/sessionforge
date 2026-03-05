/**
 * Git repository analyzer.
 * Shallow-clones a public repo to a temp directory, extracts structure,
 * and uses Claude to generate a structured summary.
 */

import simpleGit from "simple-git";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { query } from "@anthropic-ai/claude-agent-sdk";

// Allow Claude SDK subprocess spawning even when running inside a Claude Code session
delete process.env.CLAUDECODE;

export interface RepoAnalysis {
  url: string;
  name: string;
  description: string;
  techStack: string[];
  languages: Record<string, number>; // extension -> file count
  structure: string; // directory tree (top 2 levels)
  readmeContent: string;
  keyFiles: Array<{ path: string; content: string }>;
  relevantPatterns: string[];
}

const TOTAL_TIMEOUT_MS = 60_000;
const CLONE_TIMEOUT_MS = 30_000;

/** Count files by extension for language breakdown. */
async function countLanguages(dir: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  async function walk(current: string, depth: number): Promise<void> {
    if (depth > 4) return;
    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "vendor") {
        continue;
      }
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase() || "(no ext)";
        counts[ext] = (counts[ext] ?? 0) + 1;
      }
    }
  }

  await walk(dir, 0);
  return counts;
}

/** Build a directory tree string (top 2 levels). */
async function buildTree(dir: string, prefix = "", depth = 0): Promise<string> {
  if (depth > 2) return "";

  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return "";
  }

  const filtered = entries
    .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules" && e.name !== "vendor" && e.name !== ".git")
    .slice(0, 30); // cap per-level

  const lines: string[] = [];
  for (let i = 0; i < filtered.length; i++) {
    const entry = filtered[i];
    const isLast = i === filtered.length - 1;
    const connector = isLast ? "└── " : "├── ";
    lines.push(`${prefix}${connector}${entry.name}${entry.isDirectory() ? "/" : ""}`);
    if (entry.isDirectory() && depth < 1) {
      const subPrefix = prefix + (isLast ? "    " : "│   ");
      lines.push(await buildTree(path.join(dir, entry.name), subPrefix, depth + 1));
    }
  }

  return lines.filter(Boolean).join("\n");
}

/** Try to read a file, returning empty string on failure. */
async function tryRead(filePath: string, maxBytes = 8_000): Promise<string> {
  try {
    const buf = await fs.readFile(filePath);
    return buf.slice(0, maxBytes).toString("utf-8");
  } catch {
    return "";
  }
}

/** Read manifest files to detect tech stack. */
async function readManifests(dir: string): Promise<{ techStack: string[]; keyFiles: Array<{ path: string; content: string }> }> {
  const manifestCandidates = [
    "package.json",
    "Cargo.toml",
    "go.mod",
    "requirements.txt",
    "pyproject.toml",
    "Gemfile",
    "pom.xml",
    "build.gradle",
    "composer.json",
    "mix.exs",
  ];

  const techStack: string[] = [];
  const keyFiles: Array<{ path: string; content: string }> = [];

  for (const filename of manifestCandidates) {
    const filePath = path.join(dir, filename);
    const content = await tryRead(filePath, 4_000);
    if (!content) continue;

    keyFiles.push({ path: filename, content });

    // Detect stack from package.json
    if (filename === "package.json") {
      try {
        const pkg = JSON.parse(content) as Record<string, unknown>;
        const deps = {
          ...((pkg.dependencies ?? {}) as Record<string, unknown>),
          ...((pkg.devDependencies ?? {}) as Record<string, unknown>),
        };
        if ("react" in deps) techStack.push("React");
        if ("next" in deps) techStack.push("Next.js");
        if ("vue" in deps) techStack.push("Vue");
        if ("svelte" in deps) techStack.push("Svelte");
        if ("express" in deps) techStack.push("Express");
        if ("fastify" in deps) techStack.push("Fastify");
        if ("typescript" in deps || "ts-node" in deps) techStack.push("TypeScript");
        if ("drizzle-orm" in deps) techStack.push("Drizzle ORM");
        if ("prisma" in deps || "@prisma/client" in deps) techStack.push("Prisma");
        techStack.push("Node.js");
      } catch {
        // Ignore JSON parse errors
      }
    } else if (filename === "Cargo.toml") {
      techStack.push("Rust");
    } else if (filename === "go.mod") {
      techStack.push("Go");
    } else if (filename === "requirements.txt" || filename === "pyproject.toml") {
      techStack.push("Python");
    } else if (filename === "Gemfile") {
      techStack.push("Ruby");
    } else if (filename === "pom.xml" || filename === "build.gradle") {
      techStack.push("Java/JVM");
    }
  }

  return { techStack: [...new Set(techStack)], keyFiles };
}

/** Use Claude to generate a structured repo summary. */
async function generateRepoSummary(params: {
  url: string;
  name: string;
  tree: string;
  readme: string;
  languages: Record<string, number>;
  techStack: string[];
  keyFiles: Array<{ path: string; content: string }>;
}): Promise<{ description: string; relevantPatterns: string[] }> {
  const keyFilesText = params.keyFiles
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  const langSummary = Object.entries(params.languages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([ext, count]) => `${ext}: ${count} files`)
    .join(", ");

  const prompt = `Analyze this repository and provide a structured summary.

Repository: ${params.name}
URL: ${params.url}
Tech Stack: ${params.techStack.join(", ") || "Unknown"}
Languages: ${langSummary || "Unknown"}

Directory Structure:
\`\`\`
${params.tree.slice(0, 3_000)}
\`\`\`

README:
${params.readme.slice(0, 4_000)}

Key Files:
${keyFilesText.slice(0, 4_000)}

Respond with a JSON object:
{
  "description": "2-3 sentence summary of what this repo does and its purpose",
  "relevantPatterns": ["pattern1", "pattern2", ...] // up to 8 notable patterns, architectures, or techniques
}`;

  let responseText: string | null = null;
  for await (const message of query({
    prompt,
    options: {
      systemPrompt: "You are a code analyst. Respond only with valid JSON, no markdown fences.",
      model: "claude-haiku-4-5-20251001",
      maxTurns: 1,
    },
  })) {
    if ("result" in message) {
      responseText = message.result as string;
    }
  }

  if (!responseText) {
    return { description: `Repository at ${params.url}`, relevantPatterns: [] };
  }

  try {
    // Strip markdown code fences if Claude wrapped the response
    const cleaned = responseText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as { description?: string; relevantPatterns?: string[] };
    return {
      description: parsed.description ?? `Repository at ${params.url}`,
      relevantPatterns: Array.isArray(parsed.relevantPatterns) ? parsed.relevantPatterns : [],
    };
  } catch {
    return { description: `Repository at ${params.url}`, relevantPatterns: [] };
  }
}

/** Clone and analyze a public git repository. */
export async function analyzeRepo(repoUrl: string): Promise<RepoAnalysis> {
  const hash = crypto.createHash("md5").update(repoUrl).digest("hex").slice(0, 8);
  const tmpDir = path.join("/tmp", "sessionforge-repos", hash);

  try {
    // Ensure clean temp dir
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.mkdir(tmpDir, { recursive: true });

    // Shallow clone with timeout
    const git = simpleGit({ timeout: { block: CLONE_TIMEOUT_MS } });
    await git.clone(repoUrl, tmpDir, ["--depth=1", "--single-branch"]);

    // Extract repo name from URL
    const name = repoUrl.split("/").filter(Boolean).pop()?.replace(/\.git$/, "") ?? repoUrl;

    // Parallel extraction
    const [tree, readme, { techStack, keyFiles }, languages] = await Promise.all([
      buildTree(tmpDir),
      (async () => {
        const readmeCandidates = ["README.md", "readme.md", "README.rst", "README.txt", "README"];
        for (const candidate of readmeCandidates) {
          const content = await tryRead(path.join(tmpDir, candidate), 8_000);
          if (content) return content;
        }
        return "";
      })(),
      readManifests(tmpDir),
      countLanguages(tmpDir),
    ]);

    // Claude summary (within overall timeout budget)
    const { description, relevantPatterns } = await generateRepoSummary({
      url: repoUrl,
      name,
      tree,
      readme,
      languages,
      techStack,
      keyFiles,
    });

    return {
      url: repoUrl,
      name,
      description,
      techStack,
      languages,
      structure: tree,
      readmeContent: readme.slice(0, 8_000),
      keyFiles,
      relevantPatterns,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      url: repoUrl,
      name: repoUrl.split("/").filter(Boolean).pop()?.replace(/\.git$/, "") ?? repoUrl,
      description: `[Repo analysis failed: ${errorMsg}]`,
      techStack: [],
      languages: {},
      structure: "",
      readmeContent: "",
      keyFiles: [],
      relevantPatterns: [],
    };
  } finally {
    // Always clean up temp directory
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

// Enforce total timeout
export async function analyzeRepoWithTimeout(repoUrl: string): Promise<RepoAnalysis> {
  return Promise.race([
    analyzeRepo(repoUrl),
    new Promise<RepoAnalysis>((_, reject) =>
      setTimeout(() => reject(new Error("Repo analysis timed out after 60s")), TOTAL_TIMEOUT_MS)
    ),
  ]).catch((error: unknown) => {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      url: repoUrl,
      name: repoUrl.split("/").filter(Boolean).pop()?.replace(/\.git$/, "") ?? repoUrl,
      description: `[Repo analysis failed: ${errorMsg}]`,
      techStack: [],
      languages: {},
      structure: "",
      readmeContent: "",
      keyFiles: [],
      relevantPatterns: [],
    };
  });
}
