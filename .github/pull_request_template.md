## What and why

<!-- What does this change, and what problem does it solve? Link the issue if there is one. -->

## How to test

<!-- Steps a reviewer can follow. Include screenshots for visual changes, in light and dark mode. -->

## Checklist

- [ ] `npm run typecheck && npm run lint && npm run format:check && npm run test && npm run build` pass
- [ ] Tests added or updated for behavior changes
- [ ] Database or storage changes keep workspace access rules intact, and `supabase/tests/rls.sql` is updated
- [ ] No secrets, `.env` files, or service-role keys committed
