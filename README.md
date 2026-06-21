This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Setting Up Weekly Idea Generation (Cron)

This project automates weekly article idea generation using an external cron service. We recommend using [cron-job.org](https://cron-job.org) or a similar free scheduler.

### Instructions for cron-job.org:
1. Create a free account at cron-job.org.
2. Click **Create Cronjob**.
3. **Title:** Shipticle Weekly Ideas
4. **URL:** \`https://YOUR_DOMAIN.com/api/ideas/generate\`
5. **Execution schedule:** Set it to run weekly (e.g., Every Monday at 08:00 AM).
6. Click on **Advanced > Headers**.
7. Add a new header:
   - **Key:** \`Authorization\`
   - **Value:** \`Bearer YOUR_CRON_SECRET\` (Replace \`YOUR_CRON_SECRET\` with the secret you generated and placed in your \`.env.local\`)
8. Set the **HTTP Method** to \`POST\`.
9. Click **Create**.

**Note:** A backup GitHub Actions workflow is also provided in \`.github/workflows/generate-ideas.yml\`, but GitHub may deprioritize cron tasks on repositories with low activity. The external cron ping is recommended as the primary trigger.
