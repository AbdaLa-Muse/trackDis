# TradeFlow Supabase Setup — Step by Step

The app code is ready, but it cannot connect to *your* Supabase account until you create a project and add its public configuration/secrets. Follow these steps in order.

## 1) Create a Supabase project

Create a new Supabase project from the Supabase dashboard. Keep the database password private; TradeFlow does not need that password in the browser.

Record your **Project Reference** because the CLI uses it.

## 2) Create the database tables and initial data

In Supabase Dashboard open **SQL Editor**.

Run the complete file:

`supabase/migrations/001_tradeflow.sql`

It creates only:

- `daily_reviews`
- `user_settings`

It also seeds:

- Start Date = `2026-10-22`
- 22 Oct 2026 review = Risk Followed, Strategy Followed, Result Loss

The SQL enables RLS and revokes direct browser access for `anon`/`authenticated` roles. Data is accessed through the secured Edge Function gateway.

## 3) Choose your real 4-digit code

The example `125568` is **not** hard-coded into this package.

Open locally:

`tools/generate-access-hash.html`

Enter the final 4-digit code you want. It generates:

- `TRADEFLOW_ACCESS_SALT`
- `TRADEFLOW_ACCESS_HASH`

The helper runs locally in your browser and does not transmit the raw code.

Keep the actual 4-digit code somewhere safe. The app cannot recover the original code from the hash.

## 4) Create a session-signing secret

Generate a long random value. One option on macOS/Linux/Git Bash is:

```bash
openssl rand -hex 32
```

Save the result as:

`TRADEFLOW_SESSION_SECRET`

Do not place it in `config.js` or any frontend file.

## 5) Set Edge Function secrets

You can set production Edge Function secrets from the Supabase Dashboard's Edge Function Secrets page, or with the Supabase CLI.

Required secrets:

```text
TRADEFLOW_ACCESS_SALT=<generated salt>
TRADEFLOW_ACCESS_HASH=<generated hash>
TRADEFLOW_SESSION_SECRET=<random session secret>
```

Optional after the site is deployed:

```text
TRADEFLOW_ALLOWED_ORIGIN=https://your-real-tradeflow-domain.example
```

During initial local testing you can leave `TRADEFLOW_ALLOWED_ORIGIN` unset. The function will use wildcard CORS. After deployment, setting the exact site origin is cleaner.

Do **not** create a secret name beginning with `SUPABASE_`; those names are reserved by Supabase.

## 6) Deploy the Edge Functions

Install the Supabase CLI, log in, and link your project.

Typical commands:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy tradeflow-auth --no-verify-jwt
supabase functions deploy tradeflow-api --no-verify-jwt
```

This package also includes `supabase/config.toml` with `verify_jwt = false` for both functions because TradeFlow uses its own signed access-code session rather than Supabase email/password Auth.

The functions still require your project's **publishable key** at the gateway and then enforce the TradeFlow session internally.

## 7) Get the browser-safe Supabase values

In Supabase Project Settings/API, copy:

- Project URL
- Publishable key

Never use a **secret** key or `service_role` key in the frontend.

Open `config.js` and replace the placeholders:

```js
window.TRADEFLOW_CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_REPLACE_ME',
  AUTH_FUNCTION: 'tradeflow-auth',
  API_FUNCTION: 'tradeflow-api',
  AUTO_LOCK_MINUTES: 30
}
```

Only the project URL and browser-safe publishable key belong here.

## 8) Test the frontend locally

From the `TradeFlow-Supabase` folder, start a tiny static server.

Python example:

```bash
python -m http.server 8080
```

Then open:

`http://localhost:8080`

You should see the TradeFlow access-code screen.

Test:

1. Wrong code → Incorrect code.
2. Five bad attempts → temporary lockout.
3. Correct code → Dashboard loads.
4. Start Date shows Oct 22, 2026.
5. History contains 22 Oct 2026 as Risk Followed / Strategy Followed / Loss / Perfect Day.
6. Save a new review.
7. Refresh and confirm it is still there.
8. Lock and unlock again.
9. Switch theme, lock/unlock, confirm the theme remains synced.

## 9) Confirm the seed record in Supabase

In Table Editor, `daily_reviews` should contain a row equivalent to:

```text
date: 2026-10-22
risk: followed
strategy: followed
result: loss
```

`user_settings` should contain:

```text
official_start_date: 2026-10-22
theme: dark
```

Do not manually add dashboard statistics. TradeFlow derives them in JavaScript.

## 10) Optional: migrate old browser data

If the old TradeFlow localStorage still exists in that browser:

1. Unlock the Supabase version.
2. Open Settings.
3. Click **Migrate Local Data**.
4. Confirm.

The server uses the date as the unique key, so the seeded 22 Oct 2026 review will not be duplicated.

## Security behavior in this build

- Raw access code is not present in frontend source.
- PBKDF2 code verifier is stored as Edge Function secrets.
- Five failed attempts trigger a 15-minute lockout.
- Successful unlock returns a signed TradeFlow token.
- Token is kept in `sessionStorage`, so browser/session closure normally requires the code again.
- Frontend auto-lock default: 30 minutes inactivity.
- Server-side session token expiry: 8 hours.
- Lock button clears the session immediately.
- Browser does not query `daily_reviews`/`user_settings` directly.
- Secret/service-role key stays server-side in Edge Functions.

## If you change the 4-digit code later

Generate a new salt/hash with `tools/generate-access-hash.html`, then replace the two corresponding Edge Function secrets. No database migration is required.
