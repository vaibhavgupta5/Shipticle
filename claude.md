# Claude Code Build Prompts — AI Editorial Pipeline SaaS

How to use this doc: run phases **in order**, one at a time, in Claude Code. After each phase, review the diff/output before pasting the next prompt. Don't skip ahead even if it looks fast — phases 2 and 3 are the riskiest and most worth slowing down on.

Each prompt assumes Claude Code can see the previous phase's code in the repo (it can — same project). You don't need to re-paste context between phases.

Use skills from C:\Users\Vaibhav\.agents\skills while writing code for best practices

---

## Phase 0 — Project audit & plan

Paste this first, even though you already scaffolded with `create-next-app`. Don't let Claude Code start writing files yet. Using Nextjs 16.

```
I'm building a SaaS: a weekly AI editorial pipeline. Here's the product spec:

CORE FLOW:
1. Weekly cron generates 10 unique article ideas via Gemini (techy, software-dev-focused, deduped against all previously generated ideas — never repeat a topic).
2. I approve exactly 1 idea per week.
3. Gemini generates an outline + research links + research prompts for that idea.
4. I review the outline: either approve as-is, or add my own notes/research, which feeds back into Gemini to regenerate the outline. This loop can repeat.
5. Once I approve the outline, Gemini generates the full article using custom prompt templates (stored in DB, editable by me) designed to avoid AI-detectable phrasing and plagiarism. Gemini also returns Mermaid diagram specs as JSON where diagrams would help.
6. The backend renders Mermaid specs into PNG images and places them in the article at the right spots. It also sources/generates a hero image.
7. I review the final article + diagrams, can request regeneration, then approve.
8. The article gets run through an AI-detection check and a plagiarism check before I can do final publish. Scores are shown to me.
9. I select up to 2 platforms (from: Dev.to, Hashnode, Medium-unofficial-via-RapidAPI) and publish. Platforms NOT selected still get the article stored in the DB as "drafted, not posted" for that week, so it's available later.

STACK: Next.js (App Router), Firebase (Auth, Firestore, Storage, Cloud Functions), Tailwind, shadcn/ui, Zustand. Auth = Firebase Google + GitHub providers.

ARCHITECTURE NOTES:
- This is fundamentally a state machine: each `article` document moves through states (idea_pending → idea_approved → outline_pending → outline_approved → draft_generated → content_approved → quality_checked → published). Every state transition is either a user action (button click) or a cron-triggered AI call. Model this explicitly.
- All AI calls (Gemini, AI-detection, plagiarism) must be server-side only — never expose API keys client-side.
- Platform publishing must be built as a pluggable adapter pattern (a `platforms/` registry with a common interface), NOT hardcoded if/else per platform — I may add Ghost or others later.
- Long-running steps (full article + diagram generation) may exceed Vercel's default serverless timeout — flag this if relevant and propose where Firebase Cloud Functions should take over instead of API routes.
- Multi-tenant is NOT needed now (single user, me), but reserve an `orgId` field on relevant documents so this doesn't require a schema migration later.
- The weekly cron trigger will be an external pinger (cron-job.org) hitting a secret-protected Next.js API route — not relying on GitHub Actions' `schedule:` trigger alone, since GH can deprioritize/skip cron on low-activity repos.

I already have these credentials ready to use: Gemini API key, Firebase project (config + service account), RapidAPI key (for the unofficial Medium API), Dev.to API key, Hashnode API token. I'll provide exact env var names when we get to each integration.

I want to build this in phases, reviewing after each one. DO NOT write any code yet. Instead:

1. Look at my current repo state (I ran create-next-app already) — tell me what's there and what's missing for this plan.
2. Propose the Firestore schema in full detail (collections, fields, types, indexes you anticipate needing) based on the state machine above.
3. Propose the article status state machine explicitly — list every status value and what triggers each transition.
4. Flag any part of my plan above that's architecturally risky, ambiguous, or where you'd recommend a different approach, BEFORE we build anything.
5. Give me npm i commands to install missing dep.

Wait for my go-ahead before writing any code.
```

**Why this phase matters:** Claude Code will sometimes start scaffolding immediately if you don't explicitly block it. Forcing a schema + state machine review first catches modeling mistakes before they're baked into 9 phases of code.

---

## Phase 1 — Foundations: Firebase, Auth, project structure

