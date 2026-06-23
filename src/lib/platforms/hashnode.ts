import type { Article } from "@/lib/types";
import type { PlatformAdapter, PublishResult } from "./types";
import { adminDb } from "@/lib/firebase/admin";

import { getSettings } from "../settings";

export const hashnodeAdapter: PlatformAdapter = {
  id: "hashnode",
  name: "Hashnode",
  publish: async (article: Article): Promise<PublishResult> => {
    const settings = await getSettings(article.userId);
    const token = settings.HASHNODE_API_TOKEN || process.env.HASHNODE_API_TOKEN;
    const pubId = settings.HASHNODE_PUBLICATION_ID || process.env.HASHNODE_PUBLICATION_ID;

    if (!token || !pubId) {
      return { status: "failed", errorMessage: "HASHNODE_API_TOKEN or HASHNODE_PUBLICATION_ID not configured." };
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

      const query = `
        mutation PublishPost($input: PublishPostInput!) {
          publishPost(input: $input) {
            post {
              url
            }
          }
        }
      `;

      const variables = {
        input: {
          title,
          contentMarkdown: bodyMarkdown,
          publicationId: pubId,
          tags: [],
        },
      };

      const res = await fetch("https://gql.hashnode.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { status: "failed", errorMessage: `Hashnode API error: ${res.status} ${errText}` };
      }

      const contentType = res.headers.get("content-type") || "";
      const resText = await res.text();

      if (contentType.includes("text/html") || resText.trim().startsWith("<!DOCTYPE html>") || resText.trim().startsWith("<html")) {
        if (resText.includes("paid offering") || resText.includes("Pro plan") || resText.includes("moving to a paid")) {
          return {
            status: "failed",
            errorMessage: "Hashnode GraphQL API now requires a paid Pro plan. Please upgrade your Hashnode publication to a Pro plan or verify your API settings.",
          };
        }
        return {
          status: "failed",
          errorMessage: `Hashnode returned HTML instead of JSON. Status: ${res.status}. Response: ${resText.slice(0, 300)}`,
        };
      }

      let data;
      try {
        data = JSON.parse(resText);
      } catch (e) {
        return {
          status: "failed",
          errorMessage: `Failed to parse JSON response from Hashnode. Status: ${res.status}. Response: ${resText.slice(0, 300)}`,
        };
      }

      if (data.errors && data.errors.length > 0) {
        return { status: "failed", errorMessage: `Hashnode GQL error: ${data.errors[0].message}` };
      }

      return { status: "posted", platformUrl: data.data?.publishPost?.post?.url || "https://hashnode.com" };
    } catch (err) {
      return { status: "failed", errorMessage: err instanceof Error ? err.message : String(err) };
    }
  },
};
