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

      // Hashnode GraphQL mutation
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

      const data = await res.json();
      if (data.errors && data.errors.length > 0) {
        return { status: "failed", errorMessage: `Hashnode GQL error: ${data.errors[0].message}` };
      }

      return { status: "posted", platformUrl: data.data.publishPost.post.url };
    } catch (err) {
      return { status: "failed", errorMessage: err instanceof Error ? err.message : String(err) };
    }
  },
};
