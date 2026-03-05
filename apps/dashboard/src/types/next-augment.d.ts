// Re-export missing Next.js types that are not re-exported from the main "next" module
// These types exist in "next/types" but the index.d.ts only re-exports the default export
export type { NextConfig } from "next/dist/server/config";
export type {
  Metadata,
  MetadataRoute,
  ResolvedMetadata,
  ResolvingMetadata,
  Viewport,
} from "next/dist/lib/metadata/types/metadata-interface";

declare module "next" {
  export type { NextConfig } from "next/dist/server/config";
  export type {
    Metadata,
    MetadataRoute,
    ResolvedMetadata,
    ResolvingMetadata,
    Viewport,
  } from "next/dist/lib/metadata/types/metadata-interface";
}
