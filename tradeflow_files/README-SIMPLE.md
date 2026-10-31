# TradeFlow — Simple Supabase Version

This build is configured for the user's TradeFlow Supabase project.

- Project URL is already configured.
- Publishable key is already configured.
- Default simple access code is `125568` (change `ACCESS_CODE` in `config.js` if desired).
- Supabase stores daily reviews and theme/start-date settings.
- Dashboard stats, streaks, percentages, calendar colors, and history classifications are derived in JavaScript.
- Official Start Date: 22 Oct 2026.
- Seed review: 22 Oct 2026 — Risk Followed, Strategy Followed, Result Loss => Perfect Discipline Day.

## One remaining Supabase step

Run `SIMPLE-DIRECT-ACCESS.sql` in the Supabase SQL Editor. This is required because the earlier schema intentionally revoked browser access.

## Security note

This is intentionally the simple personal-app architecture requested by the user. The 6-digit code is a frontend convenience lock and is not strong server-side authentication. Anyone with technical access to the deployed frontend can inspect the code/config. For stronger security later, switch back to server-side authentication/Edge Functions.