```
Now implement the foundation. Scope for this phase ONLY:

1. Firebase setup: initialize Firebase client SDK + Firebase Admin SDK (for server-side use). Use env vars for all config — create a .env.local.example listing every var name needed (I'll fill in real values myself, don't ask me for keys in chat).
2. Firestore: create the schema we agreed on in Phase 0 as TypeScript types/interfaces in a shared `types/` or `lib/types` directory. Add Firestore security rules matching single-user access for now (only the authenticated owner can read/write their own data), with orgId-scoping structured so it's easy to extend later.
3. Auth: implement Firebase Auth with Google and GitHub providers. Build a simple login page and a protected route wrapper/middleware for the dashboard.
4. Project structure: set up the App Router folder structure for what we'll need across all phases — route groups for (auth), (dashboard), api routes for cron/webhooks. Install and configure shadcn/ui (base components only, don't build UI yet) and Zustand (just the store setup, no state logic yet).
5. Add a basic authenticated dashboard shell page (just a layout with nav, no real content) so we can confirm auth works end-to-end.

Do NOT build any AI integration, cron logic, or platform publishing yet — that's later phases. Do NOT use placeholder/fake data beyond what's needed to verify auth works.

After this phase, tell me exactly what env vars I need to fill in before I can run the app.
```

---

## Phase 2 — Idea generation + dedup (the core loop, build carefully)

```
Phase 2: weekly idea generation via Gemini.

1. Server-side Gemini integration (API route, not client-side). Env var: GEMINI_API_KEY.
2. Build the prompt that generates 10 article ideas: techy, software-dev-focused, can reference recent developments. The prompt MUST include all previously generated idea titles/summaries (pull from Firestore `ideas` collection) as explicit exclusions, instructing Gemini not to repeat or closely overlap with them.
3. Write the generated ideas to the `ideas` collection with status `pending`.
4. Build the manual trigger first: an authenticated API route I can call myself (e.g. POST /api/ideas/generate) to run this on demand — I want to test it manually before wiring up cron.
5. Build a simple UI on the dashboard: list this week's 10 pending ideas as cards, with an "Approve" button on each. Approving one idea sets its status to `approved` and rejects the other 9 (status `rejected`) — only one idea can be approved per week.
6. Add a basic idea history view so I can see all past ideas (approved/rejected/pending) — this is also useful for me to sanity-check the dedup is actually working.

Don't build the cron scheduling yet (that's a later phase) or the outline generation (next phase). Focus on getting the dedup prompt right — show me the actual prompt text you write so I can review/tune it before we move on.
```

---

## Phase 3 — Outline generation with approve/revise loop

```
Phase 3: outline generation for the approved idea, with a human-in-the-loop revision cycle.

1. API route: given an approved idea, call Gemini to generate: an outline (structured sections), a list of research links, and research prompts (questions for me to go investigate). Store on the article document (create the `articles` doc here, linked to the idea, status `outline_pending`).
2. Build the outline review UI: show the generated outline, research links, and research prompts. Two actions:
   - "Approve outline" → status becomes `outline_approved`, locks the outline.
   - "Revise" → I can add free-text notes (my own research findings, corrections, direction changes) in a textarea. Submitting this calls Gemini again, passing in the previous outline + my notes, asking it to regenerate an improved outline. The new outline replaces the old one (or keep a version history if that's easy — your call, tell me which you choose and why). Status stays `outline_pending` and I can loop this as many times as I want.
3. Show me the actual outline-generation and outline-revision prompts before moving on — I want to make sure the revision prompt correctly weights my notes over the original AI-generated content.

Stop here — don't build full article generation yet.
```

---

## Phase 4 — Full article generation with custom prompt templates

```
Phase 4: full article generation from an approved outline.

1. Build a `promptTemplates` collection — I want to store and edit my own custom system prompts here (not hardcoded), specifically aimed at producing writing that doesn't read as AI-generated and avoids plagiarism (no copying source phrasing, proper paraphrasing/synthesis instructions, varied sentence structure, etc.). Build a basic settings UI page where I can view/edit these templates.
2. API route: given an `outline_approved` article, call Gemini using the custom prompt template + the approved outline + research links, generating the full article body (markdown or MDX — pick whichever is easier to render and edit later, tell me which and why).
3. Gemini should ALSO return a structured JSON list of diagram specs where diagrams would clarify the content — each spec should include: placement (which section/after which paragraph), a description of what the diagram should show, and Mermaid syntax. Don't render these yet — just store the raw JSON specs on the article doc. Status becomes `draft_generated`.
4. Build a basic article review UI: render the markdown content, list the pending diagram specs (just show the raw Mermaid code blocks for now, not rendered), and an actions area with "Regenerate" (re-run generation, maybe with my added notes, similar pattern to the outline loop) and "Approve content" (status → `content_approved`).

Show me the actual article-generation prompt before we proceed — this is the one most worth getting right since it directly drives output quality.
```

