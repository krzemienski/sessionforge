import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import os from "os";

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
}

const SKILLS_DIR = join(os.homedir(), ".claude", "skills");

export async function listAvailableSkills(): Promise<SkillInfo[]> {
  if (!existsSync(SKILLS_DIR)) {
    return [];
  }

  try {
    const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
    const skills: SkillInfo[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillFile = join(SKILLS_DIR, entry.name, "SKILL.md");
        if (existsSync(skillFile)) {
          const content = await readFile(skillFile, "utf-8");
          // Extract first line as description
          const firstLine = content.split("\n").find((l) => l.trim()) ?? "";
          skills.push({
            name: entry.name,
            description: firstLine.replace(/^#+\s*/, "").trim(),
            path: join(SKILLS_DIR, entry.name),
          });
        }
      } else if (entry.name.endsWith(".md") || entry.name.endsWith(".ts")) {
        skills.push({
          name: entry.name.replace(/\.(md|ts)$/, ""),
          description: `Skill: ${entry.name}`,
          path: join(SKILLS_DIR, entry.name),
        });
      }
    }

    return skills;
  } catch {
    return [];
  }
}

export async function getSkillByName(name: string): Promise<string | null> {
  if (!existsSync(SKILLS_DIR)) return null;

  const candidates = [
    join(SKILLS_DIR, name, "SKILL.md"),
    join(SKILLS_DIR, `${name}.md`),
    join(SKILLS_DIR, `${name}.ts`),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return readFile(candidate, "utf-8");
    }
  }

  return null;
}

// MCP tool definitions
export const skillLoaderTools = [
  {
    name: "list_available_skills",
    description: "List all available Claude skills in the ~/.claude/skills directory.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_skill_by_name",
    description: "Get the content of a specific skill by name.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Skill name to retrieve" },
      },
      required: ["name"],
    },
  },
];

export async function handleSkillLoaderTool(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "list_available_skills":
      return listAvailableSkills();
    case "get_skill_by_name":
      return getSkillByName(toolInput.name as string);
    default:
      throw new Error(`Unknown skill loader tool: ${toolName}`);
  }
}
