import type { Article } from "@/lib/types";
import type { PlatformAdapter, PublishResult } from "./types";
import { adminDb } from "@/lib/firebase/admin";
import { getSettings } from "../settings";

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
      // Fetch idea to get the title
      const ideaSnap = await adminDb.collection("ideas").doc(article.ideaId).get();
      const title = ideaSnap.exists ? ideaSnap.data()?.title || "Draft Article" : "Draft Article";

      let bodyMarkdown = article.content;
      if (article.heroImageUrl) {
        bodyMarkdown = `![Hero Image](${article.heroImageUrl})\n\n${bodyMarkdown}`;
      }

      // Inline diagrams
      if (article.diagramSpecs && article.diagramSpecs.length > 0) {
        bodyMarkdown += "\n\n---\n\n## Diagrams\n";
        for (const spec of article.diagramSpecs) {
          if (spec.svgContent) {
            bodyMarkdown += `\n**${spec.description}** (${spec.placement})\n\n`;
            // Dev.to allows most HTML. We can just insert the SVG string directly,
            // but a safe bet is to wrap it or provide the raw mermaid block.
            bodyMarkdown += `<div align="center">\n${spec.svgContent}\n</div>\n`;
          }
        }
      }

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
            published: false, // set to false so the user can review before making public
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { status: "failed", errorMessage: `Dev.to API error: ${res.status} ${errText}` };
      }

      const data = await res.json();
      return { status: "posted", platformUrl: data.url };
    } catch (err) {
      return { status: "failed", errorMessage: err instanceof Error ? err.message : String(err) };
    }
  },
};
