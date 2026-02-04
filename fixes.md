# Fixes and Best-Practice Notes

## Findings

- **Data integrity risk (nullable fields treated as required).**
  In `src/db/schema.ts`, the columns `users.email`, `users.passwordHash`, and `chats.userId` are nullable, but the auth and chat code assumes they always exist. Consider adding `.notNull()` or enforcing the constraint at the DB layer to avoid silent bad data.

- **Potential hydration mismatch (time-dependent values during render).**
  Components that call `new Date()` during render (e.g., `src/app/my-garden/page.tsx` and `src/app/my-garden/plants/[id]/page.tsx`) can yield server/client mismatches if timezones differ. Prefer deriving these values after mount or via stable props.

- **Unbounded prompt growth to Ollama.**
  `src/app/api/chat/route.ts` sends the entire chat history on every request. This can become slow or hit model limits. Best practice is to cap history, window recent messages, or summarize older context.

- **Nonstandard route params typing.**
  `src/app/api/chats/[chatId]/route.ts` and `src/app/api/plants/[id]/route.ts` type `params` as a `Promise` and `await` it. This is atypical for App Router handlers and may confuse tooling or future maintainers.

- **Schema drift / unused field.**
  `userProfiles.tempRange` exists in `src/db/schema.ts` but is unused in API/UI. Either wire it into profile handling or remove it to avoid dead schema.
