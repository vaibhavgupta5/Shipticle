import type { Article } from "@/lib/types";
import type { PlatformAdapter, PublishResult } from "./types";
import { adminDb } from "@/lib/firebase/admin";
import { getSettings } from "../settings";
import zlib from "zlib";

export const devtoAdapter: PlatformAdapter = {
  id: "devto",
  name: "Dev.to",
  publish: async (article: Article): Promise<PublishResult> => {
    const settings = await getSettings(article.userId);
    const apiKey = settings.DEVTO_API_KEY || process.env.DEVTO_API_KEY;

    if (!apiKey) {
      return { status: "failed", errorMessage: "DEVTO_API_KEY not configured." };
    }

    try {
      const ideaSnap = await adminDb.collection("ideas").doc(article.ideaId).get();
      const title = ideaSnap.exists ? ideaSnap.data()?.title || "Draft Article" : "Draft Article";

      let bodyMarkdown = article.content;

      const mainImageUrl = article.heroImageUrl || `https://placehold.co/1000x420/0f172a/ffffff.png?text=${encodeURIComponent(title)}&font=montserrat`;

      bodyMarkdown = bodyMarkdown.replace(/```mermaid\s*\n([\s\S]*?)\n```/g, (match, p1) => {
        const codeString = p1.trim();
        try {
          const data = Buffer.from(codeString, 'utf8');
          const compressed = zlib.deflateSync(data, { level: 9 });
          const base64 = compressed.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
          return `\n\n![Diagram](https://kroki.io/mermaid/png/${base64})\n\n`;
        } catch (e) {
          console.error("Failed to compress mermaid for dev.to", e);
          return match;
        }
      });

      const res = await fetch("https://dev.to/api/articles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          article: {
            title,
            body_markdown: bodyMarkdown,
            main_image: mainImageUrl,
            published: true,
            tags: article.seoTags 
              ? article.seoTags
                  .map(t => t.toLowerCase().replace(/[^a-z0-9]/g, ""))
                  .filter(t => t.length > 0)
                  .slice(0, 4) 
              : undefined,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { status: "failed", errorMessage: `Dev.to API error: ${res.status} ${errText}` };
      }

      const resText = await res.text();
      let data;
      try {
        data = JSON.parse(resText);
      } catch (e) {
        return {
          status: "failed",
          errorMessage: `Failed to parse JSON response from Dev.to. Status: ${res.status}. Response: ${resText.slice(0, 300)}`,
        };
      }
      return { status: "posted", platformUrl: data.url || "https://dev.to" };
    } catch (err) {
      return { status: "failed", errorMessage: err instanceof Error ? err.message : String(err) };
    }
  },
};
