import type { Article } from "@/lib/types";
import type { PlatformAdapter, PublishResult } from "./types";
import { adminDb } from "@/lib/firebase/admin";

import { getSettings } from "../settings";

export const mediumAdapter: PlatformAdapter = {
  id: "medium",
  name: "Medium (Unofficial)",
  publish: async (article: Article): Promise<PublishResult> => {
    const settings = await getSettings(article.userId);
    const rapidApiKey = settings.RAPIDAPI_KEY || process.env.RAPIDAPI_KEY;
    const mediumUserId = settings.MEDIUM_USER_ID || process.env.MEDIUM_USER_ID;

    if (!rapidApiKey || !mediumUserId) {
      return { status: "failed", errorMessage: "RAPIDAPI_KEY or MEDIUM_USER_ID not configured." };
    }

    try {
      const ideaSnap = await adminDb.collection("ideas").doc(article.ideaId).get();
      const title = ideaSnap.exists ? ideaSnap.data()?.title || "Draft Article" : "Draft Article";

      let bodyMarkdown = article.content;
      if (article.heroImageUrl) {
        bodyMarkdown = `![Hero Image](${article.heroImageUrl})\n\n${bodyMarkdown}`;
      }

      if (article.diagramSpecs && article.diagramSpecs.length > 0) {
        bodyMarkdown += "\n\n---\n\n## Diagrams\n";
        for (const spec of article.diagramSpecs) {
          if (spec.svgContent) {
            bodyMarkdown += `\n**${spec.description}** (${spec.placement})\n\n`;
            bodyMarkdown += `<div align="center">\n${spec.svgContent}\n</div>\n`;
          }
        }
      }

      // Unofficial Medium API (via RapidAPI) placeholder structure
      const url = `https://medium2.p.rapidapi.com/user/${mediumUserId}/posts`;
      const payload = {
        title,
        contentFormat: "markdown",
        content: bodyMarkdown,
        publishStatus: "draft", // default to draft for safety
      };

      console.log("[Medium Publish Attempt]", JSON.stringify({ url, payload })); // Requirement: basic logging/visibility

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-RapidAPI-Key": rapidApiKey,
          "X-RapidAPI-Host": "medium2.p.rapidapi.com",
        },
        body: JSON.stringify(payload),
      });

      console.log("[Medium Publish Response Status]", res.status);

      if (!res.ok) {
        const errText = await res.text();
        console.error("[Medium Publish Error]", errText);
        return { status: "failed", errorMessage: `Medium unofficial API error: ${res.status} ${errText}` };
      }

      const data = await res.json();
      console.log("[Medium Publish Success Payload]", data);
      
      // Attempt to extract the URL from the response (depends on exact API spec)
      const platformUrl = data.url || data.data?.url || "https://medium.com/me/stories/drafts";

      return { status: "posted", platformUrl };
    } catch (err) {
      console.error("[Medium Publish Exception]", err);
      return { status: "failed", errorMessage: err instanceof Error ? err.message : String(err) };
    }
  },
};
