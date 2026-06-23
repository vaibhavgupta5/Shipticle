import type { Article } from "@/lib/types";
import type { PlatformAdapter, PublishResult } from "./types";
import { adminDb } from "@/lib/firebase/admin";
import { chromium } from "playwright";
import { getSettings, saveSettings } from "../settings";

export const mediumAdapter: PlatformAdapter = {
  id: "medium",
  name: "Medium (Browser Automation)",
  publish: async (article: Article): Promise<PublishResult> => {
    const settings = await getSettings(article.userId);
    const publicationId = process.env.MEDIUM_PUBLICATION_ID;
    const sessionData = settings.MEDIUM_SESSION_DATA;

    const isProduction = process.env.NODE_ENV === "production" || !!process.env.RENDER;
    const isHeadless = isProduction;

    if (isHeadless && !sessionData) {
      return {
        status: "failed",
        errorMessage: "Medium session cookies not found in database. Please publish from your local environment first to authenticate."
      };
    }

    console.log(`Launching Playwright browser (headless: ${isHeadless})...`);
    const browser = await chromium.launch({
      headless: isHeadless,
      args: [
        "--disable-blink-features=AutomationControlled",
      ]
    });
    
    const contextOptions = {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
    };
    
    if (sessionData) {
      try {
        (contextOptions as unknown as {storageState: string}).storageState = JSON.parse(sessionData);
      } catch (e) {
        console.error("Failed to parse Medium session data from database:", e);
      }
    }

    const context = await browser.newContext(contextOptions);

    try {
      const page = await context.newPage();

      if (!isHeadless) {
        await page.addInitScript(() => {
          document.addEventListener("click", (e) => {
            const dot = document.createElement("div");
            dot.style.position = "absolute";
            dot.style.left = `${e.pageX - 10}px`;
            dot.style.top = `${e.pageY - 10}px`;
            dot.style.width = "20px";
            dot.style.height = "20px";
            dot.style.borderRadius = "50%";
            dot.style.backgroundColor = "rgba(255, 0, 0, 0.6)";
            dot.style.border = "2px solid red";
            dot.style.zIndex = "999999";
            dot.style.pointerEvents = "none";
            document.body.appendChild(dot);
            setTimeout(() => dot.remove(), 800);
          }, true);
        });
      }

      console.log("Navigating to Medium story editor...");
      await page.goto("https://medium.com/new-story");

      let isOnEditor = false;
      const timeoutSec = isHeadless ? 25 : 300; // 25s in headless production, 5m locally for login
      
      for (let i = 0; i < timeoutSec / 2; i++) {
        const url = page.url();
        if (url.includes("/new-story") || (url.includes("/p/") && url.includes("/edit"))) {
          isOnEditor = true;
          break;
        }
        await page.waitForTimeout(2000);
      }

      if (!isOnEditor) {
        throw new Error(
          isHeadless
            ? "Session expired or invalid. Please publish locally to refresh your session."
            : "Timeout waiting for user to sign in and load the editor."
        );
      }

      console.log("Editor loaded. Preparing article title and content...");
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

      const titleField = page.locator('h3[data-placeholder="Title"], h3.graf--title, [contenteditable="true"] h3').first();
      await titleField.waitFor({ state: "visible", timeout: 15000 });
      await titleField.focus();
      
      if (!isHeadless) {
        await titleField.evaluate((el: HTMLElement) => {
          el.style.border = "3px solid red";
          el.style.backgroundColor = "yellow";
        });
        await page.waitForTimeout(500);
      }
      
      await titleField.fill(title);

      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);

      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.evaluate((text) => navigator.clipboard.writeText(text), bodyMarkdown);

      const modifier = process.platform === "darwin" ? "Meta" : "Control";
      await page.keyboard.press(`${modifier}+V`);
      console.log("Pasted article content. Waiting for auto-save...");
      await page.waitForTimeout(5000);

      const finalUrl = page.url().replace("/edit", "");

      const newSessionState = await context.storageState();
      await saveSettings(article.userId, {
        MEDIUM_SESSION_DATA: JSON.stringify(newSessionState)
      });

      console.log("Medium Draft created successfully:", finalUrl);

      return {
        status: "posted",
        platformUrl: finalUrl
      };
    } catch (err) {
      console.error("Medium Browser Automation Exception:", err);
      return {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    } finally {
      await browser.close();
    }
  }
};
