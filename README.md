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
- add plant life cycle property, expected harvest date
- add todays date as context for the AI when starting a chat
- refactor settings. there should be user profile, then plant location settings where users can create new locations and input their settings
- add properties for locations. ie garden bed has soil type, ph level, water frequency, sun amount. that way there can be context for ai chat and maybe they can suggest where to plant new plants or they have context instead of user needing to answer questions. these should be optional incase the user does not know.
