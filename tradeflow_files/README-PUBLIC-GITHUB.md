# TradeFlow — Public GitHub Safe RPC Version

This build keeps the Supabase Project URL and publishable key in the frontend, which is expected for a browser app, but it does **not** store the 4-digit access code in frontend files.

Security model:

- 4-digit code is stored in Supabase only as a bcrypt hash.
- `anon` has no direct SELECT/INSERT/UPDATE/DELETE grants on `daily_reviews`, `user_settings`, `app_access`, or `tradeflow_sessions`.
- A correct code returns a random temporary token.
- The browser keeps that temporary token in `sessionStorage`.
- All reads/writes go through controlled `SECURITY DEFINER` RPC functions that first validate the token.
- The token expires after 12 hours; the frontend also auto-locks after inactivity.
- Five incorrect code attempts trigger a 15-minute lockout.

## Setup

1. Open `SUPABASE-SECURE-RPC.sql`.
2. Replace `YOUR_6_DIGIT_CODE` with your own four-digit code.
3. Run the full SQL in Supabase SQL Editor.
4. Upload the frontend files to GitHub/hosting.

Do not put a Supabase secret/service-role key in the repository. This version only needs the public Project URL and publishable key in `config.js`.


## Break Even database update

This build adds `break_even` as a valid result. Before using the updated frontend on an existing Secure RPC v4 database, run `SUPABASE-BREAK-EVEN-UPDATE.sql`. It does not require or change your 4-digit code. Existing Win/Loss/No Trade rows remain unchanged.
