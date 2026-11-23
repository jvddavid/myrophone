# Final fix report

Branch: feat/login-empresa

## Changes
1. Names are trimmed and then validated (>= 2 chars, else AppError 400 VALIDATION_ERROR) in `registerAccount` and `createFirstCompany` via new `normalizeName` in `apps/api/src/modules/auth/input-rules.ts`.
2. `registerAccount` catches a Prisma unique violation (`P2002`) on `user.create` and throws the existing EMAIL_IN_USE 409 (`isUniqueViolation` in `input-rules.ts`). Other errors are rethrown untouched, so no database error is printed.
3. `resolveAuthContextFromRequest` loads membership and company list with `Promise.all` for tenant sessions. `listActiveCompanies` now selects only tenant `id`, `slug`, `name`.

## Tests added
- `register.flow.test.ts`: name `"  a "` returns 400 VALIDATION_ERROR and creates no user.
- `input-rules.test.ts`: unit tests for `normalizeName` and the P2002 mapper (`isUniqueViolation`). The real race is not reproduced.

## Commands and output
```
$ bun run --cwd apps/api test -- src/modules/auth/http/register.flow.test.ts src/modules/auth/input-rules.test.ts
 Test Files  2 passed (2)
      Tests  7 passed (7)

$ bun run --cwd apps/api check
$ tsc --noEmit
(no errors)

$ bun run --cwd apps/api test   (full API suite, extra regression run)
 Test Files  11 passed (11)
      Tests  28 passed (28)
```
DB: apps/api/.env (127.0.0.1:5434/myrophone). No fallback on 5432 used.

## Notes
- Slow path: companies are now fetched in parallel with the membership. When the membership turns out to be inactive, the company query result is discarded (one wasted cheap query on a rejected request).
- Deferred minors were not touched. `.env` and `bun.lock` were not committed. Nothing pushed.
