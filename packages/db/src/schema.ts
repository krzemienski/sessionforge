// Barrel file — re-exports all schema from the split schema/ directory.
// Split per Wave 4b (H3) of the 2026-04-17 review-remediation roadmap.
// Consumers import from "@sessionforge/db" (the package barrel at index.ts)
// which re-exports this file. drizzle.config.ts still points at this file.
export * from "./schema/enums";
export * from "./schema/types";
export * from "./schema/tables";
export * from "./schema/relations";
