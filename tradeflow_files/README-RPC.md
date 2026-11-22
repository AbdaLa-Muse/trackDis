# TradeFlow — Supabase access-code version

This build keeps the 4-digit access code out of the frontend. The code is stored only as a bcrypt hash in Supabase, and the browser calls `verify_access_code()` to receive `true` or `false`.

## Setup
1. Open Supabase > SQL Editor.
2. Open `SUPABASE-ACCESS-CODE.sql`.
3. Replace `YOUR_6_DIGIT_CODE` with your own four-digit code.
4. Run the SQL once.
5. Use the app normally.

Do not put your real code in `config.js`, `index.html`, or `app.js`.
