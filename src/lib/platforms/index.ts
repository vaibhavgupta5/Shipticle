import type { PlatformAdapter } from "./types";
import { devtoAdapter } from "./devto";
import { hashnodeAdapter } from "./hashnode";
import { mediumAdapter } from "./medium";

export const platforms: Record<string, PlatformAdapter> = {
  devto: devtoAdapter,
  hashnode: hashnodeAdapter,
  medium: mediumAdapter,
};

export const PLATFORM_IDS = Object.keys(platforms) as Array<"devto" | "hashnode" | "medium">;
