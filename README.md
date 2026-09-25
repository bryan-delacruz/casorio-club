# Casorio Club | Plan Your Civil Wedding Together

![Next.js](https://img.shields.io/badge/next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Clerk](https://img.shields.io/badge/clerk-6C47FF?style=for-the-badge&logo=clerk&logoColor=white)
![Neon](https://img.shields.io/badge/neon_postgres-00E599?style=for-the-badge&logo=postgresql&logoColor=black)
![Drizzle](https://img.shields.io/badge/drizzle_orm-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

**Live:** [casorio-club.vercel.app](https://casorio-club.vercel.app)

A shared workspace for couples planning a civil wedding in Peru. Paperwork, to-dos, purchases and expenses live in one place, and both partners (plus anyone they invite) work on the same board.

The UI is in Spanish, for its target users.

## Features

- **Shared wedding space:** each wedding is a Clerk Organization. Invite your partner or family, manage members and switch between weddings.
- **Passwordless sign-in:** email plus a 6-digit code, with a fully localized Clerk UI.
- **Action board:** drag and drop actions between lanes — *idea*, *before*, *the day* and *after* — with `dnd-kit`. A non-drag path exists for keyboard and touch users.
- **One entity for everything:** a paperwork step that costs money *is* an expense. Each action can take time (⏱), cost money (💰), both or neither, so totals never miss an item.
- **Owners and progress:** assign each action to a member and mark it done.

## Architecture decisions

- **Permissions live in Clerk, content lives in Postgres.** Every action stores the Clerk `orgId` as `boda_id`. Every query filters by it, backed by a composite index on `(boda_id, momento, orden)`.
- **Money as `numeric(12, 2)`, never float**, so cents are never lost to floating-point rounding.
- **Server Actions** for create, move, complete and delete, with `revalidatePath` to refresh the board.
- **Route protection per layout** with `auth.protect()`, instead of path matching in middleware, as Clerk recommends.
- **Serverless Postgres** on Neon through `@neondatabase/serverless` and Drizzle ORM, with migrations by `drizzle-kit`.

## Tech stack

| Layer | Tools |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Auth & teams | Clerk (Organizations, localization) |
| Database | Neon Postgres, Drizzle ORM |
| UI | Tailwind CSS v4, shadcn/ui, Radix UI, `dnd-kit`, Sonner |
| Deploy | Vercel |

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and add your Clerk keys and Neon `DATABASE_URL`.

3. Start the dev server:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).
