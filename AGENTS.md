# Repository Guidelines

## Project Structure & Module Organization

- `src/app/` holds the Next.js App Router pages, layouts, and route handlers (e.g., `src/app/api/`).
- `src/app/components/` holds shared UI components used by App Router pages.
- `src/app/providers.tsx` wires client-side providers (NextAuth `SessionProvider`).
- `src/db/` contains Drizzle ORM schema and database utilities.
- `src/lib/` is shared application logic and helpers.
- `src/types/` is shared TypeScript types.
- `public/` stores static assets served as-is.
- `drizzle/` stores generated SQL migrations.

## Build, Test, and Development Commands

- `npm run dev` starts the Next.js dev server at `http://localhost:3000`.
- `npm run build` creates the production build.
- `npm run start` serves the production build locally.
- `npm run lint` runs ESLint with the Next.js config.
- `npm run db:generate` creates Drizzle migrations from schema changes.
- `npm run db:push` applies migrations to the configured database.

## Coding Style & Naming Conventions

- TypeScript is strict (`strict: true` in `tsconfig.json`).
- ESLint is configured via `eslint.config.mjs` (Next.js core-web-vitals + TypeScript rules).
- Use the `@/*` path alias for imports from `src/` (e.g., `@/lib/foo`).
- Keep component and file names in `PascalCase` for React components and `camelCase` for utilities.

## Testing Guidelines

- No automated test framework is configured yet.
- If adding tests, place them alongside source (e.g., `src/lib/foo.test.ts`) or in a `tests/` directory and document the runner in `package.json`.

## Commit & Pull Request Guidelines

- Prefer short, imperative commit messages (e.g., “Add login form validation”).
- PRs should include a clear description, local verification steps, and screenshots for UI changes.

## Security & Configuration Tips

- Store secrets in `.env` (not committed). Required: `DATABASE_URL` and `NEXTAUTH_SECRET`.
- Run `npm run db:generate` and `npm run db:push` after schema updates.
