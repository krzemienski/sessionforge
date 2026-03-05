export interface BuiltInSkill {
  name: string;
  description: string;
  instructions: string;
  appliesTo: string[];
  source: "builtin";
}

export const TLDR_SUMMARY_SKILL: BuiltInSkill = {
  name: "TL;DR Summary",
  description: "Prepend a short summary before the main content.",
  instructions:
    "Always start with a TL;DR section (2-3 sentences) before the main content.",
  appliesTo: ["all"],
  source: "builtin",
};

export const CODE_HEAVY_TECHNICAL_SKILL: BuiltInSkill = {
  name: "Code-Heavy Technical",
  description: "Annotate every major code block with inline comments.",
  instructions:
    "Include annotated code blocks for every major technical point. Each code block should have inline comments explaining non-obvious lines.",
  appliesTo: ["blog"],
  source: "builtin",
};

export const STORYTELLING_NARRATIVE_SKILL: BuiltInSkill = {
  name: "Storytelling Narrative",
  description: "Frame content as a developer story arc.",
  instructions:
    "Frame the content as a developer story: start with the challenge, build to the discovery, end with the resolution and lessons learned.",
  appliesTo: ["blog", "social"],
  source: "builtin",
};

export const BUILT_IN_SKILLS: BuiltInSkill[] = [
  TLDR_SUMMARY_SKILL,
  CODE_HEAVY_TECHNICAL_SKILL,
  STORYTELLING_NARRATIVE_SKILL,
];