---

## Phase 5 — Diagram rendering pipeline (isolate and test independently)

```
Phase 5: turn the stored Mermaid diagram specs into actual images placed in the article.

1. Server-side Mermaid rendering: given Mermaid syntax, render to PNG. Use whatever approach is most reliable in a Next.js/Node serverless or Cloud Function environment (e.g. @mermaid-js/mermaid-cli or a headless browser render) — tell me which you're choosing and any deployment implications (e.g. does it need a Cloud Function instead of a Vercel API route due to binary/headless dependencies).
2. Upload rendered PNGs to Firebase Storage, store the resulting URLs back on the article's diagram specs.
3. Insert the diagram images into the article content at the correct placement (based on the placement field from Phase 4's spec) when rendering the article for display — don't mutate the raw markdown permanently, compose it at render time if reasonable (tell me your approach).
4. Also handle the hero image: a simple approach for now is fine (e.g. fetch a relevant stock/free image, or have Gemini suggest a generation prompt for a placeholder — your call, propose an approach and I'll confirm).
5. Update the article review UI from Phase 4 to show the fully rendered article WITH diagrams and hero image in place, replacing the raw-Mermaid-code view.

Build a small standalone test route or script to verify Mermaid → PNG rendering works in isolation before wiring it into the full article flow — this step is the most likely to break in deployment, so let's de-risk it early.
```

---

## Phase 6 — Quality gate: AI-detection + plagiarism check

```
Phase 6: before final publish, run the approved article through quality checks.

1. I'll provide an AI-detection API and a plagiarism-check API (tell me if you have a recommendation for free/cheap options I should evaluate, but don't hardcode a choice without confirming with me first — these services change pricing/availability often).
2. Build a server-side API route that takes a `content_approved` article, runs both checks, and stores the resulting scores/flags on the article document. Status becomes `quality_checked`.
3. Surface both scores clearly in the article review UI (e.g. "AI-detection: 12% likely AI-generated", "Plagiarism: 3% match found, source: X") before I'm allowed to proceed to publish.
4. If scores are bad (you can propose reasonable default thresholds, I'll adjust), don't hard-block me from publishing — just show a clear warning. I want final judgment to stay with me.

Pause here — don't build publishing yet. Ask me which AI-detection/plagiarism APIs to wire up before writing the integration code.
```

---

## Phase 7 — Publishing: Dev.to + Hashnode (build the adapter pattern here)

```
Phase 7: publish the approved, quality-checked article to Dev.to and/or Hashnode.

1. Build a `platforms/` adapter pattern: a common interface (e.g. `publish(article): Promise<{url, status}>`) that each platform implements. This needs to be genuinely pluggable — adding a new platform later should mean writing one new adapter file, not touching shared logic.
2. Implement the Dev.to adapter using their official API (API key auth). Env var: DEVTO_API_KEY.
3. Implement the Hashnode adapter using their official GraphQL API (token auth). Env var: HASHNODE_API_TOKEN.
4. Build the publish UI: on a `quality_checked` article, let me select up to 2 platforms from a checklist (enforce the max-2 limit in the UI). On confirm, call the relevant adapters, store results in a `publications` collection (one doc per platform attempt: article ref, platform, status `posted` or `failed`, platform URL, timestamp, error message if failed).
5. For platforms in my full platform list (Dev.to, Hashnode, Medium) that I did NOT select this week: create `publications` entries with status `stored_unpublished` so the article is recorded as available-but-not-posted there, and I can find it later if I want to publish to that platform retroactively.
6. Update overall article status to `published` once at least one platform publish succeeds.
7. Handle partial failure clearly: if I select 2 platforms and one succeeds and one fails, show me exactly which succeeded/failed, don't roll back the success, and let me retry just the failed one.

Don't build the Medium adapter yet — that's next phase, since it's an unofficial/unstable API and I want to isolate its risk from the two reliable platforms.
```

---

## Phase 8 — Publishing: Medium (unofficial, isolated, non-blocking)

