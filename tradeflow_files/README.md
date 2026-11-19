# TradeFlow — Secure Supabase Edition

This package keeps the existing TradeFlow UI/logic, uses secure Supabase RPC storage, and includes Trading System Training.

## What is included

- `index.html` — existing TradeFlow UI plus secure access-code lock screen.
- `app.js` — dashboard calculations, Supabase sync, lock/session, Daily Review, History, calendar, backup/import.
- `config.js` — your **public** Supabase URL and publishable key.
- `config.example.js` — clean template.
- `supabase/migrations/001_tradeflow.sql` — only two tables: `daily_reviews` and `user_settings`.
- `supabase/functions/tradeflow-auth/` — verifies the 4-digit code server-side and issues a signed TradeFlow session token.
- `supabase/functions/tradeflow-api/` — authenticated gateway for reviews/settings. The browser does not access tables directly.
- `supabase/functions/_shared/security.ts` — PBKDF2 + signed-session helpers.
- `supabase/config.toml` — Edge Function JWT-gateway settings for the custom code flow.
- `tools/generate-access-hash.html` — local helper that converts your chosen 4-digit code into a salt/hash. It does not send the code anywhere.

## Initial official data

The SQL migration creates:

- Official Start Date: **2026-10-22**
- First Daily Review:
  - Risk: `followed`
  - Strategy: `followed`
  - Result: `loss`

The UI derives this as **Perfect Discipline Day + Loss**.

## Security model

There is no email/password screen.

1. User enters the 4-digit code.
2. `tradeflow-auth` verifies a PBKDF2 hash stored only as Edge Function secrets.
3. Five failed attempts trigger a 15-minute temporary lock.
4. A correct code returns a signed TradeFlow session token.
5. Token is stored in `sessionStorage`, so closing the browser normally requires unlocking again.
6. The frontend also auto-locks after 30 minutes of inactivity by default.
7. All review/settings operations go through `tradeflow-api`.
8. `anon`/`authenticated` database grants are revoked. The Edge Function accesses the database server-side.
9. No service-role/secret key or raw access code is present in frontend files.

## Minimal database

`daily_reviews` stores only:

- id
- date
- risk
- strategy
- result
- created_at
- updated_at

`user_settings` stores only:

- fixed official_start_date
- theme
- rate-limit state used by access-code security
- timestamps

Streaks, percentages, Win Rate, calendar colors, summaries, comparison text, etc. are calculated in JavaScript and are **not duplicated in the database**.

## Before the app can connect

You still need to create your own Supabase project and put its public URL/publishable key in `config.js`. You also need to deploy the included SQL and Edge Functions and set the access-code secrets. The step-by-step instructions are in `SETUP-SUPABASE.md`.

## Local migration

The Settings page includes **Migrate Local Data**. It looks for the legacy TradeFlow localStorage keys and merges those reviews into Supabase by date. The official Start Date remains fixed at 22 Oct 2026.

## Backup

Export remains client-side JSON. Import validates the file, then merges records into Supabase by date; it does not create duplicate dates.


## Trading System Training integration

A new independent `Trading System Training` page has been added to the existing TradeFlow navigation. The Dashboard and discipline/performance calculations are unchanged. The training question banks, setup questions, answers, explanations, shuffle behavior, scores and topic breakdown come from the supplied `trading-system-practical-training-with-all-setups-quiz` source. Training uses TradeFlow's existing light/dark theme and stores only the last session locally under `tradeflow_training_last_session_v1`.


## Break Even result

TradeFlow now supports `win`, `loss`, `break_even`, and `no_trade`. Break Even is a real traded day, so Risk and Strategy are required and discipline is calculated normally. Break Even is excluded from Win Rate and is neutral for Win/Loss streaks. For an existing Secure RPC v4 database, run `SUPABASE-BREAK-EVEN-UPDATE.sql`. It updates only the result constraint and review/import RPCs; it does not change your access code or existing data.
