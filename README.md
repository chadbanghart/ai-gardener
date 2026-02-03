This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Database (Neon + Drizzle)

1. Create a Neon Postgres database and copy the connection string.
2. Create `.env` with:

```bash
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

3. Generate and apply migrations:

```bash
npm run db:generate
npm run db:push
```

## Using Ollama

- spin up in terminal with ollama run llama3

### ToDos

#### My Garden Page

- Wish Lists for plants you want to add to your garden when the season is right
- ability to see chat while on My Garden page and continue talking with AI while working on other pages.