```
Phase 8: add Medium as a third platform adapter, using the unofficial RapidAPI-based Medium API.

Context: this API is unofficial (reverse-engineered, not Medium's own), so it's more likely to break or change without notice than Dev.to/Hashnode. Build accordingly:

1. Implement a Medium adapter following the same `platforms/` interface from Phase 7. Env vars: RAPIDAPI_KEY, plus whatever publication-ID or user-ID config Medium's unofficial API needs (I'll confirm exact endpoint/payload shape with you when we get here, since their docs are inconsistent).
2. Wrap all Medium-specific calls in clear error handling that degrades gracefully — a Medium failure must NEVER block or roll back successful publishes to Dev.to/Hashnode in the same publish action. Treat it as fully independent.
3. In the publish UI, visually label Medium as "Best-effort / unofficial API — may occasionally fail due to upstream changes" so it's clear this isn't the same reliability tier as the other two.
4. Add basic logging/visibility for Medium publish attempts (request/response, even on success) since debugging an unofficial API later will require seeing exactly what was sent.

After this phase, all 3 platforms should be working through the same adapter pattern and publish UI from Phase 7.
```

---

## Phase 9 — Cron automation (wire up the weekly trigger)

```
Phase 9: automate the weekly idea-generation trigger (everything downstream stays manual/human-gated, as designed).

1. Secure the idea-generation endpoint from Phase 2 (POST /api/ideas/generate) with a shared secret header check (e.g. a CRON_SECRET env var compared against an incoming header) so it can't be triggered by randoms hitting the URL.
2. Document (in a README section, not code) the steps to wire up cron-job.org (or similar free external scheduler) to hit this endpoint weekly — I'll set up the actual external cron job myself, just give me the exact URL + header format it needs to send.
3. As a backup trigger, add a GitHub Actions workflow with `schedule:` (weekly) AND `workflow_dispatch:` (manual trigger from GH UI) that calls the same endpoint with the same secret. Note in a code comment that this is a backup, not primary, due to GH's known unreliability deprioritizing cron on low-activity repos.
4. Add basic safeguards: if idea-generation has already run this week (check Firestore for existing `pending`/`approved` ideas with this week's date), don't double-run — return early with a clear log message instead of generating a duplicate batch.

This is the last phase needed for the core v1 loop to run end-to-end without me manually triggering idea generation.
```

---

## Phase 10 — Polish pass: dashboard overview, error states, deploy readiness

```
Phase 10: tie everything together and prep for deployment.

1. Build a proper dashboard home page: current week's status (which gate the active article is at, visually — e.g. a simple step indicator across the 8 states), quick links to the relevant action (review ideas / review outline / review draft / publish), and a small history list of past weeks' published articles with links.
2. Audit error states across all phases: what happens if Gemini fails mid-generation, if Firestore writes fail, if an image fails to upload, etc. Make sure every AI/network call has a visible failure state in the UI (not just a console error) — I should never be staring at a stuck spinner with no explanation.
3. Review Firestore security rules end-to-end now that the full schema exists — confirm nothing is over-permissioned.
4. Confirm which parts of this app need to run as Firebase Cloud Functions vs. Next.js API routes given timeout constraints discussed in earlier phases, and make sure that split is actually implemented correctly, not just planned.
5. Give me a deployment checklist: Vercel (or wherever I'm hosting Next.js) env vars needed, Firebase project settings needed, any Firebase Functions deploy steps, and anything I should double check before this goes live even as a single-user tool.

This is the last phase of v1. Don't add multi-tenant logic, new platforms, or features beyond what's listed above — flag anything you think is missing instead of building it unprompted.
```

---

## Notes for running this well

- **Don't paste the next phase until you've actually used the previous one.** The outline-revision loop (Phase 3) and the article-generation prompt (Phase 4) are where output quality is won or lost — spend real time tuning prompts here before moving on, since later phases build UI/plumbing around whatever these produce.
- **Phase 5 (Mermaid rendering) is the most likely to hit an environment/deployment wall.** If Claude Code proposes a headless-browser-based renderer, ask explicitly whether it'll work in your deployment target (Vercel serverless has constraints on binary dependencies) before accepting it.
- **Medium (Phase 8) will break eventually** — it's unofficial. When it does, that's expected, not a sign something's wrong with the rest of the build.
- If Claude Code ever starts writing code for a future phase while you're still in an earlier one, stop it and redirect — the phases are ordered so each one is reviewable in isolation.