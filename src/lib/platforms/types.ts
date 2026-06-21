import type { Article } from "@/lib/types";

export interface PublishResult {
  status: "posted" | "failed";
  platformUrl?: string;
  errorMessage?: string;
}

export interface PlatformAdapter {
  id: string;
  name: string;
  publish: (article: Article) => Promise<PublishResult>;
}
